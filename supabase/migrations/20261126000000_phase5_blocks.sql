-- =============================================================================
-- BPS — Phase 5 (1/2) : blocage d'utilisateurs
-- =============================================================================
-- Bloquer quelqu'un :
--  * supprime les abonnements dans les deux sens ;
--  * empêche de se voir (profil, publications, stories, listes), de se suivre,
--    de s'écrire, d'être appariés au selfie du jour et de résoudre son QR code ;
--  * masque les selfies d'un échange en cours.
-- La personne bloquée n'est pas prévenue.
-- =============================================================================

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint no_self_block check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;
revoke all on public.blocks from anon, authenticated;
grant select on public.blocks to authenticated;
create policy "blocks: les miens" on public.blocks for select to authenticated
  using (blocker_id = (select auth.uid()));

-- Blocage dans un sens ou dans l'autre ?
create or replace function public.is_blocked(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a)
  );
$$;

-- RPC : bloquer
create or replace function public.block_user(p_target uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_target = auth.uid() then
    raise exception 'cannot_block_self' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles where id = p_target) then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), p_target) on conflict do nothing;
  delete from public.follows
   where (follower_id = auth.uid() and followee_id = p_target)
      or (follower_id = p_target and followee_id = auth.uid());
end;
$$;

-- RPC : débloquer
create or replace function public.unblock_user(p_target uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from public.blocks where blocker_id = auth.uid() and blocked_id = p_target;
$$;

-- RPC : mes comptes bloqués
create or replace function public.get_blocked_users()
returns table (id uuid, username text, display_name text, avatar_path text, since timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username::text, p.display_name, p.avatar_path, b.created_at
  from public.blocks b join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

-- -----------------------------------------------------------------------------
-- Prise en compte du blocage dans les règles existantes
-- -----------------------------------------------------------------------------

-- Contenu (posts, stories, listes) : invisible en cas de blocage
create or replace function public.can_view_content(p_author uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_author = auth.uid()
    or (
      public.is_active_user(auth.uid())
      and public.is_active_user(p_author)
      and not public.is_blocked(auth.uid(), p_author)
      and (
        not (select p.is_private from public.profiles p where p.id = p_author)
        or public.is_following(auth.uid(), p_author)
      )
    );
$$;

-- Profil : introuvable en cas de blocage (dans un sens ou l'autre)
create or replace function public.get_profile(p_user_id uuid)
returns table (
  id              uuid,
  username        text,
  display_name    text,
  bio             text,
  avatar_path     text,
  country_code    text,
  is_private      boolean,
  followers_count integer,
  following_count integer,
  posts_count     integer,
  is_me           boolean,
  i_follow        public.follow_status,
  follows_me      boolean,
  can_view        boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id, p.username::text, p.display_name, p.bio, p.avatar_path, p.country_code::text, p.is_private,
    p.followers_count, p.following_count, p.posts_count,
    p.id = auth.uid(),
    (select f.status from public.follows f where f.follower_id = auth.uid() and f.followee_id = p.id),
    public.is_following(p.id, auth.uid()),
    public.can_view_content(p.id)
  from public.profiles p
  where p.id = p_user_id
    and public.is_active_user(auth.uid())
    and (p.id = auth.uid() or (public.is_active_user(p.id) and not public.is_blocked(auth.uid(), p.id)));
$$;

-- Follow : impossible en cas de blocage (même message que « introuvable »)
create or replace function public._follow(p_follower uuid, p_target uuid, p_source public.follow_source)
returns public.follow_status
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status public.follow_status;
begin
  if p_follower = p_target then
    raise exception 'cannot_follow_self' using errcode = 'P0001';
  end if;
  if not public.is_active_user(p_follower) or not public.is_active_user(p_target)
     or public.is_blocked(p_follower, p_target) then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;

  select status into v_status from public.follows
   where follower_id = p_follower and followee_id = p_target;
  if found then
    return v_status;
  end if;

  v_status := case
    when (select is_private from public.profiles where id = p_target) then 'requested'::public.follow_status
    else 'active'::public.follow_status
  end;

  insert into public.follows (follower_id, followee_id, status, source, accepted_at)
  values (p_follower, p_target, v_status, p_source, case when v_status = 'active' then now() end)
  on conflict (follower_id, followee_id) do nothing;

  return v_status;
end;
$$;

-- Matching : jamais apparier deux personnes dont l'une a bloqué l'autre
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
    and not public.is_blocked(s.user_id, cand.user_id)
    and not exists (
      select 1 from public.match_pairs mp
      where mp.user_low = least(s.user_id, cand.user_id)
        and mp.user_high = greatest(s.user_id, cand.user_id)
        and mp.last_matched_at > now() - cfg.rematch_cooldown
    )
    and (not s.same_language or now() - s.created_at > cfg.language_relax_after or cand.languages && s.languages)
    and (not cand.same_language or now() - cand.created_at > cfg.language_relax_after or cand.languages && s.languages)
  order by
    (cand.country_code is distinct from s.country_code) desc,
    cand.created_at asc
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

-- Échanges de selfies : masqués en cas de blocage
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
  select v.* from public._match_view(p_match_id) v where not public.is_blocked(auth.uid(), v.other_id);
$$;

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
    and not public.is_blocked(auth.uid(), v.other_id)
  order by m.created_at desc
  limit 100;
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

-- QR code : le code d'une personne qui m'a bloqué (ou que j'ai bloquée) est « invalide »
create or replace function public._qr_owner(p_token text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select q.user_id
  from public.qr_tokens q
  where q.token_hash = public._qr_hash(p_token)
    and q.revoked_at is null
    and public.is_active_user(q.user_id)
    and not public.is_blocked(auth.uid(), q.user_id);
$$;

-- is_blocked n'est PAS exposé à l'app (sinon on pourrait tester qui a bloqué qui)
revoke execute on function
  public.is_blocked(uuid, uuid),
  public.block_user(uuid),
  public.unblock_user(uuid),
  public.get_blocked_users()
from public, anon, authenticated;

grant execute on function
  public.block_user(uuid),
  public.unblock_user(uuid),
  public.get_blocked_users()
to authenticated;
