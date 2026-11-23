-- =============================================================================
-- BPS — Phase 6 (correctif) : droits de la clé serveur (service_role)
-- =============================================================================
-- Sur les projets Supabase récents, les nouvelles tables ne sont plus
-- accessibles automatiquement par la clé serveur « service_role » (utilisée
-- par les fonctions moderate-image et purge-media). Symptôme :
--   permission denied for table moderation_results
-- La clé serveur n'est JAMAIS présente dans l'app : seules les fonctions
-- serveur l'utilisent. Les utilisateurs restent limités par la RLS.
-- =============================================================================

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Et pour les tables créées plus tard
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
