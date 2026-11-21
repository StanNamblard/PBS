-- Tests pgTAP — Phase 1 : chaque utilisateur n'écrit que dans son dossier d'avatars.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@test.dev'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@test.dev');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);

select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('avatars', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/x.jpg') $$,
  'upload dans mon propre dossier autorisé');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('avatars', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/x.jpg') $$,
  '42501', null, 'upload dans le dossier d''un autre refusé');

select public.verify_age(date '1990-01-01');
select throws_ok(
  $$ select public.complete_onboarding('user_a', null, null, 'FR', 'fr', 'Europe/Paris', '{fr}', 'v1',
                                       'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/x.jpg') $$,
  '22023', 'invalid_avatar_path', 'avatar pointant vers le dossier d''un autre refusé (onboarding)');
select public.complete_onboarding('user_a', null, null, 'FR', 'fr', 'Europe/Paris', '{fr}', 'v1');
select throws_ok(
  $$ update public.profiles set avatar_path = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/x.jpg' where id = auth.uid() $$,
  '42501', null, 'avatar pointant vers le dossier d''un autre refusé (mise à jour)');

select * from finish();
rollback;
