insert into public.profiles (id, display_name, email, initials)
values
  ('00000000-0000-0000-0000-000000000001', 'Demo Creator', 'creator@example.com', 'DC'),
  ('00000000-0000-0000-0000-000000000002', 'Sarah Lane', 'sarah@example.com', 'SL'),
  ('00000000-0000-0000-0000-000000000003', 'Jake Moore', 'jake@example.com', 'JM')
on conflict do nothing;

insert into public.profile_preferences (profile_id, default_drink_theme)
values
  ('00000000-0000-0000-0000-000000000001', 'beer'),
  ('00000000-0000-0000-0000-000000000002', 'beer'),
  ('00000000-0000-0000-0000-000000000003', 'beer')
on conflict do nothing;

insert into public.crews (id, name, description, invite_code, visibility, drink_theme, created_by_profile_id)
values
  (
    '10000000-0000-0000-0000-000000000001',
    'Demo Drinkers',
    'Seeded crew for guest joins, persistence checks, and UI smoke tests.',
    'DEMO1234',
    'private',
    'beer',
    '00000000-0000-0000-0000-000000000001'
  )
on conflict do nothing;

insert into public.crew_memberships (id, crew_id, actor_type, profile_id, role, status)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'profile', '00000000-0000-0000-0000-000000000001', 'creator', 'active'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'profile', '00000000-0000-0000-0000-000000000002', 'member', 'active'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'profile', '00000000-0000-0000-0000-000000000003', 'member', 'active')
on conflict do nothing;

insert into public.crew_invites (id, crew_id, code, label, created_by_membership_id)
values
  ('21000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'DEMO1234', 'Primary demo invite', '20000000-0000-0000-0000-000000000001')
on conflict do nothing;

insert into public.nights (id, crew_id, name, status, created_by_membership_id, drink_theme_override)
values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Friday at O''Malley''s', 'active', '20000000-0000-0000-0000-000000000001', 'beer')
on conflict do nothing;

insert into public.night_participants (id, night_id, membership_id)
values
  ('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001'),
  ('31000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002'),
  ('31000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003')
on conflict do nothing;

insert into public.bets (id, crew_id, night_id, type, title, description, status, created_by_membership_id, closes_at)
values
  (
    '40000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'prop',
    'Will Dave mention his ex?',
    'Demo open bet for testing the pool UI.',
    'open',
    '20000000-0000-0000-0000-000000000002',
    now() + interval '45 minutes'
  )
on conflict do nothing;

insert into public.bet_options (id, bet_id, label, sort_order)
values
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Yes', 0),
  ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 'No', 1)
on conflict do nothing;

insert into public.wagers (id, bet_id, bet_option_id, membership_id, drinks)
values
  ('60000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 1.0),
  ('60000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 0.5)
on conflict do nothing;

insert into public.notifications (id, crew_id, profile_id, type, title, message, payload)
values
  (
    '70000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'bet_created',
    'Demo bet created',
    'Will Dave mention his ex? is open for wagers.',
    jsonb_build_object('bet_id', '40000000-0000-0000-0000-000000000001')
  )
on conflict do nothing;
