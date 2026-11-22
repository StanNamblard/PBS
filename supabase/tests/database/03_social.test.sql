-- Tests pgTAP — Phase 2 : follow, comptes privés, publications, stories, fil.
begin;
create extension if not exists pgtap with schema extensions;
select plan(53);

-- ---------------------------------------------------------------------------
-- Préparation : 4 utilisateurs avec profil complet
--   alice (publique), bob (publique), carol (PRIVÉE), dave (sans relation)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'alice@t.dev'),
  ('b0000000-0000-0000-0000-00000000000b', 'bob@t.dev'),
  ('c0000000-0000-0000-0000-00000000000c', 'carol@t.dev'),
  ('d0000000-0000-0000-0000-00000000000d', 'dave@t.dev');

create function pg_temp.login(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('a0000000-0000-0000-0000-00000000000a');
select public.verify_age('1990-01-01'); select public.complete_onboarding('alice', null, null, 'FR', 'fr', 'Europe/Paris', '{fr}', 'v1');
select pg_temp.login('b0000000-0000-0000-0000-00000000000b');
select public.verify_age('1990-01-01'); select public.complete_onboarding('bob', null, null, 'US', 'en', 'America/New_York', '{en}', 'v1');
select pg_temp.login('c0000000-0000-0000-0000-00000000000c');
select public.verify_age('1990-01-01'); select public.complete_onboarding('carol', null, null, 'BR', 'pt', 'America/Sao_Paulo', '{pt}', 'v1');
update public.profiles set is_private = true where id = auth.uid();
select pg_temp.login('d0000000-0000-0000-0000-00000000000d');
select public.verify_age('1990-01-01'); select public.complete_onboarding('dave', null, null, 'JP', 'en', 'Asia/Tokyo', '{en}', 'v1');

-- ---------------------------------------------------------------------------
-- Pas de recherche / pas d'aspiration
-- ---------------------------------------------------------------------------
select is((select count(*)::int from public.profiles), 1, 'dave ne voit que son propre profil en lecture directe');
select is((select username from public.get_profile('a0000000-0000-0000-0000-00000000000a')), 'alice',
  'mais il peut ouvrir un profil dont il connaît l''identifiant');
select is((select can_view from public.get_profile('c0000000-0000-0000-0000-00000000000c')), false,
  'le contenu d''un compte privé n''est pas visible sans abonnement');

-- ---------------------------------------------------------------------------
-- Follow d'un compte public
-- ---------------------------------------------------------------------------
select pg_temp.login('a0000000-0000-0000-0000-00000000000a');
select is(public.follow_user('b0000000-0000-0000-0000-00000000000b')::text, 'active', 'suivre un compte public : immédiat');
select is(public.follow_user('b0000000-0000-0000-0000-00000000000b')::text, 'active', 'suivre deux fois : idempotent');
select throws_ok($$ select public.follow_user(auth.uid()) $$, 'P0001', 'cannot_follow_self', 'impossible de se suivre soi-même');
select throws_ok($$ select public.follow_user('99999999-9999-9999-9999-999999999999') $$, 'P0002', 'user_not_found', 'utilisateur inexistant');
select is((select following_count from public.get_profile(auth.uid())), 1, 'alice : 1 abonnement');
select is((select followers_count from public.get_profile('b0000000-0000-0000-0000-00000000000b')), 1, 'bob : 1 abonné');
select is((select follows_me from public.get_profile('b0000000-0000-0000-0000-00000000000b')), false, 'bob ne suit pas alice (pas de follow-back automatique)');
select is((select count(*)::int from public.profiles), 2, 'après le follow, alice peut lire le profil de bob directement');
select throws_ok($$ insert into public.follows (follower_id, followee_id, status) values (auth.uid(), 'd0000000-0000-0000-0000-00000000000d', 'active') $$,
  '42501', null, 'insertion directe dans follows interdite (RPC obligatoire)');
select throws_ok($$ update public.profiles set followers_count = 999 where id = auth.uid() $$,
  '42501', null, 'compteurs non modifiables par le client');

-- ---------------------------------------------------------------------------
-- Compte privé : demande, acceptation, refus
-- ---------------------------------------------------------------------------
select is(public.follow_user('c0000000-0000-0000-0000-00000000000c')::text, 'requested', 'suivre un compte privé : demande');
select is((select followers_count from public.get_profile('c0000000-0000-0000-0000-00000000000c')), 0, 'une demande ne compte pas comme abonné');
select is((select can_view from public.get_profile('c0000000-0000-0000-0000-00000000000c')), false, 'demande en attente : contenu toujours masqué');
select pg_temp.login('d0000000-0000-0000-0000-00000000000d');
select public.follow_user('c0000000-0000-0000-0000-00000000000c');

select pg_temp.login('c0000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.get_follow_requests()), 2, 'carol voit 2 demandes');
select public.respond_follow_request('a0000000-0000-0000-0000-00000000000a', true);
select public.respond_follow_request('d0000000-0000-0000-0000-00000000000d', false);
select is((select count(*)::int from public.get_follow_requests()), 0, 'plus de demande en attente');
select is((select followers_count from public.get_profile(auth.uid())), 1, 'carol : 1 abonné après acceptation');

select pg_temp.login('a0000000-0000-0000-0000-00000000000a');
select is((select can_view from public.get_profile('c0000000-0000-0000-0000-00000000000c')), true, 'alice acceptée : contenu visible');
select pg_temp.login('d0000000-0000-0000-0000-00000000000d');
select is((select i_follow from public.get_profile('c0000000-0000-0000-0000-00000000000c')), null, 'dave refusé : aucune relation');
select is((select count(*)::int from public.get_followers('c0000000-0000-0000-0000-00000000000c')), 0, 'dave ne voit pas les abonnés d''un compte privé');

-- Retrait d'un abonné puis compte repassé en public : demandes acceptées automatiquement
select public.follow_user('c0000000-0000-0000-0000-00000000000c');
select pg_temp.login('c0000000-0000-0000-0000-00000000000c');
select public.remove_follower('a0000000-0000-0000-0000-00000000000a');
select is((select followers_count from public.get_profile(auth.uid())), 0, 'abonné retiré : compteur à 0');
update public.profiles set is_private = false where id = auth.uid();
select is((select followers_count from public.get_profile(auth.uid())), 1, 'repasse en public : la demande de dave est acceptée');
update public.profiles set is_private = true where id = auth.uid();

-- ---------------------------------------------------------------------------
-- Publications
-- ---------------------------------------------------------------------------
reset role;
insert into storage.objects (bucket_id, name) values
  ('posts', 'b0000000-0000-0000-0000-00000000000b/p1.jpg'),
  ('posts', 'b0000000-0000-0000-0000-00000000000b/p2.jpg'),
  ('posts', 'c0000000-0000-0000-0000-00000000000c/c1.jpg'),
  ('posts', 'a0000000-0000-0000-0000-00000000000a/a1.jpg'),
  ('stories', 'b0000000-0000-0000-0000-00000000000b/s1.jpg'),
  ('stories', 'b0000000-0000-0000-0000-00000000000b/s2.jpg');
set local role authenticated;

select pg_temp.login('b0000000-0000-0000-0000-00000000000b');
select lives_ok($$ select public.create_post('Hello', '[{"path":"b0000000-0000-0000-0000-00000000000b/p1.jpg","width":1080,"height":1350},{"path":"b0000000-0000-0000-0000-00000000000b/p2.jpg","width":1080,"height":1080}]') $$,
  'bob publie un carrousel de 2 photos');
select throws_ok($$ select public.create_post('vol', '[{"path":"a0000000-0000-0000-0000-00000000000a/a1.jpg"}]') $$,
  '22023', 'invalid_media_path', 'impossible de publier la photo d''un autre');
select throws_ok($$ select public.create_post('fantôme', '[{"path":"b0000000-0000-0000-0000-00000000000b/inexistant.jpg"}]') $$,
  '22023', 'invalid_media_path', 'impossible de publier un fichier non envoyé');
select throws_ok($$ select public.create_post('vide', '[]') $$, '22023', 'invalid_media_count', 'au moins une photo');
select throws_ok($$ select public.create_post('trop', (select jsonb_agg(jsonb_build_object('path', 'x' || g)) from generate_series(1, 11) g)) $$,
  '22023', 'invalid_media_count', '10 photos maximum');
select is((select posts_count from public.get_profile(auth.uid())), 1, 'compteur de publications de bob');
select is((select jsonb_array_length(media) from public.get_user_posts(auth.uid()) limit 1), 2, 'les 2 photos sont dans l''ordre');

select pg_temp.login('c0000000-0000-0000-0000-00000000000c');
select public.create_post('Privé', '[{"path":"c0000000-0000-0000-0000-00000000000c/c1.jpg"}]');

-- Fil d'alice : suit bob (public) ; ne suit plus carol
select pg_temp.login('a0000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.get_feed()), 1, 'fil d''alice : la publication de bob uniquement');
select is((select count(*)::int from public.get_user_posts('c0000000-0000-0000-0000-00000000000c')), 0, 'publications d''un compte privé non suivi : masquées');
select is((select count(*)::int from public.posts where author_id = 'c0000000-0000-0000-0000-00000000000c'), 0, 'idem en lecture directe');

-- Dave suit carol (accepté) : voit sa publication
select pg_temp.login('d0000000-0000-0000-0000-00000000000d');
select is((select count(*)::int from public.get_feed()), 1, 'fil de dave : la publication privée de carol (abonné accepté)');
select is((select count(*)::int from public.get_user_posts('b0000000-0000-0000-0000-00000000000b')), 1, 'compte public : publications visibles sans abonnement');
select is((select count(*)::int from public.get_feed() where author_id = 'b0000000-0000-0000-0000-00000000000b'), 0, '…mais pas dans le fil sans abonnement');

-- Lecture des fichiers (condition des URLs signées)
select is((select count(*)::int from storage.objects where bucket_id = 'posts' and name like 'b000%'), 2, 'fichiers d''un post public lisibles');
select is((select count(*)::int from storage.objects where bucket_id = 'posts' and name like 'c000%'), 1, 'fichiers d''un post privé lisibles par un abonné');
select pg_temp.login('a0000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from storage.objects where bucket_id = 'posts' and name like 'c000%'), 0, 'fichiers d''un post privé illisibles sans abonnement');

-- Suppression
select pg_temp.login('a0000000-0000-0000-0000-00000000000a');
delete from public.posts where author_id = 'b0000000-0000-0000-0000-00000000000b';
select is((select count(*)::int from public.get_user_posts('b0000000-0000-0000-0000-00000000000b')), 1, 'impossible de supprimer la publication d''un autre');
select pg_temp.login('b0000000-0000-0000-0000-00000000000b');
delete from public.posts where author_id = auth.uid();
select is((select count(*)::int from public.get_user_posts(auth.uid())), 0, 'je supprime ma publication');
select is((select posts_count from public.get_profile(auth.uid())), 0, 'compteur décrémenté');

-- ---------------------------------------------------------------------------
-- Stories
-- ---------------------------------------------------------------------------
select lives_ok($$ select public.create_story('b0000000-0000-0000-0000-00000000000b/s1.jpg') $$, 'bob publie une story');
select throws_ok($$ select public.create_story('a0000000-0000-0000-0000-00000000000a/a1.jpg') $$, '22023', 'invalid_media_path', 'story avec le fichier d''un autre refusée');
select public.create_story('b0000000-0000-0000-0000-00000000000b/s2.jpg');
reset role;
-- La 2e story a été publiée il y a 25 h : expirée
update public.stories set created_at = now() - interval '25 hours', expires_at = now() - interval '1 hour'
 where storage_path like '%s2.jpg';
set local role authenticated;

select pg_temp.login('a0000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.get_story_tray()), 1, 'alice voit bob dans le bandeau de stories');
select is((select has_unseen from public.get_story_tray() limit 1), true, 'story non vue');
select is((select count(*)::int from public.get_user_stories('b0000000-0000-0000-0000-00000000000b')), 1, 'la story expirée n''est plus visible');
select is((select count(*)::int from storage.objects where bucket_id = 'stories' and name like '%s2.jpg'), 0, 'le fichier d''une story expirée n''est plus lisible');
select public.mark_story_viewed((select id from public.get_user_stories('b0000000-0000-0000-0000-00000000000b') limit 1));
select is((select has_unseen from public.get_story_tray() limit 1), false, 'story marquée comme vue');

select pg_temp.login('d0000000-0000-0000-0000-00000000000d');
select is((select count(*)::int from public.get_story_tray()), 0, 'dave ne suit pas bob : pas de story dans son bandeau');

select pg_temp.login('b0000000-0000-0000-0000-00000000000b');
select is((select view_count from public.get_user_stories(auth.uid()) limit 1), 1, 'bob voit 1 vue sur sa story');
select is((select username from public.get_story_viewers((select id from public.get_user_stories(auth.uid()) limit 1))), 'alice', 'bob sait qu''alice l''a vue');

select * from finish();
rollback;
