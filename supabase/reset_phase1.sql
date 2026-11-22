-- =============================================================================
-- REMISE À ZÉRO de la phase 1 — À utiliser UNIQUEMENT si l'installation de la
-- base a échoué à moitié (erreur « already exists » en relançant les scripts).
-- ⚠️ Efface les profils et données créés par l'app. Les comptes (emails) restent.
-- Ensuite, relance les fichiers de supabase/migrations dans l'ordre.
-- =============================================================================
drop policy if exists "avatars: upload dans mon dossier" on storage.objects;
drop policy if exists "avatars: remplacer dans mon dossier" on storage.objects;
drop policy if exists "avatars: supprimer dans mon dossier" on storage.objects;

drop table if exists public.profiles cascade;
drop table if exists public.user_private cascade;
drop table if exists public.age_gate_rejections cascade;
drop table if exists public.age_verifications cascade;

drop function if exists public.complete_onboarding(text, text, text, text, text, text, text[], text, text);
drop function if exists public.is_username_available(text);
drop function if exists public.verify_age(date);
drop function if exists public.get_onboarding_state();
drop function if exists public.is_active_user(uuid);
drop function if exists public.is_reserved_username(text);
drop function if exists public.is_supported_locale(text);
drop function if exists public.tg_user_private_guard();
drop function if exists public.tg_set_updated_at();

drop type if exists public.account_status cascade;
drop type if exists public.age_level cascade;
