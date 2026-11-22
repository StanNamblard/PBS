-- =============================================================================
-- BPS — Phase 2 : follow, comptes privés, publications, stories, fil d'accueil
-- =============================================================================
-- Rappels :
--  * Pas de recherche : aucune fonction ne permet de trouver un profil par son
--    nom. On accède à un profil par son identifiant (obtenu via un match, un QR
--    code ou une liste d'abonnés). La lecture directe de la table "profiles" est
--    restreinte à soi-même et à ses relations, pour empêcher d'aspirer la liste
--    de tous les utilisateurs.
--  * Toutes les écritures sensibles passent par des fonctions RPC.
--  * Les photos (publications, stories) sont dans des buckets PRIVÉS ; le client
--    obtient une URL signée temporaire seulement s'il a le droit de voir le contenu.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------
create type public.follow_status as enum ('active', 'requested');
create type public.follow_source as enum ('profile', 'match', 'qr');
-- Modération : 'approved' par défaut pour l'instant ; la phase 6 fera passer
-- chaque nouvelle photo par une analyse automatique ('pending' → 'approved').
create type public.moderation_status as enum ('pending', 'approved', 'rejected');

-- -----------------------------------------------------------------------------
-- FOLLOWS
-- -----------------------------------------------------------------------------
create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  status      public.follow_status not null,
  source      public.follow_source not null default 'profile',
  created_at  timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (follower_id, followee_id),
  constraint no_self_follow check (follower_id <> followee_id)
);
create index follows_followee_idx on public.follows (followee_id, status, created_at desc);
create index follows_follower_idx on public.follows (follower_id, status, created_at desc);

-- A suit B (abonnement accepté) ?
create or replace function public.is_following(p_follower uuid, p_followee uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.follows
    where follower_id = p_follower and followee_id = p_followee and status = 'active'
  );
$$;

-- L'utilisateur connecté peut-il voir le CONTENU (posts, stories, listes) de p_author ?
--   * toujours pour soi-même
--   * sinon : l'auteur est actif ET (compte public OU je le suis)
--   * le lecteur doit lui-même être un utilisateur actif
-- (Le blocage s'ajoutera en phase 6.)
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
      and (
        not (select p.is_private from public.profiles p where p.id = p_author)
        or public.is_following(auth.uid(), p_author)
      )
    );
$$;

-- Compteurs d'abonnés / abonnements (seuls les abonnements acceptés comptent)
create or replace function public.tg_follows_counters()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.status = 'active' then
    update public.profiles set followers_count = greatest(followers_count - 1, 0) where id = old.followee_id;
    update public.profiles set following_count = greatest(following_count - 1, 0) where id = old.follower_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.status = 'active' then
    update public.profiles set followers_count = followers_count + 1 where id = new.followee_id;
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
  end if;
  return null;
end;
$$;

create trigger follows_counters
  after insert or update of status or delete on public.follows
  for each row execute function public.tg_follows_counters();

-- Quand un compte privé repasse en public, toutes les demandes en attente
-- sont acceptées automatiquement.
create or replace function public.tg_profile_private_switch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_private and not new.is_private then
    update public.follows
       set status = 'active', accepted_at = now()
     where followee_id = new.id and status = 'requested';
  end if;
  return null;
end;
$$;

create trigger profile_private_switch
  after update of is_private on public.profiles
  for each row execute function public.tg_profile_private_switch();

-- Fonction interne (non exposée) : utilisée par follow_user et, plus tard,
-- par le match de selfies (phase 3) et le QR code (phase 4).
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
  if not public.is_active_user(p_follower) or not public.is_active_user(p_target) then
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

-- RPC : suivre quelqu'un (renvoie 'active' ou 'requested' si compte privé)
create or replace function public.follow_user(p_target uuid)
returns public.follow_status
language sql
volatile
security definer
set search_path = ''
as $$
  select public._follow(auth.uid(), p_target, 'profile');
$$;

