-- =============================================================================
-- BPS — Phase 5 (2/2) : messagerie privée + boîte « Demandes »
-- =============================================================================
-- Règles :
--  * Seul quelqu'un qui me SUIT peut m'écrire (ou quelqu'un dont j'ai accepté la
--    conversation, pour pouvoir répondre).
--  * Le dossier est calculé PAR PARTICIPANT :
--      - je suis l'autre personne        → « primary » (boîte principale)
--      - je ne la suis pas               → « requests » (Demandes)
--      - j'ai accepté la demande          → « primary » définitivement
--    Dès que je suis l'autre, la conversation bascule AUTOMATIQUEMENT en
--    principale (déclencheur sur la table follows).
--  * Tant qu'une demande n'est pas acceptée : 1 seul message, texte uniquement,
--    et aucun accusé de lecture.
--  * Bloquer = plus aucun message possible, conversation masquée.
-- =============================================================================

create type public.inbox_folder as enum ('primary', 'requests');

create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  user_low        uuid not null references public.profiles (id) on delete cascade,
  user_high       uuid not null references public.profiles (id) on delete cascade,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz,
  unique (user_low, user_high),
  constraint conversation_order check (user_low < user_high)
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  folder          public.inbox_folder not null,
  accepted_at     timestamptz,       -- non null = la conversation est « acceptée » pour ce participant
  last_read_at    timestamptz,       -- accusés de lecture
  hidden_at       timestamptz,       -- « supprimer la conversation » (de mon côté uniquement)
  primary key (conversation_id, user_id)
);
create index conversation_members_user_idx on public.conversation_members (user_id, folder);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id) on delete cascade,
  body            text check (char_length(body) between 1 and 2000),
  media_path      text unique,
  -- clock_timestamp : horodatage précis même pour plusieurs messages d'une même transaction
  created_at      timestamptz not null default clock_timestamp(),
  constraint message_not_empty check (body is not null or media_path is not null)
);
create index messages_conversation_idx on public.messages (conversation_id, created_at desc);
create index messages_sender_idx on public.messages (sender_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Aides
-- -----------------------------------------------------------------------------
create or replace function public._conversation_between(p_a uuid, p_b uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.conversations where user_low = least(p_a, p_b) and user_high = greatest(p_a, p_b);
$$;

-- Un message est-il visible pour l'utilisateur connecté ?
-- (membre de la conversation, message postérieur à une éventuelle suppression, pas de blocage)
create or replace function public._can_read_message(p_conversation uuid, p_created_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members m
    join public.conversations c on c.id = m.conversation_id
    where m.conversation_id = p_conversation
      and m.user_id = auth.uid()
      and p_created_at > coalesce(m.hidden_at, '-infinity'::timestamptz)
      and not public.is_blocked(c.user_low, c.user_high)
  );
$$;

-- Quand A se met à suivre B : la conversation devient « principale » pour A,
-- définitivement (accepted_at). C'est la bascule automatique Demandes → Principale.
create or replace function public.tg_follow_moves_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' then
    update public.conversation_members m
       set folder = 'primary', accepted_at = coalesce(m.accepted_at, now())
     where m.user_id = new.follower_id
       and m.conversation_id = public._conversation_between(new.follower_id, new.followee_id);
  end if;
  return null;
end;
$$;

create trigger follows_move_conversation
  after insert or update of status on public.follows
  for each row execute function public.tg_follow_moves_conversation();

-- -----------------------------------------------------------------------------
-- RLS : lecture uniquement, écritures via les fonctions
-- -----------------------------------------------------------------------------
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
revoke all on public.conversations, public.conversation_members, public.messages from anon, authenticated;
grant select on public.conversations, public.conversation_members, public.messages to authenticated;

create policy "conversations: les miennes" on public.conversations for select to authenticated
  using ((select auth.uid()) in (user_low, user_high));
create policy "conversation_members: mes participations" on public.conversation_members for select to authenticated
  using (user_id = (select auth.uid()));
create policy "messages: ceux de mes conversations" on public.messages for select to authenticated
  using (public._can_read_message(conversation_id, created_at));

-- Temps réel : l'app est prévenue instantanément des nouveaux messages
-- (Supabase applique les mêmes règles RLS aux abonnements temps réel).
alter publication supabase_realtime add table public.messages, public.conversation_members;

-- -----------------------------------------------------------------------------
-- Envoi
-- -----------------------------------------------------------------------------
create or replace function public.send_message(p_to uuid, p_body text, p_media_path text default null)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me     uuid := auth.uid();
  v_conv   uuid;
  v_mine   public.conversation_members;
  v_theirs public.conversation_members;
  v_body   text := nullif(trim(p_body), '');
  v_id     uuid;
begin
  if not public.is_active_user(v_me) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_to = v_me then
    raise exception 'cannot_message_self' using errcode = 'P0001';
  end if;
  if not public.is_active_user(p_to) or public.is_blocked(v_me, p_to) then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  if v_body is null and p_media_path is null then
    raise exception 'empty_message' using errcode = '22023';
  end if;
  if p_media_path is not null and not public._owns_uploaded_file('dm', p_media_path) then
    raise exception 'invalid_media_path' using errcode = '22023';
  end if;
  -- Anti-spam : 30 messages par minute maximum
  if (select count(*) from public.messages where sender_id = v_me and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  v_conv := public._conversation_between(v_me, p_to);
  if v_conv is not null then
    select * into v_mine from public.conversation_members where conversation_id = v_conv and user_id = v_me;
  end if;

  -- Droit d'écrire : je suis l'autre, ou j'ai accepté sa conversation
  if not public.is_following(v_me, p_to) and v_mine.accepted_at is null then
    raise exception 'must_follow' using errcode = 'P0001';
  end if;

  if v_conv is null then
    insert into public.conversations (user_low, user_high)
    values (least(v_me, p_to), greatest(v_me, p_to))
    on conflict (user_low, user_high) do nothing;
    v_conv := public._conversation_between(v_me, p_to);
    insert into public.conversation_members (conversation_id, user_id, folder, accepted_at)
    values
      (v_conv, v_me, 'primary', now()),
      (v_conv, p_to,
        case when public.is_following(p_to, v_me) then 'primary'::public.inbox_folder else 'requests'::public.inbox_folder end,
        case when public.is_following(p_to, v_me) then now() end)
    on conflict do nothing;
  end if;

  -- Verrou sur la conversation : sérialise les envois simultanés (limite des demandes)
  perform 1 from public.conversations where id = v_conv for update;

  -- Si j'avais supprimé la conversation de mon côté puis que j'écris, elle réapparaît
  update public.conversation_members
     set accepted_at = coalesce(accepted_at, now()), folder = 'primary'
   where conversation_id = v_conv and user_id = v_me;

  select * into v_theirs from public.conversation_members where conversation_id = v_conv and user_id = p_to;
  if v_theirs.accepted_at is null then
    -- Demande en attente : 1 seul message, texte uniquement
    if p_media_path is not null then
      raise exception 'no_media_in_requests' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.messages where conversation_id = v_conv and sender_id = v_me) then
      raise exception 'request_pending' using errcode = 'P0001';
    end if;
  end if;

  insert into public.messages (conversation_id, sender_id, body, media_path)
  values (v_conv, v_me, v_body, p_media_path)
  returning id into v_id;

  update public.conversations set last_message_at = now() where id = v_conv;
  update public.conversation_members set last_read_at = clock_timestamp() where conversation_id = v_conv and user_id = v_me;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Lecture
-- -----------------------------------------------------------------------------
-- Boîte de réception (principale ou demandes)
create or replace function public.get_inbox(p_folder public.inbox_folder)
returns table (
  conversation_id uuid, other_id uuid, other_username text, other_display_name text, other_avatar_path text,
  last_message_at timestamptz, last_body text, last_has_media boolean, last_from_me boolean, unread boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, o.id, o.username::text, o.display_name, o.avatar_path,
         lm.created_at, lm.body, lm.media_path is not null, lm.sender_id = auth.uid(),
         lm.sender_id <> auth.uid() and (m.last_read_at is null or lm.created_at > m.last_read_at)
  from public.conversation_members m
  join public.conversations c on c.id = m.conversation_id
  join public.profiles o on o.id = case when c.user_low = auth.uid() then c.user_high else c.user_low end
  cross join lateral (
    select x.created_at, x.body, x.media_path, x.sender_id
    from public.messages x
    where x.conversation_id = c.id and x.created_at > coalesce(m.hidden_at, '-infinity'::timestamptz)
    order by x.created_at desc
    limit 1
  ) lm
  where m.user_id = auth.uid()
    and m.folder = p_folder
    and public.is_active_user(o.id)
    and not public.is_blocked(auth.uid(), o.id)
  order by lm.created_at desc
  limit 200;
$$;

-- Compteurs pour les badges (messages non lus en principale, demandes en attente)
create or replace function public.get_inbox_counts()
returns table (primary_unread integer, requests integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::integer from public.get_inbox('primary') where unread),
    (select count(*)::integer from public.get_inbox('requests'));
$$;

-- Ouvrir la conversation avec quelqu'un (même si elle n'existe pas encore)
create or replace function public.get_conversation(p_other uuid)
returns table (
  conversation_id uuid,
  other_id uuid, other_username text, other_display_name text, other_avatar_path text,
  my_folder public.inbox_folder, i_accepted boolean,
  can_send boolean, blocked_reason text,
  other_accepted boolean,             -- l'autre a-t-il accepté ? (photos autorisées)
  other_last_read_at timestamptz     -- null si les accusés de lecture ne s'appliquent pas
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_me     uuid := auth.uid();
  v_conv   uuid;
  v_mine   public.conversation_members;
  v_theirs public.conversation_members;
  v_reason text;
begin
  if not public.is_active_user(v_me) or p_other = v_me
     or not public.is_active_user(p_other) or public.is_blocked(v_me, p_other) then
    return;
  end if;
  v_conv := public._conversation_between(v_me, p_other);
  if v_conv is not null then
    select * into v_mine from public.conversation_members where conversation_id = v_conv and user_id = v_me;
    select * into v_theirs from public.conversation_members where conversation_id = v_conv and user_id = p_other;
  end if;

  if not public.is_following(v_me, p_other) and v_mine.accepted_at is null then
    v_reason := 'must_follow';
  elsif v_conv is not null and v_theirs.accepted_at is null
        and exists (select 1 from public.messages where conversation_id = v_conv and sender_id = v_me) then
    v_reason := 'request_pending';
  end if;

  return query
    select v_conv, p.id, p.username::text, p.display_name, p.avatar_path,
           coalesce(v_mine.folder, 'primary'::public.inbox_folder),
           v_mine.accepted_at is not null,
           v_reason is null,
           v_reason,
           v_theirs.accepted_at is not null,
           -- Accusés de lecture : seulement si l'autre a la conversation en principale
           case when v_theirs.accepted_at is not null then v_theirs.last_read_at end
    from public.profiles p where p.id = p_other;
end;
$$;

-- Marquer comme lu (sans effet visible pour l'autre tant que je n'ai pas accepté)
create or replace function public.mark_conversation_read(p_conversation uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.conversation_members set last_read_at = clock_timestamp()
   where conversation_id = p_conversation and user_id = auth.uid();
$$;

-- Accepter une demande → boîte principale
create or replace function public.accept_conversation(p_conversation uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.conversation_members set accepted_at = coalesce(accepted_at, now()), folder = 'primary'
   where conversation_id = p_conversation and user_id = auth.uid();
$$;

-- Supprimer la conversation DE MON CÔTÉ (l'autre la garde). Elle réapparaît si un nouveau message arrive.
create or replace function public.delete_conversation(p_conversation uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.conversation_members set hidden_at = clock_timestamp()
   where conversation_id = p_conversation and user_id = auth.uid();
$$;

-- -----------------------------------------------------------------------------
-- Photos des messages : bucket PRIVÉ « dm »
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dm', 'dm', false, 10 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_read_dm_file(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_name like auth.uid()::text || '/%'
    or exists (
      select 1 from public.messages x
      where x.media_path = p_name and public._can_read_message(x.conversation_id, x.created_at)
    );
$$;

create policy "dm: upload dans mon dossier" on storage.objects for insert to authenticated
  with check (bucket_id = 'dm' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "dm: lecture par les participants" on storage.objects for select to authenticated
  using (bucket_id = 'dm' and public.can_read_dm_file(name));

-- -----------------------------------------------------------------------------
-- Droits d'exécution
-- -----------------------------------------------------------------------------
revoke execute on function
  public._conversation_between(uuid, uuid),
  public._can_read_message(uuid, timestamptz),
  public.send_message(uuid, text, text),
  public.get_inbox(public.inbox_folder),
  public.get_inbox_counts(),
  public.get_conversation(uuid),
  public.mark_conversation_read(uuid),
  public.accept_conversation(uuid),
  public.delete_conversation(uuid),
  public.can_read_dm_file(text)
from public, anon, authenticated;

grant execute on function
  public.send_message(uuid, text, text),
  public.get_inbox(public.inbox_folder),
  public.get_inbox_counts(),
  public.get_conversation(uuid),
  public.mark_conversation_read(uuid),
  public.accept_conversation(uuid),
  public.delete_conversation(uuid),
  -- utilisées dans des politiques RLS : doivent être exécutables
  public._can_read_message(uuid, timestamptz),
  public.can_read_dm_file(text)
to authenticated;
