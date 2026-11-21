-- =============================================================================
-- BPS — Phase 1 : identité, profils, contrôle d'âge (18+)
-- =============================================================================
-- Principes :
--  * Toutes les tables ont la RLS activée.
--  * Les écritures sensibles (création de profil, date de naissance) passent
--    UNIQUEMENT par des fonctions RPC "security definer" qui vérifient les règles.
--    Le client n'a jamais le droit d'insérer directement dans ces tables.
--  * Les données privées (date de naissance, statut, préférences) sont séparées
--    du profil public et ne sont lisibles que par leur propriétaire.
-- =============================================================================

create extension if not exists citext with schema extensions;

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------
create type public.account_status as enum ('active', 'suspended', 'banned', 'deleted');

-- Niveau de vérification de l'âge. Seul 'self_declared' est utilisé au lancement ;
-- les autres niveaux sont prévus pour brancher plus tard les signaux d'âge des
-- stores (Apple Declared Age Range, Google Play Age Signals) ou un prestataire
-- de vérification d'identité.
create type public.age_level as enum ('self_declared', 'store_signal', 'id_verified');

-- -----------------------------------------------------------------------------
-- Utilitaire : updated_at automatique
-- -----------------------------------------------------------------------------
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Langues supportées par l'interface (les 10 langues les plus parlées)
-- en, zh, hi, es, fr, ar, bn, pt, ru, ur
-- -----------------------------------------------------------------------------
create or replace function public.is_supported_locale(p_locale text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_locale = any (array['en','zh','hi','es','fr','ar','bn','pt','ru','ur']);
$$;

-- -----------------------------------------------------------------------------
-- Données privées de l'utilisateur (1–1 avec auth.users)
-- Créée par verify_age() ; jamais lisible par un autre utilisateur.
-- -----------------------------------------------------------------------------
create table public.user_private (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  birth_date          date not null,
  age_level           public.age_level not null default 'self_declared',
  age_verified_at     timestamptz not null default now(),
  status              public.account_status not null default 'active',
  locale              text not null default 'en' check (public.is_supported_locale(locale)),
  timezone            text not null default 'UTC',
  languages           text[] not null default '{}',   -- langues parlées (préférence de matching, phase 3)
  match_same_language boolean not null default false,
  terms_version       text,
  terms_accepted_at   timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint birth_date_plausible check (birth_date >= date '1900-01-01')
);

create trigger user_private_updated_at
  before update on public.user_private
  for each row execute function public.tg_set_updated_at();

-- La date de naissance ne peut JAMAIS être modifiée après sa saisie
-- (empêche de contourner le contrôle d'âge). Une correction éventuelle
-- passera par le support / une vérification d'identité.
create or replace function public.tg_user_private_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.birth_date is distinct from old.birth_date then
    raise exception 'birth_date_immutable' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger user_private_guard
  before update on public.user_private
  for each row execute function public.tg_user_private_guard();

-- -----------------------------------------------------------------------------
-- Refus d'âge : un compte qui a déclaré < 18 ans est bloqué définitivement
-- -----------------------------------------------------------------------------
create table public.age_gate_rejections (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  rejected_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Vérifications d'âge renforcées (prévu, non utilisé au lancement)
-- On ne stocke JAMAIS de pièce d'identité : seulement le résultat et
-- la référence chez le prestataire.
-- -----------------------------------------------------------------------------
create table public.age_verifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  provider   text not null,      -- 'apple_age_range' | 'google_age_signals' | 'yoti' | ...
  result     text not null check (result in ('adult', 'minor', 'failed')),
  reference  text,
  created_at timestamptz not null default now()
);
create index age_verifications_user_idx on public.age_verifications (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Profil PUBLIC
-- -----------------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  username        extensions.citext not null unique,
  display_name    text check (char_length(display_name) <= 50),
  bio             text check (char_length(bio) <= 160),
  avatar_path     text,
  country_code    char(2) check (country_code ~ '^[A-Z]{2}$'),
  is_private      boolean not null default false,
  followers_count integer not null default 0,
  following_count integer not null default 0,
  posts_count     integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- 3 à 30 caractères : minuscules, chiffres, "_" et "." ; pas de "." au début/à la fin ni ".."
  constraint username_format check (
    username::text ~ '^[a-z0-9_.]{3,30}$'
    and username::text !~ '^\.|\.$|\.\.'
  )
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- Noms réservés (marque, support, usurpation)
create or replace function public.is_reserved_username(p_username text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(p_username) = any (array[
    'admin','administrator','root','support','help','bps','official','team',
    'moderator','moderation','security','staff','system','null','undefined',
    'me','settings','api','www','app'
  ]);
$$;

-- -----------------------------------------------------------------------------
-- Helpers de sécurité
-- -----------------------------------------------------------------------------
-- Un utilisateur est "actif" s'il a terminé l'onboarding et n'est ni suspendu,
-- ni banni, ni supprimé.
create or replace function public.is_active_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_private up
    join public.profiles p on p.id = up.user_id
    where up.user_id = p_user_id
      and up.status = 'active'
  );
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.user_private        enable row level security;
alter table public.age_gate_rejections enable row level security;
alter table public.age_verifications   enable row level security;
alter table public.profiles            enable row level security;

-- Aucun accès anonyme aux données de l'app
revoke all on public.user_private, public.age_gate_rejections,
              public.age_verifications, public.profiles from anon;

-- user_private : lecture de MA ligne uniquement ; mises à jour limitées
-- à quelques colonnes de préférences (la date de naissance, le statut et
-- le niveau de vérification ne sont jamais modifiables par le client).
revoke all on public.user_private from authenticated;
grant select on public.user_private to authenticated;
grant update (locale, timezone, languages, match_same_language) on public.user_private to authenticated;

create policy "user_private: lecture par le propriétaire"
  on public.user_private for select to authenticated
  using (user_id = (select auth.uid()));

create policy "user_private: mise à jour par le propriétaire"
  on public.user_private for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- age_gate_rejections / age_verifications : aucun accès client (service uniquement)
revoke all on public.age_gate_rejections, public.age_verifications from authenticated;

-- profiles : lecture des profils actifs (et du mien) par les utilisateurs connectés.
-- NB : il n'existe volontairement AUCUNE fonction de recherche. Le blocage
-- (phase 6) viendra restreindre cette politique.
revoke all on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (username, display_name, bio, avatar_path, country_code, is_private)
  on public.profiles to authenticated;

create policy "profiles: lecture des profils actifs"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_active_user(id));

create policy "profiles: mise à jour de mon profil"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and not public.is_reserved_username(username::text)
    -- l'avatar doit se trouver dans MON dossier de stockage
    and (avatar_path is null or avatar_path like (select auth.uid())::text || '/%')
  );

-- -----------------------------------------------------------------------------
-- RPC : état de l'onboarding
-- Renvoie : 'underage' | 'age_required' | 'profile_required' | 'suspended' | 'complete'
-- -----------------------------------------------------------------------------
create or replace function public.get_onboarding_state()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_status public.account_status;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if exists (select 1 from public.age_gate_rejections where user_id = v_uid) then
    return 'underage';
  end if;

  select status into v_status from public.user_private where user_id = v_uid;
  if not found then
    return 'age_required';
  end if;

  if v_status <> 'active' then
    return 'suspended';
  end if;

  if not exists (select 1 from public.profiles where id = v_uid) then
    return 'profile_required';
  end if;

  return 'complete';
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC : contrôle d'âge
-- * < 18 ans → enregistre un refus DÉFINITIF pour ce compte, renvoie false
-- * ≥ 18 ans → crée user_private, renvoie true
-- * date déjà saisie → erreur (pas de seconde tentative)
-- -----------------------------------------------------------------------------
create or replace function public.verify_age(p_birth_date date)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if exists (select 1 from public.age_gate_rejections where user_id = v_uid) then
    raise exception 'underage_locked' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.user_private where user_id = v_uid) then
    raise exception 'birth_date_already_set' using errcode = 'P0001';
  end if;

  if p_birth_date is null
     or p_birth_date < date '1900-01-01'
     or p_birth_date > current_date then
    raise exception 'invalid_birth_date' using errcode = '22023';
  end if;

  -- Majeur = au moins 18 ans révolus aujourd'hui (UTC).
  if p_birth_date > (current_date - interval '18 years')::date then
    insert into public.age_gate_rejections (user_id) values (v_uid)
      on conflict (user_id) do nothing;
    return false;
  end if;

  insert into public.user_private (user_id, birth_date) values (v_uid, p_birth_date);
  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC : disponibilité d'un pseudo