-- RPC : ne plus suivre (annule aussi une demande en attente)
create or replace function public.unfollow_user(p_target uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from public.follows where follower_id = auth.uid() and followee_id = p_target;
$$;

-- RPC : accepter / refuser une demande d'abonnement
create or replace function public.respond_follow_request(p_follower uuid, p_accept boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_accept then
    update public.follows set status = 'active', accepted_at = now()
     where follower_id = p_follower and followee_id = auth.uid() and status = 'requested';
  else
    delete from public.follows
     where follower_id = p_follower and followee_id = auth.uid() and status = 'requested';
  end if;
end;
$$;

-- RPC : retirer un abonné
create or replace function public.remove_follower(p_follower uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from public.follows where follower_id = p_follower and followee_id = auth.uid();
$$;

alter table public.follows enable row level security;
revoke all on public.follows from anon, authenticated;
grant select on public.follows to authenticated;
create policy "follows: mes relations" on public.follows for select to authenticated
  using (follower_id = (select auth.uid()) or followee_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- PROFILS : lecture directe limitée à soi + relations (anti-aspiration)
-- -----------------------------------------------------------------------------
drop policy "profiles: lecture des profils actifs" on public.profiles;
create policy "profiles: moi et mes relations" on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (
      public.is_active_user(id)
      and exists (
        select 1 from public.follows f
        where (f.follower_id = (select auth.uid()) and f.followee_id = profiles.id)
           or (f.followee_id = (select auth.uid()) and f.follower_id = profiles.id)
      )
    )
  );

-- RPC : profil d'un utilisateur par son identifiant + relation avec moi
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
  i_follow        public.follow_status,   -- null = je ne suis pas
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
    and (p.id = auth.uid() or public.is_active_user(p.id));
$$;

-- Ligne de liste (abonnés, abonnements, demandes, vues de story)
-- RPC : abonnés d'un utilisateur (si je peux voir son contenu)
create or replace function public.get_followers(p_user_id uuid, p_before timestamptz default null, p_limit integer default 30)
returns table (id uuid, username text, display_name text, avatar_path text, since timestamptz, i_follow public.follow_status)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username::text, p.display_name, p.avatar_path, f.created_at,
         (select m.status from public.follows m where m.follower_id = auth.uid() and m.followee_id = p.id)
  from public.follows f
  join public.profiles p on p.id = f.follower_id
  where f.followee_id = p_user_id
    and f.status = 'active'
    and public.can_view_content(p_user_id)
    and public.is_active_user(p.id)
    and (p_before is null or f.created_at < p_before)
  order by f.created_at desc
  limit least(greatest(p_limit, 1), 50);
$$;

-- RPC : abonnements d'un utilisateur
create or replace function public.get_following(p_user_id uuid, p_before timestamptz default null, p_limit integer default 30)
returns table (id uuid, username text, display_name text, avatar_path text, since timestamptz, i_follow public.follow_status)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username::text, p.display_name, p.avatar_path, f.created_at,
         (select m.status from public.follows m where m.follower_id = auth.uid() and m.followee_id = p.id)
  from public.follows f
  join public.profiles p on p.id = f.followee_id
  where f.follower_id = p_user_id
    and f.status = 'active'
    and public.can_view_content(p_user_id)
    and public.is_active_user(p.id)
    and (p_before is null or f.created_at < p_before)
  order by f.created_at desc
  limit least(greatest(p_limit, 1), 50);
$$;

-- RPC : demandes d'abonnement reçues (compte privé)
create or replace function public.get_follow_requests()
returns table (id uuid, username text, display_name text, avatar_path text, since timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username::text, p.display_name, p.avatar_path, f.created_at
  from public.follows f
  join public.profiles p on p.id = f.follower_id
  where f.followee_id = auth.uid() and f.status = 'requested' and public.is_active_user(p.id)
  order by f.created_at desc
  limit 200;
$$;

-- -----------------------------------------------------------------------------
-- PUBLICATIONS
-- -----------------------------------------------------------------------------
create table public.posts (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.profiles (id) on delete cascade,
  caption    text check (char_length(caption) <= 2200),
  moderation public.moderation_status not null default 'approved',
  created_at timestamptz not null default now()
);
create index posts_author_idx on public.posts (author_id, created_at desc);
create index posts_created_idx on public.posts (created_at desc);

create table public.post_media (
  post_id      uuid not null references public.posts (id) on delete cascade,
  position     smallint not null check (position between 0 and 9),
  storage_path text not null unique,
  width        integer check (width > 0),
  height       integer check (height > 0),
  primary key (post_id, position)
);

-- Compteur de publications
create or replace function public.tg_posts_counter()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set posts_count = posts_count + 1 where id = new.author_id;
  elsif tg_op = 'DELETE' then
    update public.profiles set posts_count = greatest(posts_count - 1, 0) where id = old.author_id;
  end if;
  return null;
end;
$$;

create trigger posts_counter
  after insert or delete on public.posts
  for each row execute function public.tg_posts_counter();

alter table public.posts enable row level security;
alter table public.post_media enable row level security;
revoke all on public.posts, public.post_media from anon, authenticated;
grant select, delete on public.posts to authenticated;
grant select on public.post_media to authenticated;

create policy "posts: visibles si autorisé" on public.posts for select to authenticated
  using (
    author_id = (select auth.uid())
    or (moderation = 'approved' and public.can_view_content(author_id))
  );
create policy "posts: je supprime les miens" on public.posts for delete to authenticated
  using (author_id = (select auth.uid()));

create policy "post_media: visibles avec la publication" on public.post_media for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_media.post_id));

-- Vérifie qu'un fichier a bien été envoyé par l'utilisateur dans son dossier
create or replace function public._owns_uploaded_file(p_bucket text, p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_path like auth.uid()::text || '/%'
     and exists (select 1 from storage.objects o where o.bucket_id = p_bucket and o.name = p_path);
$$;

-- RPC : créer une publication. p_media = [{"path": "...", "width": 1080, "height": 1350}, ...]
create or replace function public.create_post(p_caption text, p_media jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_post uuid;
  v_item jsonb;
  v_pos  integer := 0;
begin
  if not public.is_active_user(v_uid) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(p_media) <> 'array' or jsonb_array_length(p_media) < 1 or jsonb_array_length(p_media) > 10 then
    raise exception 'invalid_media_count' using errcode = '22023';
  end if;
  if p_caption is not null and char_length(p_caption) > 2200 then
    raise exception 'caption_too_long' using errcode = '22023';
  end if;

  insert into public.posts (author_id, caption)
  values (v_uid, nullif(trim(p_caption), ''))
  returning id into v_post;

  for v_item in select * from jsonb_array_elements(p_media) loop
    if not public._owns_uploaded_file('posts', v_item ->> 'path') then
      raise exception 'invalid_media_path' using errcode = '22023';
    end if;
    insert into public.post_media (post_id, position, storage_path, width, height)
    values (v_post, v_pos, v_item ->> 'path', (v_item ->> 'width')::integer, (v_item ->> 'height')::integer);
    v_pos := v_pos + 1;
  end loop;

  return v_post;
end;
$$;

-- Forme commune d'une publication renvoyée au client
-- RPC : fil d'accueil (mes publications + celles des comptes que je suis)
create or replace function public.get_feed(p_before timestamptz default null, p_limit integer default 20)
returns table (
  id uuid, author_id uuid, username text, display_name text, avatar_path text,
  caption text, created_at timestamptz, media jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select po.id, po.author_id, a.username::text, a.display_name, a.avatar_path, po.caption, po.created_at,
         (select jsonb_agg(jsonb_build_object('path', m.storage_path, 'width', m.width, 'height', m.height) order by m.position)
            from public.post_media m where m.post_id = po.id)
  from public.posts po
  join public.profiles a on a.id = po.author_id
  where (po.author_id = auth.uid() or public.is_following(auth.uid(), po.author_id))
    and public.is_active_user(po.author_id)
    and (po.moderation = 'approved' or po.author_id = auth.uid())
    and (p_before is null or po.created_at < p_before)
  order by po.created_at desc
  limit least(greatest(p_limit, 1), 50);
$$;

-- RPC : publications d'un profil (grille)
create or replace function public.get_user_posts(p_user_id uuid, p_before timestamptz default null, p_limit integer default 30)
returns table (
  id uuid, author_id uuid, username text, display_name text, avatar_path text,
  caption text, created_at timestamptz, media jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select po.id, po.author_id, a.username::text, a.display_name, a.avatar_path, po.caption, po.created_at,
         (select jsonb_agg(jsonb_build_object('path', m.storage_path, 'width', m.width, 'height', m.height) order by m.position)
            from public.post_media m where m.post_id = po.id)
  from public.posts po
  join public.profiles a on a.id = po.author_id
  where po.author_id = p_user_id
    and public.can_view_content(p_user_id)
    and (po.moderation = 'approved' or po.author_id = auth.uid())
    and (p_before is null or po.created_at < p_before)
  order by po.created_at desc
  limit least(greatest(p_limit, 1), 60);
$$;

-- RPC : une publication
create or replace function public.get_post(p_post_id uuid)
returns table (
  id uuid, author_id uuid, username text, display_name text, avatar_path text,
  caption text, created_at timestamptz, media jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select po.id, po.author_id, a.username::text, a.display_name, a.avatar_path, po.caption, po.created_at,
         (select jsonb_agg(jsonb_build_object('path', m.storage_path, 'width', m.width, 'height', m.height) order by m.position)
            from public.post_media m where m.post_id = po.id)
  from public.posts po
  join public.profiles a on a.id = po.author_id
  where po.id = p_post_id
    and public.can_view_content(po.author_id)
    and (po.moderation = 'approved' or po.author_id = auth.uid());
$$;

-- -----------------------------------------------------------------------------
-- STORIES (24 h)
-- -----------------------------------------------------------------------------
create table public.stories (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique,
  moderation   public.moderation_status not null default 'approved',
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '24 hours')
);
create index stories_author_idx on public.stories (author_id, expires_at desc);

create table public.story_views (
  story_id  uuid not null references public.stories (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);
create index story_views_viewer_idx on public.story_views (viewer_id);

alter table public.stories enable row level security;
alter table public.story_views enable row level security;
revoke all on public.stories, public.story_views from anon, authenticated;
grant select, delete on public.stories to authenticated;
grant select on public.story_views to authenticated;

-- Une story est visible : par son auteur, ou si elle n'a pas expiré et que
-- je peux voir le contenu de l'auteur.
create or replace function public.can_view_story(p_story_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.stories s
    where s.id = p_story_id
      and (
        s.author_id = auth.uid()
        or (s.expires_at > now() and s.moderation = 'approved' and public.can_view_content(s.author_id))
      )
  );
$$;

create policy "stories: visibles si autorisé" on public.stories for select to authenticated
  using (
    author_id = (select auth.uid())
    or (expires_at > now() and moderation = 'approved' and public.can_view_content(author_id))
  );
create policy "stories: je supprime les miennes" on public.stories for delete to authenticated
  using (author_id = (select auth.uid()));

create policy "story_views: les miennes ou celles de mes stories" on public.story_views for select to authenticated
  using (
    viewer_id = (select auth.uid())
    or exists (select 1 from public.stories s where s.id = story_views.story_id and s.author_id = (select auth.uid()))
  );

-- RPC : publier une story
create or replace function public.create_story(p_path text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_active_user(auth.uid()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not public._owns_uploaded_file('stories', p_path) then
    raise exception 'invalid_media_path' using errcode = '22023';
  end if;
  insert into public.stories (author_id, storage_path) values (auth.uid(), p_path) returning id into v_id;
  return v_id;
end;
$$;

-- RPC : marquer une story comme vue (ignoré pour ses propres stories)
create or replace function public.mark_story_viewed(p_story_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if public.can_view_story(p_story_id)
     and not exists (select 1 from public.stories where id = p_story_id and author_id = auth.uid()) then
    insert into public.story_views (story_id, viewer_id) values (p_story_id, auth.uid())
      on conflict do nothing;
  end if;
end;
$$;

-- RPC : bandeau de stories de l'accueil (moi + comptes suivis ayant une story active)
create or replace function public.get_story_tray()
returns table (author_id uuid, username text, avatar_path text, is_me boolean, latest_at timestamptz, has_unseen boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.username::text, a.avatar_path, a.id = auth.uid(),
         max(s.created_at),
         bool_or(a.id <> auth.uid() and not exists (
           select 1 from public.story_views v where v.story_id = s.id and v.viewer_id = auth.uid()))
  from public.stories s
  join public.profiles a on a.id = s.author_id
  where s.expires_at > now()
    and (s.moderation = 'approved' or s.author_id = auth.uid())
    and (s.author_id = auth.uid() or public.is_following(auth.uid(), s.author_id))
    and public.is_active_user(s.author_id)
  group by a.id, a.username, a.avatar_path
  order by (a.id = auth.uid()) desc,
           bool_or(a.id <> auth.uid() and not exists (
             select 1 from public.story_views v where v.story_id = s.id and v.viewer_id = auth.uid())) desc,
           max(s.created_at) desc;
$$;

-- RPC : stories actives d'un utilisateur (ordre chronologique)
create or replace function public.get_user_stories(p_user_id uuid)
returns table (id uuid, storage_path text, created_at timestamptz, expires_at timestamptz, viewed boolean, view_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.storage_path, s.created_at, s.expires_at,
         exists (select 1 from public.story_views v where v.story_id = s.id and v.viewer_id = auth.uid()),
         case when s.author_id = auth.uid()
              then (select count(*)::integer from public.story_views v where v.story_id = s.id)
         end
  from public.stories s
  where s.author_id = p_user_id
    and s.expires_at > now()
    and public.can_view_story(s.id)
  order by s.created_at asc;
$$;

-- RPC : qui a vu ma story (réservé à l'auteur)
create or replace function public.get_story_viewers(p_story_id uuid)
returns table (id uuid, username text, display_name text, avatar_path text, viewed_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username::text, p.display_name, p.avatar_path, v.viewed_at
  from public.story_views v
  join public.stories s on s.id = v.story_id
  join public.profiles p on p.id = v.viewer_id
  where v.story_id = p_story_id and s.author_id = auth.uid()
  order by v.viewed_at desc;
$$;

-- -----------------------------------------------------------------------------
-- Droits d'exécution
-- -----------------------------------------------------------------------------
revoke execute on function
  public.is_following(uuid, uuid),
  public.can_view_content(uuid),
  public._follow(uuid, uuid, public.follow_source),
  public.follow_user(uuid),
  public.unfollow_user(uuid),
  public.respond_follow_request(uuid, boolean),
  public.remove_follower(uuid),
  public.get_profile(uuid),
  public.get_followers(uuid, timestamptz, integer),
  public.get_following(uuid, timestamptz, integer),
  public.get_follow_requests(),
  public._owns_uploaded_file(text, text),
  public.create_post(text, jsonb),
  public.get_feed(timestamptz, integer),
  public.get_user_posts(uuid, timestamptz, integer),
  public.get_post(uuid),
  public.can_view_story(uuid),
  public.create_story(text),
  public.mark_story_viewed(uuid),
  public.get_story_tray(),
  public.get_user_stories(uuid),
  public.get_story_viewers(uuid)
from public, anon, authenticated;

-- Fonctions appelables par l'app
grant execute on function
  public.follow_user(uuid),
  public.unfollow_user(uuid),
  public.respond_follow_request(uuid, boolean),
  public.remove_follower(uuid),
  public.get_profile(uuid),
  public.get_followers(uuid, timestamptz, integer),
  public.get_following(uuid, timestamptz, integer),
  public.get_follow_requests(),
  public.create_post(text, jsonb),
  public.get_feed(timestamptz, integer),
  public.get_user_posts(uuid, timestamptz, integer),
  public.get_post(uuid),
  public.create_story(text),
  public.mark_story_viewed(uuid),
  public.get_story_tray(),
  public.get_user_stories(uuid),
  public.get_story_viewers(uuid)
to authenticated;

-- Fonctions utilisées DANS les politiques RLS : doivent être exécutables
-- par le rôle "authenticated" (elles ne révèlent qu'un booléen).
grant execute on function
  public.is_following(uuid, uuid),
  public.can_view_content(uuid),
  public.can_view_story(uuid)
to authenticated;
