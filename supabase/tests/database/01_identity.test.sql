-- Tests pgTAP — Phase 1 : contrôle d'âge, onboarding, sécurité des profils.
-- Exécutables avec `supabase test db` ou `bash supabase/tests/local/run.sh`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

-- ---------------------------------------------------------------------------
-- Données de test (en tant que superutilisateur)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'adult@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'minor@test.dev'),
  ('33333333-3333-3333-3333-333333333333', 'other@test.dev'),
  ('44444444-4444-4444-4444-444444444444', 'exact18@test.dev'),
  ('55555555-5555-5555-5555-555555555555', 'almost18@test.dev');

-- RLS activée partout
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'RLS active sur profiles');
select ok((select relrowsecurity from pg_class where oid = 'public.user_private'::regclass), 'RLS active sur user_private');
select ok((select relrowsecurity from pg_class where oid = 'public.age_gate_rejections'::regclass), 'RLS active sur age_gate_rejections');

-- ---------------------------------------------------------------------------
-- Contrôle d'âge
-- ---------------------------------------------------------------------------
set local role authenticated;

-- Mineur
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is(public.get_onboarding_state(), 'age_required', 'nouvel utilisateur : âge requis');
select is(public.verify_age((current_date - interval '15 years')::date), false, 'un mineur de 15 ans est refusé');
select is(public.get_onboarding_state(), 'underage', 'le compte mineur est marqué underage');
select throws_ok(
  $$ select public.verify_age(date '1990-01-01') $$,
  'P0001', 'underage_locked', 'un mineur ne peut pas retenter avec une autre date');
select throws_ok(
  $$ select public.complete_onboarding('minorname', null, null, 'FR', 'fr', 'Europe/Paris', '{fr}', 'v1') $$,
  'P0001', 'onboarding_not_allowed', 'un mineur ne peut pas créer de profil');

-- 18 ans pile aujourd'hui → accepté ; 18 ans demain → refusé
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select is(public.verify_age((current_date - interval '18 years')::date), true, '18 ans pile aujourd''hui : accepté');
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select is(public.verify_age((current_date - interval '18 years' + interval '1 day')::date), false, '18 ans demain : refusé');

-- Dates invalides
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select throws_ok($$ select public.verify_age(current_date + 1) $$, '22023', 'invalid_birth_date', 'date future refusée');
select throws_ok($$ select public.verify_age(date '1850-01-01') $$, '22023', 'invalid_birth_date', 'date absurde refusée');

-- Adulte
select is(public.verify_age(date '1995-06-15'), true, 'un adulte est accepté');
select is(public.get_onboarding_state(), 'profile_required', 'adulte : profil requis');
select throws_ok($$ select public.verify_age(date '1980-01-01') $$, 'P0001', 'birth_date_already_set',
  'impossible de ressaisir sa date de naissance');
select throws_ok(
  $$ update public.user_private set birth_date = date '1980-01-01' where user_id = auth.uid() $$,
  '42501', null, 'le client ne peut pas modifier sa date de naissance');
select throws_ok(
  $$ update public.user_private set status = 'active' where user_id = auth.uid() $$,
  '42501', null, 'le client ne peut pas modifier son statut');
select lives_ok(
  $$ update public.user_private set locale = 'en' where user_id = auth.uid() $$,
  'le client peut modifier sa langue');

-- ---------------------------------------------------------------------------
-- Pseudo & création du profil
-- ---------------------------------------------------------------------------
select is(public.is_username_available('ab'), false, 'pseudo trop court refusé');
select is(public.is_username_available('admin'), false, 'pseudo réservé refusé');
select is(public.is_username_available('.alice'), false, 'pseudo commençant par un point refusé');
select is(public.is_username_available('alice_95'), true, 'pseudo valide disponible');
select throws_ok(
  $$ select public.complete_onboarding('alice_95', 'Alice', 'Hello', 'FR', 'fr', 'Mars/Olympus', '{fr}', 'v1') $$,
  '22023', 'invalid_timezone', 'fuseau horaire invalide refusé');
select throws_ok(
  $$ select public.complete_onboarding('alice_95', 'Alice', 'Hello', 'FR', 'fr', 'Europe/Paris', '{fr}', '') $$,
  '22023', 'terms_required', 'CGU obligatoires');
select lives_ok(
  $$ select public.complete_onboarding('Alice_95', 'Alice', 'Hello', 'fr', 'fr', 'Europe/Paris', '{fr,en}', 'v1') $$,
  'onboarding complet pour un adulte');
select is(public.get_onboarding_state(), 'complete', 'onboarding terminé');
select is((select username::text from public.profiles where id = auth.uid()), 'alice_95', 'pseudo stocké en minuscules');

-- ---------------------------------------------------------------------------
-- Sécurité : un autre utilisateur
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select throws_ok(
  $$ select public.complete_onboarding('ALICE_95', null, null, 'US', 'en', 'America/New_York', '{en}', 'v1') $$,
  '23505', 'username_unavailable', 'pseudo déjà pris (insensible à la casse)');
select is((select count(*)::int from public.user_private where user_id = '11111111-1111-1111-1111-111111111111'), 0,
  'impossible de lire les données privées d''un autre');
select is((select count(*)::int from public.profiles where username = 'alice_95'), 1,
  'le profil public d''un utilisateur actif est lisible');
update public.profiles set bio = 'hacked' where id = '11111111-1111-1111-1111-111111111111';
reset role;
select is((select bio from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 'Hello',
  'impossible de modifier le profil d''un autre');

-- Compteurs non modifiables par le client
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select throws_ok(
  $$ update public.profiles set followers_count = 1000000 where id = auth.uid() $$,
  '42501', null, 'impossible de gonfler ses compteurs');

select * from finish();
rollback;
