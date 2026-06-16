-- =============================================================================
-- Row Level Security — políticas por perfil e ownership
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;

create policy "profiles_select"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.is_super_admin()
  or exists (
    select 1
    from public.memberships mine
    join public.memberships other on other.condominium_id = mine.condominium_id
    where mine.profile_id = auth.uid()
      and other.profile_id = profiles.id
      and mine.role in ('admin', 'syndic', 'doorman')
  )
);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid() or public.is_super_admin())
with check (id = auth.uid() or public.is_super_admin());

-- -----------------------------------------------------------------------------
-- condominiums
-- -----------------------------------------------------------------------------

alter table public.condominiums enable row level security;

create policy "condominiums_select"
on public.condominiums
for select
to authenticated
using (public.is_condo_member(id));

create policy "condominiums_insert"
on public.condominiums
for insert
to authenticated
with check (public.is_super_admin());

create policy "condominiums_update"
on public.condominiums
for update
to authenticated
using (public.is_condo_staff(id))
with check (public.is_condo_staff(id));

create policy "condominiums_delete"
on public.condominiums
for delete
to authenticated
using (public.is_super_admin());

-- -----------------------------------------------------------------------------
-- memberships
-- -----------------------------------------------------------------------------

alter table public.memberships enable row level security;

create policy "memberships_select"
on public.memberships
for select
to authenticated
using (
  profile_id = auth.uid()
  or public.is_condo_staff(condominium_id)
  or public.is_super_admin()
);

create policy "memberships_insert"
on public.memberships
for insert
to authenticated
with check (
  public.is_condo_staff(condominium_id)
  or public.is_super_admin()
);

create policy "memberships_update"
on public.memberships
for update
to authenticated
using (
  public.is_condo_staff(condominium_id)
  or public.is_super_admin()
)
with check (
  public.is_condo_staff(condominium_id)
  or public.is_super_admin()
);

create policy "memberships_delete"
on public.memberships
for delete
to authenticated
using (
  public.is_condo_staff(condominium_id)
  or public.is_super_admin()
);

-- -----------------------------------------------------------------------------
-- towers
-- -----------------------------------------------------------------------------

alter table public.towers enable row level security;

create policy "towers_select"
on public.towers
for select
to authenticated
using (public.is_condo_member(condominium_id));

create policy "towers_insert"
on public.towers
for insert
to authenticated
with check (public.is_condo_staff(condominium_id));

create policy "towers_update"
on public.towers
for update
to authenticated
using (public.is_condo_staff(condominium_id))
with check (public.is_condo_staff(condominium_id));

create policy "towers_delete"
on public.towers
for delete
to authenticated
using (public.is_condo_staff(condominium_id));

-- -----------------------------------------------------------------------------
-- units
-- -----------------------------------------------------------------------------

alter table public.units enable row level security;

create policy "units_select"
on public.units
for select
to authenticated
using (
  public.is_condo_member(public.condominium_id_for_unit(id))
  or public.is_condo_doorman(public.condominium_id_for_unit(id))
);

create policy "units_insert"
on public.units
for insert
to authenticated
with check (public.is_condo_staff(public.condominium_id_for_tower(tower_id)));

create policy "units_update"
on public.units
for update
to authenticated
using (public.is_condo_staff(public.condominium_id_for_unit(id)))
with check (public.is_condo_staff(public.condominium_id_for_tower(tower_id)));

create policy "units_delete"
on public.units
for delete
to authenticated
using (public.is_condo_staff(public.condominium_id_for_unit(id)));

-- -----------------------------------------------------------------------------
-- residents
-- -----------------------------------------------------------------------------

alter table public.residents enable row level security;

create policy "residents_select"
on public.residents
for select
to authenticated
using (
  public.is_condo_staff(public.condominium_id_for_unit(unit_id))
  or public.is_condo_doorman(public.condominium_id_for_unit(unit_id))
  or public.shares_unit_with_auth_user(unit_id)
  or profile_id = auth.uid()
);

create policy "residents_insert"
on public.residents
for insert
to authenticated
with check (
  public.is_condo_staff(public.condominium_id_for_unit(unit_id))
);

create policy "residents_update"
on public.residents
for update
to authenticated
using (
  public.is_condo_staff(public.condominium_id_for_unit(unit_id))
  or (profile_id = auth.uid() and public.is_condo_member(public.condominium_id_for_unit(unit_id)))
)
with check (
  public.is_condo_staff(public.condominium_id_for_unit(unit_id))
  or (profile_id = auth.uid() and public.is_condo_member(public.condominium_id_for_unit(unit_id)))
);

create policy "residents_delete"
on public.residents
for delete
to authenticated
using (public.is_condo_staff(public.condominium_id_for_unit(unit_id)));

-- -----------------------------------------------------------------------------
-- common_areas
-- -----------------------------------------------------------------------------

alter table public.common_areas enable row level security;

create policy "common_areas_select"
on public.common_areas
for select
to authenticated
using (
  public.is_condo_member(condominium_id)
  or public.is_condo_doorman(condominium_id)
);

create policy "common_areas_insert"
on public.common_areas
for insert
to authenticated
with check (public.is_condo_staff(condominium_id));

create policy "common_areas_update"
on public.common_areas
for update
to authenticated
using (public.is_condo_staff(condominium_id))
with check (public.is_condo_staff(condominium_id));

create policy "common_areas_delete"
on public.common_areas
for delete
to authenticated
using (public.is_condo_staff(condominium_id));

-- -----------------------------------------------------------------------------
-- reservations
-- -----------------------------------------------------------------------------

alter table public.reservations enable row level security;

create policy "reservations_select"
on public.reservations
for select
to authenticated
using (
  public.is_condo_member(public.condominium_id_for_common_area(common_area_id))
  or public.is_condo_doorman(public.condominium_id_for_common_area(common_area_id))
);

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
);

create policy "reservations_update"
on public.reservations
for update
to authenticated
using (
  public.is_condo_staff(public.condominium_id_for_common_area(common_area_id))
  or (
    public.owns_unit(unit_id)
    and status in ('pending', 'confirmed')
    and public.is_condo_member(public.condominium_id_for_common_area(common_area_id))
  )
)
with check (
  public.is_condo_staff(public.condominium_id_for_common_area(common_area_id))
  or (
    public.owns_unit(unit_id)
    and status in ('pending', 'cancelled')
    and public.is_condo_member(public.condominium_id_for_common_area(common_area_id))
  )
);

create policy "reservations_delete"
on public.reservations
for delete
to authenticated
using (public.is_condo_staff(public.condominium_id_for_common_area(common_area_id)));

-- -----------------------------------------------------------------------------
-- announcements
-- -----------------------------------------------------------------------------

alter table public.announcements enable row level security;

create policy "announcements_select"
on public.announcements
for select
to authenticated
using (
  (
    public.is_condo_member(condominium_id)
    or public.is_condo_doorman(condominium_id)
  )
  and (expires_at is null or expires_at > timezone('utc', now()))
);

create policy "announcements_insert"
on public.announcements
for insert
to authenticated
with check (public.is_condo_staff(condominium_id));

create policy "announcements_update"
on public.announcements
for update
to authenticated
using (public.is_condo_staff(condominium_id))
with check (public.is_condo_staff(condominium_id));

create policy "announcements_delete"
on public.announcements
for delete
to authenticated
using (public.is_condo_staff(condominium_id));
