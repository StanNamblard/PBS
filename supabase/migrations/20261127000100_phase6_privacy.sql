-- =============================================================================
-- BPS — Phase 6 (2/3) : mise en sourdine, suppression du compte, export RGPD
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Mise en sourdine : masquer les publications et stories de quelqu'un de mon
-- fil sans me désabonner (la personne n'est pas prévenue)
-- -----------------------------------------------------------------------------
create table public.mutes (
  muter_id   uuid not null references public.profiles (id) on delete cascade,
  muted_id   uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter_id, muted_id),
  constraint no_self_mute check (muter_id <> muted_id)
);
alter table public.mutes enable row level security;
revoke all on public.mutes from anon, authenticated;
grant select on public.mutes to authenticated;
create policy "mutes: les miens" on public.mutes for select to authenticated using (muter_id = (select auth.uid()));

create or replace function public.mute_user(p_target uuid)
returns void language sql volatile security definer set search_path = '' as $$
  insert into public.mutes (muter_id, muted_id) select auth.uid(), p_target where p_target <> auth.uid() on conflict do nothing;
$$;
create or replace function public.unmute_user(p_target uuid)
returns void language sql volatile security definer set search_path = '' as $$
  delete from public.mutes where muter_id = auth.uid() and muted_id = p_target;
