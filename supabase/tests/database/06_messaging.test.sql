-- Tests pgTAP — Phase 5 : messagerie, boîte « Demandes », blocage.
begin;
create extension if not exists pgtap with schema extensions;
select plan(45);

create function pg_temp.login(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;
-- A = alex, B = bea, C = cyril (intrus), D = dora (pour le blocage)
insert into auth.users (id) values
  ('aa000000-0000-0000-0000-0000000000aa'), ('bb000000-0000-0000-0000-0000000000bb'),
  ('cc000000-0000-0000-0000-0000000000cc'), ('dd000000-0000-0000-0000-0000000000dd');
set local role authenticated;
select pg_temp.login('aa000000-0000-0000-0000-0000000000aa'); select public.verify_age('1990-01-01'); select public.complete_onboarding('alex', null, null, 'FR', 'fr', 'UTC', '{fr}', 'v1');
select pg_temp.login('bb000000-0000-0000-0000-0000000000bb'); select public.verify_age('1990-01-01'); select public.complete_onboarding('bea', null, null, 'ES', 'es', 'UTC', '{es}', 'v1');
select pg_temp.login('cc000000-0000-0000-0000-0000000000cc'); select public.verify_age('1990-01-01'); select public.complete_onboarding('cyril', null, null, 'BE', 'fr', 'UTC', '{fr}', 'v1');
select pg_temp.login('dd000000-0000-0000-0000-0000000000dd'); select public.verify_age('1990-01-01'); select public.complete_onboarding('dora', null, null, 'IT', 'en', 'UTC', '{en}', 'v1');

-- ---------------------------------------------------------------------------
-- 1. Il faut suivre quelqu'un pour lui écrire
-- ---------------------------------------------------------------------------
select pg_temp.login('aa000000-0000-0000-0000-0000000000aa');
select throws_ok($$ select public.send_message('bb000000-0000-0000-0000-0000000000bb', 'salut') $$, 'P0001', 'must_follow', 'impossible d''écrire à quelqu''un qu''on ne suit pas');
select is((select blocked_reason from public.get_conversation('bb000000-0000-0000-0000-0000000000bb')), 'must_follow', 'l''app sait expliquer pourquoi');
select throws_ok($$ select public.send_message(auth.uid(), 'moi') $$, 'P0001', 'cannot_message_self', 'pas de message à soi-même');
select throws_ok($$ insert into public.messages (conversation_id, sender_id, body) values (gen_random_uuid(), auth.uid(), 'x') $$, '42501', null, 'insertion directe interdite');

-- ---------------------------------------------------------------------------
-- 2. A suit B, B ne suit pas A → boîte « Demandes » de B
-- ---------------------------------------------------------------------------
select public.follow_user('bb000000-0000-0000-0000-0000000000bb');
select lives_ok($$ select public.send_message('bb000000-0000-0000-0000-0000000000bb', 'Salut Bea !') $$, 'A suit B : A peut écrire');
select is((select count(*)::int from public.get_inbox('primary')), 1, 'chez A (expéditeur) : conversation en principale');
select throws_ok($$ select public.send_message('bb000000-0000-0000-0000-0000000000bb', 'tu es là ?') $$, 'P0001', 'request_pending', 'demande non acceptée : un seul message');
select is((select blocked_reason from public.get_conversation('bb000000-0000-0000-0000-0000000000bb')), 'request_pending', 'A voit « en attente d''acceptation »');

select pg_temp.login('bb000000-0000-0000-0000-0000000000bb');
select is((select count(*)::int from public.get_inbox('requests')), 1, 'chez B : la conversation est dans Demandes');
select is((select count(*)::int from public.get_inbox('primary')), 0, 'et PAS dans la principale');
select is((select requests from public.get_inbox_counts()), 1, 'compteur de demandes = 1');
select is((select primary_unread from public.get_inbox_counts()), 0, 'aucun non-lu en principale (pas de notification)');
select is((select last_body from public.get_inbox('requests')), 'Salut Bea !', 'B peut lire le message');
select public.mark_conversation_read((select conversation_id from public.get_inbox('requests')));

select pg_temp.login('aa000000-0000-0000-0000-0000000000aa');
select is((select other_last_read_at from public.get_conversation('bb000000-0000-0000-0000-0000000000bb')), null,
  'PAS d''accusé de lecture tant que la demande n''est pas acceptée');

-- ---------------------------------------------------------------------------
-- 3. B suit A à son tour → bascule automatique en principale
-- ---------------------------------------------------------------------------
select pg_temp.login('bb000000-0000-0000-0000-0000000000bb');
select public.follow_user('aa000000-0000-0000-0000-0000000000aa');
select is((select count(*)::int from public.get_inbox('requests')), 0, 'B suit A : la demande disparaît…');
select is((select count(*)::int from public.get_inbox('primary')), 1, '…et la conversation passe en principale automatiquement');
select lives_ok($$ select public.send_message('aa000000-0000-0000-0000-0000000000aa', 'Hola Alex') $$, 'B répond');
select public.mark_conversation_read((select conversation_id from public.get_inbox('primary')));

select pg_temp.login('aa000000-0000-0000-0000-0000000000aa');
select is((select primary_unread from public.get_inbox_counts()), 1, 'A a 1 message non lu en principale');
select lives_ok($$ select public.send_message('bb000000-0000-0000-0000-0000000000bb', 'Super !') $$, 'plus de limite une fois en principale');
select isnt((select other_last_read_at from public.get_conversation('bb000000-0000-0000-0000-0000000000bb')), null, 'accusé de lecture visible en principale');
select is((select count(*)::int from public.messages), 3, 'A voit les 3 messages');

-- ---------------------------------------------------------------------------
-- 4. Un intrus ne voit rien
-- ---------------------------------------------------------------------------
select pg_temp.login('cc000000-0000-0000-0000-0000000000cc');
select is((select count(*)::int from public.messages), 0, 'un tiers ne peut lire aucun message');
select is((select count(*)::int from public.conversations), 0, 'ni aucune conversation');

-- ---------------------------------------------------------------------------
-- 5. Accepter une demande sans suivre ; pas de photo dans une demande
-- ---------------------------------------------------------------------------
select public.follow_user('aa000000-0000-0000-0000-0000000000aa');
reset role;
insert into storage.objects (bucket_id, name) values ('dm', 'cc000000-0000-0000-0000-0000000000cc/p.jpg');
set local role authenticated;
select throws_ok($$ select public.send_message('aa000000-0000-0000-0000-0000000000aa', null, 'cc000000-0000-0000-0000-0000000000cc/p.jpg') $$,
  'P0001', 'no_media_in_requests', 'pas de photo dans une demande');
select lives_ok($$ select public.send_message('aa000000-0000-0000-0000-0000000000aa', 'Coucou, on s''est croisés au QR') $$, 'C (abonné) envoie une demande à A');

select pg_temp.login('aa000000-0000-0000-0000-0000000000aa');
select is((select other_username from public.get_inbox('requests')), 'cyril', 'A reçoit la demande de Cyril');
select public.accept_conversation((select conversation_id from public.get_inbox('requests')));
select is((select count(*)::int from public.get_inbox('primary')), 2, 'acceptée : elle rejoint la principale');
select is((select i_follow from public.get_profile('cc000000-0000-0000-0000-0000000000cc')), null, 'accepter ne crée pas d''abonnement');
select lives_ok($$ select public.send_message('cc000000-0000-0000-0000-0000000000cc', 'Bienvenue !') $$, 'A peut répondre sans suivre Cyril');
select pg_temp.login('cc000000-0000-0000-0000-0000000000cc');
select lives_ok($$ select public.send_message('aa000000-0000-0000-0000-0000000000aa', null, 'cc000000-0000-0000-0000-0000000000cc/p.jpg') $$, 'photo autorisée une fois acceptée');
select is((select count(*)::int from storage.objects where bucket_id = 'dm'), 1, 'Cyril voit sa photo');
select pg_temp.login('aa000000-0000-0000-0000-0000000000aa');
select is((select count(*)::int from storage.objects where bucket_id = 'dm'), 1, 'Alex (destinataire) peut ouvrir la photo');
select pg_temp.login('bb000000-0000-0000-0000-0000000000bb');
select is((select count(*)::int from storage.objects where bucket_id = 'dm'), 0, 'Bea (étrangère à la conversation) ne peut pas');

-- ---------------------------------------------------------------------------
-- 6. Supprimer une conversation de son côté
-- ---------------------------------------------------------------------------
select pg_temp.login('aa000000-0000-0000-0000-0000000000aa');
select public.delete_conversation((select conversation_id from public.get_inbox('primary') where other_username = 'cyril'));
select is((select count(*)::int from public.get_inbox('primary') where other_username = 'cyril'), 0, 'conversation supprimée de mon côté');
select pg_temp.login('cc000000-0000-0000-0000-0000000000cc');
select is((select count(*)::int from public.get_inbox('primary')), 1, 'Cyril la garde de son côté');

-- ---------------------------------------------------------------------------
-- 7. Blocage
-- ---------------------------------------------------------------------------
select pg_temp.login('dd000000-0000-0000-0000-0000000000dd');
select public.follow_user('aa000000-0000-0000-0000-0000000000aa');
select public.send_message('aa000000-0000-0000-0000-0000000000aa', 'message lourd');
select pg_temp.login('aa000000-0000-0000-0000-0000000000aa');
select public.follow_user('dd000000-0000-0000-0000-0000000000dd');
select public.block_user('dd000000-0000-0000-0000-0000000000dd');
select is((select count(*)::int from public.follows where 'dd000000-0000-0000-0000-0000000000dd' in (follower_id, followee_id)), 0, 'bloquer supprime les abonnements dans les deux sens');
select is((select count(*)::int from public.get_inbox('primary') where other_username = 'dora') + (select count(*)::int from public.get_inbox('requests') where other_username = 'dora'), 0,
  'la conversation avec la personne bloquée disparaît');
select is((select count(*)::int from public.get_blocked_users()), 1, 'elle apparaît dans « Comptes bloqués »');
select pg_temp.login('dd000000-0000-0000-0000-0000000000dd');
select throws_ok($$ select public.send_message('aa000000-0000-0000-0000-0000000000aa', 'encore moi') $$, 'P0002', 'user_not_found', 'la personne bloquée ne peut plus écrire');
select throws_ok($$ select public.follow_user('aa000000-0000-0000-0000-0000000000aa') $$, 'P0002', 'user_not_found', 'ni suivre à nouveau');
select is((select count(*)::int from public.get_profile('aa000000-0000-0000-0000-0000000000aa')), 0, 'ni voir le profil');
select is((select count(*)::int from public.messages), 0, 'ni relire l''ancienne conversation');
select pg_temp.login('aa000000-0000-0000-0000-0000000000aa');
select public.unblock_user('dd000000-0000-0000-0000-0000000000dd');
select is((select count(*)::int from public.get_profile('dd000000-0000-0000-0000-0000000000dd')), 1, 'débloquer rend le profil de nouveau visible');

-- Blocage : ni match de selfies, ni QR code
select public.block_user('dd000000-0000-0000-0000-0000000000dd');
create temp table qr (v text); grant all on qr to authenticated;
select pg_temp.login('dd000000-0000-0000-0000-0000000000dd');
insert into qr values (public.regenerate_qr_token());
reset role;
insert into storage.objects (bucket_id, name) values
  ('selfies', 'aa000000-0000-0000-0000-0000000000aa/s.jpg'), ('selfies', 'dd000000-0000-0000-0000-0000000000dd/s.jpg');
set local role authenticated;
select public.submit_selfie('dd000000-0000-0000-0000-0000000000dd/s.jpg', gen_random_uuid());
select pg_temp.login('aa000000-0000-0000-0000-0000000000aa');
select is((select status::text from public.submit_selfie('aa000000-0000-0000-0000-0000000000aa/s.jpg', gen_random_uuid())), 'pending',
  'deux personnes qui se sont bloquées ne sont jamais appariées');
select throws_ok($$ select * from public.resolve_qr_token((select v from qr)) $$, 'P0002', 'qr_invalid', 'le QR code d''une personne bloquée est refusé');

select * from finish();
rollback;
