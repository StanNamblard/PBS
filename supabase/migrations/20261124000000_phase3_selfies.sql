-- =============================================================================
-- BPS — Phase 3 : selfie du jour, file d'attente, matching, déblocage mutuel
-- =============================================================================
-- Fonctionnement :
--  1. L'app envoie la photo dans le bucket PRIVÉ "selfies" (dossier de l'utilisateur)
--     puis appelle submit_selfie().
--  2. Le serveur cherche immédiatement un autre selfie en attente (même fenêtre de
--     30 min). S'il en trouve un : création du match, les DEUX photos deviennent
--     visibles pour les DEUX personnes au même instant (unlocked_at).
--     Sinon : le selfie reste en attente ; l'app interroge poll_selfie() toutes
--     les quelques secondes (ce qui relance aussi la recherche).
--  3. Personne ne peut JAMAIS lire le selfie d'un autre hors d'un match débloqué :
--     la politique de lecture du stockage le vérifie côté serveur.
--  4. Les photos sont visibles 24 h après le match, puis inaccessibles et effacées
--     (fonction purge-media).
-- =============================================================================

create type public.submission_status as enum ('pending', 'matched', 'expired', 'cancelled');
create type public.match_decision as enum ('pending', 'follow', 'pass');

-- Réglages du matching (centralisés ici)
create or replace function public.selfie_settings()
returns table (queue_ttl interval, media_ttl interval, rematch_cooldown interval, language_relax_after interval, max_per_hour integer)
language sql
immutable
set search_path = ''
as $$
  select interval '30 minutes', interval '24 hours', interval '30 days', interval '2 minutes', 30;
$$;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
create table public.selfie_submissions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  client_request_id uuid not null,                         -- idempotence (double tap, réseau instable)
  storage_path      text not null unique,
  status            public.submission_status not null default 'pending',
  country_code      char(2),
  languages         text[] not null default '{}',
  same_language     boolean not null default false,       -- préférence « même langue »
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null,
  matched_at        timestamptz,
  media_purged_at   timestamptz,
  unique (user_id, client_request_id)
);
-- File d'attente : seuls les selfies en attente sont indexés
create index selfie_queue_idx on public.selfie_submissions (created_at) where status = 'pending';
-- Un seul selfie en attente à la fois par utilisateur (l'illimité se fait en série)
create unique index one_pending_selfie_per_user on public.selfie_submissions (user_id) where status = 'pending';
create index selfie_user_idx on public.selfie_submissions (user_id, created_at desc);

create table public.matches (
  id               uuid primary key default gen_random_uuid(),
  submission_a     uuid not null unique references public.selfie_submissions (id) on delete cascade,
  submission_b     uuid not null unique references public.selfie_submissions (id) on delete cascade,
  user_a           uuid not null references public.profiles (id) on delete cascade,
  user_b           uuid not null references public.profiles (id) on delete cascade,
  created_at       timestamptz not null default now(),
  unlocked_at      timestamptz,                -- les deux selfies sont visibles à partir de cet instant
  media_expires_at timestamptz,                -- …et jusqu'à cet instant (24 h)
  decision_a       public.match_decision not null default 'pending',
  decision_b       public.match_decision not null default 'pending',
  constraint match_distinct_users check (user_a <> user_b)
);
create index matches_user_a_idx on public.matches (user_a, created_at desc);
create index matches_user_b_idx on public.matches (user_b, created_at desc);

-- Historique compact des paires pour interdire un nouveau match avant 30 jours
create table public.match_pairs (
  user_low        uuid not null references public.profiles (id) on delete cascade,
  user_high       uuid not null references public.profiles (id) on delete cascade,
  last_matched_at timestamptz not null,
  primary key (user_low, user_high),
  constraint pair_order check (user_low < user_high)
);

-- -----------------------------------------------------------------------------
-- Signalements (version minimale ; la phase 6 ajoutera le traitement / back-office)
-- -----------------------------------------------------------------------------
create type public.report_reason as enum ('nudity', 'minor', 'harassment', 'hate', 'violence', 'spam', 'fake', 'other');

create table public.reports (
  id             uuid primary key default gen_random_uuid(),
  reporter_id    uuid references public.profiles (id) on delete set null,
  target_user_id uuid references public.profiles (id) on delete set null,
  context        text not null check (context in ('selfie', 'profile', 'post', 'story', 'message')),
  context_id     uuid,
  reason         public.report_reason not null,
  details        text check (char_length(details) <= 1000),
  status         text not null default 'open' check (status in ('open', 'in_review', 'actioned', 'dismissed')),
  created_at     timestamptz not null default now()
);
create index reports_open_idx on public.reports (status, created_at) where status in ('open', 'in_review');
create index reports_target_idx on public.reports (target_user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- RLS : aucun accès direct en écriture ; lecture de ses propres lignes
-- -----------------------------------------------------------------------------
alter table public.selfie_submissions enable row level security;
alter table public.matches enable row level security;
alter table public.match_pairs enable row level security;
alter table public.reports enable row level security;
revoke all on public.selfie_submissions, public.matches, public.match_pairs, public.reports from anon, authenticated;
grant select on public.selfie_submissions, public.matches to authenticated;

create policy "selfies: les miens" on public.selfie_submissions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "matches: les miens" on public.matches for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));
-- match_pairs et reports : aucun accès client (lecture réservée au serveur / back-office)

