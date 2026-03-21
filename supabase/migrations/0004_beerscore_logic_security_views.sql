alter table public.profile_preferences enable row level security;
alter table public.crew_settings enable row level security;
alter table public.crew_join_requests enable row level security;
alter table public.night_presence_events enable row level security;
alter table public.bet_comments enable row level security;
alter table public.disputes enable row level security;
alter table public.dispute_votes enable row level security;
alter table public.bet_resolution_events enable row level security;
alter table public.ledger_event_batches enable row level security;
alter table public.settlement_requests enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_deliveries enable row level security;

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select profile.id
  from public.profiles profile
  where profile.auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_crew_member(target_crew_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.crew_memberships membership
    where membership.crew_id = target_crew_id
      and membership.status = 'active'
      and membership.profile_id = public.current_profile_id()
  );
$$;

create or replace function public.is_crew_admin(target_crew_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.crew_memberships membership
    where membership.crew_id = target_crew_id
      and membership.status = 'active'
      and membership.profile_id = public.current_profile_id()
      and membership.role in ('creator', 'admin')
  );
$$;

create or replace function public.is_crew_creator(target_crew_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.crew_memberships membership
    where membership.crew_id = target_crew_id
      and membership.status = 'active'
      and membership.profile_id = public.current_profile_id()
      and membership.role = 'creator'
  );
$$;

create or replace function app_private.generate_invite_code()
returns text
language sql
volatile
as $$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
$$;

