-- Corrige policy de reservas: my_unit_ids() é set-returning e não pode ir em RLS.
-- Use owns_unit(unit_id), mesma função já usada nas outras policies de reserva.

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
);
