-- Tests pgTAP — Phase 6 : modération, back-office, sourdine, suppression, export.
begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

create function pg_temp.login(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.verdict(p_bucket text, p_path text, p_decision text) returns void language sql as $$
  insert into public.moderation_results (bucket, path, decision, reason, provider) values (p_bucket, p_path, p_decision, 'test', 'test')
  on conflict (bucket, path) do update set decision = excluded.decision;
$$;
-- M = modo (admin), U = ugo, V = vera, R1..R3 = signaleurs
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-0000000000a1', 'modo@t.dev'), ('b0000000-0000-0000-0000-0000000000b1', 'ugo@t.dev'),
  ('c0000000-0000-0000-0000-0000000000c1', 'vera@t.dev'), ('d0000000-0000-0000-0000-0000000000d1', 'r1@t.dev'),
  ('d0000000-0000-0000-0000-0000000000d2', 'r2@t.dev'), ('d0000000-0000-0000-0000-0000000000d3', 'r3@t.dev');
set local role authenticated;
select pg_temp.login('a0000000-0000-0000-0000-0000000000a1'); select public.verify_age('1990-01-01'); select public.complete_onboarding('modo', null, null, 'FR', 'fr', 'UTC', '{fr}', 'v1');
select pg_temp.login('b0000000-0000-0000-0000-0000000000b1'); select public.verify_age('1990-01-01'); select public.complete_onboarding('ugo', null, null, 'FR', 'fr', 'UTC', '{fr}', 'v1');
select pg_temp.login('c0000000-0000-0000-0000-0000000000c1'); select public.verify_age('1990-01-01'); select public.complete_onboarding('vera', null, null, 'FR', 'fr', 'UTC', '{fr}', 'v1');
select pg_temp.login('d0000000-0000-0000-0000-0000000000d1'); select public.verify_age('1990-01-01'); select public.complete_onboarding('rep1', null, null, 'FR', 'fr', 'UTC', '{fr}', 'v1');
select pg_temp.login('d0000000-0000-0000-0000-0000000000d2'); select public.verify_age('1990-01-01'); select public.complete_onboarding('rep2', null, null, 'FR', 'fr', 'UTC', '{fr}', 'v1');
select pg_temp.login('d0000000-0000-0000-0000-0000000000d3'); select public.verify_age('1990-01-01'); select public.complete_onboarding('rep3', null, null, 'FR', 'fr', 'UTC', '{fr}', 'v1');
reset role;
insert into public.admins (user_id) values ('a0000000-0000-0000-0000-0000000000a1');
insert into storage.objects (bucket_id, name) values
  ('posts', 'b0000000-0000-0000-0000-0000000000b1/ok.jpg'), ('posts', 'b0000000-0000-0000-0000-0000000000b1/nu.jpg'),
  ('posts', 'b0000000-0000-0000-0000-0000000000b1/douteux.jpg'), ('posts', 'b0000000-0000-0000-0000-0000000000b1/sans.jpg'),
  ('stories', 'b0000000-0000-0000-0000-0000000000b1/st.jpg'), ('selfies', 'b0000000-0000-0000-0000-0000000000b1/s1.jpg'),
  ('selfies', 'b0000000-0000-0000-0000-0000000000b1/s2.jpg'), ('avatars', 'b0000000-0000-0000-0000-0000000000b1/av.jpg');

-- ---------------------------------------------------------------------------
-- 1. Modération désactivée (avant configuration) : tout passe
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.login('b0000000-0000-0000-0000-0000000000b1');
select lives_ok($$ select public.create_post('sans verdict', '[{"path":"b0000000-0000-0000-0000-0000000000b1/sans.jpg"}]') $$, 'modération non activée : une photo sans verdict passe');

-- ---------------------------------------------------------------------------
-- 2. Modération activée
-- ---------------------------------------------------------------------------
reset role;
update public.app_config set value = 'true' where key = 'moderation_enforced';
select pg_temp.verdict('posts', 'b0000000-0000-0000-0000-0000000000b1/ok.jpg', 'approved');
select pg_temp.verdict('posts', 'b0000000-0000-0000-0000-0000000000b1/nu.jpg', 'rejected');
select pg_temp.verdict('posts', 'b0000000-0000-0000-0000-0000000000b1/douteux.jpg', 'review');
select pg_temp.verdict('stories', 'b0000000-0000-0000-0000-0000000000b1/st.jpg', 'review');
select pg_temp.verdict('selfies', 'b0000000-0000-0000-0000-0000000000b1/s1.jpg', 'review');
select pg_temp.verdict('avatars', 'b0000000-0000-0000-0000-0000000000b1/av.jpg', 'rejected');
insert into storage.objects (bucket_id, name) values ('posts', 'b0000000-0000-0000-0000-0000000000b1/jamais.jpg');
set local role authenticated;
select pg_temp.login('b0000000-0000-0000-0000-0000000000b1');
select throws_ok($$ select public.create_post('x', '[{"path":"b0000000-0000-0000-0000-0000000000b1/jamais.jpg"}]') $$, 'P0001', 'moderation_required', 'modération activée : photo non analysée refusée');
select throws_ok($$ select public.create_post('x', '[{"path":"b0000000-0000-0000-0000-0000000000b1/nu.jpg"}]') $$, 'P0001', 'content_rejected', 'photo refusée par la modération : publication impossible');
select lives_ok($$ select public.create_post('ok', '[{"path":"b0000000-0000-0000-0000-0000000000b1/ok.jpg"}]') $$, 'photo approuvée : publiée');
select lives_ok($$ select public.create_post('douteux', '[{"path":"b0000000-0000-0000-0000-0000000000b1/douteux.jpg"}]') $$, 'photo douteuse : publication créée…');
select is((select moderation::text from public.posts where caption = 'douteux'), 'pending', '…mais en attente de revue');
select lives_ok($$ select public.create_story('b0000000-0000-0000-0000-0000000000b1/st.jpg') $$, 'story douteuse créée…');
select is((select moderation::text from public.stories limit 1), 'pending', '…en attente de revue');
select throws_ok($$ select * from public.submit_selfie('b0000000-0000-0000-0000-0000000000b1/s1.jpg', gen_random_uuid()) $$, 'P0001', 'content_rejected', 'selfie douteux refusé (ne peut pas attendre une revue)');
select throws_ok($$ update public.profiles set avatar_path = 'b0000000-0000-0000-0000-0000000000b1/av.jpg' where id = auth.uid() $$, 'P0001', 'content_rejected', 'photo de profil refusée');
select throws_ok($$ insert into public.moderation_results (bucket, path, decision, provider) values ('posts', 'b0000000-0000-0000-0000-0000000000b1/x.jpg', 'approved', 'moi') $$,
  '42501', null, 'un utilisateur ne peut pas s''auto-approuver');

select pg_temp.login('c0000000-0000-0000-0000-0000000000c1');
select is((select count(*)::int from public.get_user_posts('b0000000-0000-0000-0000-0000000000b1') where caption = 'douteux'), 0, 'une publication en attente est invisible pour les autres');

-- ---------------------------------------------------------------------------
-- 3. Back-office : réservé aux admins
-- ---------------------------------------------------------------------------
select is(public.am_i_admin(), false, 'vera n''est pas admin');
select throws_ok($$ select * from public.admin_list_reports() $$, '42501', 'not_admin', 'un non-admin ne voit pas les signalements');
select throws_ok($$ select public.admin_set_user_status('b0000000-0000-0000-0000-0000000000b1', 'banned') $$, '42501', 'not_admin', 'un non-admin ne peut pas bannir');

select pg_temp.login('a0000000-0000-0000-0000-0000000000a1');
select is(public.am_i_admin(), true, 'modo est admin');
select is((select count(*)::int from public.admin_review_queue()), 2, 'file « À revoir » : 1 publication + 1 story');
select public.admin_review_content('post', (select id from public.admin_review_queue() where kind = 'post'), true);
select is((select moderation::text from public.posts where caption = 'douteux'), 'approved', 'l''admin valide la publication (désormais visible)');
select public.admin_review_content('story', (select id from public.admin_review_queue() where kind = 'story'), false);
select is((select count(*)::int from public.admin_review_queue()), 0, 'l''admin refuse la story : supprimée, file vide');

-- ---------------------------------------------------------------------------
-- 4. Signalements : suspension automatique + traitement
-- ---------------------------------------------------------------------------
select pg_temp.login('d0000000-0000-0000-0000-0000000000d1'); select public.report_user('c0000000-0000-0000-0000-0000000000c1', 'profile', null, 'nudity');
select pg_temp.login('d0000000-0000-0000-0000-0000000000d2'); select public.report_user('c0000000-0000-0000-0000-0000000000c1', 'profile', null, 'nudity');
reset role;
select is((select status::text from public.user_private where user_id = 'c0000000-0000-0000-0000-0000000000c1'), 'active', '2 signalements : pas encore de suspension');
set local role authenticated;
select pg_temp.login('d0000000-0000-0000-0000-0000000000d3'); select public.report_user('c0000000-0000-0000-0000-0000000000c1', 'profile', null, 'minor');
reset role;
select is((select status::text from public.user_private where user_id = 'c0000000-0000-0000-0000-0000000000c1'), 'suspended', '3 personnes différentes (nudité/mineur) : suspension automatique');
select is((select count(*)::int from public.moderation_actions where action = 'auto_suspend'), 1, 'la suspension automatique est tracée');
set local role authenticated;
select pg_temp.login('c0000000-0000-0000-0000-0000000000c1');
select is(public.get_onboarding_state(), 'suspended', 'vera voit l''écran « compte suspendu »');
select isnt((select status_reason from public.get_my_account_status()), null, '…avec le motif (motivation des décisions)');

select pg_temp.login('a0000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from public.admin_list_reports('open')), 3, 'l''admin voit les 3 signalements ouverts');
select public.admin_resolve_report((select report_id from public.admin_list_reports('open') limit 1), 'dismiss', 'faux signalement');
select is((select count(*)::int from public.admin_list_reports('open')), 0, 'classer traite tous les signalements du même contenu');
select public.admin_set_user_status('c0000000-0000-0000-0000-0000000000c1', 'active');
select pg_temp.login('c0000000-0000-0000-0000-0000000000c1');
select is(public.get_onboarding_state(), 'complete', 'suspension levée par l''admin');

-- ---------------------------------------------------------------------------
-- 5. Mise en sourdine
-- ---------------------------------------------------------------------------
select public.follow_user('b0000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from public.get_feed() where author_id = 'b0000000-0000-0000-0000-0000000000b1'), 3, 'vera voit les publications d''ugo');
select public.mute_user('b0000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from public.get_feed() where author_id = 'b0000000-0000-0000-0000-0000000000b1'), 0, 'sourdine : plus rien dans le fil');
select is((select i_follow::text from public.get_profile('b0000000-0000-0000-0000-0000000000b1')), 'active', '…sans se désabonner');
select is(public.is_muted('b0000000-0000-0000-0000-0000000000b1'), true, 'l''app sait que le compte est en sourdine');

-- ---------------------------------------------------------------------------
-- 6. Export et suppression du compte
-- ---------------------------------------------------------------------------
select pg_temp.login('b0000000-0000-0000-0000-0000000000b1');
select is((select jsonb_array_length(public.export_my_data() -> 'posts')), 3, 'l''export contient mes publications');
select is((select public.export_my_data() -> 'private' ->> 'birth_date'), '1990-01-01', 'l''export contient mes données privées');
select ok(public.request_account_deletion() > now() + interval '29 days', 'suppression programmée dans 30 jours');
select is(public.get_onboarding_state(), 'deletion_pending', 'reconnecté : écran « suppression en cours »');
select pg_temp.login('c0000000-0000-0000-0000-0000000000c1');
select is((select count(*)::int from public.get_profile('b0000000-0000-0000-0000-0000000000b1')), 0, 'le compte en suppression est invisible pour les autres');
select pg_temp.login('b0000000-0000-0000-0000-0000000000b1');
select public.cancel_account_deletion();
select is(public.get_onboarding_state(), 'complete', 'annuler la suppression restaure le compte');

select * from finish();
rollback;
