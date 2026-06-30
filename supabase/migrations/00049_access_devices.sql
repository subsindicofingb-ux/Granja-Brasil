-- Pontos de acesso ControlID — cadastro por condomínio (síndico+)

create type public.access_device_type as enum (
  'facial_pedestrian',
  'facial_vehicle',
  'tag_vehicle',
  'visitor_temp',
  'staff_maintenance'
);

create type public.access_device_direction as enum (
  'entry',
  'exit',
  'both'
);

create table public.access_devices (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  display_name text not null,
  access_type public.access_device_type not null default 'facial_pedestrian',
  manufacturer text not null default 'ControlID',
  model text not null default 'iDFace',
  host_url text not null,
  api_username text not null default 'admin',
  api_password_encrypted text not null,
  direction public.access_device_direction not null default 'entry',
  entry_kind text not null default 'pedestrian',
  is_active boolean not null default true,
  is_pilot boolean not null default false,
  last_connection_ok_at timestamptz,
  last_connection_error text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint access_devices_display_name_unique unique (condominium_id, display_name),
  constraint access_devices_entry_kind_check check (entry_kind in ('pedestrian', 'vehicle'))
);

create index access_devices_condominium_id_idx on public.access_devices (condominium_id);
create index access_devices_active_idx on public.access_devices (condominium_id, is_active);

create table public.access_device_shares (
  id uuid primary key default gen_random_uuid(),
  access_device_id uuid not null references public.access_devices (id) on delete cascade,
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint access_device_shares_unique unique (access_device_id, condominium_id)
);

create index access_device_shares_condominium_id_idx
  on public.access_device_shares (condominium_id);

create trigger access_devices_set_updated_at
before update on public.access_devices
for each row execute function public.set_updated_at();

create or replace function public.is_access_device_owner_staff(p_device_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.access_devices d
      join public.memberships m on m.condominium_id = d.condominium_id
      where d.id = p_device_id
        and m.profile_id = auth.uid()
        and m.role in ('admin', 'syndic', 'sub_syndic')
    );
$$;

create or replace function public.can_view_access_device_for_condo(p_device_id uuid, p_condominium_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.access_devices d
    where d.id = p_device_id
      and (
        d.condominium_id = p_condominium_id
        or exists (
          select 1
          from public.access_device_shares s
          where s.access_device_id = d.id
            and s.condominium_id = p_condominium_id
        )
      )
  );
$$;

alter table public.access_devices enable row level security;
alter table public.access_device_shares enable row level security;

create policy "access_devices_select"
on public.access_devices
for select
to authenticated
using (
  public.is_condo_staff(condominium_id)
  or exists (
    select 1
    from public.access_device_shares s
    where s.access_device_id = access_devices.id
      and public.is_condo_staff(s.condominium_id)
  )
);

create policy "access_devices_insert"
on public.access_devices
for insert
to authenticated
with check (public.is_condo_staff(condominium_id));

create policy "access_devices_update"
on public.access_devices
for update
to authenticated
using (public.is_access_device_owner_staff(id))
with check (public.is_access_device_owner_staff(id));

create policy "access_devices_delete"
on public.access_devices
for delete
to authenticated
using (public.is_access_device_owner_staff(id));

create policy "access_device_shares_select"
on public.access_device_shares
for select
to authenticated
using (
  public.is_access_device_owner_staff(access_device_id)
  or public.is_condo_staff(condominium_id)
);

create policy "access_device_shares_insert"
on public.access_device_shares
for insert
to authenticated
with check (public.is_access_device_owner_staff(access_device_id));

create policy "access_device_shares_delete"
on public.access_device_shares
for delete
to authenticated
using (public.is_access_device_owner_staff(access_device_id));

grant execute on function public.is_access_device_owner_staff(uuid) to authenticated;
grant execute on function public.can_view_access_device_for_condo(uuid, uuid) to authenticated;
