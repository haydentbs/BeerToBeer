create table if not exists public.mini_game_matches (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  night_id uuid not null references public.nights(id) on delete cascade,
  game_key text not null check (game_key in ('beer_bomb')),
  title text not null check (char_length(trim(title)) between 1 and 120),
  status text not null default 'pending' check (status in ('pending', 'active', 'declined', 'cancelled', 'completed')),
  created_by_membership_id uuid not null references public.crew_memberships(id) on delete restrict,
  opponent_membership_id uuid not null references public.crew_memberships(id) on delete restrict,
  proposed_wager numeric(10,2) not null check (proposed_wager > 0 and mod(proposed_wager * 10, 5) = 0),
  agreed_wager numeric(10,2) check (agreed_wager > 0 and mod(agreed_wager * 10, 5) = 0),
  board_size integer not null default 8 check (board_size = 8),
  hidden_slot_index integer not null check (hidden_slot_index between 0 and 7),
  current_turn_membership_id uuid references public.crew_memberships(id) on delete set null,
  starting_player_membership_id uuid references public.crew_memberships(id) on delete set null,
  winner_membership_id uuid references public.crew_memberships(id) on delete set null,
  loser_membership_id uuid references public.crew_memberships(id) on delete set null,
  revealed_slots jsonb not null default '[]'::jsonb check (jsonb_typeof(revealed_slots) = 'array'),
  metadata jsonb not null default '{}'::jsonb,
  accepted_at timestamptz,
  declined_at timestamptz,
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mini_game_match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.mini_game_matches(id) on delete cascade,
  actor_membership_id uuid references public.crew_memberships(id) on delete set null,
  event_type text not null check (
    event_type in (
      'challenge_created',
      'challenge_accepted',
      'challenge_declined',
      'challenge_cancelled',
      'turn_taken',
      'match_completed'
    )
  ),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mini_game_matches_crew_id_idx
  on public.mini_game_matches (crew_id, created_at desc);

create index if not exists mini_game_matches_night_id_idx
  on public.mini_game_matches (night_id, created_at desc);

create index if not exists mini_game_matches_status_idx
  on public.mini_game_matches (night_id, status, created_at desc);

create index if not exists mini_game_match_events_match_id_idx
  on public.mini_game_match_events (match_id, created_at desc);

alter table public.mini_game_matches enable row level security;
alter table public.mini_game_match_events enable row level security;

create or replace function app_private.validate_mini_game_match_memberships()
returns trigger
language plpgsql
as $$
declare
  night_crew_id uuid;
  membership_crew_id uuid;
begin
  select crew_id into night_crew_id
  from public.nights
  where id = new.night_id;

  if night_crew_id is distinct from new.crew_id then
    raise exception 'mini game match night must belong to the same crew';
  end if;

  if new.created_by_membership_id is null or new.opponent_membership_id is null then
    raise exception 'mini game matches require both players';
  end if;

  select crew_id into membership_crew_id
  from public.crew_memberships
  where id = new.created_by_membership_id;

  if membership_crew_id is distinct from new.crew_id then
    raise exception 'mini game challenger must belong to the same crew';
  end if;

  select crew_id into membership_crew_id
  from public.crew_memberships
  where id = new.opponent_membership_id;

  if membership_crew_id is distinct from new.crew_id then
    raise exception 'mini game opponent must belong to the same crew';
  end if;

  if new.current_turn_membership_id is not null then
    select crew_id into membership_crew_id
    from public.crew_memberships
    where id = new.current_turn_membership_id;

    if membership_crew_id is distinct from new.crew_id then
      raise exception 'mini game current turn membership must belong to the same crew';
    end if;
  end if;

  if new.starting_player_membership_id is not null then
    select crew_id into membership_crew_id
    from public.crew_memberships
    where id = new.starting_player_membership_id;

    if membership_crew_id is distinct from new.crew_id then
      raise exception 'mini game starting player must belong to the same crew';
    end if;
  end if;

  if new.winner_membership_id is not null then
    select crew_id into membership_crew_id
    from public.crew_memberships
    where id = new.winner_membership_id;

    if membership_crew_id is distinct from new.crew_id then
      raise exception 'mini game winner must belong to the same crew';
    end if;
  end if;

  if new.loser_membership_id is not null then
    select crew_id into membership_crew_id
    from public.crew_memberships
    where id = new.loser_membership_id;

    if membership_crew_id is distinct from new.crew_id then
      raise exception 'mini game loser must belong to the same crew';
    end if;
  end if;

  if new.status = 'pending' then
    if new.agreed_wager is not null or new.accepted_at is not null or new.declined_at is not null or new.cancelled_at is not null or new.completed_at is not null then
      raise exception 'pending mini game matches cannot have resolution timestamps';
    end if;
  elsif new.status = 'active' then
    if new.agreed_wager is null or new.accepted_at is null or new.current_turn_membership_id is null or new.completed_at is not null or new.cancelled_at is not null or new.declined_at is not null then
      raise exception 'active mini game matches require acceptance and a current turn';
    end if;
  elsif new.status = 'declined' then
    if new.declined_at is null or new.agreed_wager is not null or new.current_turn_membership_id is not null or new.winner_membership_id is not null or new.loser_membership_id is not null then
      raise exception 'declined mini game matches cannot carry active state';
    end if;
  elsif new.status = 'cancelled' then
    if new.cancelled_at is null or new.agreed_wager is not null or new.current_turn_membership_id is not null or new.winner_membership_id is not null or new.loser_membership_id is not null then
      raise exception 'cancelled mini game matches cannot carry active state';
    end if;
  elsif new.status = 'completed' then
    if new.completed_at is null or new.agreed_wager is null or new.current_turn_membership_id is not null or new.winner_membership_id is null or new.loser_membership_id is null then
      raise exception 'completed mini game matches require a winner, loser, and completion timestamp';
    end if;
  end if

  return new;
end;
$$;

create or replace function app_private.validate_mini_game_match_event_membership()
returns trigger
language plpgsql
as $$
declare
  match_crew_id uuid;
  membership_crew_id uuid;
begin
  select crew_id into match_crew_id
  from public.mini_game_matches
  where id = new.match_id;

  if new.actor_membership_id is not null then
    select crew_id into membership_crew_id
    from public.crew_memberships
    where id = new.actor_membership_id;

    if membership_crew_id is distinct from match_crew_id then
      raise exception 'mini game match event actor must belong to the same crew';
    end if;
  end if;

  return new;
end;
$$;

create trigger mini_game_matches_validate_memberships
before insert or update on public.mini_game_matches
for each row execute function app_private.validate_mini_game_match_memberships();

create trigger mini_game_matches_set_updated_at
before update on public.mini_game_matches
for each row execute function public.set_updated_at();

create trigger mini_game_match_events_validate_memberships
before insert or update on public.mini_game_match_events
for each row execute function app_private.validate_mini_game_match_event_membership();

create policy mini_game_matches_member_read
  on public.mini_game_matches
  for select to authenticated
  using (public.is_crew_member(crew_id));

create policy mini_game_match_events_member_read
  on public.mini_game_match_events
  for select to authenticated
  using (
    exists (
      select 1
      from public.mini_game_matches match_row
      where match_row.id = match_id
        and public.is_crew_member(match_row.crew_id)
    )
  );

alter table public.ledger_events
  drop constraint if exists ledger_events_event_type_check;

alter table public.ledger_events
  add constraint ledger_events_event_type_check
  check (event_type in ('bet_result', 'mini_game_result', 'manual_settlement', 'adjustment', 'reversal'));

alter publication supabase_realtime add table public.mini_game_matches;
alter publication supabase_realtime add table public.mini_game_match_events;