-- -----------------------------------------------------------------------------
create or replace function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_username ~ '^[a-z0-9_.]{3,30}$'
    and p_username !~ '^\.|\.$|\.\.'
    and not public.is_reserved_username(p_username)
    and not exists (
      select 1 from public.profiles
      where username = p_username::extensions.citext
        and id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
    );
$$;

-- -----------------------------------------------------------------------------
-- RPC : fin de l'onboarding (acceptation des CGU + création du profil)
-- -----------------------------------------------------------------------------
create or replace function public.complete_onboarding(
  p_username      text,
  p_display_name  text,
  p_bio           text,
  p_country_code  text,
  p_locale        text,
  p_timezone      text,
  p_languages     text[],
  p_terms_version text,
  p_avatar_path   text default null
)
returns public.profiles
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_profile public.profiles;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if public.get_onboarding_state() <> 'profile_required' then
    raise exception 'onboarding_not_allowed' using errcode = 'P0001';
  end if;

  if p_terms_version is null or length(p_terms_version) = 0 then
    raise exception 'terms_required' using errcode = '22023';
  end if;

  if not public.is_username_available(lower(p_username)) then
    raise exception 'username_unavailable' using errcode = '23505';
  end if;

  if not public.is_supported_locale(p_locale) then
    raise exception 'invalid_locale' using errcode = '22023';
  end if;

  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'invalid_timezone' using errcode = '22023';
  end if;

  if p_avatar_path is not null and p_avatar_path not like v_uid::text || '/%' then
    raise exception 'invalid_avatar_path' using errcode = '22023';
  end if;

  update public.user_private
     set terms_version     = p_terms_version,
         terms_accepted_at = now(),
         locale            = p_locale,
         timezone          = p_timezone,
         languages         = coalesce(p_languages, '{}')
   where user_id = v_uid;

  insert into public.profiles (id, username, display_name, bio, country_code, avatar_path)
  values (
    v_uid,
    lower(p_username),
    nullif(trim(p_display_name), ''),
    nullif(trim(p_bio), ''),
    upper(nullif(p_country_code, '')),
    p_avatar_path
  )
  returning * into v_profile;

  return v_profile;
end;
$$;

-- Les fonctions RPC ne sont accessibles qu'aux utilisateurs connectés
revoke execute on function public.get_onboarding_state() from public, anon;
revoke execute on function public.verify_age(date) from public, anon;
revoke execute on function public.is_username_available(text) from public, anon;
revoke execute on function public.complete_onboarding(text, text, text, text, text, text, text[], text, text) from public, anon;
revoke execute on function public.is_active_user(uuid) from public, anon;

grant execute on function public.get_onboarding_state() to authenticated;
grant execute on function public.verify_age(date) to authenticated;
grant execute on function public.is_username_available(text) to authenticated;
grant execute on function public.complete_onboarding(text, text, text, text, text, text, text[], text, text) to authenticated;
grant execute on function public.is_active_user(uuid) to authenticated;
