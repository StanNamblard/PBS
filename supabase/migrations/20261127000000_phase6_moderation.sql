-- =============================================================================
-- BPS — Phase 6 (1/3) : modération des photos, administrateurs, signalements
-- =============================================================================
-- MODÉRATION AUTOMATIQUE
--  * Après chaque envoi de photo, l'app appelle la fonction serveur
--    « moderate-image » qui analyse l'image (Sightengine) et enregistre le
--    verdict dans moderation_results : approved | review | rejected.
--  * Des DÉCLENCHEURS vérifient ce verdict au moment où la photo est utilisée
--    (publication, story, selfie, message, photo de profil) :
--      rejected            → refusé partout
--      review              → publication / story « en attente » (visible par
--                            l'auteur seulement) ; refusé pour selfie, message,
--                            photo de profil
--      pas de verdict      → refusé si la modération est ACTIVÉE (interrupteur
--                            app_config), accepté sinon (avant la configuration)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Réglages de l'app (interrupteurs)
-- -----------------------------------------------------------------------------
create table public.app_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;

-- Modération obligatoire ? (false tant que Sightengine n'est pas configuré)
insert into public.app_config (key, value) values ('moderation_enforced', 'false'::jsonb)
on conflict (key) do nothing;

create or replace function public._config_bool(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (value)::text::boolean from public.app_config where key = p_key), false);
$$;

-- -----------------------------------------------------------------------------
-- Résultats de modération (écrits uniquement par le serveur)
-- -----------------------------------------------------------------------------
create table public.moderation_results (
  bucket     text not null,
  path       text not null,
  -- auth.users (et non profiles) : la photo de profil est analysée avant que le profil existe
  user_id    uuid references auth.users (id) on delete cascade,
  decision   text not null check (decision in ('approved', 'review', 'rejected')),
  reason     text,
  provider   text not null,
  scores     jsonb,
  created_at timestamptz not null default now(),
  primary key (bucket, path)
);
create index moderation_results_review_idx on public.moderation_results (decision, created_at) where decision = 'review';
alter table public.moderation_results enable row level security;
revoke all on public.moderation_results from anon, authenticated;

-- Verdict d'une photo : approved | review | rejected | missing
create or replace function public._moderation_decision(p_bucket text, p_path text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select decision from public.moderation_results where bucket = p_bucket and path = p_path),
    case when public._config_bool('moderation_enforced') then 'missing' else 'approved' end
  );
$$;

