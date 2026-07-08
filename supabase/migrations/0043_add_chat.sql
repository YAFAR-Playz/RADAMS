-- Staff-only chat: 1:1 direct messages plus one group channel per course
-- offering (auto-membership = that offering's heads + assistants). Students
-- and parents are out of scope entirely.

create type public.chat_conversation_type as enum ('dm', 'group');

create table public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  type public.chat_conversation_type not null,
  offering_id uuid references course_offerings(id) on delete cascade,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  constraint chat_conversations_group_needs_offering check (
    (type = 'group' and offering_id is not null) or (type = 'dm' and offering_id is null)
  )
);

-- One group channel per offering.
create unique index chat_conversations_group_offering_uidx on chat_conversations (offering_id) where type = 'group';
create index chat_conversations_org_idx on chat_conversations (org_id);

create table public.chat_conversation_members (
  conversation_id uuid not null references chat_conversations(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (conversation_id, profile_id)
);

create index chat_conversation_members_profile_idx on chat_conversation_members (profile_id);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references chat_conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index chat_messages_conversation_idx on chat_messages (conversation_id, created_at);

-- SECURITY DEFINER helpers (same convention as current_org_id/current_role).
-- Every one of these bypasses RLS on purpose: the alternative is a bare
-- subquery inside a policy that ends up subject to the *target* table's own
-- RLS policy, which recurses into exactly the "not a member yet" case each
-- of these functions exists to handle (creating a conversation, adding its
-- first members, or a newly-assigned assistant finding their group channel
-- for the first time). None of them expose anything beyond an id/boolean.

create or replace function public.is_chat_member(conv_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.chat_conversation_members m
    where m.conversation_id = conv_id and m.profile_id = auth.uid()
  );
$$;

create or replace function public.conversation_in_org(conv_id uuid, org uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.chat_conversations c where c.id = conv_id and c.org_id = org);
$$;

create or replace function public.find_group_conversation_id(p_offering_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.chat_conversations where offering_id = p_offering_id and type = 'group';
$$;

alter table public.chat_conversations enable row level security;
alter table public.chat_conversation_members enable row level security;
alter table public.chat_messages enable row level security;

create policy "members read their conversations" on chat_conversations
  for select using (org_id = public.current_org_id() and public.is_chat_member(id));

create policy "staff create conversations in their org" on chat_conversations
  for insert with check (org_id = public.current_org_id());

create policy "members update their conversations" on chat_conversations
  for update using (org_id = public.current_org_id() and public.is_chat_member(id))
  with check (org_id = public.current_org_id());

create policy "members read conversation members" on chat_conversation_members
  for select using (public.is_chat_member(conversation_id));

create policy "org staff add members to org conversations" on chat_conversation_members
  for insert with check (public.conversation_in_org(conversation_id, public.current_org_id()));

create policy "members update their own membership row" on chat_conversation_members
  for update using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy "members read messages in their conversations" on chat_messages
  for select using (public.is_chat_member(conversation_id));

create policy "members send messages in their conversations" on chat_messages
  for insert with check (sender_id = auth.uid() and public.is_chat_member(conversation_id));
