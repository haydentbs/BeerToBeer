create schema if not exists app_private;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function app_private.validate_membership_identity()
returns trigger
language plpgsql
as $$
begin
  if new.actor_type = 'profile' and (new.profile_id is null or new.guest_identity_id is not null) then
    raise exception 'profile memberships must reference profile_id only';
  end if;

  if new.actor_type = 'guest' and (new.guest_identity_id is null or new.profile_id is not null) then
    raise exception 'guest memberships must reference guest_identity_id only';
  end if;

  return new;
end;
$$;

create or replace function app_private.validate_night_participant_membership()
returns trigger
language plpgsql
as $$
declare
  membership_crew_id uuid;
  night_crew_id uuid;
begin
  select crew_id into membership_crew_id
  from public.crew_memberships
  where id = new.membership_id;

  select crew_id into night_crew_id
  from public.nights
  where id = new.night_id;

  if membership_crew_id is distinct from night_crew_id then
    raise exception 'night participant membership must belong to the same crew as the night';
  end if;

  return new;
end;
$$;

create or replace function app_private.validate_wager_consistency()
returns trigger
language plpgsql
as $$
declare
  option_bet_id uuid;
  membership_crew_id uuid;
  bet_crew_id uuid;
  bet_state text;
begin
  select bet_id into option_bet_id
  from public.bet_options
  where id = new.bet_option_id;

  if option_bet_id is distinct from new.bet_id then
    raise exception 'bet option does not belong to the supplied bet';
  end if;

  select crew_id, status into bet_crew_id, bet_state
  from public.bets
  where id = new.bet_id;

  select crew_id into membership_crew_id
  from public.crew_memberships
  where id = new.membership_id;

  if membership_crew_id is distinct from bet_crew_id then
    raise exception 'wager membership must belong to the same crew as the bet';
  end if;

  if bet_state <> 'open' then
    raise exception 'wagers can only be placed on open bets';
  end if;

  return new;
end;
$$;

alter table public.profiles
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active', 'blocked'));

alter table public.guest_identities
  add column if not exists created_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists last_seen_at timestamptz not null default now();

alter table public.crews
  add column if not exists slug text,
  add column if not exists visibility text not null default 'private'
    check (visibility in ('private', 'unlisted'));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'crews_slug_unique'
      and conrelid = 'public.crews'::regclass
  ) then
    alter table public.crews
      add constraint crews_slug_unique unique (slug);
  end if;
end $$;

alter table public.crew_memberships
  add column if not exists invited_by_membership_id uuid references public.crew_memberships(id) on delete set null,
  add column if not exists last_seen_at timestamptz not null default now();

alter table public.crew_invites
  add column if not exists expires_at timestamptz,
  add column if not exists max_uses integer,
  add column if not exists uses_count integer not null default 0,
  add column if not exists revoked_at timestamptz;

alter table public.nights
  add column if not exists notes text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.bets
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists minimum_stake numeric(6,2) not null default 0.5,
  add column if not exists resolution_source text
    check (resolution_source in ('manual', 'consensus', 'dispute', 'system'));

create table if not exists public.profile_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  preferred_drink_theme text,
  default_wager numeric(6,2) not null default 1.00
    check (default_wager > 0 and mod(default_wager * 10, 5) = 0),
  notifications_enabled boolean not null default true,
  push_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid unique references public.crew_memberships(id) on delete cascade,
  profile_id uuid unique references public.profiles(id) on delete cascade,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default false,
  push_enabled boolean not null default false,
  quiet_hours jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (membership_id is not null or profile_id is not null)
);

