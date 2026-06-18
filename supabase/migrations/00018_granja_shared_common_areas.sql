-- =============================================================================
-- Espaços comuns compartilhados: condomínios residenciais e casas reservam
-- também os espaços do condomínio Granja (residencial-exemplo).
-- =============================================================================

create or replace function public.granja_condominium_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.condominiums
  where slug = 'residencial-exemplo'
  limit 1;
$$;

create or replace function public.is_granja_common_area(p_common_area_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.common_areas ca
    where ca.id = p_common_area_id
      and ca.condominium_id = public.granja_condominium_id()
  );
$$;

create or replace function public.can_use_granja_shared_common_areas()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    join public.condominiums c on c.id = m.condominium_id
    where m.profile_id = auth.uid()
      and c.slug <> 'residencial-exemplo'
      and coalesce(c.is_commercial, false) = false
  )
  or exists (
    select 1
    from public.residents r
    join public.units u on u.id = r.unit_id
    join public.towers t on t.id = u.tower_id
    where r.profile_id = auth.uid()
      and (
        lower(trim(t.name)) = 'casa'
        or lower(trim(coalesce(u.block, ''))) = 'casa'
      )
  );
$$;

grant execute on function public.granja_condominium_id() to authenticated;
grant execute on function public.is_granja_common_area(uuid) to authenticated;
grant execute on function public.can_use_granja_shared_common_areas() to authenticated;

drop policy if exists "common_areas_select" on public.common_areas;

create policy "common_areas_select"
on public.common_areas
for select
to authenticated
using (
  public.is_condo_member(condominium_id)
  or public.is_condo_doorman(condominium_id)
  or (
    public.can_use_granja_shared_common_areas()
    and condominium_id = public.granja_condominium_id()
  )
);

drop policy if exists "reservations_select" on public.reservations;

create policy "reservations_select"
on public.reservations
for select
to authenticated
using (
  public.is_condo_staff(public.condominium_id_for_common_area(common_area_id))
  or public.is_condo_doorman(public.condominium_id_for_common_area(common_area_id))
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

drop policy if exists "reservations_insert" on public.reservations;

create policy "reservations_insert"
on public.reservations
for insert
to authenticated
with check (
  public.is_condo_staff(public.condominium_id_for_common_area(common_area_id))
  or (
    public.owns_unit(unit_id)
    and public.is_condo_member(public.condominium_id_for_common_area(common_area_id))
    and public.condominium_id_for_unit(unit_id) = public.condominium_id_for_common_area(common_area_id)
  )
  or (
    public.can_use_granja_shared_common_areas()
    and public.is_granja_common_area(common_area_id)
    and public.owns_unit(unit_id)
    and public.condominium_id_for_unit(unit_id) <> public.granja_condominium_id()
  )
  or (
    public.can_use_granja_shared_common_areas()
    and public.is_granja_common_area(common_area_id)
    and public.is_condo_staff(public.condominium_id_for_unit(unit_id))
    and public.condominium_id_for_unit(unit_id) <> public.granja_condominium_id()
  )
);

drop policy if exists "reservations_update" on public.reservations;

create policy "reservations_update"
on public.reservations
for update
to authenticated
using (
  public.is_condo_staff(public.condominium_id_for_common_area(common_area_id))
  or (
    public.owns_unit(unit_id)
    and status in ('pending', 'approved')
    and public.is_condo_member(public.condominium_id_for_common_area(common_area_id))
  )
  or (
    public.can_use_granja_shared_common_areas()
    and public.is_granja_common_area(common_area_id)
    and public.owns_unit(unit_id)
    and status in ('pending', 'approved')
  )
)
with check (
  public.is_condo_staff(public.condominium_id_for_common_area(common_area_id))
  or (
    public.owns_unit(unit_id)
    and status in ('pending', 'cancelled')
    and public.is_condo_member(public.condominium_id_for_common_area(common_area_id))
  )
  or (
    public.can_use_granja_shared_common_areas()
    and public.is_granja_common_area(common_area_id)
    and public.owns_unit(unit_id)
    and status in ('pending', 'cancelled')
  )
);
