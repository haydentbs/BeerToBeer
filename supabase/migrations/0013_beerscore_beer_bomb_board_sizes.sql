alter table public.mini_game_matches
  drop constraint if exists mini_game_matches_board_size_check,
  drop constraint if exists mini_game_matches_hidden_slot_index_check;

alter table public.mini_game_matches
  add constraint mini_game_matches_board_size_check
    check (board_size in (4, 6, 8, 9, 12)),
  add constraint mini_game_matches_hidden_slot_index_check
    check (hidden_slot_index >= 0 and hidden_slot_index < board_size);
