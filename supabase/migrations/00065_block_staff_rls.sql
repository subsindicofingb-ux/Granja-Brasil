-- Síndico/admin do bloco e portaria: acesso operacional aos condomínios unidos.
-- Corrige leitura de unidades/moradores/acessos entre Jacarandás e Jequitibás (e demais blocos).

create or replace function public.is_block_staff(p_condominium_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.memberships m
    where m.profile_id = auth.uid()
      and m.role in ('admin', 'syndic', 'sub_syndic')
      and public.condominium_doorman_block_id(m.condominium_id) is not null
      and public.condominium_doorman_block_id(m.condominium_id)
        = public.condominium_doorman_block_id(p_condominium_id)
  );
$$;

grant execute on function public.is_block_staff(uuid) to authenticated;

create or replace function public.is_condo_operational_staff(p_condominium_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or public.is_condo_staff(p_condominium_id)
    or public.is_block_staff(p_condominium_id)
    or public.is_condo_doorman(p_condominium_id)
    or public.is_block_doorman(p_condominium_id)
    or public.has_condo_role(
      p_condominium_id,
      array['sub_syndic']::public.membership_role[]
    );
$$;

-- Condomínios do bloco
drop policy if exists "condominiums_select" on public.condominiums;
create policy "condominiums_select"
on public.condominiums
for select
to authenticated
using (
  public.is_condo_member(id)
  or public.is_block_doorman(id)
  or public.is_block_staff(id)
);

-- Torres
drop policy if exists "towers_select" on public.towers;
create policy "towers_select"
on public.towers
for select
to authenticated
using (
  public.is_condo_member(condominium_id)
  or public.is_block_doorman(condominium_id)
  or public.is_block_staff(condominium_id)
);

drop policy if exists "towers_insert" on public.towers;
create policy "towers_insert"
on public.towers
for insert
to authenticated
with check (
  public.is_condo_staff(condominium_id)
  or public.is_block_staff(condominium_id)
);

drop policy if exists "towers_update" on public.towers;
create policy "towers_update"
on public.towers
for update
to authenticated
using (
  public.is_condo_staff(condominium_id)
  or public.is_block_staff(condominium_id)
)
with check (
  public.is_condo_staff(condominium_id)
  or public.is_block_staff(condominium_id)
);

drop policy if exists "towers_delete" on public.towers;
create policy "towers_delete"
on public.towers
for delete
to authenticated
using (
  public.is_condo_staff(condominium_id)
  or public.is_block_staff(condominium_id)
);

-- Unidades
drop policy if exists "units_select" on public.units;
create policy "units_select"
on public.units
for select
to authenticated
using (
  public.is_condo_member(public.condominium_id_for_unit(id))
  or public.is_condo_doorman(public.condominium_id_for_unit(id))
  or public.is_block_doorman(public.condominium_id_for_unit(id))
  or public.is_block_staff(public.condominium_id_for_unit(id))
);

drop policy if exists "units_insert" on public.units;
create policy "units_insert"
on public.units
for insert
to authenticated
with check (
  public.is_condo_staff(public.condominium_id_for_tower(tower_id))
  or public.is_block_staff(public.condominium_id_for_tower(tower_id))
);

drop policy if exists "units_update" on public.units;
create policy "units_update"
on public.units
for update
to authenticated
using (
  public.is_condo_staff(public.condominium_id_for_unit(id))
  or public.is_block_staff(public.condominium_id_for_unit(id))
)
with check (
  public.is_condo_staff(public.condominium_id_for_tower(tower_id))
  or public.is_block_staff(public.condominium_id_for_tower(tower_id))
);

drop policy if exists "units_delete" on public.units;
create policy "units_delete"
on public.units
for delete
to authenticated
using (
  public.is_condo_staff(public.condominium_id_for_unit(id))
  or public.is_block_staff(public.condominium_id_for_unit(id))
);

-- Moradores
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
  or public.shares_unit_with_auth_user(unit_id)
  or profile_id = auth.uid()
);