create table if not exists public.crew_settings (
  crew_id uuid primary key references public.crews(id) on delete cascade,
  allow_guests boolean not null default true,
  allow_member_invites boolean not null default true,
  default_bet_close_minutes integer not null default 60 check (default_bet_close_minutes between 5 and 1440),
  default_drink_theme text,
  auto_void_uncontested boolean not null default true,
  settlement_threshold numeric(10,2) not null default 1.00
    check (settlement_threshold >= 0 and mod(settlement_threshold * 10, 5) = 0),
  maximum_open_bets integer not null default 50 check (maximum_open_bets >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crew_join_requests (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  message text,
  handled_by_membership_id uuid references public.crew_memberships(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists crew_join_requests_active_idx
  on public.crew_join_requests (crew_id, profile_id)
  where status = 'pending';

create table if not exists public.bet_comments (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null references public.bets(id) on delete cascade,
  membership_id uuid not null references public.crew_memberships(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bet_status_events (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null references public.bets(id) on delete cascade,
  actor_membership_id uuid references public.crew_memberships(id) on delete set null,
  from_status text check (from_status in ('open', 'locked', 'resolved', 'disputed', 'void', 'cancelled')),
  to_status text not null check (to_status in ('open', 'locked', 'resolved', 'disputed', 'void', 'cancelled')),
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.night_presence_events (
  id uuid primary key default gen_random_uuid(),
  night_id uuid not null references public.nights(id) on delete cascade,
  membership_id uuid not null references public.crew_memberships(id) on delete cascade,
  created_by_membership_id uuid references public.crew_memberships(id) on delete set null,
  event_type text not null check (event_type in ('join', 'leave', 'rejoin')),
  created_at timestamptz not null default now()
);

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null references public.bets(id) on delete cascade,
  opened_by_membership_id uuid not null references public.crew_memberships(id) on delete restrict,
  status text not null default 'open' check (status in ('open', 'resolved', 'expired', 'cancelled')),
  expires_at timestamptz not null default (now() + interval '2 hours'),
  resolution_option_id uuid references public.bet_options(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create unique index if not exists disputes_one_open_per_bet_idx
  on public.disputes (bet_id)
  where status = 'open';

create table if not exists public.dispute_votes (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  membership_id uuid not null references public.crew_memberships(id) on delete cascade,
  choice_option_id uuid references public.bet_options(id) on delete set null,
  decision_note text,
  is_deferred boolean not null default false,
  created_at timestamptz not null default now(),
  unique (dispute_id, membership_id)
);

create table if not exists public.bet_resolution_events (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null references public.bets(id) on delete cascade,
  resolved_by_membership_id uuid references public.crew_memberships(id) on delete set null,
  source text not null check (source in ('manual', 'dispute', 'system')),
  status_applied text not null check (status_applied in ('resolved', 'void', 'reversed')),
  winning_option_id uuid references public.bet_options(id) on delete set null,
  notes text,
  reversal_of_resolution_event_id uuid references public.bet_resolution_events(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.ledger_event_batches (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  night_id uuid references public.nights(id) on delete set null,
  bet_id uuid references public.bets(id) on delete set null,
  source_type text not null
    check (source_type in ('bet_result', 'manual_settlement', 'adjustment', 'reversal')),
  created_by_membership_id uuid references public.crew_memberships(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.bet_member_outcomes
  add column if not exists resolution_event_id uuid references public.bet_resolution_events(id) on delete set null,
  add column if not exists gross_return numeric(8,2) not null default 0;

alter table public.ledger_events
  add column if not exists batch_id uuid references public.ledger_event_batches(id) on delete set null;

create table if not exists public.settlement_requests (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  night_id uuid references public.nights(id) on delete set null,
  bet_id uuid references public.bets(id) on delete set null,
  requested_by_membership_id uuid not null references public.crew_memberships(id) on delete restrict,
  from_membership_id uuid not null references public.crew_memberships(id) on delete restrict,
  to_membership_id uuid not null references public.crew_memberships(id) on delete restrict,
  drinks numeric(8,2) not null check (drinks > 0),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  channel text not null check (channel in ('in_app', 'push', 'email')),
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'skipped')),
  delivered_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists profile_preferences_updated_at_idx on public.profile_preferences (updated_at desc);
create index if not exists notification_preferences_membership_idx on public.notification_preferences (membership_id);
create index if not exists notification_preferences_profile_idx on public.notification_preferences (profile_id);
create index if not exists crew_settings_updated_at_idx on public.crew_settings (updated_at desc);
create index if not exists crew_join_requests_crew_id_idx on public.crew_join_requests (crew_id, created_at desc);
create index if not exists bet_comments_bet_id_idx on public.bet_comments (bet_id, created_at desc);
create index if not exists bet_comments_membership_id_idx on public.bet_comments (membership_id);
create index if not exists bet_status_events_bet_id_idx on public.bet_status_events (bet_id, created_at desc);
create index if not exists night_presence_events_night_id_idx on public.night_presence_events (night_id, created_at desc);
create index if not exists disputes_bet_id_idx on public.disputes (bet_id, created_at desc);
create index if not exists dispute_votes_dispute_id_idx on public.dispute_votes (dispute_id);
create index if not exists bet_resolution_events_bet_id_idx on public.bet_resolution_events (bet_id, created_at desc);
create index if not exists bet_member_outcomes_resolution_event_idx on public.bet_member_outcomes (resolution_event_id);
create index if not exists ledger_event_batches_crew_id_idx on public.ledger_event_batches (crew_id, created_at desc);
create index if not exists ledger_events_batch_id_idx on public.ledger_events (batch_id);
create index if not exists settlement_requests_crew_id_idx on public.settlement_requests (crew_id, created_at desc);
create index if not exists settlement_requests_from_idx on public.settlement_requests (from_membership_id);
create index if not exists settlement_requests_to_idx on public.settlement_requests (to_membership_id);
create index if not exists notification_deliveries_notification_id_idx on public.notification_deliveries (notification_id);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists crews_set_updated_at on public.crews;
create trigger crews_set_updated_at
before update on public.crews
for each row execute function public.set_updated_at();

drop trigger if exists nights_set_updated_at on public.nights;
create trigger nights_set_updated_at
before update on public.nights
for each row execute function public.set_updated_at();

drop trigger if exists bets_set_updated_at on public.bets;
create trigger bets_set_updated_at
before update on public.bets
for each row execute function public.set_updated_at();

drop trigger if exists wagers_set_updated_at on public.wagers;
create trigger wagers_set_updated_at
before update on public.wagers
for each row execute function public.set_updated_at();

drop trigger if exists profile_preferences_set_updated_at on public.profile_preferences;
create trigger profile_preferences_set_updated_at
before update on public.profile_preferences
for each row execute function public.set_updated_at();

drop trigger if exists notification_preferences_set_updated_at on public.notification_preferences;
create trigger notification_preferences_set_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

drop trigger if exists crew_settings_set_updated_at on public.crew_settings;
create trigger crew_settings_set_updated_at
before update on public.crew_settings
for each row execute function public.set_updated_at();

drop trigger if exists crew_join_requests_set_updated_at on public.crew_join_requests;
create trigger crew_join_requests_set_updated_at
before update on public.crew_join_requests
for each row execute function public.set_updated_at();

drop trigger if exists bet_comments_set_updated_at on public.bet_comments;
create trigger bet_comments_set_updated_at
before update on public.bet_comments
for each row execute function public.set_updated_at();

drop trigger if exists crew_memberships_validate_identity on public.crew_memberships;
create trigger crew_memberships_validate_identity
before insert or update on public.crew_memberships
for each row execute function app_private.validate_membership_identity();

drop trigger if exists night_participants_validate_membership on public.night_participants;
create trigger night_participants_validate_membership
before insert or update on public.night_participants
for each row execute function app_private.validate_night_participant_membership();

drop trigger if exists wagers_validate_consistency on public.wagers;
create trigger wagers_validate_consistency
before insert or update on public.wagers
for each row execute function app_private.validate_wager_consistency();
