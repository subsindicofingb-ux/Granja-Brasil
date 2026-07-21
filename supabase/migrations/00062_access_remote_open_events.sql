-- =============================================================================
-- Abertura remota ControlID: auditoria de pulsos pela unidade
-- =============================================================================

create type public.access_remote_open_reason as enum (
  'visitor',
  'emergency'
);

create type public.access_remote_open_origin as enum (
  'app_resident',
  'app_doorman',
  'app_staff'
);

create type public.access_remote_open_result as enum (
  'ok',
  'error'
);

create table public.access_remote_open_events (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  resident_id uuid not null references public.residents (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  unit_id uuid references public.units (id) on delete set null,
  access_device_id uuid not null references public.access_devices (id) on delete cascade,
  controlid_user_id bigint,
  reason public.access_remote_open_reason not null,
  origin public.access_remote_open_origin not null,
  result public.access_remote_open_result not null,
  error_message text,
  notes text,
  visitor_authorization_id uuid references public.visitor_authorizations (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index access_remote_open_events_condo_created_idx
  on public.access_remote_open_events (condominium_id, created_at desc);

create index access_remote_open_events_resident_created_idx
  on public.access_remote_open_events (resident_id, created_at desc);

create index access_remote_open_events_device_created_idx
  on public.access_remote_open_events (access_device_id, created_at desc);

create index access_remote_open_events_profile_created_idx
  on public.access_remote_open_events (profile_id, created_at desc);

alter table public.access_remote_open_events enable row level security;

drop policy if exists "access_remote_open_events_select" on public.access_remote_open_events;
create policy "access_remote_open_events_select"
on public.access_remote_open_events
for select
to authenticated
using (
  profile_id = auth.uid()
  or public.is_condo_staff(condominium_id)
  or public.is_condo_doorman(condominium_id)
  or public.is_super_admin()
);

drop policy if exists "access_remote_open_events_insert" on public.access_remote_open_events;
create policy "access_remote_open_events_insert"
on public.access_remote_open_events
for insert
to authenticated
with check (
  profile_id = auth.uid()
  and public.resident_belongs_to_condominium(resident_id, condominium_id)
  and exists (
    select 1
    from public.resident_access_grants g
    where g.resident_id = access_remote_open_events.resident_id
      and g.access_device_id = access_remote_open_events.access_device_id
      and g.sync_status = 'synced'
  )
);
