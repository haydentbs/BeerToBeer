alter table public.profiles enable row level security;
alter table public.profile_preferences enable row level security;
alter table public.guest_identities enable row level security;
alter table public.crews enable row level security;
alter table public.crew_memberships enable row level security;
alter table public.crew_invites enable row level security;
alter table public.crew_invite_redemptions enable row level security;
alter table public.crew_join_requests enable row level security;
alter table public.nights enable row level security;
alter table public.night_participants enable row level security;
alter table public.bets enable row level security;
alter table public.bet_options enable row level security;
alter table public.wagers enable row level security;
alter table public.bet_comments enable row level security;
alter table public.disputes enable row level security;
alter table public.dispute_votes enable row level security;
alter table public.bet_member_outcomes enable row level security;
alter table public.ledger_events enable row level security;
alter table public.settlement_requests enable row level security;
alter table public.settlement_confirmations enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.audit_log enable row level security;

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

create or replace function public.current_membership_id(target_crew_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select membership.id
  from public.crew_memberships membership
  where membership.crew_id = target_crew_id
    and membership.profile_id = public.current_profile_id()
    and membership.status = 'active'
  limit 1;
$$;

create or replace function public.is_crew_member(target_crew_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_membership_id(target_crew_id) is not null;
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
      and membership.profile_id = public.current_profile_id()
      and membership.status = 'active'
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
      and membership.profile_id = public.current_profile_id()
      and membership.status = 'active'
      and membership.role = 'creator'
  );
$$;

create policy profiles_self_read
  on public.profiles
  for select to authenticated
  using (auth_user_id = auth.uid());

create policy profiles_self_update
  on public.profiles
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

create policy profile_preferences_self_read
  on public.profile_preferences
  for select to authenticated
  using (profile_id = public.current_profile_id());

create policy crews_member_read
  on public.crews
  for select to authenticated
  using (public.is_crew_member(id));

create policy memberships_member_read
  on public.crew_memberships
  for select to authenticated
  using (public.is_crew_member(crew_id));

create policy crew_invites_member_read
  on public.crew_invites
  for select to authenticated
  using (public.is_crew_member(crew_id));

create policy crew_invite_redemptions_member_read
  on public.crew_invite_redemptions
  for select to authenticated
  using (
    exists (
      select 1
      from public.crew_invites invite_row
      where invite_row.id = crew_invite_id
        and public.is_crew_member(invite_row.crew_id)
    )
  );

create policy crew_join_requests_member_read
  on public.crew_join_requests
  for select to authenticated
  using (public.is_crew_member(crew_id) or profile_id = public.current_profile_id());

create policy nights_member_read
  on public.nights
  for select to authenticated
  using (public.is_crew_member(crew_id));

create policy night_participants_member_read
  on public.night_participants
  for select to authenticated
  using (
    exists (
      select 1
      from public.nights night_row
      where night_row.id = night_id
        and public.is_crew_member(night_row.crew_id)
    )
  );

create policy bets_member_read
  on public.bets
  for select to authenticated
  using (public.is_crew_member(crew_id));

create policy bet_options_member_read
  on public.bet_options
  for select to authenticated
  using (
    exists (
      select 1
      from public.bets bet_row
      where bet_row.id = bet_id
        and public.is_crew_member(bet_row.crew_id)
    )
  );

create policy wagers_member_read
  on public.wagers
  for select to authenticated
  using (
    exists (
      select 1
      from public.bets bet_row
      where bet_row.id = bet_id
        and public.is_crew_member(bet_row.crew_id)
    )
  );

create policy bet_comments_member_read
  on public.bet_comments
  for select to authenticated
  using (
    exists (
      select 1
      from public.bets bet_row
      where bet_row.id = bet_id
        and public.is_crew_member(bet_row.crew_id)
    )
  );

create policy disputes_member_read
  on public.disputes
  for select to authenticated
  using (
    exists (
      select 1
      from public.bets bet_row
      where bet_row.id = bet_id
        and public.is_crew_member(bet_row.crew_id)
    )
  );

create policy dispute_votes_member_read
  on public.dispute_votes
  for select to authenticated
  using (
    exists (
      select 1
      from public.disputes dispute_row
      join public.bets bet_row on bet_row.id = dispute_row.bet_id
      where dispute_row.id = dispute_id
        and public.is_crew_member(bet_row.crew_id)
    )
  );

create policy outcomes_member_read
  on public.bet_member_outcomes
  for select to authenticated
  using (
    exists (
      select 1
      from public.bets bet_row
      where bet_row.id = bet_id
        and public.is_crew_member(bet_row.crew_id)
    )
  );

create policy ledger_member_read
  on public.ledger_events
  for select to authenticated
  using (public.is_crew_member(crew_id));

create policy settlement_requests_member_read
  on public.settlement_requests
  for select to authenticated
  using (public.is_crew_member(crew_id));

create policy settlement_confirmations_member_read
  on public.settlement_confirmations
  for select to authenticated
  using (
    exists (
      select 1
      from public.settlement_requests request_row
      where request_row.id = settlement_request_id
        and public.is_crew_member(request_row.crew_id)
    )
  );

create policy notifications_profile_read
  on public.notifications
  for select to authenticated
  using (profile_id = public.current_profile_id());

create policy notifications_profile_update
  on public.notifications
  for update to authenticated
  using (profile_id = public.current_profile_id())
  with check (profile_id = public.current_profile_id());

create policy notification_preferences_self_read
  on public.notification_preferences
  for select to authenticated
  using (
    profile_id = public.current_profile_id()
    or membership_id in (
      select membership.id
      from public.crew_memberships membership
      where membership.profile_id = public.current_profile_id()
        and membership.status = 'active'
    )
  );

create policy audit_log_member_read
  on public.audit_log
  for select to authenticated
  using (public.is_crew_member(crew_id));

create or replace view public.crew_home_summaries_v as
select
  crew.id as crew_id,
  crew.name,
  crew.slug,
  crew.invite_code,
  crew.drink_theme,
  crew.created_at,
  active_night.id as current_night_id,
  active_night.name as current_night_name,
  active_night.status as current_night_status,
  (
    select count(*)
    from public.crew_memberships membership
    where membership.crew_id = crew.id
      and membership.status = 'active'
  ) as member_count
from public.crews crew
left join public.nights active_night
  on active_night.crew_id = crew.id
 and active_night.status in ('active', 'winding-down')
where crew.archived_at is null;

create or replace view public.crew_balances_v as
select
  event_row.crew_id,
  event_row.from_membership_id,
  event_row.to_membership_id,
  sum(
    case
      when event_row.status = 'posted' and event_row.event_type <> 'manual_settlement' then event_row.drinks
      else 0
    end
  )::numeric(10,2) as drinks,
  sum(
    case
      when event_row.status = 'posted' and event_row.event_type = 'manual_settlement' then event_row.drinks
      else 0
    end
  )::numeric(10,2) as settled,
  (
    sum(
      case
        when event_row.status = 'posted' and event_row.event_type <> 'manual_settlement' then event_row.drinks
        else 0
      end
    ) -
    sum(
      case
        when event_row.status = 'posted' and event_row.event_type = 'manual_settlement' then event_row.drinks
        else 0
      end
    )
  )::numeric(10,2) as outstanding
from public.ledger_events event_row
where event_row.from_membership_id is not null
  and event_row.to_membership_id is not null
group by event_row.crew_id, event_row.from_membership_id, event_row.to_membership_id;

create or replace view public.crew_leaderboard_v as
with nightly_scores as (
  select
    bet_row.crew_id,
    outcome.membership_id,
    bet_row.night_id,
    sum(outcome.net_result)::numeric(10,2) as night_net
  from public.bet_member_outcomes outcome
  join public.bets bet_row on bet_row.id = outcome.bet_id
  where outcome.reversal_of is null
  group by bet_row.crew_id, outcome.membership_id, bet_row.night_id
)
select
  bet_row.crew_id,
  outcome.membership_id,
  count(*) filter (where outcome.reversal_of is null)::integer as bets_participated,
  count(*) filter (where outcome.net_result > 0 and outcome.reversal_of is null)::integer as wins,
  coalesce(sum(greatest(outcome.net_result, 0)) filter (where outcome.reversal_of is null), 0)::numeric(10,2) as total_won,
  coalesce(sum(least(outcome.net_result, 0)) filter (where outcome.reversal_of is null), 0)::numeric(10,2) as total_lost,
  case
    when count(*) filter (where outcome.reversal_of is null) = 0 then 0::numeric
    else round(
      (count(*) filter (where outcome.net_result > 0 and outcome.reversal_of is null))::numeric
      / (count(*) filter (where outcome.reversal_of is null))::numeric,
      4
    )
  end as win_rate,
  coalesce(max(nightly_scores.night_net), 0)::numeric(10,2) as best_night
from public.bet_member_outcomes outcome
join public.bets bet_row on bet_row.id = outcome.bet_id
left join nightly_scores
  on nightly_scores.crew_id = bet_row.crew_id
 and nightly_scores.membership_id = outcome.membership_id
group by bet_row.crew_id, outcome.membership_id;

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

alter publication supabase_realtime add table public.crews;
alter publication supabase_realtime add table public.crew_memberships;
alter publication supabase_realtime add table public.nights;
alter publication supabase_realtime add table public.night_participants;
alter publication supabase_realtime add table public.bets;
alter publication supabase_realtime add table public.bet_options;
alter publication supabase_realtime add table public.wagers;
alter publication supabase_realtime add table public.notifications;
