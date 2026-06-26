-- Moradores podem excluir veículos da própria unidade (qualquer status).

drop policy if exists "vehicles_delete" on public.vehicles;

create policy "vehicles_delete"
on public.vehicles
for delete
to authenticated
using (
  public.is_condo_staff(condominium_id)
  or public.shares_unit_with_auth_user(unit_id)
);
