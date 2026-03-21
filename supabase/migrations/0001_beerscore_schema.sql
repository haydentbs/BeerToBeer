create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  email text,
  display_name text not null check (char_length(trim(display_name)) between 1 and 80),
  avatar_url text,
  initials text not null check (char_length(trim(initials)) between 1 and 4),
  account_status text not null default 'active' check (account_status in ('active', 'suspended', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profile_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  default_drink_theme text check (default_drink_theme in ('beer', 'cocktails', 'shots', 'tequila', 'wine', 'whiskey')),
  notifications_enabled boolean not null default true,
  email_notifications boolean not null default true,
  push_notifications boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.guest_identities (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(trim(display_name)) between 1 and 80),
  initials text not null check (char_length(trim(initials)) between 1 and 4),
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  upgraded_to_profile_id uuid references public.profiles(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.crews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  slug text,
  description text,
  invite_code text not null check (char_length(trim(invite_code)) between 4 and 32),
  visibility text not null default 'private' check (visibility in ('private', 'invite_only')),
  drink_theme text check (drink_theme in ('beer', 'cocktails', 'shots', 'tequila', 'wine', 'whiskey')),
  settings jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create unique index crews_invite_code_active_idx
  on public.crews (lower(invite_code))
  where archived_at is null;

create unique index crews_slug_active_idx
  on public.crews (lower(slug))
  where slug is not null and archived_at is null;

create table public.crew_memberships (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  actor_type text not null check (actor_type in ('profile', 'guest')),
  profile_id uuid references public.profiles(id) on delete cascade,
  guest_identity_id uuid references public.guest_identities(id) on delete cascade,
  role text not null check (role in ('creator', 'admin', 'member', 'guest')),
  status text not null default 'active' check (status in ('active', 'left', 'removed', 'banned')),
  nickname text,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crew_memberships_actor_check check (
    (actor_type = 'profile' and profile_id is not null and guest_identity_id is null and role <> 'guest')
    or
    (actor_type = 'guest' and guest_identity_id is not null and profile_id is null and role = 'guest')
  )
);

create unique index crew_memberships_active_profile_idx
  on public.crew_memberships (crew_id, profile_id)
  where profile_id is not null and status = 'active';

create unique index crew_memberships_active_guest_idx
  on public.crew_memberships (crew_id, guest_identity_id)
  where guest_identity_id is not null and status = 'active';

create table public.crew_invites (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  code text not null check (char_length(trim(code)) between 4 and 32),
  label text,
  created_by_membership_id uuid references public.crew_memberships(id) on delete set null,
  max_uses integer,
  use_count integer not null default 0 check (use_count >= 0),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index crew_invites_active_code_idx
  on public.crew_invites (lower(code))
  where revoked_at is null;

create table public.crew_invite_redemptions (
  id uuid primary key default gen_random_uuid(),
  crew_invite_id uuid not null references public.crew_invites(id) on delete cascade,
  membership_id uuid not null references public.crew_memberships(id) on delete cascade,
  redeemed_at timestamptz not null default now()
);

create table public.crew_join_requests (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  message text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by_membership_id uuid references public.crew_memberships(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index crew_join_requests_pending_idx
  on public.crew_join_requests (crew_id, profile_id)
  where status = 'pending';

create table public.nights (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  status text not null default 'active' check (status in ('active', 'winding-down', 'closed')),
  created_by_membership_id uuid references public.crew_memberships(id) on delete set null,
  drink_theme_override text check (drink_theme_override in ('beer', 'cocktails', 'shots', 'tequila', 'wine', 'whiskey')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index nights_one_active_per_crew_idx
  on public.nights (crew_id)
  where status in ('active', 'winding-down');

create table public.night_participants (
  id uuid primary key default gen_random_uuid(),
  night_id uuid not null references public.nights(id) on delete cascade,
  membership_id uuid not null references public.crew_memberships(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index night_participants_active_member_idx
  on public.night_participants (night_id, membership_id)
  where left_at is null;

create table public.bets (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  night_id uuid not null references public.nights(id) on delete cascade,
  type text not null check (type in ('prop', 'h2h', 'multi')),
  title text not null check (char_length(trim(title)) between 1 and 160),
  description text,
  status text not null default 'open' check (status in ('open', 'locked', 'resolved', 'disputed', 'void', 'cancelled')),
  created_by_membership_id uuid not null references public.crew_memberships(id) on delete restrict,
  challenger_membership_id uuid references public.crew_memberships(id) on delete set null,
  closes_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  winning_option_id uuid,
  void_reason text,
  metadata jsonb not null default '{}'::jsonb
);

create table public.bet_options (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null references public.bets(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 80),
  sort_order integer not null check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bet_id, sort_order)
);

alter table public.bets
  add constraint bets_winning_option_fk
  foreign key (winning_option_id) references public.bet_options(id) on delete set null;

create table public.wagers (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null references public.bets(id) on delete cascade,
  bet_option_id uuid not null references public.bet_options(id) on delete cascade,
  membership_id uuid not null references public.crew_memberships(id) on delete cascade,
  drinks numeric(10,2) not null check (drinks > 0 and mod(drinks * 10, 5) = 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bet_id, membership_id)
);

create table public.bet_comments (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null references public.bets(id) on delete cascade,
  membership_id uuid not null references public.crew_memberships(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 800),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null references public.bets(id) on delete cascade,
  opened_by_membership_id uuid not null references public.crew_memberships(id) on delete restrict,
  reason text,
  status text not null default 'open' check (status in ('open', 'resolved', 'expired', 'cancelled')),
  expires_at timestamptz,
  resolution_option_id uuid references public.bet_options(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dispute_votes (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  membership_id uuid not null references public.crew_memberships(id) on delete cascade,
  option_id uuid references public.bet_options(id) on delete set null,
  deferred boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dispute_id, membership_id),
  constraint dispute_votes_choice_check check (
    (deferred = true and option_id is null) or (deferred = false and option_id is not null)
  )
);

create table public.bet_member_outcomes (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null references public.bets(id) on delete cascade,
  membership_id uuid not null references public.crew_memberships(id) on delete cascade,
  option_id uuid references public.bet_options(id) on delete set null,
  stake numeric(10,2) not null check (stake >= 0),
  net_result numeric(10,2) not null,
  gross_return numeric(10,2) not null default 0,
  reason text,
  reversal_of uuid references public.bet_member_outcomes(id) on delete set null,
  created_at timestamptz not null default now()
);

create index bet_member_outcomes_bet_membership_idx
  on public.bet_member_outcomes (bet_id, membership_id);

create table public.ledger_events (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  night_id uuid references public.nights(id) on delete set null,
  bet_id uuid references public.bets(id) on delete set null,
  from_membership_id uuid references public.crew_memberships(id) on delete set null,
  to_membership_id uuid references public.crew_memberships(id) on delete set null,
  event_type text not null check (event_type in ('bet_result', 'manual_settlement', 'adjustment', 'reversal')),
  status text not null default 'posted' check (status in ('pending', 'posted', 'cancelled')),
  drinks numeric(10,2) not null check (drinks >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.settlement_requests (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  initiated_by_membership_id uuid not null references public.crew_memberships(id) on delete restrict,
  counterparty_membership_id uuid not null references public.crew_memberships(id) on delete restrict,
  scope text not null default 'all_time' check (scope in ('all_time', 'tonight', 'night', 'bet')),
  night_id uuid references public.nights(id) on delete set null,
  bet_id uuid references public.bets(id) on delete set null,
  drinks numeric(10,2) not null check (drinks > 0),
  note text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.settlement_confirmations (
  id uuid primary key default gen_random_uuid(),
  settlement_request_id uuid not null references public.settlement_requests(id) on delete cascade,
  membership_id uuid not null references public.crew_memberships(id) on delete cascade,
  decision text not null check (decision in ('confirmed', 'rejected')),
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (settlement_request_id, membership_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid references public.crews(id) on delete cascade,
  membership_id uuid references public.crew_memberships(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  type text not null check (type in ('bet_created', 'bet_resolved', 'challenge', 'crew_invite', 'night_started', 'night_closed', 'settlement_requested', 'settlement_confirmed', 'role_updated', 'guest_joined', 'member_joined', 'crew_role_changed', 'settlement_recorded', 'bet_disputed')),
  title text not null check (char_length(trim(title)) between 1 and 120),
  message text not null check (char_length(trim(message)) between 1 and 400),
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_recipient_check check (
    (profile_id is not null and membership_id is null) or (profile_id is null and membership_id is not null)
  )
);

create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  membership_id uuid references public.crew_memberships(id) on delete cascade,
  bet_updates boolean not null default true,
  night_updates boolean not null default true,
  settlement_updates boolean not null default true,
  crew_updates boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_preferences_recipient_check check (
    (profile_id is not null and membership_id is null) or (profile_id is null and membership_id is not null)
  )
);

create unique index notification_preferences_profile_idx
  on public.notification_preferences (profile_id)
  where profile_id is not null;

create unique index notification_preferences_membership_idx
  on public.notification_preferences (membership_id)
  where membership_id is not null;

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid references public.crews(id) on delete cascade,
  actor_membership_id uuid references public.crew_memberships(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index crew_memberships_crew_id_idx on public.crew_memberships (crew_id);
create index crew_memberships_profile_id_idx on public.crew_memberships (profile_id);
create index crew_memberships_guest_identity_id_idx on public.crew_memberships (guest_identity_id);
create index crew_invites_crew_id_idx on public.crew_invites (crew_id);
create index crew_invite_redemptions_invite_id_idx on public.crew_invite_redemptions (crew_invite_id);
create index crew_invite_redemptions_membership_id_idx on public.crew_invite_redemptions (membership_id);
create index crew_join_requests_crew_id_idx on public.crew_join_requests (crew_id);
create index crew_join_requests_profile_id_idx on public.crew_join_requests (profile_id);
create index nights_crew_id_idx on public.nights (crew_id);
create index night_participants_night_id_idx on public.night_participants (night_id);
create index night_participants_membership_id_idx on public.night_participants (membership_id);
create index bets_crew_id_idx on public.bets (crew_id);
create index bets_night_id_idx on public.bets (night_id);
create index bets_open_night_idx on public.bets (night_id, closes_at) where status = 'open';
create index bet_options_bet_id_idx on public.bet_options (bet_id);
create index wagers_bet_option_id_idx on public.wagers (bet_option_id);
create index wagers_membership_id_idx on public.wagers (membership_id);
create index bet_comments_bet_id_idx on public.bet_comments (bet_id);
create index disputes_bet_id_idx on public.disputes (bet_id);
create index dispute_votes_dispute_id_idx on public.dispute_votes (dispute_id);
create index ledger_events_crew_id_idx on public.ledger_events (crew_id);
create index ledger_events_bet_id_idx on public.ledger_events (bet_id);
create index ledger_events_pair_idx on public.ledger_events (crew_id, from_membership_id, to_membership_id);
create index settlement_requests_crew_id_idx on public.settlement_requests (crew_id);
create index settlement_requests_initiator_idx on public.settlement_requests (initiated_by_membership_id);
create index settlement_confirmations_request_id_idx on public.settlement_confirmations (settlement_request_id);
create index notifications_profile_id_idx on public.notifications (profile_id);
create index notifications_membership_id_idx on public.notifications (membership_id);
create index notifications_unread_profile_idx on public.notifications (profile_id, created_at desc) where read_at is null;
create index notifications_unread_membership_idx on public.notifications (membership_id, created_at desc) where read_at is null;
create index audit_log_crew_id_idx on public.audit_log (crew_id, created_at desc);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger profile_preferences_set_updated_at
before update on public.profile_preferences
for each row execute function public.set_updated_at();

create trigger guest_identities_set_updated_at
before update on public.guest_identities
for each row execute function public.set_updated_at();

create trigger crews_set_updated_at
before update on public.crews
for each row execute function public.set_updated_at();

create trigger crew_memberships_set_updated_at
before update on public.crew_memberships
for each row execute function public.set_updated_at();

create trigger crew_invites_set_updated_at
before update on public.crew_invites
for each row execute function public.set_updated_at();

create trigger crew_join_requests_set_updated_at
before update on public.crew_join_requests
for each row execute function public.set_updated_at();

create trigger nights_set_updated_at
before update on public.nights
for each row execute function public.set_updated_at();

create trigger night_participants_set_updated_at
before update on public.night_participants
for each row execute function public.set_updated_at();

create trigger bets_set_updated_at
before update on public.bets
for each row execute function public.set_updated_at();

create trigger bet_options_set_updated_at
before update on public.bet_options
for each row execute function public.set_updated_at();

create trigger wagers_set_updated_at
before update on public.wagers
for each row execute function public.set_updated_at();

create trigger bet_comments_set_updated_at
before update on public.bet_comments
for each row execute function public.set_updated_at();

create trigger disputes_set_updated_at
before update on public.disputes
for each row execute function public.set_updated_at();

create trigger dispute_votes_set_updated_at
before update on public.dispute_votes
for each row execute function public.set_updated_at();

create trigger settlement_requests_set_updated_at
before update on public.settlement_requests
for each row execute function public.set_updated_at();

create trigger notification_preferences_set_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();
