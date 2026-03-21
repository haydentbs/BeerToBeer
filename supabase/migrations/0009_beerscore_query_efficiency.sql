create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop policy if exists guest_identities_owner_read on public.guest_identities;
create policy guest_identities_owner_read
  on public.guest_identities
  for select to authenticated
  using (
    created_by_profile_id = public.current_profile_id()
    or upgraded_to_profile_id = public.current_profile_id()
    or exists (
      select 1
      from public.crew_memberships actor_membership
      join public.crew_memberships guest_membership
        on guest_membership.guest_identity_id = guest_identities.id
       and guest_membership.crew_id = actor_membership.crew_id
      where actor_membership.profile_id = public.current_profile_id()
        and actor_membership.status = 'active'
    )
  );

drop view if exists public.crew_balances_v;
drop view if exists public.crew_home_summaries_v;
drop view if exists public.crew_leaderboard_v;
drop view if exists public.notification_inbox_v;

create index if not exists crews_invite_code_lookup_idx
  on public.crews (invite_code)
  where archived_at is null;

create index if not exists crew_invites_code_lookup_idx
  on public.crew_invites (code)
  where revoked_at is null;

create index if not exists bets_created_by_membership_id_idx
  on public.bets (created_by_membership_id);

create index if not exists bets_challenger_membership_id_idx
  on public.bets (challenger_membership_id);

create index if not exists bets_winning_option_id_idx
  on public.bets (winning_option_id);

create index if not exists bets_pending_result_option_id_idx
  on public.bets (pending_result_option_id);

create index if not exists nights_created_by_membership_id_idx
  on public.nights (created_by_membership_id);

create index if not exists bet_status_events_actor_membership_id_idx
  on public.bet_status_events (actor_membership_id);

create index if not exists bet_member_outcomes_membership_id_idx
  on public.bet_member_outcomes (membership_id);

create index if not exists bet_member_outcomes_option_id_idx
  on public.bet_member_outcomes (option_id);

create index if not exists ledger_events_night_id_idx
  on public.ledger_events (night_id);

create index if not exists ledger_events_from_membership_id_idx
  on public.ledger_events (from_membership_id);

create index if not exists ledger_events_to_membership_id_idx
  on public.ledger_events (to_membership_id);

create index if not exists audit_log_actor_membership_id_idx
  on public.audit_log (actor_membership_id);

create index if not exists crew_invites_created_by_membership_id_idx
  on public.crew_invites (created_by_membership_id);

create index if not exists disputes_opened_by_membership_id_idx
  on public.disputes (opened_by_membership_id);

create index if not exists disputes_resolution_option_id_idx
  on public.disputes (resolution_option_id);

create index if not exists dispute_votes_membership_id_idx
  on public.dispute_votes (membership_id);

create index if not exists dispute_votes_option_id_idx
  on public.dispute_votes (option_id);
