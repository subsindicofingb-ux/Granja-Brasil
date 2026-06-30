-- Fase 3 ControlID: locais de acesso por morador e solicitação de cadastro

create type public.access_grant_sync_status as enum (
  'pending',
  'synced',
  'error'
);

create table public.resident_access_grants (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references public.residents (id) on delete cascade,
  access_device_id uuid not null references public.access_devices (id) on delete cascade,
  sync_status public.access_grant_sync_status not null default 'pending',
  sync_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint resident_access_grants_unique unique (resident_id, access_device_id)
);

create index resident_access_grants_resident_id_idx
  on public.resident_access_grants (resident_id);

create index resident_access_grants_access_device_id_idx
  on public.resident_access_grants (access_device_id);

create index resident_access_grants_sync_status_idx
  on public.resident_access_grants (sync_status);

create table public.registration_request_access_devices (
  id uuid primary key default gen_random_uuid(),
  registration_request_id uuid not null references public.registration_requests (id) on delete cascade,
  access_device_id uuid not null references public.access_devices (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint registration_request_access_devices_unique
    unique (registration_request_id, access_device_id)
);

create index registration_request_access_devices_request_id_idx
  on public.registration_request_access_devices (registration_request_id);

create trigger resident_access_grants_set_updated_at
before update on public.resident_access_grants
for each row execute function public.set_updated_at();

create or replace function public.is_condo_operational_staff(p_condominium_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or public.is_condo_staff(p_condominium_id)
    or public.is_condo_doorman(p_condominium_id)
    or public.has_condo_role(
      p_condominium_id,
      array['sub_syndic']::public.membership_role[]
    );
$$;

create or replace function public.resident_belongs_to_condominium(
  p_resident_id uuid,
  p_condominium_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.residents r
    join public.units u on u.id = r.unit_id
    join public.towers t on t.id = u.tower_id
    where r.id = p_resident_id
      and t.condominium_id = p_condominium_id
  );
$$;

-- Portaria e sub-síndico podem consultar equipamentos visíveis ao condomínio
create policy "access_devices_select_operational"
on public.access_devices
for select
to authenticated
using (
  public.is_condo_doorman(condominium_id)
  or public.has_condo_role(
    condominium_id,
    array['sub_syndic']::public.membership_role[]
  )
  or exists (
    select 1
    from public.access_device_shares s
    where s.access_device_id = access_devices.id
      and (
        public.is_condo_doorman(s.condominium_id)
        or public.has_condo_role(
          s.condominium_id,
          array['sub_syndic']::public.membership_role[]
        )
      )
  )
);

alter table public.resident_access_grants enable row level security;
alter table public.registration_request_access_devices enable row level security;

create policy "resident_access_grants_select"
on public.resident_access_grants
for select
to authenticated
using (
  exists (
    select 1
    from public.residents r
    join public.units u on u.id = r.unit_id
    join public.towers t on t.id = u.tower_id
    where r.id = resident_access_grants.resident_id
      and (
        public.is_condo_operational_staff(t.condominium_id)
        or r.profile_id = auth.uid()
      )
  )
);

create policy "resident_access_grants_insert"
on public.resident_access_grants
for insert
to authenticated
with check (
  exists (
    select 1
    from public.residents r
    join public.units u on u.id = r.unit_id
    join public.towers t on t.id = u.tower_id
    where r.id = resident_access_grants.resident_id
      and public.is_condo_staff(t.condominium_id)
      and public.can_view_access_device_for_condo(
        resident_access_grants.access_device_id,
        t.condominium_id
      )
  )
);

create policy "resident_access_grants_update"
on public.resident_access_grants
for update
to authenticated
using (
  exists (
    select 1
    from public.residents r
    join public.units u on u.id = r.unit_id
    join public.towers t on t.id = u.tower_id
    where r.id = resident_access_grants.resident_id
      and public.is_condo_staff(t.condominium_id)
  )
)
with check (
  exists (
    select 1
    from public.residents r
    join public.units u on u.id = r.unit_id
    join public.towers t on t.id = u.tower_id
    where r.id = resident_access_grants.resident_id
      and public.is_condo_staff(t.condominium_id)
      and public.can_view_access_device_for_condo(
        resident_access_grants.access_device_id,
        t.condominium_id
      )
  )
);

create policy "resident_access_grants_delete"
on public.resident_access_grants
for delete
to authenticated
using (
  exists (
    select 1
    from public.residents r
    join public.units u on u.id = r.unit_id
    join public.towers t on t.id = u.tower_id
    where r.id = resident_access_grants.resident_id
      and public.is_condo_staff(t.condominium_id)
  )
);

create policy "registration_request_access_devices_select"
on public.registration_request_access_devices
for select
to authenticated
using (
  exists (
    select 1
    from public.registration_requests rr
    where rr.id = registration_request_access_devices.registration_request_id
      and public.is_condo_operational_staff(rr.condominium_id)
  )
);

create policy "registration_request_access_devices_insert"
on public.registration_request_access_devices
for insert
to authenticated
with check (
  exists (
    select 1
    from public.registration_requests rr
    where rr.id = registration_request_access_devices.registration_request_id
      and public.is_condo_operational_staff(rr.condominium_id)
      and public.can_view_access_device_for_condo(
        registration_request_access_devices.access_device_id,
        rr.condominium_id
      )
  )
);

create policy "registration_request_access_devices_delete"
on public.registration_request_access_devices
for delete
to authenticated
using (
  exists (
    select 1
    from public.registration_requests rr
    where rr.id = registration_request_access_devices.registration_request_id
      and public.is_condo_operational_staff(rr.condominium_id)
  )
);

grant execute on function public.is_condo_operational_staff(uuid) to authenticated;
grant execute on function public.resident_belongs_to_condominium(uuid, uuid) to authenticated;
