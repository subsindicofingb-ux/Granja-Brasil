-- =============================================================================
-- Hidrômetros: síndico/sub-síndico/admin registram leituras
-- Visitantes: foto, ControlID, check-in/out, responsável da unidade cadastra
-- =============================================================================

drop policy if exists "water_meter_readings_insert" on public.water_meter_readings;
create policy "water_meter_readings_insert"
on public.water_meter_readings
for insert
to authenticated
with check (
  created_by = auth.uid()
  and (
    public.is_condo_doorman(condominium_id)
    or public.is_block_doorman(condominium_id)
    or public.is_condo_staff(condominium_id)
  )
);

drop policy if exists "water_meter_readings_update" on public.water_meter_readings;
create policy "water_meter_readings_update"
on public.water_meter_readings
for update
to authenticated
using (
  public.is_condo_doorman(condominium_id)
  or public.is_block_doorman(condominium_id)
  or public.is_condo_staff(condominium_id)
)
with check (
  public.is_condo_doorman(condominium_id)
  or public.is_block_doorman(condominium_id)
  or public.is_condo_staff(condominium_id)
);

create or replace function public.can_register_unit_visitors(p_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.residents r
    where r.unit_id = p_unit_id
      and r.profile_id = auth.uid()
      and r.type in ('owner', 'responsible', 'tenant')
  );
$$;

grant execute on function public.can_register_unit_visitors(uuid) to authenticated;

drop policy if exists "visitor_authorizations_insert_resident" on public.visitor_authorizations;
create policy "visitor_authorizations_insert_resident"
on public.visitor_authorizations
for insert
to authenticated
with check (
  public.is_condo_member(condominium_id)
  and not public.is_condo_staff(condominium_id)
  and public.can_register_unit_visitors(unit_id)
  and public.condominium_id_for_unit(unit_id) = condominium_id
);

alter table public.visitor_authorizations
  add column if not exists photo_url text,
  add column if not exists sync_controlid boolean not null default false,
  add column if not exists checked_in_at timestamptz,
  add column if not exists checked_out_at timestamptz,
  add column if not exists controlid_registration text;

