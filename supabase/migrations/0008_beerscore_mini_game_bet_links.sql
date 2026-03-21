alter table public.mini_game_matches
  add column if not exists bet_id uuid references public.bets(id) on delete set null,
  add column if not exists respond_by_at timestamptz;

create index if not exists mini_game_matches_bet_id_idx
  on public.mini_game_matches (bet_id);
