create table if not exists public.crew_event_log (
  id bigint generated always as identity primary key,
  crew_id uuid not null references public.crews(id) on delete cascade,
  event_type text not null,
  entity_table text,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists crew_event_log_crew_id_id_idx
  on public.crew_event_log (crew_id, id desc);

create index if not exists crew_event_log_created_at_idx
  on public.crew_event_log (created_at desc);

alter table public.crew_event_log enable row level security;

drop policy if exists crew_event_log_member_read on public.crew_event_log;
create policy crew_event_log_member_read on public.crew_event_log
  for select to authenticated
  using (public.is_crew_member(crew_id));

create or replace function app_private.append_crew_event(
  p_crew_id uuid,
  p_event_type text,
  p_entity_table text default null,
  p_entity_id uuid default null,
  p_payload jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_id bigint;
begin
  insert into public.crew_event_log (
    crew_id,
    event_type,
    entity_table,
    entity_id,
    payload
  )
  values (
    p_crew_id,
    p_event_type,
    p_entity_table,
    p_entity_id,
    coalesce(p_payload, '{}'::jsonb)
  )
  returning id into inserted_id;

  return inserted_id;
end;
$$;

comment on table public.crew_event_log is 'Append-only change cursor for crew-scoped V2 polling.';