drop policy if exists "residents_insert" on public.residents;
create policy "residents_insert"
on public.residents
for insert
to authenticated
with check (
  public.is_condo_staff(public.condominium_id_for_unit(unit_id))
  or public.is_block_staff(public.condominium_id_for_unit(unit_id))
);

drop policy if exists "residents_update" on public.residents;
create policy "residents_update"
on public.residents
for update
to authenticated
using (
  public.is_condo_staff(public.condominium_id_for_unit(unit_id))
  or public.is_block_staff(public.condominium_id_for_unit(unit_id))
  or (profile_id = auth.uid() and public.is_condo_member(public.condominium_id_for_unit(unit_id)))
)
with check (
  public.is_condo_staff(public.condominium_id_for_unit(unit_id))
  or public.is_block_staff(public.condominium_id_for_unit(unit_id))
  or (profile_id = auth.uid() and public.is_condo_member(public.condominium_id_for_unit(unit_id)))
);

drop policy if exists "residents_delete" on public.residents;
create policy "residents_delete"
on public.residents
for delete
to authenticated
using (
  public.is_condo_staff(public.condominium_id_for_unit(unit_id))
  or public.is_block_staff(public.condominium_id_for_unit(unit_id))
);

-- Equipamentos ControlID: portaria/síndico do bloco
create or replace function public.can_view_access_device_for_condo(p_device_id uuid, p_condominium_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
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
        or (
          public.condominium_doorman_block_id(d.condominium_id) is not null
          and public.condominium_doorman_block_id(p_condominium_id) is not null
          and public.condominium_doorman_block_id(d.condominium_id)
            = public.condominium_doorman_block_id(p_condominium_id)
        )
      )
  );
$$;

drop policy if exists "access_devices_select_operational" on public.access_devices;
create policy "access_devices_select_operational"
on public.access_devices
for select
to authenticated
using (
  public.is_condo_doorman(condominium_id)
  or public.is_block_doorman(condominium_id)
  or public.is_block_staff(condominium_id)
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
        or public.is_block_doorman(s.condominium_id)
        or public.is_block_staff(s.condominium_id)
        or public.has_condo_role(
          s.condominium_id,
          array['sub_syndic']::public.membership_role[]
        )
      )
  )
);

drop policy if exists "access_device_shares_select" on public.access_device_shares;
create policy "access_device_shares_select"
on public.access_device_shares
for select
to authenticated
using (
  public.is_access_device_owner_staff(access_device_id)
  or public.is_condo_staff(condominium_id)
  or public.is_block_staff(condominium_id)
  or public.is_condo_doorman(condominium_id)
  or public.is_block_doorman(condominium_id)
);

-- Grants de acesso do morador: síndico do bloco pode inserir/atualizar
drop policy if exists "resident_access_grants_insert" on public.resident_access_grants;
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
      and (
        public.is_condo_staff(t.condominium_id)
        or public.is_block_staff(t.condominium_id)
      )
      and public.can_view_access_device_for_condo(
        resident_access_grants.access_device_id,
        t.condominium_id
      )
  )
);

drop policy if exists "resident_access_grants_update" on public.resident_access_grants;
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
      and (
        public.is_condo_staff(t.condominium_id)
        or public.is_block_staff(t.condominium_id)
      )
  )
)
with check (
  exists (
    select 1
    from public.residents r
    join public.units u on u.id = r.unit_id
    join public.towers t on t.id = u.tower_id
    where r.id = resident_access_grants.resident_id
      and (
        public.is_condo_staff(t.condominium_id)
        or public.is_block_staff(t.condominium_id)
      )
  )
);

drop policy if exists "resident_access_grants_delete" on public.resident_access_grants;
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
      and (
        public.is_condo_staff(t.condominium_id)
        or public.is_block_staff(t.condominium_id)
      )
  )
);
