-- =============================================================================
-- Cadastro: unidade selecionada + reservas visíveis só para a unidade do morador
-- =============================================================================

alter table public.registration_requests
  add column if not exists requested_unit_id uuid references public.units (id) on delete set null;

alter table public.registration_requests
  alter column unit_kind drop not null;

alter table public.registration_requests
  alter column unit_number drop not null;

create index if not exists registration_requests_requested_unit_id_idx
  on public.registration_requests (requested_unit_id);

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
