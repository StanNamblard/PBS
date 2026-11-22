-- =============================================================================
-- BPS — Phase 2 : stockage PRIVÉ des publications et des stories
-- =============================================================================
-- Fichiers : <bucket>/<user id>/<fichier>.jpg
--  * écriture / suppression : uniquement dans son propre dossier
--  * lecture : aucun accès public. Le client demande une URL signée temporaire ;
--    Supabase ne la délivre que si la politique "select" ci-dessous l'autorise,
--    c.-à-d. si l'utilisateur a le droit de voir la publication / la story.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('posts',   'posts',   false, 10 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp']),
  ('stories', 'stories', false, 10 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Peut-on lire ce fichier de publication ?
create or replace function public.can_read_post_file(p_name text)
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
      from public.post_media m
      join public.posts p on p.id = m.post_id
      where m.storage_path = p_name
        and p.moderation = 'approved'
        and public.can_view_content(p.author_id)
    );
$$;

-- Peut-on lire ce fichier de story ? (refusé après expiration, sauf pour l'auteur)
create or replace function public.can_read_story_file(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_name like auth.uid()::text || '/%'
    or exists (
      select 1 from public.stories s
      where s.storage_path = p_name and public.can_view_story(s.id)
    );
$$;

revoke execute on function public.can_read_post_file(text), public.can_read_story_file(text) from public, anon;
grant execute on function public.can_read_post_file(text), public.can_read_story_file(text) to authenticated;

-- Publications
create policy "posts: upload dans mon dossier" on storage.objects for insert to authenticated
  with check (bucket_id = 'posts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "posts: supprimer dans mon dossier" on storage.objects for delete to authenticated
  using (bucket_id = 'posts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "posts: lecture si autorisé" on storage.objects for select to authenticated
  using (bucket_id = 'posts' and public.can_read_post_file(name));

-- Stories
create policy "stories: upload dans mon dossier" on storage.objects for insert to authenticated
  with check (bucket_id = 'stories' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "stories: supprimer dans mon dossier" on storage.objects for delete to authenticated
  using (bucket_id = 'stories' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "stories: lecture si autorisé" on storage.objects for select to authenticated
  using (bucket_id = 'stories' and public.can_read_story_file(name));