create table if not exists public.visitor_authorization_access_devices (
  id uuid primary key default gen_random_uuid(),
  visitor_authorization_id uuid not null references public.visitor_authorizations (id) on delete cascade,
  access_device_id uuid not null references public.access_devices (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint visitor_authorization_access_devices_unique
    unique (visitor_authorization_id, access_device_id)
);

create index if not exists visitor_authorization_access_devices_auth_id_idx
  on public.visitor_authorization_access_devices (visitor_authorization_id);

create table if not exists public.visitor_access_grants (
  id uuid primary key default gen_random_uuid(),
  visitor_authorization_id uuid not null references public.visitor_authorizations (id) on delete cascade,
  access_device_id uuid not null references public.access_devices (id) on delete cascade,
  sync_status public.access_grant_sync_status not null default 'pending',
  sync_error text,
  controlid_user_id bigint,
  controlid_registration text,
  synced_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint visitor_access_grants_unique unique (visitor_authorization_id, access_device_id)
);

create index if not exists visitor_access_grants_auth_id_idx
  on public.visitor_access_grants (visitor_authorization_id);

drop trigger if exists visitor_access_grants_set_updated_at on public.visitor_access_grants;
create trigger visitor_access_grants_set_updated_at
before update on public.visitor_access_grants
for each row execute function public.set_updated_at();

create table if not exists public.visitor_access_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  visitor_authorization_id uuid not null references public.visitor_authorizations (id) on delete cascade,
  access_device_id uuid not null references public.access_devices (id) on delete cascade,
  grant_id uuid references public.visitor_access_grants (id) on delete set null,
  action public.access_sync_action not null,
  status public.access_sync_job_status not null default 'pending',
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  last_error text,
  controlid_user_id bigint,
  scheduled_at timestamptz not null default timezone('utc', now()),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists visitor_access_sync_jobs_status_scheduled_idx
  on public.visitor_access_sync_jobs (status, scheduled_at);

create unique index if not exists visitor_access_sync_jobs_pending_unique
  on public.visitor_access_sync_jobs (visitor_authorization_id, access_device_id, action)
  where status in ('pending', 'processing');

drop trigger if exists visitor_access_sync_jobs_set_updated_at on public.visitor_access_sync_jobs;
create trigger visitor_access_sync_jobs_set_updated_at
before update on public.visitor_access_sync_jobs
for each row execute function public.set_updated_at();

alter table public.visitor_authorization_access_devices enable row level security;
alter table public.visitor_access_grants enable row level security;
alter table public.visitor_access_sync_jobs enable row level security;

create policy "visitor_auth_access_devices_select"
on public.visitor_authorization_access_devices
for select
to authenticated
using (
  exists (
    select 1
    from public.visitor_authorizations va
    where va.id = visitor_authorization_id
      and (
        public.is_condo_staff(va.condominium_id)
        or public.is_condo_doorman(va.condominium_id)
        or (
          public.is_condo_member(va.condominium_id)
          and public.shares_unit_with_auth_user(va.unit_id)
        )
      )
  )
);

create policy "visitor_auth_access_devices_insert"
on public.visitor_authorization_access_devices
for insert
to authenticated
with check (
  exists (
    select 1
    from public.visitor_authorizations va
    where va.id = visitor_authorization_id
      and (
        public.is_condo_staff(va.condominium_id)
        or (
          public.can_register_unit_visitors(va.unit_id)
          and va.requested_by = auth.uid()
          and va.status = 'pending'
        )
      )
      and public.can_view_access_device_for_condo(access_device_id, va.condominium_id)
  )
);

create policy "visitor_auth_access_devices_delete"
on public.visitor_authorization_access_devices
for delete
to authenticated
using (
  exists (
    select 1
    from public.visitor_authorizations va
    where va.id = visitor_authorization_id
      and (
        public.is_condo_staff(va.condominium_id)
        or (
          public.can_register_unit_visitors(va.unit_id)
          and va.requested_by = auth.uid()
          and va.status = 'pending'
        )
      )
  )
);

create policy "visitor_access_grants_select"
on public.visitor_access_grants
for select
to authenticated
using (
  exists (
    select 1
    from public.visitor_authorizations va
    where va.id = visitor_authorization_id
      and (
        public.is_condo_operational_staff(va.condominium_id)
        or public.shares_unit_with_auth_user(va.unit_id)
      )
  )
);

create policy "visitor_access_grants_staff_write"
on public.visitor_access_grants
for insert
to authenticated
with check (
  exists (
    select 1
    from public.visitor_authorizations va
    where va.id = visitor_authorization_id
      and public.is_condo_staff(va.condominium_id)
      and public.can_view_access_device_for_condo(access_device_id, va.condominium_id)
  )
);

create policy "visitor_access_grants_staff_update"
on public.visitor_access_grants
for update
to authenticated
using (
  exists (
    select 1
    from public.visitor_authorizations va
    where va.id = visitor_authorization_id
      and public.is_condo_operational_staff(va.condominium_id)
  )
)
with check (
  exists (
    select 1
    from public.visitor_authorizations va
    where va.id = visitor_authorization_id
      and public.is_condo_operational_staff(va.condominium_id)
  )
);

create policy "visitor_access_grants_staff_delete"
on public.visitor_access_grants
for delete
to authenticated
using (
  exists (
    select 1
    from public.visitor_authorizations va
    where va.id = visitor_authorization_id
      and public.is_condo_staff(va.condominium_id)
  )
);

create policy "visitor_access_sync_jobs_select"
on public.visitor_access_sync_jobs
for select
to authenticated
using (
  exists (
    select 1
    from public.visitor_authorizations va
    where va.id = visitor_authorization_id
      and public.is_condo_operational_staff(va.condominium_id)
  )
);
