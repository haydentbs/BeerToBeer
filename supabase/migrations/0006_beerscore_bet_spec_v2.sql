create schema if not exists app_private;

alter table public.bets
  add column if not exists subtype text,
  add column if not exists line numeric(6,1),
  add column if not exists resolution_source text,
  add column if not exists pending_result_option_id uuid,
  add column if not exists pending_result_at timestamptz;

update public.bets
set type = 'prop',
    subtype = coalesce(subtype, 'multi')
where type = 'multi';

update public.bets
set status = 'open'
where status = 'locked';

update public.bet_status_events
set from_status = 'open'
where from_status = 'locked';

update public.bet_status_events
set to_status = 'open'
where to_status = 'locked';

update public.bets bet
set subtype = case
  when bet.type = 'h2h' then null
  when bet.subtype is not null then bet.subtype
  when bet.line is not null then 'overunder'
  when (
    select count(*)
    from public.bet_options option
    where option.bet_id = bet.id
  ) > 2 then 'multi'
  else 'yesno'
end
where bet.subtype is null;

alter table public.bets
  drop constraint if exists bets_type_check;

alter table public.bets
  add constraint bets_type_check
  check (type in ('prop', 'h2h'));

alter table public.bets
  drop constraint if exists bets_status_check;

alter table public.bets
  add constraint bets_status_check
  check (status in ('open', 'pending_result', 'disputed', 'resolved', 'void', 'cancelled'));

alter table public.bets
  drop constraint if exists bets_subtype_check;

alter table public.bets
  add constraint bets_subtype_check
  check (subtype in ('yesno', 'overunder', 'multi') or subtype is null);

alter table public.bets
  drop constraint if exists bets_pending_result_option_fk;

alter table public.bets
  add constraint bets_pending_result_option_fk
  foreign key (pending_result_option_id) references public.bet_options(id) on delete set null;

alter table public.wagers
  drop constraint if exists wagers_max_drinks_check;

alter table public.wagers
  add constraint wagers_max_drinks_check
  check (drinks <= 5);

alter table public.bet_status_events
  drop constraint if exists bet_status_events_from_status_check;

alter table public.bet_status_events
  add constraint bet_status_events_from_status_check
  check (from_status in ('open', 'pending_result', 'disputed', 'resolved', 'void', 'cancelled') or from_status is null);

alter table public.bet_status_events
  drop constraint if exists bet_status_events_to_status_check;

alter table public.bet_status_events
  add constraint bet_status_events_to_status_check
  check (to_status in ('open', 'pending_result', 'disputed', 'resolved', 'void', 'cancelled'));

alter table public.bets
  drop constraint if exists bets_resolution_source_check;

alter table public.bets
  add constraint bets_resolution_source_check
  check (
    resolution_source is null
    or resolution_source in ('manual', 'consensus', 'dispute', 'system', 'proposal', 'confirm', 'timeout')
  );

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
      (wager.drinks * 100)::integer as stake_cents,
      wager.created_at,
      wager.id
    from public.wagers wager
    where wager.bet_id = p_bet_id
  ),
  totals as (
    select
      coalesce(sum(wager.stake_cents) filter (where wager.option_id = p_winning_option_id), 0)::integer as total_winning_stake_cents,
      coalesce(sum(wager.stake_cents) filter (where wager.option_id <> p_winning_option_id), 0)::integer as total_losing_stake_cents
    from wager_base wager
  ),
  ranked_winners as (
    select
      wager.membership_id,
      wager.option_id,
      wager.stake,
      wager.stake_cents,
      totals.total_losing_stake_cents,
      row_number() over (
        order by wager.stake desc, wager.created_at asc, wager.id asc
      ) as winner_rank,
      floor((wager.stake_cents::numeric * totals.total_losing_stake_cents) / nullif(totals.total_winning_stake_cents, 0))::integer as profit_cents
    from wager_base wager
    cross join totals
    where wager.option_id = p_winning_option_id
  ),
  winner_profit_totals as (
    select coalesce(sum(ranked_winners.profit_cents), 0)::integer as profit_cents_sum
    from ranked_winners
  ),
  winning_rows as (
    select
      ranked_winners.membership_id,
      ranked_winners.option_id,
      ranked_winners.stake,
      (
        case
          when ranked_winners.winner_rank = 1 then ranked_winners.profit_cents + (ranked_winners.total_losing_stake_cents - winner_profit_totals.profit_cents_sum)
          else ranked_winners.profit_cents
        end
      )::numeric / 100 as net_result,
      (
        ranked_winners.stake_cents +
        case
          when ranked_winners.winner_rank = 1 then ranked_winners.profit_cents + (ranked_winners.total_losing_stake_cents - winner_profit_totals.profit_cents_sum)
          else ranked_winners.profit_cents
        end
      )::numeric / 100 as gross_return
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
  select
    winning_rows.membership_id,
    winning_rows.option_id,
    winning_rows.stake,
    winning_rows.net_result::numeric(8,2),
    winning_rows.gross_return::numeric(8,2)
  from winning_rows
  union all
  select * from losing_rows;
$$;
