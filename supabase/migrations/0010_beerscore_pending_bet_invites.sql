alter table public.bets
  add column if not exists challenge_wager numeric(10,2),
  add column if not exists respond_by_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists declined_at timestamptz,
  add column if not exists close_after_accept_minutes integer;

update public.bets
set close_after_accept_minutes = greatest(
  1,
  ceil(extract(epoch from (closes_at - created_at)) / 60.0)::integer
)
where closes_at is not null
  and close_after_accept_minutes is null;

alter table public.bets
  alter column closes_at drop not null;

alter table public.bets
  drop constraint if exists bets_status_check;

alter table public.bets
  add constraint bets_status_check
  check (status in ('pending_accept', 'open', 'pending_result', 'disputed', 'resolved', 'void', 'cancelled', 'declined'));

alter table public.bet_status_events
  drop constraint if exists bet_status_events_from_status_check;

alter table public.bet_status_events
  add constraint bet_status_events_from_status_check
  check (from_status in ('pending_accept', 'open', 'pending_result', 'disputed', 'resolved', 'void', 'cancelled', 'declined') or from_status is null);

alter table public.bet_status_events
  drop constraint if exists bet_status_events_to_status_check;

alter table public.bet_status_events
  add constraint bet_status_events_to_status_check
  check (to_status in ('pending_accept', 'open', 'pending_result', 'disputed', 'resolved', 'void', 'cancelled', 'declined'));

alter table public.bets
  drop constraint if exists bets_challenge_wager_check;

alter table public.bets
  add constraint bets_challenge_wager_check
  check (
    challenge_wager is null
    or (
      challenge_wager > 0
      and challenge_wager <= 5
      and mod(challenge_wager * 10, 5) = 0
    )
  );

alter table public.bets
  drop constraint if exists bets_close_after_accept_minutes_check;

alter table public.bets
  add constraint bets_close_after_accept_minutes_check
  check (close_after_accept_minutes is null or close_after_accept_minutes > 0);

create index if not exists bets_pending_accept_respond_by_idx
  on public.bets (status, respond_by_at)
  where status = 'pending_accept';