-- Refuse si la photo n'est pas strictement approuvée (selfie, message, profil)
create or replace function public._require_approved(p_bucket text, p_path text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v text := public._moderation_decision(p_bucket, p_path);
begin
  if v = 'missing' then
    raise exception 'moderation_required' using errcode = 'P0001';
  elsif v <> 'approved' then
    raise exception 'content_rejected' using errcode = 'P0001';
  end if;
end;
$$;

-- Publications : chaque photo est vérifiée ; un cas douteux met la publication en attente
create or replace function public.tg_post_media_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v text := public._moderation_decision('posts', new.storage_path);
begin
  if v = 'missing' then
    raise exception 'moderation_required' using errcode = 'P0001';
  elsif v = 'rejected' then
    raise exception 'content_rejected' using errcode = 'P0001';
  elsif v = 'review' then
    update public.posts set moderation = 'pending' where id = new.post_id;
  end if;
  return new;
end;
$$;
create trigger post_media_moderation before insert on public.post_media
  for each row execute function public.tg_post_media_moderation();

-- Stories : idem
create or replace function public.tg_story_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v text := public._moderation_decision('stories', new.storage_path);
begin
  if v = 'missing' then
    raise exception 'moderation_required' using errcode = 'P0001';
  elsif v = 'rejected' then
    raise exception 'content_rejected' using errcode = 'P0001';
  elsif v = 'review' then
    new.moderation := 'pending';
  end if;
  return new;
end;
$$;
create trigger story_moderation before insert on public.stories
  for each row execute function public.tg_story_moderation();

-- Selfies : uniquement des photos approuvées (un selfie ne peut pas attendre une revue)
create or replace function public.tg_selfie_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._require_approved('selfies', new.storage_path);
  return new;
end;
$$;
create trigger selfie_moderation before insert on public.selfie_submissions
  for each row execute function public.tg_selfie_moderation();

-- Photos de messages
create or replace function public.tg_message_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.media_path is not null then
    perform public._require_approved('dm', new.media_path);
  end if;
  return new;
end;
$$;
create trigger message_moderation before insert on public.messages
  for each row execute function public.tg_message_moderation();

-- Photo de profil (bucket public : uniquement des photos approuvées)
create or replace function public.tg_avatar_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.avatar_path is not null and (tg_op = 'INSERT' or new.avatar_path is distinct from old.avatar_path) then
    perform public._require_approved('avatars', new.avatar_path);
  end if;
  return new;
end;
$$;
create trigger avatar_moderation before insert or update of avatar_path on public.profiles
  for each row execute function public.tg_avatar_moderation();

-- -----------------------------------------------------------------------------
-- Administrateurs
-- -----------------------------------------------------------------------------
create table public.admins (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function public._require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
end;
$$;

-- Journal des actions de modération (traçabilité, obligation DSA)
create table public.moderation_actions (
  id             uuid primary key default gen_random_uuid(),
  admin_id       uuid references public.profiles (id) on delete set null,   -- null = automatique
  target_user_id uuid references public.profiles (id) on delete set null,
  report_id      uuid references public.reports (id) on delete set null,
  action         text not null,
  note           text,
  created_at     timestamptz not null default now()
);
create index moderation_actions_target_idx on public.moderation_actions (target_user_id, created_at desc);
alter table public.moderation_actions enable row level security;
revoke all on public.moderation_actions from anon, authenticated;

-- Statut du compte : motif communiqué à l'utilisateur (motivation des décisions, DSA)
alter table public.user_private
  add column status_reason text,
  add column status_changed_at timestamptz,
  add column deletion_requested_at timestamptz;

-- Les admins peuvent ouvrir les photos signalées (URLs signées)
create or replace function public.can_read_post_file(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_name like auth.uid()::text || '/%'
    or public.is_admin()
    or exists (
      select 1
      from public.post_media m
      join public.posts p on p.id = m.post_id
      where m.storage_path = p_name
        and p.moderation = 'approved'
        and public.can_view_content(p.author_id)
    );
$$;

create or replace function public.can_read_story_file(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_name like auth.uid()::text || '/%'
    or public.is_admin()
    or exists (
      select 1 from public.stories s
      where s.storage_path = p_name and public.can_view_story(s.id)
    );
$$;

create or replace function public.can_read_selfie_file(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_name like auth.uid()::text || '/%'
    or public.is_admin()
    or exists (
      select 1
      from public.selfie_submissions s
      join public.matches m on m.submission_a = s.id or m.submission_b = s.id
      where s.storage_path = p_name
        and s.user_id <> auth.uid()
        and auth.uid() in (m.user_a, m.user_b)
        and m.unlocked_at is not null
        and now() < m.media_expires_at
        and not public.is_blocked(auth.uid(), s.user_id)
    );
$$;

-- -----------------------------------------------------------------------------
-- Suspension automatique en cas de signalements graves multiples
-- (3 personnes différentes en 24 h pour nudité / mineur / violence,
--  5 personnes différentes en 24 h pour tout motif)
-- -----------------------------------------------------------------------------
create or replace function public.tg_reports_auto_suspend()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_serious integer;
  v_all     integer;
begin
  if new.target_user_id is null then
    return null;
  end if;
  select count(distinct reporter_id) filter (where reason in ('nudity', 'minor', 'violence')),
         count(distinct reporter_id)
    into v_serious, v_all
  from public.reports
  where target_user_id = new.target_user_id and created_at > now() - interval '24 hours' and status = 'open';

  if (v_serious >= 3 or v_all >= 5)
     and exists (select 1 from public.user_private where user_id = new.target_user_id and status = 'active')
     and not exists (select 1 from public.admins where user_id = new.target_user_id) then
    update public.user_private
       set status = 'suspended',
           status_reason = 'Compte suspendu automatiquement suite à plusieurs signalements, en attente de vérification par la modération.',
           status_changed_at = now()
     where user_id = new.target_user_id;
    insert into public.moderation_actions (admin_id, target_user_id, report_id, action, note)
    values (null, new.target_user_id, new.id, 'auto_suspend', format('%s signalements graves / %s au total en 24 h', v_serious, v_all));
  end if;
  return null;
end;
$$;
create trigger reports_auto_suspend after insert on public.reports
  for each row execute function public.tg_reports_auto_suspend();

-- -----------------------------------------------------------------------------
-- Back-office (fonctions réservées aux admins)
-- -----------------------------------------------------------------------------
create or replace function public.am_i_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin();
$$;

-- Photos concernées par un signalement
create or replace function public._report_media(p_context text, p_context_id uuid, p_target uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case p_context
    when 'post' then (
      select coalesce(jsonb_agg(jsonb_build_object('bucket', 'posts', 'path', m.storage_path) order by m.position), '[]'::jsonb)
      from public.post_media m where m.post_id = p_context_id)
    when 'story' then (
      select coalesce(jsonb_agg(jsonb_build_object('bucket', 'stories', 'path', s.storage_path)), '[]'::jsonb)
      from public.stories s where s.id = p_context_id)
    when 'selfie' then (
      select coalesce(jsonb_agg(jsonb_build_object('bucket', 'selfies', 'path', s.storage_path)), '[]'::jsonb)
      from public.matches mt
      join public.selfie_submissions s on s.id in (mt.submission_a, mt.submission_b)
      where mt.id = p_context_id and s.user_id = p_target and s.media_purged_at is null)
    when 'profile' then (
      select coalesce(jsonb_agg(jsonb_build_object('bucket', 'avatars', 'path', p.avatar_path)), '[]'::jsonb)
      from public.profiles p where p.id = p_target and p.avatar_path is not null)
    else '[]'::jsonb
  end;
$$;

create or replace function public.admin_list_reports(p_status text default 'open')
returns table (
  report_id uuid, created_at timestamptz, reason public.report_reason, details text,
  context text, context_id uuid, status text,
  reporter_username text, target_id uuid, target_username text, target_avatar_path text,
  target_status public.account_status, target_open_reports integer, media jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public._require_admin();
  return query
    select r.id, r.created_at, r.reason, r.details, r.context, r.context_id, r.status,
           rp.username::text, t.id, t.username::text, t.avatar_path,
           tp.status,
           (select count(*)::integer from public.reports x where x.target_user_id = r.target_user_id and x.status = 'open'),
           public._report_media(r.context, r.context_id, r.target_user_id)
    from public.reports r
    left join public.profiles rp on rp.id = r.reporter_id
    left join public.profiles t on t.id = r.target_user_id
    left join public.user_private tp on tp.user_id = r.target_user_id
    where (p_status = 'all' or r.status = p_status)
    order by r.created_at desc
    limit 200;
end;
$$;

-- Traiter un signalement : dismiss | remove_content | suspend | ban
-- p_note = motif, montré à l'utilisateur en cas de suspension / bannissement
create or replace function public.admin_resolve_report(p_report uuid, p_action text, p_note text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r public.reports;
begin
  perform public._require_admin();
  if p_action not in ('dismiss', 'remove_content', 'suspend', 'ban') then
    raise exception 'invalid_action' using errcode = '22023';
  end if;
  select * into r from public.reports where id = p_report for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if p_action in ('remove_content', 'suspend', 'ban') then
    -- Retire le contenu signalé
    if r.context = 'post' then
      delete from public.posts where id = r.context_id;
    elsif r.context = 'story' then
      delete from public.stories where id = r.context_id;
    elsif r.context = 'selfie' then
      update public.matches set media_expires_at = now() where id = r.context_id;
    elsif r.context = 'profile' then
      update public.profiles set avatar_path = null, bio = null where id = r.target_user_id;
    end if;
  end if;

  if p_action in ('suspend', 'ban') and r.target_user_id is not null then
    update public.user_private
       set status = case when p_action = 'ban' then 'banned'::public.account_status else 'suspended'::public.account_status end,
           status_reason = coalesce(nullif(trim(p_note), ''), 'Non-respect des règles de la communauté.'),
           status_changed_at = now()
     where user_id = r.target_user_id;
  end if;

  -- Ce signalement (et les autres signalements ouverts du même contenu) sont traités
  update public.reports
     set status = case when p_action = 'dismiss' then 'dismissed' else 'actioned' end
   where id = r.id
      or (status = 'open' and target_user_id = r.target_user_id and context = r.context and context_id is not distinct from r.context_id);

  insert into public.moderation_actions (admin_id, target_user_id, report_id, action, note)
  values (auth.uid(), r.target_user_id, r.id, p_action, p_note);
end;
$$;

-- Changer le statut d'un compte (ex. lever une suspension)
create or replace function public.admin_set_user_status(p_user uuid, p_status public.account_status, p_reason text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public._require_admin();
  update public.user_private
     set status = p_status,
         status_reason = case when p_status = 'active' then null else p_reason end,
         status_changed_at = now()
   where user_id = p_user;
  insert into public.moderation_actions (admin_id, target_user_id, action, note)
  values (auth.uid(), p_user, 'set_status:' || p_status, p_reason);
end;
$$;

-- File « À revoir » : publications et stories mises en attente par la modération automatique
create or replace function public.admin_review_queue()
returns table (kind text, id uuid, author_id uuid, author_username text, created_at timestamptz, caption text, media jsonb, reason text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public._require_admin();
  return query
    select 'post', p.id, p.author_id, a.username::text, p.created_at, p.caption,
           (select jsonb_agg(jsonb_build_object('bucket', 'posts', 'path', m.storage_path) order by m.position) from public.post_media m where m.post_id = p.id),
           (select string_agg(distinct mr.reason, ', ') from public.post_media m join public.moderation_results mr on mr.bucket = 'posts' and mr.path = m.storage_path where m.post_id = p.id)
    from public.posts p join public.profiles a on a.id = p.author_id
    where p.moderation = 'pending'
    union all
    select 'story', s.id, s.author_id, a.username::text, s.created_at, null,
           jsonb_build_array(jsonb_build_object('bucket', 'stories', 'path', s.storage_path)),
           (select mr.reason from public.moderation_results mr where mr.bucket = 'stories' and mr.path = s.storage_path)
    from public.stories s join public.profiles a on a.id = s.author_id
    where s.moderation = 'pending' and s.expires_at > now()
    order by 5 asc
    limit 200;
end;
$$;

-- Valider ou refuser un contenu en attente
create or replace function public.admin_review_content(p_kind text, p_id uuid, p_approve boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_author uuid;
begin
  perform public._require_admin();
  if p_kind = 'post' then
    select author_id into v_author from public.posts where id = p_id;
    if p_approve then update public.posts set moderation = 'approved' where id = p_id;
    else delete from public.posts where id = p_id; end if;
  elsif p_kind = 'story' then
    select author_id into v_author from public.stories where id = p_id;
    if p_approve then update public.stories set moderation = 'approved' where id = p_id;
    else delete from public.stories where id = p_id; end if;
  else
    raise exception 'invalid_kind' using errcode = '22023';
  end if;
  insert into public.moderation_actions (admin_id, target_user_id, action, note)
  values (auth.uid(), v_author, case when p_approve then 'approve_' else 'reject_' end || p_kind, p_id::text);
end;
$$;

-- -----------------------------------------------------------------------------
-- Droits
-- -----------------------------------------------------------------------------
revoke execute on function
  public._config_bool(text),
  public._moderation_decision(text, text),
  public._require_approved(text, text),
  public.is_admin(),
  public._require_admin(),
  public.am_i_admin(),
  public._report_media(text, uuid, uuid),
  public.admin_list_reports(text),
  public.admin_resolve_report(uuid, text, text),
  public.admin_set_user_status(uuid, public.account_status, text),
  public.admin_review_queue(),
  public.admin_review_content(text, uuid, boolean)
from public, anon, authenticated;

grant execute on function
  public.am_i_admin(),
  public.admin_list_reports(text),
  public.admin_resolve_report(uuid, text, text),
  public.admin_set_user_status(uuid, public.account_status, text),
  public.admin_review_queue(),
  public.admin_review_content(text, uuid, boolean),
  -- utilisée dans les politiques de stockage
  public.is_admin()
to authenticated;
