-- =============================================================================
-- BPS — Phase 1 : stockage des photos de profil
-- =============================================================================
-- Choix : le bucket "avatars" est en lecture publique avec des noms de fichiers
-- aléatoires (non devinables), car les avatars s'affichent partout dans l'app
-- et une URL signée à chaque affichage empêcherait la mise en cache.
-- TOUS les autres buckets (selfies, posts, stories, DM) seront PRIVÉS et servis
-- par URLs signées à durée limitée (phases 2, 3 et 5).
--
-- Écriture : chaque utilisateur ne peut écrire que dans son propre dossier
--   avatars/<son user id>/<fichier>
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "avatars: upload dans mon dossier"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars: remplacer dans mon dossier"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars: supprimer dans mon dossier"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
