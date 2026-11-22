-- Tests pgTAP — Phase 3 : selfie du jour, matching, déblocage mutuel côté serveur.
begin;
create extension if not exists pgtap with schema extensions;
select plan(45);

create function pg_temp.login(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.onboard(p_uid uuid, p_name text, p_country text) returns void language plpgsql as $$
begin
  perform pg_temp.login(p_uid);
  perform public.verify_age('1990-01-01');
  perform public.complete_onboarding(p_name, null, null, p_country, 'en', 'UTC', '{en}', 'v1');
end $$;
-- Dépose un faux fichier de selfie (en tant que serveur) et renvoie son chemin
create function pg_temp.upload(p_uid uuid, p_name text) returns text language plpgsql as $$
begin
  insert into storage.objects (bucket_id, name) values ('selfies', p_uid || '/' || p_name);
  return p_uid || '/' || p_name;
end $$;

insert into auth.users (id, email) values
  ('a1000000-0000-0000-0000-000000000001', 'ana@t.dev'),   -- FR
  ('b2000000-0000-0000-0000-000000000002', 'ben@t.dev'),   -- US
  ('c3000000-0000-0000-0000-000000000003', 'chen@t.dev'),  -- CN
  ('d4000000-0000-0000-0000-000000000004', 'dia@t.dev'),   -- FR
  ('e5000000-0000-0000-0000-000000000005', 'eli@t.dev'),   -- BR
  ('f6000000-0000-0000-0000-000000000006', 'fay@t.dev');   -- FR
set local role authenticated;
select pg_temp.onboard('a1000000-0000-0000-0000-000000000001', 'ana', 'FR');
select pg_temp.onboard('b2000000-0000-0000-0000-000000000002', 'ben', 'US');
select pg_temp.onboard('c3000000-0000-0000-0000-000000000003', 'chen', 'CN');
select pg_temp.onboard('d4000000-0000-0000-0000-000000000004', 'dia', 'FR');
select pg_temp.onboard('e5000000-0000-0000-0000-000000000005', 'eli', 'BR');
select pg_temp.onboard('f6000000-0000-0000-0000-000000000006', 'fay', 'FR');
reset role;
select pg_temp.upload('a1000000-0000-0000-0000-000000000001', 'a1.jpg');
select pg_temp.upload('a1000000-0000-0000-0000-000000000001', 'a2.jpg');
select pg_temp.upload('a1000000-0000-0000-0000-000000000001', 'a3.jpg');
select pg_temp.upload('b2000000-0000-0000-0000-000000000002', 'b1.jpg');
select pg_temp.upload('b2000000-0000-0000-0000-000000000002', 'b2.jpg');
select pg_temp.upload('c3000000-0000-0000-0000-000000000003', 'c1.jpg');
select pg_temp.upload('d4000000-0000-0000-0000-000000000004', 'd1.jpg');
select pg_temp.upload('e5000000-0000-0000-0000-000000000005', 'e1.jpg');
select pg_temp.upload('f6000000-0000-0000-0000-000000000006', 'f1.jpg');
set local role authenticated;

-- ---------------------------------------------------------------------------
-- 1. Envoi seul → en attente, verrouillé pour les autres
-- ---------------------------------------------------------------------------
select pg_temp.login('a1000000-0000-0000-0000-000000000001');
select is((select status::text from public.submit_selfie('a1000000-0000-0000-0000-000000000001/a1.jpg', '00000000-0000-0000-0000-0000000000a1')),
  'pending', 'ana envoie un selfie : en attente (file vide)');
select is((select submission_id from public.submit_selfie('a1000000-0000-0000-0000-000000000001/a1.jpg', '00000000-0000-0000-0000-0000000000a1')),
  (select id from public.selfie_submissions where client_request_id = '00000000-0000-0000-0000-0000000000a1'),
  'renvoyer la même requête ne crée pas de doublon (idempotence)');
select throws_ok($$ select * from public.submit_selfie('a1000000-0000-0000-0000-000000000001/a2.jpg', gen_random_uuid()) $$,
  'P0001', 'selfie_already_pending', 'un seul selfie en attente à la fois');
select throws_ok($$ select * from public.submit_selfie('b2000000-0000-0000-0000-000000000002/b1.jpg', gen_random_uuid()) $$,
  '22023', 'invalid_media_path', 'impossible d''envoyer le selfie de quelqu''un d''autre');
select is((select count(*)::int from public.get_pending_selfie()), 1, 'ana retrouve son selfie en attente');

select pg_temp.login('b2000000-0000-0000-0000-000000000002');
select is((select count(*)::int from storage.objects where bucket_id = 'selfies' and name like 'a1%'), 0,
  'VERROU : ben ne peut pas lire le selfie en attente d''ana');
select is((select count(*)::int from public.selfie_submissions), 0, 'ben ne voit pas la file d''attente');

-- ---------------------------------------------------------------------------
-- 2. Deuxième envoi → match immédiat + déblocage simultané
-- ---------------------------------------------------------------------------
select is((select status::text from public.submit_selfie('b2000000-0000-0000-0000-000000000002/b1.jpg', gen_random_uuid())),
  'matched', 'ben envoie : match immédiat avec ana');
select is((select count(*)::int from public.matches), 1, 'un match créé');
select isnt((select unlocked_at from public.matches limit 1), null, 'le match est débloqué (les deux ont envoyé)');
select is((select count(*)::int from storage.objects where bucket_id = 'selfies' and name like 'a1000000-0000-0000-0000-000000000001/a1.jpg'), 1,
  'DÉBLOCAGE : ben peut maintenant lire le selfie d''ana');
select is((select their_selfie_path from public.get_recent_matches() limit 1), 'a1000000-0000-0000-0000-000000000001/a1.jpg',
  'ben voit le selfie d''ana dans son match');
select is((select other_username from public.get_recent_matches() limit 1), 'ana', 'ben voit le profil d''ana');

select pg_temp.login('a1000000-0000-0000-0000-000000000001');
select is((select status::text from public.poll_selfie((select id from public.selfie_submissions where client_request_id = '00000000-0000-0000-0000-0000000000a1'))),
  'matched', 'ana apprend en interrogeant que son selfie est apparié');
select is((select their_selfie_path from public.get_recent_matches() limit 1), 'b2000000-0000-0000-0000-000000000002/b1.jpg',
  'ana voit le selfie de ben (déblocage symétrique)');
select is((select count(*)::int from storage.objects where bucket_id = 'selfies' and name like 'b2%'), 1, 'ana peut lire le fichier de ben');

select pg_temp.login('c3000000-0000-0000-0000-000000000003');
select is((select count(*)::int from storage.objects where bucket_id = 'selfies' and name not like 'c3%'), 0,
  'un tiers (chen) ne peut lire aucun selfie de ce match');
select is((select count(*)::int from public.get_match((select id from public.matches limit 1))), 0, 'chen ne peut pas ouvrir le match');

-- ---------------------------------------------------------------------------
-- 3. Décisions Follow / Passer (indépendantes)
-- ---------------------------------------------------------------------------
select pg_temp.login('a1000000-0000-0000-0000-000000000001');
select is(public.decide_match((select id from public.matches limit 1), 'follow')::text, 'active', 'ana suit ben depuis le match');
select throws_ok($$ select public.decide_match((select id from public.matches limit 1), 'pass') $$, 'P0001', 'already_decided', 'une seule décision par match');
select is((select source::text from public.follows where follower_id = auth.uid()), 'match', 'l''abonnement est marqué « match »');
select pg_temp.login('b2000000-0000-0000-0000-000000000002');
select is(public.decide_match((select id from public.matches limit 1), 'pass'), null, 'ben passe');
select is((select follows_me from public.get_recent_matches() limit 1), true, 'ben voit qu''ana le suit, sans obligation de retour');
select is((select count(*)::int from public.follows where follower_id = auth.uid()), 0, 'ben ne suit personne');

-- ---------------------------------------------------------------------------
-- 4. Pas de re-match avant 30 jours
-- ---------------------------------------------------------------------------
select is((select status::text from public.submit_selfie('b2000000-0000-0000-0000-000000000002/b2.jpg', gen_random_uuid())), 'pending', 'ben renvoie un selfie');
select pg_temp.login('a1000000-0000-0000-0000-000000000001');
select is((select status::text from public.submit_selfie('a1000000-0000-0000-0000-000000000001/a2.jpg', gen_random_uuid())), 'pending',
  'ana renvoie aussi : PAS de nouveau match avec ben (moins de 30 jours)');

-- ---------------------------------------------------------------------------
-- 5. Diversité internationale : préférer un pays différent
--    File : ben (US, en attente), ana (FR, en attente). Dia (FR) envoie → doit
--    être appariée avec ben (US) plutôt qu'avec ana (FR), même si ana… est plus récente
--    et ben plus ancien : on vérifie surtout le critère pays.
-- ---------------------------------------------------------------------------
select pg_temp.login('d4000000-0000-0000-0000-000000000004');
select is((select status::text from public.submit_selfie('d4000000-0000-0000-0000-000000000004/d1.jpg', gen_random_uuid())), 'matched', 'dia est appariée');
select is((select other_username from public.get_recent_matches() limit 1), 'ben', 'dia (FR) est appariée avec ben (US) plutôt qu''avec ana (FR)');

-- ---------------------------------------------------------------------------
-- 6. Préférence de langue : respectée 2 min puis relâchée
-- ---------------------------------------------------------------------------
reset role;
update public.user_private set languages = '{pt}', match_same_language = true where user_id = 'e5000000-0000-0000-0000-000000000005';
-- ana attend depuis 1 min seulement
update public.selfie_submissions set created_at = now() - interval '1 minute' where storage_path like 'a1000000%/a2.jpg';
set local role authenticated;
select pg_temp.login('e5000000-0000-0000-0000-000000000005');
select is((select status::text from public.submit_selfie('e5000000-0000-0000-0000-000000000005/e1.jpg', gen_random_uuid())), 'pending',
  'eli veut la même langue (pt) : pas de match immédiat avec ana (en)');
reset role;
update public.selfie_submissions set created_at = now() - interval '3 minutes' where storage_path like 'e5000000%';
set local role authenticated;
select is((select status::text from public.poll_selfie((select id from public.selfie_submissions where storage_path like 'e5000000%'))), 'matched',
  'après 2 min d''attente, la préférence est relâchée : match');

-- ---------------------------------------------------------------------------
-- 7. Expiration après 30 min
-- ---------------------------------------------------------------------------
select pg_temp.login('c3000000-0000-0000-0000-000000000003');
select is((select status::text from public.submit_selfie('c3000000-0000-0000-0000-000000000003/c1.jpg', gen_random_uuid())), 'pending', 'chen attend seul');
reset role;
update public.selfie_submissions set expires_at = now() - interval '1 second' where storage_path like 'c3000000%';
set local role authenticated;
select is((select status::text from public.poll_selfie((select id from public.selfie_submissions where storage_path like 'c3000000%'))), 'expired',
  'au bout de 30 min sans partenaire : expiré');
select pg_temp.login('f6000000-0000-0000-0000-000000000006');
select is((select status::text from public.submit_selfie('f6000000-0000-0000-0000-000000000006/f1.jpg', gen_random_uuid())), 'pending',
  'un selfie expiré n''est plus proposé au matching');

-- ---------------------------------------------------------------------------
-- 8. Photos visibles 24 h seulement
-- ---------------------------------------------------------------------------
reset role;
update public.matches set media_expires_at = now() - interval '1 second'
 where user_a = 'a1000000-0000-0000-0000-000000000001' or user_b = 'a1000000-0000-0000-0000-000000000001';
set local role authenticated;
select pg_temp.login('b2000000-0000-0000-0000-000000000002');
select is((select count(*)::int from storage.objects where bucket_id = 'selfies' and name like 'a1%'), 0,
  'après 24 h, ben ne peut plus lire le selfie d''ana');
select is((select their_selfie_path from public.get_match((select id from public.matches where user_a = 'a1000000-0000-0000-0000-000000000001' or user_b = 'a1000000-0000-0000-0000-000000000001'))),
  null, 'le match ne donne plus le chemin de la photo');

-- ---------------------------------------------------------------------------
-- 9. Annulation, anti-abus, accès direct
-- ---------------------------------------------------------------------------
select pg_temp.login('f6000000-0000-0000-0000-000000000006');
select public.cancel_selfie((select id from public.selfie_submissions where storage_path like 'f6000000%'));
select is((select status::text from public.selfie_submissions where storage_path like 'f6000000%'), 'cancelled', 'annuler son selfie en attente');
select throws_ok($$ insert into public.matches (submission_a, submission_b, user_a, user_b) values (gen_random_uuid(), gen_random_uuid(), auth.uid(), auth.uid()) $$,
  '42501', null, 'création directe de match interdite');
select throws_ok($$ update public.matches set unlocked_at = now() $$, '42501', null, 'déblocage manuel interdit');
reset role;
insert into public.selfie_submissions (user_id, client_request_id, storage_path, status, expires_at, created_at)
select 'f6000000-0000-0000-0000-000000000006', gen_random_uuid(), 'f6000000-0000-0000-0000-000000000006/spam' || g, 'expired', now(), now() - interval '10 minutes'
from generate_series(1, 30) g;
insert into storage.objects (bucket_id, name) values ('selfies', 'f6000000-0000-0000-0000-000000000006/encore.jpg');
set local role authenticated;
select throws_ok($$ select * from public.submit_selfie('f6000000-0000-0000-0000-000000000006/encore.jpg', gen_random_uuid()) $$,
  'P0001', 'rate_limited', 'plus de 30 selfies en une heure : bloqué');

-- ---------------------------------------------------------------------------
-- 10. Signalement
-- ---------------------------------------------------------------------------
select lives_ok($$ select public.report_user('a1000000-0000-0000-0000-000000000001', 'selfie', null, 'nudity', 'test') $$, 'signaler un utilisateur');
select throws_ok($$ select public.report_user(auth.uid(), 'profile', null, 'spam') $$, 'P0001', 'cannot_report_self', 'impossible de se signaler soi-même');
select throws_ok($$ select count(*) from public.reports $$, '42501', null, 'les signalements ne sont pas lisibles par les utilisateurs');

-- ---------------------------------------------------------------------------
-- 11. Purge des photos (réservée au serveur)
-- ---------------------------------------------------------------------------
select throws_ok($$ select * from public.media_to_purge() $$, '42501', null, 'un utilisateur ne peut pas lancer la purge');
reset role;
set local role service_role;
select ok((select count(*) from public.media_to_purge() where path like 'a1000000%/a1.jpg') = 1, 'le selfie d''un match de plus de 24 h est à effacer');
select public.mark_media_purged('selfies', array['a1000000-0000-0000-0000-000000000001/a1.jpg']);
select ok((select count(*) from public.media_to_purge() where path like 'a1000000%/a1.jpg') = 0, 'une fois effacé, il ne réapparaît plus');

select * from finish();
rollback;
