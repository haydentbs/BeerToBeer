create index if not exists bets_pending_result_confirm_idx
  on public.bets (crew_id, pending_result_at)
  where status = 'pending_result' and pending_result_at is not null;

create index if not exists mini_game_matches_pending_respond_by_idx
  on public.mini_game_matches (crew_id, respond_by_at)
  where status = 'pending' and respond_by_at is not null;

create index if not exists disputes_open_expires_at_idx
  on public.disputes (expires_at, bet_id)
  where status = 'open';
