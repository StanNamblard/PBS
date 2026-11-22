-- =============================================================================
-- REMISE À ZÉRO de la base de BPS (toutes phases)
-- =============================================================================
-- À utiliser UNIQUEMENT si l'installation a échoué à moitié (erreur
-- « already exists » en relançant les scripts), puis relancer TOUS les fichiers
-- de supabase/migrations dans l'ordre.
-- ⚠️ Efface TOUTES les données de l'app (profils, publications, stories…).
--    Les comptes (emails) sont conservés. Les photos déjà envoyées restent dans
--    Storage mais ne sont plus reliées à rien.
-- =============================================================================
do $$
declare
  r record;
begin
  -- Politiques de stockage créées par l'app
  for r in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname ~ '^(avatars|posts|stories|selfies|dm):'
  loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;

  -- Tables du schéma public (toutes appartiennent à l'app)
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('drop table if exists public.%I cascade', r.tablename);
  end loop;

  -- Fonctions du schéma public
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e') -- hors extensions
  loop
    execute format('drop function if exists %s cascade', r.sig);
  end loop;

  -- Types énumérés du schéma public
  for r in
    select t.typname from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typtype = 'e'
  loop
    execute format('drop type if exists public.%I cascade', r.typname);
  end loop;
end;
$$;
