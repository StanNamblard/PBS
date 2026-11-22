-- Tests pgTAP — Phase 4 : QR code personnel.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

create function pg_temp.login(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;
insert into auth.users (id) values
  ('11000000-0000-0000-0000-000000000011'), ('22000000-0000-0000-0000-000000000022'), ('33000000-0000-0000-0000-000000000033');
set local role authenticated;
select pg_temp.login('11000000-0000-0000-0000-000000000011');
select public.verify_age('1990-01-01'); select public.complete_onboarding('lea', null, null, 'FR', 'fr', 'Europe/Paris', '{fr}', 'v1');
select pg_temp.login('22000000-0000-0000-0000-000000000022');
select public.verify_age('1990-01-01'); select public.complete_onboarding('max', null, null, 'DE', 'en', 'Europe/Berlin', '{en}', 'v1');
select pg_temp.login('33000000-0000-0000-0000-000000000033');
select public.verify_age('1990-01-01'); select public.complete_onboarding('noa', null, null, 'IL', 'en', 'Asia/Jerusalem', '{en}', 'v1');
update public.profiles set is_private = true where id = auth.uid();

-- Léa génère son code
select pg_temp.login('11000000-0000-0000-0000-000000000011');
create temp table t (k text, v text);
grant all on t to authenticated;
insert into t values ('lea1', public.regenerate_qr_token());
select ok((select v from t where k = 'lea1') ~ '^[A-Za-z0-9_-]{22}$', 'jeton de 22 caractères base64url (128 bits)');
select throws_ok($$ select * from public.qr_tokens $$, '42501', null, 'la table des jetons n''est pas lisible');
reset role;
select is((select count(*)::int from public.qr_tokens where token_hash = convert_to((select v from t where k = 'lea1'), 'UTF8')), 0,
  'le jeton n''est PAS stocké en clair');
select is((select count(*)::int from public.qr_tokens where token_hash = extensions.digest(convert_to((select v from t where k = 'lea1'), 'UTF8'), 'sha256')), 1,
  'seule son empreinte SHA-256 est stockée');
set local role authenticated;

-- Max scanne le code de Léa
select pg_temp.login('22000000-0000-0000-0000-000000000022');
select is((select username from public.resolve_qr_token((select v from t where k = 'lea1'))), 'lea', 'scanner le code affiche le profil de Léa');
select is((select i_follow from public.resolve_qr_token((select v from t where k = 'lea1'))), null, 'Max ne la suit pas encore');
select is(public.follow_by_qr((select v from t where k = 'lea1'))::text, 'active', 'Max suit Léa via le QR code');
select is((select source::text from public.follows where follower_id = auth.uid()), 'qr', 'abonnement marqué « qr »');
select is((select follows_me from public.get_profile('11000000-0000-0000-0000-000000000011')), false, 'Léa ne suit pas Max en retour automatiquement');

-- Léa régénère : l'ancien code ne marche plus
select pg_temp.login('11000000-0000-0000-0000-000000000011');
insert into t values ('lea2', public.regenerate_qr_token());
select isnt((select v from t where k = 'lea2'), (select v from t where k = 'lea1'), 'nouveau jeton différent');
select is((select is_me from public.resolve_qr_token((select v from t where k = 'lea2'))), true, 'scanner son propre code : reconnu comme « moi »');
select pg_temp.login('22000000-0000-0000-0000-000000000022');
select throws_ok($$ select * from public.resolve_qr_token((select v from t where k = 'lea1')) $$, 'P0002', 'qr_invalid', 'l''ancien code (révoqué) ne fonctionne plus');
select is((select username from public.resolve_qr_token((select v from t where k = 'lea2'))), 'lea', 'le nouveau code fonctionne');
select throws_ok($$ select * from public.resolve_qr_token('pas-un-jeton') $$, 'P0002', 'qr_invalid', 'texte quelconque refusé');

-- Compte privé : le scan crée une demande
select pg_temp.login('33000000-0000-0000-0000-000000000033');
insert into t values ('noa', public.regenerate_qr_token());
select throws_ok($$ select public.follow_by_qr((select v from t where k = 'noa')) $$, 'P0001', 'cannot_follow_self', 'scanner son propre code : impossible de se suivre');
select pg_temp.login('11000000-0000-0000-0000-000000000011');
select is(public.follow_by_qr((select v from t where k = 'noa'))::text, 'requested', 'compte privé : le scan envoie une demande');

-- Anti force brute : 10 échecs par heure maximum
select pg_temp.login('22000000-0000-0000-0000-000000000022');
reset role;
insert into public.qr_scan_attempts (user_id, success)
select '22000000-0000-0000-0000-000000000022', false from generate_series(1, 10);
set local role authenticated;
select throws_ok($$ select * from public.resolve_qr_token((select v from t where k = 'lea2')) $$, 'P0001', 'rate_limited', 'trop d''essais ratés : bloqué temporairement');

-- Utilisateur non connecté
reset role;
set local role anon;
select throws_ok($$ select public.regenerate_qr_token() $$, '42501', null, 'un visiteur non connecté ne peut rien faire');
reset role;
select is((select count(*)::int from public.qr_tokens where revoked_at is null), 2, 'un seul jeton actif par utilisateur (Léa + Noa)');

select * from finish();
rollback;