$$;
create or replace function public._is_muted(p_target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.mutes where muter_id = auth.uid() and muted_id = p_target);
$$;
create or replace function public.is_muted(p_target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public._is_muted(p_target);
$$;

-- Publications : on ajoute le statut de modération (l'auteur voit « en cours de
-- vérification ») et on retire les comptes en sourdine du fil.
-- (Changement de colonnes renvoyées → il faut supprimer puis recréer.)
drop function public.get_feed(timestamptz, integer);
drop function public.get_user_posts(uuid, timestamptz, integer);
drop function public.get_post(uuid);

create function public.get_feed(p_before timestamptz default null, p_limit integer default 20)
returns table (
  id uuid, author_id uuid, username text, display_name text, avatar_path text,
  caption text, created_at timestamptz, media jsonb, moderation public.moderation_status
)
language sql
stable
security definer
set search_path = ''
as $$
  select po.id, po.author_id, a.username::text, a.display_name, a.avatar_path, po.caption, po.created_at,
         (select jsonb_agg(jsonb_build_object('path', m.storage_path, 'width', m.width, 'height', m.height) order by m.position)
            from public.post_media m where m.post_id = po.id),
         po.moderation
  from public.posts po
  join public.profiles a on a.id = po.author_id
  where (po.author_id = auth.uid() or (public.is_following(auth.uid(), po.author_id) and not public._is_muted(po.author_id)))
    and public.is_active_user(po.author_id)
    and (po.moderation = 'approved' or po.author_id = auth.uid())
    and (p_before is null or po.created_at < p_before)
  order by po.created_at desc
  limit least(greatest(p_limit, 1), 50);
$$;

create function public.get_user_posts(p_user_id uuid, p_before timestamptz default null, p_limit integer default 30)
returns table (
  id uuid, author_id uuid, username text, display_name text, avatar_path text,
  caption text, created_at timestamptz, media jsonb, moderation public.moderation_status
)
language sql
stable
security definer
set search_path = ''
as $$
  select po.id, po.author_id, a.username::text, a.display_name, a.avatar_path, po.caption, po.created_at,
         (select jsonb_agg(jsonb_build_object('path', m.storage_path, 'width', m.width, 'height', m.height) order by m.position)
            from public.post_media m where m.post_id = po.id),
         po.moderation
  from public.posts po
  join public.profiles a on a.id = po.author_id
  where po.author_id = p_user_id
    and public.can_view_content(p_user_id)
    and (po.moderation = 'approved' or po.author_id = auth.uid())
    and (p_before is null or po.created_at < p_before)
  order by po.created_at desc
  limit least(greatest(p_limit, 1), 60);
$$;

create function public.get_post(p_post_id uuid)
returns table (
  id uuid, author_id uuid, username text, display_name text, avatar_path text,
  caption text, created_at timestamptz, media jsonb, moderation public.moderation_status
)
language sql
stable
security definer
set search_path = ''
as $$
  select po.id, po.author_id, a.username::text, a.display_name, a.avatar_path, po.caption, po.created_at,
         (select jsonb_agg(jsonb_build_object('path', m.storage_path, 'width', m.width, 'height', m.height) order by m.position)
            from public.post_media m where m.post_id = po.id),
         po.moderation
  from public.posts po
  join public.profiles a on a.id = po.author_id
  where po.id = p_post_id
    and public.can_view_content(po.author_id)
    and (po.moderation = 'approved' or po.author_id = auth.uid());
$$;

revoke execute on function public.get_feed(timestamptz, integer), public.get_user_posts(uuid, timestamptz, integer), public.get_post(uuid) from public, anon;
grant execute on function public.get_feed(timestamptz, integer), public.get_user_posts(uuid, timestamptz, integer), public.get_post(uuid) to authenticated;

-- Bandeau de stories sans les comptes en sourdine
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
    and (s.author_id = auth.uid() or (public.is_following(auth.uid(), s.author_id) and not public._is_muted(s.author_id)))
    and public.is_active_user(s.author_id)
  group by a.id, a.username, a.avatar_path
  order by (a.id = auth.uid()) desc,
           bool_or(a.id <> auth.uid() and not exists (
             select 1 from public.story_views v where v.story_id = s.id and v.viewer_id = auth.uid())) desc,
           max(s.created_at) desc;
$$;

-- -----------------------------------------------------------------------------
-- Statut du compte (écrans « suspendu » / « suppression en cours »)
-- -----------------------------------------------------------------------------
create or replace function public.get_onboarding_state()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_priv public.user_private;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if exists (select 1 from public.age_gate_rejections where user_id = v_uid) then
    return 'underage';
  end if;
  select * into v_priv from public.user_private where user_id = v_uid;
  if not found then
    return 'age_required';
  end if;
  if v_priv.status = 'deleted' then
    return 'deletion_pending';
  end if;
  if v_priv.status <> 'active' then
    return 'suspended';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    return 'profile_required';
  end if;
  return 'complete';
end;
$$;

create or replace function public.get_my_account_status()
returns table (status public.account_status, status_reason text, status_changed_at timestamptz, deletion_scheduled_for timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select status, status_reason, status_changed_at,
         case when status = 'deleted' then deletion_requested_at + interval '30 days' end
  from public.user_private where user_id = auth.uid();
$$;

-- -----------------------------------------------------------------------------
-- Suppression du compte (exigence App Store / Google Play + RGPD)
-- Le compte est désactivé immédiatement (invisible pour tous), puis tout est
-- effacé définitivement après 30 jours par la fonction serveur purge-media.
-- Se reconnecter pendant ces 30 jours permet d'annuler.
-- -----------------------------------------------------------------------------
create or replace function public.request_account_deletion()
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.user_private where user_id = auth.uid()) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  update public.user_private
     set status = 'deleted', deletion_requested_at = now(), status_changed_at = now(), status_reason = null
   where user_id = auth.uid() and status in ('active', 'deleted');
  -- Retire immédiatement un selfie en file d'attente
  update public.selfie_submissions set status = 'cancelled' where user_id = auth.uid() and status = 'pending';
  return now() + interval '30 days';
end;
$$;

create or replace function public.cancel_account_deletion()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.user_private
     set status = 'active', deletion_requested_at = null, status_changed_at = now()
   where user_id = auth.uid() and status = 'deleted';
$$;

-- Comptes à effacer définitivement (appelée par purge-media, clé service_role)
create or replace function public.accounts_to_delete(p_limit integer default 50)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select user_id from public.user_private
  where status = 'deleted' and deletion_requested_at < now() - interval '30 days'
  limit p_limit;
$$;

-- -----------------------------------------------------------------------------
-- Export de mes données (droit d'accès et à la portabilité, RGPD art. 15 et 20)
-- -----------------------------------------------------------------------------
create or replace function public.export_my_data()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'generated_at', now(),
    'account', (select jsonb_build_object('id', u.id, 'email', u.email, 'created_at', u.created_at) from auth.users u where u.id = auth.uid()),
    'profile', (select to_jsonb(p) - 'followers_count' - 'following_count' - 'posts_count' from public.profiles p where p.id = auth.uid()),
    'private', (select to_jsonb(up) from public.user_private up where up.user_id = auth.uid()),
    'following', (select coalesce(jsonb_agg(jsonb_build_object('username', p.username, 'status', f.status, 'source', f.source, 'since', f.created_at)), '[]')
                  from public.follows f join public.profiles p on p.id = f.followee_id where f.follower_id = auth.uid()),
    'followers', (select coalesce(jsonb_agg(jsonb_build_object('username', p.username, 'status', f.status, 'since', f.created_at)), '[]')
                  from public.follows f join public.profiles p on p.id = f.follower_id where f.followee_id = auth.uid()),
    'posts', (select coalesce(jsonb_agg(jsonb_build_object('id', po.id, 'caption', po.caption, 'created_at', po.created_at,
                 'photos', (select jsonb_agg(m.storage_path order by m.position) from public.post_media m where m.post_id = po.id))), '[]')
              from public.posts po where po.author_id = auth.uid()),
    'stories', (select coalesce(jsonb_agg(jsonb_build_object('photo', s.storage_path, 'created_at', s.created_at, 'expires_at', s.expires_at)), '[]')
                from public.stories s where s.author_id = auth.uid()),
    'selfies', (select coalesce(jsonb_agg(jsonb_build_object('created_at', s.created_at, 'status', s.status,
                   'photo', case when s.media_purged_at is null then s.storage_path end,
                   'matched_with', (select p.username from public.matches m join public.profiles p
                                    on p.id = case when m.user_a = auth.uid() then m.user_b else m.user_a end
                                    where m.submission_a = s.id or m.submission_b = s.id))), '[]')
                from public.selfie_submissions s where s.user_id = auth.uid()),
    'conversations', (select coalesce(jsonb_agg(jsonb_build_object(
                        'with', (select p.username from public.profiles p where p.id = case when c.user_low = auth.uid() then c.user_high else c.user_low end),
                        'messages', (select jsonb_agg(jsonb_build_object('from_me', x.sender_id = auth.uid(), 'body', x.body, 'photo', x.media_path, 'at', x.created_at) order by x.created_at)
                                     from public.messages x where x.conversation_id = c.id))), '[]')
                      from public.conversations c where auth.uid() in (c.user_low, c.user_high)),
    'blocked', (select coalesce(jsonb_agg(p.username), '[]') from public.blocks b join public.profiles p on p.id = b.blocked_id where b.blocker_id = auth.uid()),
    'muted', (select coalesce(jsonb_agg(p.username), '[]') from public.mutes m join public.profiles p on p.id = m.muted_id where m.muter_id = auth.uid()),
    'reports_made', (select coalesce(jsonb_agg(jsonb_build_object('reason', r.reason, 'context', r.context, 'created_at', r.created_at, 'status', r.status)), '[]')
                     from public.reports r where r.reporter_id = auth.uid())
  );
$$;

-- -----------------------------------------------------------------------------
-- Droits
-- -----------------------------------------------------------------------------
revoke execute on function
  public.mute_user(uuid), public.unmute_user(uuid), public._is_muted(uuid), public.is_muted(uuid),
  public.get_my_account_status(), public.request_account_deletion(), public.cancel_account_deletion(),
  public.accounts_to_delete(integer), public.export_my_data()
from public, anon, authenticated;

grant execute on function
  public.mute_user(uuid), public.unmute_user(uuid), public.is_muted(uuid),
  public.get_my_account_status(), public.request_account_deletion(), public.cancel_account_deletion(),
  public.export_my_data()
to authenticated;

grant execute on function public.accounts_to_delete(integer) to service_role;
