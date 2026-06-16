-- =============================================================================
-- Reservas — status de aprovação (approved/rejected) e overlap atualizado
-- =============================================================================

alter type public.reservation_status rename value 'confirmed' to 'approved';

alter type public.reservation_status add value 'rejected';

-- Overlap: apenas pending e approved bloqueiam o horário
alter table public.reservations drop constraint if exists reservations_no_overlap;

alter table public.reservations
add constraint reservations_no_overlap
exclude using gist (
  common_area_id with =,
  tstzrange(start_at, end_at, '[)') with &&
)
where (status in ('pending', 'approved'));

-- RLS: residentes podem cancelar pending ou approved
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
)
with check (
  public.is_condo_staff(public.condominium_id_for_common_area(common_area_id))
  or (
    public.owns_unit(unit_id)
    and status in ('pending', 'cancelled')
    and public.is_condo_member(public.condominium_id_for_common_area(common_area_id))
  )
);
