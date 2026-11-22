-- =============================================================================
-- BPS — Phase 4 : QR code personnel (suivre quelqu'un en scannant son code)
-- =============================================================================
-- Sécurité :
--  * Le QR contient un JETON ALÉATOIRE de 128 bits (pas l'identifiant de
--    l'utilisateur) : impossible de deviner le code de quelqu'un.
--  * Le serveur ne stocke que l'EMPREINTE SHA-256 du jeton : même en cas de fuite
--    de la base, les QR codes ne peuvent pas être reconstitués.
--  * Un seul jeton actif par utilisateur ; « régénérer » révoque l'ancien.
--  * Les résolutions de jetons sont limitées (anti force brute / anti-robots).
--  * Scanner = follow SIMPLE (source « qr ») ; la personne scannée décide seule
--    de suivre en retour. Compte privé → demande d'abonnement.
-- =============================================================================

create table public.qr_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index one_active_qr_per_user on public.qr_tokens (user_id) where revoked_at is null;

-- Journal des tentatives de résolution (limitation de débit)
create table public.qr_scan_attempts (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  success    boolean not null
);
create index qr_scan_attempts_idx on public.qr_scan_attempts (user_id, created_at desc);

alter table public.qr_tokens enable row level security;
alter table public.qr_scan_attempts enable row level security;
revoke all on public.qr_tokens, public.qr_scan_attempts from anon, authenticated;
-- Aucune lecture directe : tout passe par les fonctions ci-dessous.

-- Empreinte d'un jeton
create or replace function public._qr_hash(p_token text)
returns bytea
language sql
immutable
set search_path = ''
as $$
  select extensions.digest(convert_to(p_token, 'UTF8'), 'sha256');
$$;

-- RPC : (re)génère MON jeton. Révoque l'ancien. Renvoie le jeton EN CLAIR
-- (une seule fois : l'app le garde sur le téléphone ; le serveur n'en garde que l'empreinte).
create or replace function public.regenerate_qr_token()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  if not public.is_active_user(auth.uid()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  -- 16 octets aléatoires → 22 caractères base64url (A-Z a-z 0-9 - _)
  v_token := rtrim(translate(encode(extensions.gen_random_bytes(16), 'base64'), '+/', '-_'), '=');

  update public.qr_tokens set revoked_at = now() where user_id = auth.uid() and revoked_at is null;
  insert into public.qr_tokens (user_id, token_hash) values (auth.uid(), public._qr_hash(v_token));
  return v_token;
end;
$$;

-- Vérifie la limite de débit et journalise. 60 scans / heure, 10 échecs / heure.
create or replace function public._qr_check_rate()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.qr_scan_attempts
       where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 60
     or (select count(*) from public.qr_scan_attempts
          where user_id = auth.uid() and created_at > now() - interval '1 hour' and not success) >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
end;
$$;

-- Trouve le propriétaire d'un jeton actif (null si inconnu / révoqué)
create or replace function public._qr_owner(p_token text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select q.user_id
  from public.qr_tokens q
  where q.token_hash = public._qr_hash(p_token)
    and q.revoked_at is null
    and public.is_active_user(q.user_id);
$$;

-- RPC : que contient ce QR code ? Renvoie la carte de profil de son propriétaire.
create or replace function public.resolve_qr_token(p_token text)
returns table (
  id uuid, username text, display_name text, avatar_path text, country_code text, bio text,
  is_private boolean, followers_count integer, is_me boolean, i_follow public.follow_status, follows_me boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  if not public.is_active_user(auth.uid()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  perform public._qr_check_rate();

  v_owner := case when p_token ~ '^[A-Za-z0-9_-]{22}$' then public._qr_owner(p_token) end;
  insert into public.qr_scan_attempts (user_id, success) values (auth.uid(), v_owner is not null);

  if v_owner is null then
    raise exception 'qr_invalid' using errcode = 'P0002';
  end if;

  return query
    select p.id, p.username::text, p.display_name, p.avatar_path, p.country_code::text, p.bio,
           p.is_private, p.followers_count, p.id = auth.uid(),
           (select f.status from public.follows f where f.follower_id = auth.uid() and f.followee_id = p.id),
           public.is_following(p.id, auth.uid())
    from public.profiles p where p.id = v_owner;
end;
$$;

-- RPC : suivre le propriétaire d'un QR code (follow simple, source « qr »)
create or replace function public.follow_by_qr(p_token text)
returns public.follow_status
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  if not public.is_active_user(auth.uid()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  perform public._qr_check_rate();
  v_owner := case when p_token ~ '^[A-Za-z0-9_-]{22}$' then public._qr_owner(p_token) end;
  insert into public.qr_scan_attempts (user_id, success) values (auth.uid(), v_owner is not null);
  if v_owner is null then
    raise exception 'qr_invalid' using errcode = 'P0002';
  end if;
  if v_owner = auth.uid() then
    raise exception 'cannot_follow_self' using errcode = 'P0001';
  end if;
  return public._follow(auth.uid(), v_owner, 'qr');
end;
$$;

revoke execute on function
  public._qr_hash(text),
  public.regenerate_qr_token(),
  public._qr_check_rate(),
  public._qr_owner(text),
  public.resolve_qr_token(text),
  public.follow_by_qr(text)
from public, anon, authenticated;

grant execute on function
  public.regenerate_qr_token(),
  public.resolve_qr_token(text),
  public.follow_by_qr(text)
to authenticated;