create or replace function app_private.record_audit(
  p_crew_id uuid,
  p_actor_membership_id uuid,
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.audit_log (
    crew_id,
    actor_membership_id,
    action,
    target_type,
    target_id,
    payload
  )
  values (
    p_crew_id,
    p_actor_membership_id,
    p_action,
    p_target_type,
    p_target_id,
    coalesce(p_payload, '{}'::jsonb)
  );
$$;

create or replace function app_private.notify_crew_members(
  p_crew_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_payload jsonb default '{}'::jsonb,
  p_exclude_membership_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  insert into public.notifications (
    crew_id,
    membership_id,
    profile_id,
    type,
    title,
    message,
    payload
  )
  select
    membership.crew_id,
    case when membership.actor_type = 'guest' then membership.id else null end,
    case when membership.actor_type = 'profile' then membership.profile_id else null end,
    p_type,
    p_title,
    p_message,
    coalesce(p_payload, '{}'::jsonb)
  from public.crew_memberships membership
  where membership.crew_id = p_crew_id
    and membership.status = 'active'
    and (p_exclude_membership_id is null or membership.id <> p_exclude_membership_id);

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.ensure_profile(
  p_auth_user_id uuid,
  p_email text,
  p_display_name text,
  p_avatar_url text default null,
  p_initials text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles;
begin
  insert into public.profiles (
    auth_user_id,
    email,
    display_name,
    avatar_url,
    initials
  )
  values (
    p_auth_user_id,
    p_email,
    coalesce(nullif(trim(p_display_name), ''), split_part(coalesce(p_email, 'player@example.com'), '@', 1), 'Player'),
    p_avatar_url,
    coalesce(nullif(trim(p_initials), ''), upper(substr(coalesce(nullif(trim(p_display_name), ''), 'BS'), 1, 2)))
  )
  on conflict (auth_user_id) do update
    set email = excluded.email,
        display_name = excluded.display_name,
        avatar_url = excluded.avatar_url,
        initials = excluded.initials
  returning * into profile_row;

  insert into public.profile_preferences (profile_id)
  values (profile_row.id)
  on conflict (profile_id) do nothing;

  return profile_row;
end;
$$;

create or replace function public.create_crew(
  p_profile_id uuid,
  p_name text,
  p_drink_theme text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  crew_id uuid;
  membership_id uuid;
  invite_code text;
begin
  if p_profile_id is null then
    raise exception 'profile_id is required';
  end if;

  invite_code := app_private.generate_invite_code();

  insert into public.crews (
    name,
    invite_code,
    drink_theme,
    created_by_profile_id
  )
  values (
    trim(p_name),
    invite_code,
    p_drink_theme,
    p_profile_id
  )
  returning id into crew_id;

  insert into public.crew_settings (crew_id)
  values (crew_id)
  on conflict (crew_id) do nothing;

  insert into public.crew_memberships (
    crew_id,
    actor_type,
    profile_id,
    role,
    status
  )
  values (
    crew_id,
    'profile',
    p_profile_id,
    'creator',
    'active'
  )
  returning id into membership_id;

  insert into public.crew_invites (
    crew_id,
    code,
    created_by_membership_id
  )
  values (
    crew_id,
    invite_code,
    membership_id
  );

  perform app_private.record_audit(
    crew_id,
    membership_id,
    'crew.created',
    'crew',
    crew_id,
    jsonb_build_object('name', trim(p_name), 'invite_code', invite_code)
  );

  return crew_id;
end;
$$;

create or replace function public.join_crew_by_code(
  p_profile_id uuid,
  p_code text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_crew_id uuid;
  membership_id uuid;
begin
  select crew.id
  into target_crew_id
  from public.crews crew
  where crew.archived_at is null
    and upper(crew.invite_code) = upper(trim(p_code))
  limit 1;

  if target_crew_id is null then
    select invite.crew_id
    into target_crew_id
    from public.crew_invites invite
    where upper(invite.code) = upper(trim(p_code))
      and invite.revoked_at is null
      and (invite.expires_at is null or invite.expires_at > now())
    limit 1;
  end if;

  if target_crew_id is null then
    raise exception 'Invite code not found';
  end if;

  insert into public.crew_memberships (
    crew_id,
    actor_type,
    profile_id,
    role,
    status
  )
  values (
    target_crew_id,
    'profile',
    p_profile_id,
    'member',
    'active'
  )
  on conflict (crew_id, profile_id) where profile_id is not null and status = 'active'
  do update
    set status = 'active',
        left_at = null,
        last_seen_at = now()
  returning id into membership_id;

  perform app_private.record_audit(
    target_crew_id,
    membership_id,
    'membership.joined',
    'crew_membership',
    membership_id,
    jsonb_build_object('via', 'invite_code')
  );

  return membership_id;
end;
$$;

create or replace function public.join_crew_as_guest(
  p_name text,
  p_code text
)
returns table (
  guest_identity_id uuid,
  membership_id uuid,
  crew_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_crew_id uuid;
  guest_row_id uuid;
  membership_row_id uuid;
  allow_guests_flag boolean := true;
begin
  select crew.id
  into target_crew_id
  from public.crews crew
  where crew.archived_at is null
    and upper(crew.invite_code) = upper(trim(p_code))
  limit 1;

  if target_crew_id is null then
    raise exception 'Invite code not found';
  end if;

  select coalesce(setting.allow_guests, true)
  into allow_guests_flag
  from public.crew_settings setting
  where setting.crew_id = target_crew_id;

  if not allow_guests_flag then
    raise exception 'Guests are disabled for this crew';
  end if;

  insert into public.guest_identities (
    display_name,
    initials,
    last_seen_at
  )
  values (
    trim(p_name),
    upper(substr(trim(p_name), 1, 2)),
    now()
  )
  returning id into guest_row_id;

  insert into public.crew_memberships (
    crew_id,
    actor_type,
    guest_identity_id,
    role,
    status
  )
  values (
    target_crew_id,
    'guest',
    guest_row_id,
    'guest',
    'active'
  )
  returning id into membership_row_id;

  perform app_private.record_audit(
    target_crew_id,
    membership_row_id,
    'membership.guest_joined',
    'crew_membership',
    membership_row_id,
    jsonb_build_object('guest_name', trim(p_name))
  );

  guest_identity_id := guest_row_id;
  membership_id := membership_row_id;
  crew_id := target_crew_id;
  return next;
end;
$$;

create or replace function public.start_night(
  p_actor_membership_id uuid,
  p_name text,
  p_drink_theme_override text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_membership public.crew_memberships;
  night_id uuid;
begin
  select *
  into actor_membership
  from public.crew_memberships
  where id = p_actor_membership_id
    and status = 'active';

  if actor_membership.id is null then
    raise exception 'Active membership is required';
  end if;

  insert into public.nights (
    crew_id,
    name,
    status,
    created_by_membership_id,
    drink_theme_override
  )
  values (
    actor_membership.crew_id,
    trim(coalesce(nullif(p_name, ''), 'Tonight')),
    'active',
    actor_membership.id,
    p_drink_theme_override
  )
  returning id into night_id;

  insert into public.night_participants (night_id, membership_id)
  select night_id, membership.id
  from public.crew_memberships membership
  where membership.crew_id = actor_membership.crew_id
    and membership.status = 'active';

  insert into public.night_presence_events (
    night_id,
    membership_id,
    created_by_membership_id,
    event_type
  )
  select night_id, membership.id, actor_membership.id, 'join'
  from public.crew_memberships membership
  where membership.crew_id = actor_membership.crew_id
    and membership.status = 'active';

  perform app_private.record_audit(
    actor_membership.crew_id,
    actor_membership.id,
    'night.started',
    'night',
    night_id,
    jsonb_build_object('name', trim(coalesce(nullif(p_name, ''), 'Tonight')))
  );

  perform app_private.notify_crew_members(
    actor_membership.crew_id,
    'night_started',
    'Night started',
    trim(coalesce(nullif(p_name, ''), 'Tonight')),
    jsonb_build_object('night_id', night_id),
    actor_membership.id
  );

  return night_id;
end;
$$;

create or replace function public.create_bet(
  p_actor_membership_id uuid,
  p_night_id uuid,
  p_type text,
  p_title text,
  p_description text default null,
  p_options jsonb default '[]'::jsonb,
  p_challenger_membership_id uuid default null,
  p_close_minutes integer default 60,
  p_initial_option_index integer default null,
  p_initial_wager numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_membership public.crew_memberships;
  night_row public.nights;
  bet_id uuid;
  selected_option_id uuid;
  option_count integer;
begin
  select *
  into actor_membership
  from public.crew_memberships
  where id = p_actor_membership_id
    and status = 'active';

  select *
  into night_row
  from public.nights
  where id = p_night_id;

  if actor_membership.id is null or night_row.id is null or actor_membership.crew_id <> night_row.crew_id then
    raise exception 'Active membership in the same crew as the night is required';
  end if;

  if night_row.status not in ('active', 'winding-down') then
    raise exception 'Bets can only be created during an active or winding-down night';
  end if;

  option_count := coalesce(jsonb_array_length(p_options), 0);
  if option_count < 2 then
    raise exception 'At least two bet options are required';
  end if;

  insert into public.bets (
    crew_id,
    night_id,
    type,
    title,
    description,
    status,
    created_by_membership_id,
    challenger_membership_id,
    closes_at
  )
  values (
    actor_membership.crew_id,
    night_row.id,
    p_type,
    trim(p_title),
    nullif(trim(coalesce(p_description, '')), ''),
    'open',
    actor_membership.id,
    p_challenger_membership_id,
    now() + make_interval(mins => greatest(1, p_close_minutes))
  )
  returning id into bet_id;

  insert into public.bet_options (bet_id, label, sort_order)
  select
    bet_id,
    trim(option_item.value ->> 'label'),
    option_item.ordinality - 1
  from jsonb_array_elements(p_options) with ordinality as option_item(value, ordinality);

  if p_initial_wager is not null and p_initial_option_index is not null then
    select option.id
    into selected_option_id
    from public.bet_options option
    where option.bet_id = bet_id
      and option.sort_order = p_initial_option_index;

    if selected_option_id is not null then
      perform public.place_or_update_wager(
        p_actor_membership_id,
        bet_id,
        selected_option_id,
        p_initial_wager
      );
    end if;
  end if;

  perform app_private.record_audit(
    actor_membership.crew_id,
    actor_membership.id,
    'bet.created',
    'bet',
    bet_id,
    jsonb_build_object('title', trim(p_title), 'type', p_type)
  );

  perform app_private.notify_crew_members(
    actor_membership.crew_id,
    'bet_created',
    'New bet created',
    trim(p_title),
    jsonb_build_object('bet_id', bet_id, 'night_id', night_row.id),
    actor_membership.id
  );

  return bet_id;
end;
$$;

create or replace function public.place_or_update_wager(
  p_actor_membership_id uuid,
  p_bet_id uuid,
  p_option_id uuid,
  p_drinks numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_membership public.crew_memberships;
  bet_row public.bets;
  wager_id uuid;
begin
  select *
  into actor_membership
  from public.crew_memberships
  where id = p_actor_membership_id
    and status = 'active';

  select *
  into bet_row
  from public.bets
  where id = p_bet_id;

  if actor_membership.id is null or bet_row.id is null or actor_membership.crew_id <> bet_row.crew_id then
    raise exception 'Active crew membership is required';
  end if;

  if bet_row.status <> 'open' then
    raise exception 'Wagers can only be placed on open bets';
  end if;

  insert into public.wagers (
    bet_id,
    bet_option_id,
    membership_id,
    drinks
  )
  values (
    p_bet_id,
    p_option_id,
    p_actor_membership_id,
    p_drinks
  )
  on conflict (bet_id, membership_id) do update
    set bet_option_id = excluded.bet_option_id,
        drinks = excluded.drinks,
        updated_at = now()
  returning id into wager_id;

  perform app_private.record_audit(
    actor_membership.crew_id,
    actor_membership.id,
    'wager.upserted',
    'wager',
    wager_id,
    jsonb_build_object('bet_id', p_bet_id, 'option_id', p_option_id, 'drinks', p_drinks)
  );

  return wager_id;
end;
$$;

create or replace function app_private.compute_parimutuel_outcomes(
  p_bet_id uuid,
  p_winning_option_id uuid
)
returns table (
  membership_id uuid,
  option_id uuid,
  stake numeric(8,2),
  net_result numeric(8,2),
  gross_return numeric(8,2)
)
language sql
stable
set search_path = public
as $$
  with wager_base as (
    select
      wager.membership_id,
      wager.bet_option_id as option_id,
      wager.drinks::numeric(8,2) as stake,
      wager.created_at,
      wager.id
    from public.wagers wager
    where wager.bet_id = p_bet_id
  ),
  totals as (
    select
      coalesce(sum(wager.stake) filter (where wager.option_id = p_winning_option_id), 0)::numeric(8,2) as total_winning_stake,
      coalesce(sum(wager.stake) filter (where wager.option_id <> p_winning_option_id), 0)::numeric(8,2) as total_losing_stake
    from wager_base wager
  ),
  ranked_winners as (
    select
      wager.membership_id,
      wager.option_id,
      wager.stake,
      totals.total_losing_stake,
      row_number() over (
        order by wager.stake desc, wager.created_at asc, wager.id asc
      ) as winner_rank,
      round((wager.stake / nullif(totals.total_winning_stake, 0)) * totals.total_losing_stake, 2) as rounded_profit
    from wager_base wager
    cross join totals
    where wager.option_id = p_winning_option_id
  ),
  winner_profit_totals as (
    select coalesce(sum(ranked_winners.rounded_profit), 0)::numeric(8,2) as rounded_profit_sum
    from ranked_winners
  ),
  winning_rows as (
    select
      ranked_winners.membership_id,
      ranked_winners.option_id,
      ranked_winners.stake,
      case
        when ranked_winners.winner_rank = 1 then ranked_winners.rounded_profit + (ranked_winners.total_losing_stake - winner_profit_totals.rounded_profit_sum)
        else ranked_winners.rounded_profit
      end::numeric(8,2) as net_result,
      (
        ranked_winners.stake +
        case
          when ranked_winners.winner_rank = 1 then ranked_winners.rounded_profit + (ranked_winners.total_losing_stake - winner_profit_totals.rounded_profit_sum)
          else ranked_winners.rounded_profit
        end
      )::numeric(8,2) as gross_return
    from ranked_winners
    cross join winner_profit_totals
  ),
  losing_rows as (
    select
      wager.membership_id,
      wager.option_id,
      wager.stake,
      (-wager.stake)::numeric(8,2) as net_result,
      0::numeric(8,2) as gross_return
    from wager_base wager
    where wager.option_id <> p_winning_option_id
  )
  select * from winning_rows
  union all
  select * from losing_rows;
$$;

create or replace function public.resolve_bet(
  p_actor_membership_id uuid,
  p_bet_id uuid,
  p_winning_option_id uuid,
  p_source text default 'manual',
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_membership public.crew_memberships;
  bet_row public.bets;
  resolution_event_id uuid;
  batch_id uuid;
  funded_option_count integer;
begin
  select *
  into actor_membership
  from public.crew_memberships
  where id = p_actor_membership_id
    and status = 'active';

  select *
  into bet_row
  from public.bets
  where id = p_bet_id;

  if actor_membership.id is null or bet_row.id is null or actor_membership.crew_id <> bet_row.crew_id then
    raise exception 'Active crew membership is required';
  end if;

  if bet_row.status not in ('open', 'locked', 'disputed') then
    raise exception 'Only open, locked, or disputed bets can be resolved';
  end if;

  select count(*)
  into funded_option_count
  from (
    select wager.bet_option_id
    from public.wagers wager
    where wager.bet_id = p_bet_id
    group by wager.bet_option_id
    having sum(wager.drinks) > 0
  ) funded_options;

  if funded_option_count < 2 then
    insert into public.bet_resolution_events (
      bet_id,
      resolved_by_membership_id,
      source,
      status_applied,
      notes
    )
    values (
      p_bet_id,
      p_actor_membership_id,
      coalesce(p_source, 'system'),
      'void',
      coalesce(p_notes, 'Auto-voided because fewer than two options were funded')
    )
    returning id into resolution_event_id;

    update public.bets
    set status = 'void',
        winning_option_id = null,
        resolved_at = now(),
        resolution_source = coalesce(p_source, 'system'),
        void_reason = coalesce(p_notes, 'No opposing action')
    where id = p_bet_id;

    insert into public.bet_member_outcomes (
      bet_id,
      resolution_event_id,
      membership_id,
      option_id,
      stake,
      net_result,
      gross_return
    )
    select
      wager.bet_id,
      resolution_event_id,
      wager.membership_id,
      wager.bet_option_id,
      wager.drinks,
      0,
      wager.drinks
    from public.wagers wager
    where wager.bet_id = p_bet_id;

    return resolution_event_id;
  end if;

  insert into public.bet_resolution_events (
    bet_id,
    resolved_by_membership_id,
    source,
    status_applied,
    winning_option_id,
    notes
  )
  values (
    p_bet_id,
    p_actor_membership_id,
    coalesce(p_source, 'manual'),
    'resolved',
    p_winning_option_id,
    p_notes
  )
  returning id into resolution_event_id;

  update public.bets
  set status = 'resolved',
      winning_option_id = p_winning_option_id,
      resolved_at = now(),
      resolution_source = coalesce(p_source, 'manual')
  where id = p_bet_id;

  insert into public.bet_member_outcomes (
    bet_id,
    resolution_event_id,
    membership_id,
    option_id,
    stake,
    net_result,
    gross_return
  )
  select
    p_bet_id,
    resolution_event_id,
    outcome.membership_id,
    outcome.option_id,
    outcome.stake,
    outcome.net_result,
    outcome.gross_return
  from app_private.compute_parimutuel_outcomes(p_bet_id, p_winning_option_id) outcome;

  insert into public.ledger_event_batches (
    crew_id,
    night_id,
    bet_id,
    source_type,
    created_by_membership_id,
    metadata
  )
  values (
    bet_row.crew_id,
    bet_row.night_id,
    bet_row.id,
    'bet_result',
    p_actor_membership_id,
    jsonb_build_object('resolution_event_id', resolution_event_id)
  )
  returning id into batch_id;

  with resolution_outcomes as (
    select
      outcome.membership_id,
      outcome.stake,
      outcome.net_result
    from public.bet_member_outcomes outcome
    where outcome.resolution_event_id = resolution_event_id
  ),
  losing_outcomes as (
    select
      outcome.membership_id,
      abs(outcome.net_result)::numeric(8,2) as loss
    from resolution_outcomes outcome
    where outcome.net_result < 0
  ),
  winning_outcomes as (
    select
      outcome.membership_id,
      outcome.net_result::numeric(8,2) as profit
    from resolution_outcomes outcome
    where outcome.net_result > 0
  ),
  winning_totals as (
    select coalesce(sum(winning_outcomes.profit), 0)::numeric(8,2) as total_profit
    from winning_outcomes
  ),
  allocations as (
    select
      losing_outcomes.membership_id as from_membership_id,
      winning_outcomes.membership_id as to_membership_id,
      losing_outcomes.loss,
      round((losing_outcomes.loss * winning_outcomes.profit) / nullif(winning_totals.total_profit, 0), 2)::numeric(8,2) as rounded_amount,
      row_number() over (
        partition by losing_outcomes.membership_id
        order by winning_outcomes.profit desc, winning_outcomes.membership_id
      ) as allocation_rank
    from losing_outcomes
    cross join winning_outcomes
    cross join winning_totals
  ),
  allocation_sums as (
    select
      allocations.from_membership_id,
      coalesce(sum(allocations.rounded_amount), 0)::numeric(8,2) as rounded_sum
    from allocations
    group by allocations.from_membership_id
  )
  insert into public.ledger_events (
    batch_id,
    crew_id,
    night_id,
    bet_id,
    from_membership_id,
    to_membership_id,
    event_type,
    drinks,
    metadata
  )
  select
    batch_id,
    bet_row.crew_id,
    bet_row.night_id,
    bet_row.id,
    allocations.from_membership_id,
    allocations.to_membership_id,
    'bet_result',
    case
      when allocations.allocation_rank = 1 then allocations.rounded_amount + (allocations.loss - allocation_sums.rounded_sum)
      else allocations.rounded_amount
    end::numeric(8,2),
    jsonb_build_object('resolution_event_id', resolution_event_id)
  from allocations
  join allocation_sums on allocation_sums.from_membership_id = allocations.from_membership_id
  where (
    case
      when allocations.allocation_rank = 1 then allocations.rounded_amount + (allocations.loss - allocation_sums.rounded_sum)
      else allocations.rounded_amount
    end
  ) > 0;

  perform app_private.record_audit(
    bet_row.crew_id,
    p_actor_membership_id,
    'bet.resolved',
    'bet',
    p_bet_id,
    jsonb_build_object('winning_option_id', p_winning_option_id, 'resolution_event_id', resolution_event_id)
  );

  perform app_private.notify_crew_members(
    bet_row.crew_id,
    'bet_resolved',
    'Bet resolved',
    bet_row.title,
    jsonb_build_object('bet_id', bet_row.id, 'winning_option_id', p_winning_option_id),
    p_actor_membership_id
  );

  return resolution_event_id;
end;
$$;

create or replace function public.mark_notifications_read(
  p_profile_id uuid default null,
  p_membership_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer := 0;
begin
  update public.notifications
  set read_at = now()
  where read_at is null
    and (
      (p_profile_id is not null and profile_id = p_profile_id) or
      (p_membership_id is not null and membership_id = p_membership_id)
    );

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

drop policy if exists notification_preferences_self_read on public.notification_preferences;
create policy notification_preferences_self_read on public.notification_preferences
  for select to authenticated
  using (
    profile_id = public.current_profile_id()
    or membership_id in (
      select membership.id
      from public.crew_memberships membership
      where membership.profile_id = public.current_profile_id()
    )
  );

drop policy if exists profile_preferences_self_read on public.profile_preferences;
create policy profile_preferences_self_read on public.profile_preferences
  for select to authenticated
  using (profile_id = public.current_profile_id());

drop policy if exists crew_settings_member_read on public.crew_settings;
create policy crew_settings_member_read on public.crew_settings
  for select to authenticated
  using (public.is_crew_member(crew_id));

drop policy if exists crew_join_requests_member_read on public.crew_join_requests;
create policy crew_join_requests_member_read on public.crew_join_requests
  for select to authenticated
  using (public.is_crew_member(crew_id));

drop policy if exists night_presence_events_member_read on public.night_presence_events;
create policy night_presence_events_member_read on public.night_presence_events
  for select to authenticated
  using (
    exists (
      select 1
      from public.nights night
      where night.id = night_id
        and public.is_crew_member(night.crew_id)
    )
  );

drop policy if exists bet_comments_member_read on public.bet_comments;
create policy bet_comments_member_read on public.bet_comments
  for select to authenticated
  using (
    exists (
      select 1
      from public.bets bet
      where bet.id = bet_id
        and public.is_crew_member(bet.crew_id)
    )
  );

drop policy if exists disputes_member_read on public.disputes;
create policy disputes_member_read on public.disputes
  for select to authenticated
  using (
    exists (
      select 1
      from public.bets bet
      where bet.id = bet_id
        and public.is_crew_member(bet.crew_id)
    )
  );

drop policy if exists dispute_votes_member_read on public.dispute_votes;
create policy dispute_votes_member_read on public.dispute_votes
  for select to authenticated
  using (
    exists (
      select 1
      from public.disputes dispute
      join public.bets bet on bet.id = dispute.bet_id
      where dispute.id = dispute_id
        and public.is_crew_member(bet.crew_id)
    )
  );

drop policy if exists bet_resolution_events_member_read on public.bet_resolution_events;
create policy bet_resolution_events_member_read on public.bet_resolution_events
  for select to authenticated
  using (
    exists (
      select 1
      from public.bets bet
      where bet.id = bet_id
        and public.is_crew_member(bet.crew_id)
    )
  );

drop policy if exists ledger_event_batches_member_read on public.ledger_event_batches;
create policy ledger_event_batches_member_read on public.ledger_event_batches
  for select to authenticated
  using (public.is_crew_member(crew_id));

drop policy if exists settlement_requests_member_read on public.settlement_requests;
create policy settlement_requests_member_read on public.settlement_requests
  for select to authenticated
  using (public.is_crew_member(crew_id));

drop policy if exists notification_deliveries_member_read on public.notification_deliveries;
create policy notification_deliveries_member_read on public.notification_deliveries
  for select to authenticated
  using (
    exists (
      select 1
      from public.notifications notification
      where notification.id = notification_id
        and (
          notification.profile_id = public.current_profile_id()
          or notification.membership_id in (
            select membership.id
            from public.crew_memberships membership
            where membership.profile_id = public.current_profile_id()
          )
        )
    )
  );

drop policy if exists notifications_membership_read on public.notifications;
create policy notifications_membership_read on public.notifications
  for select to authenticated
  using (
    membership_id in (
      select membership.id
      from public.crew_memberships membership
      where membership.profile_id = public.current_profile_id()
    )
  );

create or replace view public.crew_member_directory_v as
select
  membership.id as membership_id,
  membership.crew_id,
  membership.actor_type,
  membership.role,
  membership.status,
  membership.joined_at,
  membership.left_at,
  coalesce(profile.id, guest.id) as actor_id,
  coalesce(profile.display_name, guest.display_name) as display_name,
  coalesce(profile.avatar_url, '') as avatar_url,
  coalesce(profile.initials, guest.initials) as initials
from public.crew_memberships membership
left join public.profiles profile on profile.id = membership.profile_id
left join public.guest_identities guest on guest.id = membership.guest_identity_id;

create or replace view public.bet_pool_state_v as
select
  bet.id as bet_id,
  bet.crew_id,
  bet.night_id,
  option.id as option_id,
  option.label,
  option.sort_order,
  coalesce(sum(wager.drinks), 0)::numeric(8,2) as option_pool,
  coalesce(count(wager.id), 0)::integer as wager_count,
  coalesce(sum(sum(wager.drinks)) over (partition by bet.id), 0)::numeric(8,2) as total_pool
from public.bets bet
join public.bet_options option on option.bet_id = bet.id
left join public.wagers wager on wager.bet_option_id = option.id
group by bet.id, bet.crew_id, bet.night_id, option.id, option.label, option.sort_order;

create or replace view public.crew_balances_v as
with normalized_events as (
  select
    event.crew_id,
    event.from_membership_id,
    event.to_membership_id,
    case
      when event.event_type = 'manual_settlement' then -event.drinks
      else event.drinks
    end::numeric(8,2) as signed_drinks
  from public.ledger_events event
  where event.from_membership_id is not null
    and event.to_membership_id is not null
),
rolled_up as (
  select
    normalized_events.crew_id,
    least(normalized_events.from_membership_id, normalized_events.to_membership_id) as member_a_id,
    greatest(normalized_events.from_membership_id, normalized_events.to_membership_id) as member_b_id,
    sum(
      case
        when normalized_events.from_membership_id < normalized_events.to_membership_id then normalized_events.signed_drinks
        else -normalized_events.signed_drinks
      end
    )::numeric(8,2) as net_forward
  from normalized_events
  group by
    normalized_events.crew_id,
    least(normalized_events.from_membership_id, normalized_events.to_membership_id),
    greatest(normalized_events.from_membership_id, normalized_events.to_membership_id)
)
select
  rolled_up.crew_id,
  case when rolled_up.net_forward >= 0 then rolled_up.member_a_id else rolled_up.member_b_id end as from_membership_id,
  case when rolled_up.net_forward >= 0 then rolled_up.member_b_id else rolled_up.member_a_id end as to_membership_id,
  abs(rolled_up.net_forward)::numeric(8,2) as outstanding_drinks
from rolled_up
where abs(rolled_up.net_forward) > 0;

create or replace view public.crew_leaderboard_v as
select
  bet.crew_id,
  outcome.membership_id,
  coalesce(sum(case when outcome.net_result > 0 then outcome.net_result else 0 end), 0)::numeric(8,2) as total_won,
  count(*) filter (where outcome.net_result > 0) as wins,
  count(*) as appearances,
  coalesce(max(outcome.net_result), 0)::numeric(8,2) as best_result
from public.bet_member_outcomes outcome
join public.bets bet on bet.id = outcome.bet_id
group by bet.crew_id, outcome.membership_id;

create or replace view public.crew_home_summaries_v as
select
  crew.id as crew_id,
  crew.name,
  crew.invite_code,
  crew.drink_theme,
  crew.visibility,
  crew.archived_at,
  night.id as current_night_id,
  night.name as current_night_name,
  night.status as current_night_status,
  coalesce(member_counts.active_members, 0) as active_members,
  coalesce(open_bets.open_bets, 0) as open_bets
from public.crews crew
left join lateral (
  select night_inner.*
  from public.nights night_inner
  where night_inner.crew_id = crew.id
    and night_inner.status in ('active', 'winding-down')
  order by night_inner.started_at desc
  limit 1
) night on true
left join lateral (
  select count(*)::integer as active_members
  from public.crew_memberships membership
  where membership.crew_id = crew.id
    and membership.status = 'active'
) member_counts on true
left join lateral (
  select count(*)::integer as open_bets
  from public.bets bet
  where bet.crew_id = crew.id
    and bet.status = 'open'
) open_bets on true;

create or replace view public.notification_inbox_v as
select
  notification.id,
  notification.crew_id,
  notification.profile_id,
  notification.membership_id,
  notification.type,
  notification.title,
  notification.message,
  notification.payload,
  notification.read_at,
  notification.created_at
from public.notifications notification;

do $$
begin
  begin
    alter publication supabase_realtime add table public.night_participants;
  exception when duplicate_object then
    null;
  end;

  begin
    alter publication supabase_realtime add table public.disputes;
  exception when duplicate_object then
    null;
  end;

  begin
    alter publication supabase_realtime add table public.bet_resolution_events;
  exception when duplicate_object then
    null;
  end;
end
$$;
