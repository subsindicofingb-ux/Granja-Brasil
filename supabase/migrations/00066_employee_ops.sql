-- =============================================================================
-- Funcionário (membership role staff): consulta operacional, reservas, acessos
-- =============================================================================

create or replace function public.is_condo_employee(p_condominium_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_condo_role(
    p_condominium_id,
    array['staff']::public.membership_role[]
  );
$$;

grant execute on function public.is_condo_employee(uuid) to authenticated;

-- Reservas: funcionário pode ver (assinatura usa service role)
drop policy if exists "reservations_select" on public.reservations;
create policy "reservations_select"
on public.reservations
for select
to authenticated
using (
  public.is_condo_staff(public.condominium_id_for_common_area(common_area_id))
  or public.is_condo_doorman(public.condominium_id_for_common_area(common_area_id))
  or public.is_condo_employee(public.condominium_id_for_common_area(common_area_id))
  or (
    public.is_condo_member(public.condominium_id_for_common_area(common_area_id))
    and public.owns_unit(unit_id)
  )
  or (
    public.can_use_granja_shared_common_areas()
    and public.is_granja_common_area(common_area_id)
    and public.owns_unit(unit_id)
  )
);

-- Moradores: consulta
drop policy if exists "residents_select" on public.residents;
create policy "residents_select"
on public.residents
for select
to authenticated
using (
  public.is_condo_staff(public.condominium_id_for_unit(unit_id))
  or public.is_block_staff(public.condominium_id_for_unit(unit_id))
  or public.is_condo_doorman(public.condominium_id_for_unit(unit_id))
  or public.is_block_doorman(public.condominium_id_for_unit(unit_id))
  or public.is_condo_employee(public.condominium_id_for_unit(unit_id))
  or public.shares_unit_with_auth_user(unit_id)
  or profile_id = auth.uid()
);

-- Veículos: consulta (aprovados, como portaria)
drop policy if exists "vehicles_select" on public.vehicles;
create policy "vehicles_select"
on public.vehicles
for select
to authenticated
using (
  public.is_condo_staff(condominium_id)
  or (
    public.is_condo_doorman(condominium_id)
    and status = 'approved'
  )
  or (
    public.is_condo_employee(condominium_id)
    and status = 'approved'
  )
  or public.shares_unit_with_auth_user(unit_id)
);

-- Visitantes: consulta
drop policy if exists "visitor_authorizations_select_employee" on public.visitor_authorizations;
create policy "visitor_authorizations_select_employee"
on public.visitor_authorizations
for select
to authenticated
using (
  public.is_condo_employee(condominium_id)
  and not public.is_condo_staff(condominium_id)
  and not public.is_condo_doorman(condominium_id)
);

-- Locais de acesso habilitados por membership (funcionário / equipe)
create table if not exists public.membership_access_devices (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships (id) on delete cascade,
  access_device_id uuid not null references public.access_devices (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint membership_access_devices_unique unique (membership_id, access_device_id)
);

create index if not exists membership_access_devices_membership_id_idx
  on public.membership_access_devices (membership_id);

create index if not exists membership_access_devices_device_id_idx
  on public.membership_access_devices (access_device_id);

alter table public.membership_access_devices enable row level security;

drop policy if exists "membership_access_devices_select" on public.membership_access_devices;
create policy "membership_access_devices_select"
on public.membership_access_devices
for select
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.id = membership_access_devices.membership_id
      and (
        m.profile_id = auth.uid()
        or public.is_condo_staff(m.condominium_id)
        or public.is_super_admin()
      )
  )
);

drop policy if exists "membership_access_devices_manage" on public.membership_access_devices;
create policy "membership_access_devices_manage"
on public.membership_access_devices
for all
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.id = membership_access_devices.membership_id
      and (public.is_condo_staff(m.condominium_id) or public.is_super_admin())
  )
)
with check (
  exists (
    select 1
    from public.memberships m
    where m.id = membership_access_devices.membership_id
      and (public.is_condo_staff(m.condominium_id) or public.is_super_admin())
  )
);

-- Abertura remota: funcionário só nos pontos habilitados no membership
drop policy if exists "access_remote_open_events_insert" on public.access_remote_open_events;
create policy "access_remote_open_events_insert"
on public.access_remote_open_events
for insert
to authenticated
with check (
  profile_id = auth.uid()
  and (
    (
      resident_id is not null
      and public.resident_belongs_to_condominium(resident_id, condominium_id)
      and exists (
        select 1
        from public.resident_access_grants g
        where g.resident_id = access_remote_open_events.resident_id
          and g.access_device_id = access_remote_open_events.access_device_id
          and g.sync_status = 'synced'
      )
    )
    or (
      resident_id is null
      and (
        public.is_super_admin()
        or public.is_condo_staff(condominium_id)
        or exists (
          select 1
          from public.memberships m
          join public.membership_access_devices mad on mad.membership_id = m.id
          where m.profile_id = auth.uid()
            and m.condominium_id = access_remote_open_events.condominium_id
            and m.role = 'staff'
            and mad.access_device_id = access_remote_open_events.access_device_id
        )
      )
    )
  )
);

-- Atualiza hierarquia salva: Funcionário com permissões operacionais padrão
do $$
declare
  current_matrix jsonb;
  staff_defaults jsonb := jsonb_build_object(
    'dashboard', jsonb_build_object('view', true, 'create', false, 'delete', false),
    'registration_requests', jsonb_build_object('view', false, 'create', false, 'delete', false),
    'structure', jsonb_build_object('view', false, 'create', false, 'delete', false),
    'residents', jsonb_build_object('view', true, 'create', false, 'delete', false),
    'vehicles', jsonb_build_object('view', true, 'create', false, 'delete', false),
    'areas', jsonb_build_object('view', false, 'create', false, 'delete', false),
    'reservations', jsonb_build_object('view', true, 'create', false, 'delete', false),
    'announcements', jsonb_build_object('view', true, 'create', false, 'delete', false),
    'correspondence', jsonb_build_object('view', false, 'create', false, 'delete', false),
    'water_meters', jsonb_build_object('view', false, 'create', false, 'delete', false),
    'notifications', jsonb_build_object('view', true, 'create', true, 'delete', false),
    'visitors', jsonb_build_object('view', true, 'create', false, 'delete', false),
    'members', jsonb_build_object('view', false, 'create', false, 'delete', false),
    'access_devices', jsonb_build_object('view', true, 'create', false, 'delete', false),
    'condo_settings', jsonb_build_object('view', false, 'create', false, 'delete', false)
  );
begin
  select matrix into current_matrix
  from public.app_permission_matrix
  where id = 1;

  if current_matrix is null then
    return;
  end if;

  update public.app_permission_matrix
  set
    matrix = jsonb_set(current_matrix, '{staff}', staff_defaults, true),
    updated_at = now()
  where id = 1;
end;
$$;
