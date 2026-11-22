-- =============================================================================
-- BPS — Phase 3 : stockage PRIVÉ des selfies + verrouillage côté serveur
-- =============================================================================
-- RÈGLE CLÉ : le selfie d'une autre personne n'est lisible (URL signée) QUE si :
--   * il fait partie d'un match dont je suis l'autre participant,
--   * le match est débloqué (les deux selfies ont été envoyés),
--   * et il a moins de 24 h.
-- Un selfie en file d'attente n'est lisible par personne d'autre que son auteur.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('selfies', 'selfies', false, 5 * 1024 * 1024, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

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
    );
$$;

revoke execute on function public.can_read_selfie_file(text) from public, anon;
grant execute on function public.can_read_selfie_file(text) to authenticated;

create policy "selfies: upload dans mon dossier" on storage.objects for insert to authenticated
  with check (bucket_id = 'selfies' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "selfies: supprimer dans mon dossier" on storage.objects for delete to authenticated
  using (bucket_id = 'selfies' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "selfies: lecture seulement après déblocage" on storage.objects for select to authenticated
  using (bucket_id = 'selfies' and public.can_read_selfie_file(name));