-- -----------------------------------------------------------------------------
-- Moteur de matching
-- -----------------------------------------------------------------------------
-- Expire les selfies en attente depuis plus de 30 min (appelé à chaque envoi / interrogation)
create or replace function public._expire_stale_selfies()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.selfie_submissions set status = 'expired'
   where status = 'pending' and expires_at <= now();
$$;

-- Essaie d'apparier un selfie en attente. Renvoie l'id du match ou null.
-- Concurrence : la ligne du selfie est verrouillée, et le candidat est pris avec
-- SKIP LOCKED : deux transactions simultanées ne peuvent jamais prendre le même
-- candidat ; une personne ne peut donc pas être dans deux matchs pour un même selfie.
create or replace function public._try_match(p_submission uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s        public.selfie_submissions;
  c        public.selfie_submissions;
  cfg      record;
  v_match  uuid;
begin
  select * into cfg from public.selfie_settings();

  select * into s from public.selfie_submissions where id = p_submission for update;
  if not found or s.status <> 'pending' or s.expires_at <= now() then
    return null;
  end if;

  select cand.* into c
  from public.selfie_submissions cand
  where cand.status = 'pending'
    and cand.expires_at > now()
    and cand.user_id <> s.user_id
    and public.is_active_user(cand.user_id)
    -- pas de re-match avant 30 jours
    and not exists (
      select 1 from public.match_pairs mp
      where mp.user_low = least(s.user_id, cand.user_id)
        and mp.user_high = greatest(s.user_id, cand.user_id)
        and mp.last_matched_at > now() - cfg.rematch_cooldown
    )
    -- (phase 6 : exclure aussi les utilisateurs bloqués)
    -- préférence « même langue » : respectée pendant 2 min d'attente, puis relâchée
    and (not s.same_language or now() - s.created_at > cfg.language_relax_after or cand.languages && s.languages)
    and (not cand.same_language or now() - cand.created_at > cfg.language_relax_after or cand.languages && s.languages)
  order by
    (cand.country_code is distinct from s.country_code) desc,   -- diversité internationale d'abord
    cand.created_at asc                                          -- puis le plus ancien (équité)
  limit 1
  for update of cand skip locked;

  if not found then
    return null;
  end if;

  insert into public.matches (submission_a, submission_b, user_a, user_b, unlocked_at, media_expires_at)
  values (c.id, s.id, c.user_id, s.user_id, now(), now() + cfg.media_ttl)
  returning id into v_match;

  update public.selfie_submissions set status = 'matched', matched_at = now() where id in (s.id, c.id);

  insert into public.match_pairs (user_low, user_high, last_matched_at)
  values (least(s.user_id, c.user_id), greatest(s.user_id, c.user_id), now())
  on conflict (user_low, user_high) do update set last_matched_at = excluded.last_matched_at;

  return v_match;
end;
$$;

-- État d'un selfie renvoyé à l'app
create or replace function public._selfie_state(p_submission uuid)
returns table (submission_id uuid, status public.submission_status, match_id uuid, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.status,
         (select m.id from public.matches m where m.submission_a = s.id or m.submission_b = s.id),
         s.expires_at
  from public.selfie_submissions s
  where s.id = p_submission;
$$;

-- RPC : envoyer un selfie (déjà uploadé dans selfies/<mon id>/...)
create or replace function public.submit_selfie(p_path text, p_client_request_id uuid)
returns table (submission_id uuid, status public.submission_status, match_id uuid, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_id   uuid;
  cfg    record;
  v_priv public.user_private;
begin
  if not public.is_active_user(v_uid) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into cfg from public.selfie_settings();

  -- Idempotence : même requête renvoyée → même résultat
  select s.id into v_id from public.selfie_submissions s
   where s.user_id = v_uid and s.client_request_id = p_client_request_id;
  if found then
    perform public._try_match(v_id);
    return query select * from public._selfie_state(v_id);
    return;
  end if;

  if not public._owns_uploaded_file('selfies', p_path) then
    raise exception 'invalid_media_path' using errcode = '22023';
  end if;

  perform public._expire_stale_selfies();

  if exists (select 1 from public.selfie_submissions s where s.user_id = v_uid and s.status = 'pending') then
    raise exception 'selfie_already_pending' using errcode = 'P0001';
  end if;

  -- Anti-abus : 30 selfies max par heure
  if (select count(*) from public.selfie_submissions s
       where s.user_id = v_uid and s.created_at > now() - interval '1 hour') >= cfg.max_per_hour then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  select * into v_priv from public.user_private where user_id = v_uid;

  insert into public.selfie_submissions (user_id, client_request_id, storage_path, country_code, languages, same_language, expires_at)
  values (
    v_uid, p_client_request_id, p_path,
    (select country_code from public.profiles where id = v_uid),
    coalesce(v_priv.languages, '{}'),
    coalesce(v_priv.match_same_language, false),
    now() + cfg.queue_ttl
  )
  returning id into v_id;

  perform public._try_match(v_id);
  return query select * from public._selfie_state(v_id);
end;
$$;

-- RPC : où en est mon selfie ? (relance aussi la recherche de match)
create or replace function public.poll_selfie(p_submission_id uuid)
returns table (submission_id uuid, status public.submission_status, match_id uuid, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.selfie_submissions s where s.id = p_submission_id and s.user_id = auth.uid()) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  perform public._expire_stale_selfies();
  perform public._try_match(p_submission_id);
  return query select * from public._selfie_state(p_submission_id);
end;
$$;

-- RPC : mon selfie en attente (pour reprendre l'écran d'attente)
create or replace function public.get_pending_selfie()
returns table (submission_id uuid, status public.submission_status, match_id uuid, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public._expire_stale_selfies();
  return query
    select st.* from public.selfie_submissions s, lateral public._selfie_state(s.id) st
    where s.user_id = auth.uid() and s.status = 'pending'
    limit 1;
end;
$$;

-- RPC : annuler mon selfie en attente
create or replace function public.cancel_selfie(p_submission_id uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.selfie_submissions set status = 'cancelled'
   where id = p_submission_id and user_id = auth.uid() and status = 'pending';
$$;

-- -----------------------------------------------------------------------------
-- Lecture des matchs
-- -----------------------------------------------------------------------------
-- Un match vu par l'utilisateur connecté. Les chemins des photos ne sont fournis
-- que tant que le match est débloqué et non expiré (24 h).
create or replace function public._match_view(p_match_id uuid)
returns table (
  match_id uuid, created_at timestamptz, media_expires_at timestamptz,
  my_selfie_path text, their_selfie_path text,
  other_id uuid, other_username text, other_display_name text, other_avatar_path text,
  other_country_code text, other_bio text,
  my_decision public.match_decision, i_follow public.follow_status, follows_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with m as (
    select mt.*,
           (mt.user_a = auth.uid()) as me_is_a
    from public.matches mt
    where mt.id = p_match_id and auth.uid() in (mt.user_a, mt.user_b)
  )
  select
    m.id, m.created_at, m.media_expires_at,
    case when m.unlocked_at is not null and now() < m.media_expires_at then mine.storage_path end,
    case when m.unlocked_at is not null and now() < m.media_expires_at then theirs.storage_path end,
    o.id, o.username::text, o.display_name, o.avatar_path, o.country_code::text, o.bio,
    case when m.me_is_a then m.decision_a else m.decision_b end,
    (select f.status from public.follows f where f.follower_id = auth.uid() and f.followee_id = o.id),
    public.is_following(o.id, auth.uid())
  from m
  join public.selfie_submissions mine   on mine.id   = case when m.me_is_a then m.submission_a else m.submission_b end
  join public.selfie_submissions theirs on theirs.id = case when m.me_is_a then m.submission_b else m.submission_a end
  join public.profiles o on o.id = theirs.user_id;
$$;

create or replace function public.get_match(p_match_id uuid)
returns table (
  match_id uuid, created_at timestamptz, media_expires_at timestamptz,
  my_selfie_path text, their_selfie_path text,
  other_id uuid, other_username text, other_display_name text, other_avatar_path text,
  other_country_code text, other_bio text,
  my_decision public.match_decision, i_follow public.follow_status, follows_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from public._match_view(p_match_id);
$$;

-- Matchs des dernières 24 h (selfies encore visibles)
create or replace function public.get_recent_matches()
returns table (
  match_id uuid, created_at timestamptz, media_expires_at timestamptz,
  my_selfie_path text, their_selfie_path text,
  other_id uuid, other_username text, other_display_name text, other_avatar_path text,
  other_country_code text, other_bio text,
  my_decision public.match_decision, i_follow public.follow_status, follows_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select v.*
  from public.matches m, lateral public._match_view(m.id) v
  where auth.uid() in (m.user_a, m.user_b)
    and m.media_expires_at > now()
  order by m.created_at desc
  limit 100;
$$;

-- RPC : Follow ou Passer (décisions indépendantes ; une seule décision par match)
create or replace function public.decide_match(p_match_id uuid, p_decision public.match_decision)
returns public.follow_status
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  m       public.matches;
  v_me_a  boolean;
  v_other uuid;
begin
  if p_decision = 'pending' then
    raise exception 'invalid_decision' using errcode = '22023';
  end if;
  select * into m from public.matches where id = p_match_id and auth.uid() in (user_a, user_b) for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  v_me_a := m.user_a = auth.uid();
  v_other := case when v_me_a then m.user_b else m.user_a end;

  if (case when v_me_a then m.decision_a else m.decision_b end) <> 'pending' then
    raise exception 'already_decided' using errcode = 'P0001';
  end if;

  if v_me_a then
    update public.matches set decision_a = p_decision where id = m.id;
  else
    update public.matches set decision_b = p_decision where id = m.id;
  end if;

  if p_decision = 'follow' then
    return public._follow(auth.uid(), v_other, 'match');
  end if;
  return null;
end;
$$;

-- RPC : signaler un utilisateur (20 signalements max par jour et par personne)
create or replace function public.report_user(
  p_target uuid, p_context text, p_context_id uuid, p_reason public.report_reason, p_details text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_active_user(auth.uid()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_target = auth.uid() then
    raise exception 'cannot_report_self' using errcode = 'P0001';
  end if;
  if (select count(*) from public.reports where reporter_id = auth.uid() and created_at > now() - interval '1 day') >= 20 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.reports (reporter_id, target_user_id, context, context_id, reason, details)
  values (auth.uid(), p_target, p_context, p_context_id, p_reason, nullif(trim(p_details), ''));
end;
$$;

-- -----------------------------------------------------------------------------
-- Purge des photos expirées (appelée par la fonction serveur purge-media)
-- -----------------------------------------------------------------------------
create table public.media_purge_log (
  bucket     text not null,
  path       text not null,
  purged_at  timestamptz not null default now(),
  primary key (bucket, path)
);
alter table public.media_purge_log enable row level security;
revoke all on public.media_purge_log from anon, authenticated;

-- Liste des fichiers à effacer : selfies non appariés (expirés/annulés),
-- selfies de matchs de plus de 24 h, stories expirées.
create or replace function public.media_to_purge(p_limit integer default 500)
returns table (bucket text, path text)
language sql
stable
security definer
set search_path = ''
as $$
  (
    select 'selfies', s.storage_path
    from public.selfie_submissions s
    where s.media_purged_at is null
      and (
        s.status in ('expired', 'cancelled')
        or (s.status = 'matched' and exists (
              select 1 from public.matches m
              where (m.submission_a = s.id or m.submission_b = s.id) and m.media_expires_at <= now()))
      )
    limit p_limit
  )
  union all
  (
    select 'stories', st.storage_path
    from public.stories st
    where st.expires_at <= now()
    limit p_limit
  );
$$;

-- Marque les fichiers comme effacés (selfies) / supprime les stories expirées
create or replace function public.mark_media_purged(p_bucket text, p_paths text[])
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_bucket = 'selfies' then
    update public.selfie_submissions set media_purged_at = now() where storage_path = any (p_paths);
  elsif p_bucket = 'stories' then
    delete from public.stories where storage_path = any (p_paths) and expires_at <= now();
  end if;
  insert into public.media_purge_log (bucket, path)
  select p_bucket, unnest(p_paths) on conflict do nothing;
end;
$$;

-- -----------------------------------------------------------------------------
-- Droits d'exécution
-- -----------------------------------------------------------------------------
revoke execute on function
  public.selfie_settings(),
  public._expire_stale_selfies(),
  public._try_match(uuid),
  public._selfie_state(uuid),
  public.submit_selfie(text, uuid),
  public.poll_selfie(uuid),
  public.get_pending_selfie(),
  public.cancel_selfie(uuid),
  public._match_view(uuid),
  public.get_match(uuid),
  public.get_recent_matches(),
  public.decide_match(uuid, public.match_decision),
  public.report_user(uuid, text, uuid, public.report_reason, text),
  public.media_to_purge(integer),
  public.mark_media_purged(text, text[])
from public, anon, authenticated;

grant execute on function
  public.submit_selfie(text, uuid),
  public.poll_selfie(uuid),
  public.get_pending_selfie(),
  public.cancel_selfie(uuid),
  public.get_match(uuid),
  public.get_recent_matches(),
  public.decide_match(uuid, public.match_decision),
  public.report_user(uuid, text, uuid, public.report_reason, text)
to authenticated;

-- Purge : réservée au serveur (clé service_role)
grant execute on function public.media_to_purge(integer), public.mark_media_purged(text, text[]) to service_role;
