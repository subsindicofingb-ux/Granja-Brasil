-- =============================================================================
-- Recibo de reserva: RLS permite morador atualizar awaiting_receipt -> pending
-- e bucket aceita PDF nos comprovantes.
-- =============================================================================

drop policy if exists "reservations_update" on public.reservations;

create policy "reservations_update"
on public.reservations
for update
to authenticated
using (
  public.is_condo_staff(public.condominium_id_for_common_area(common_area_id))
  or (
    public.owns_unit(unit_id)
    and status in ('pending', 'approved', 'awaiting_receipt')
    and public.is_condo_member(public.condominium_id_for_common_area(common_area_id))
  )
  or (
    public.can_use_granja_shared_common_areas()
    and public.is_granja_common_area(common_area_id)
    and public.owns_unit(unit_id)
    and status in ('pending', 'approved', 'awaiting_receipt')
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

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf'
]
where id = 'condo-uploads';
