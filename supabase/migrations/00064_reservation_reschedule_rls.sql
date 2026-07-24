-- =============================================================================
-- Reagendamento: morador pode atualizar data mantendo status approved/awaiting_receipt.
-- WITH CHECK anterior só permitia pending/cancelled, o que bloqueava reagendar autorizadas.
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
    and status in ('pending', 'cancelled', 'approved', 'awaiting_receipt')
    and public.is_condo_member(public.condominium_id_for_common_area(common_area_id))
  )
  or (
    public.can_use_granja_shared_common_areas()
    and public.is_granja_common_area(common_area_id)
    and public.owns_unit(unit_id)
    and status in ('pending', 'cancelled', 'approved', 'awaiting_receipt')
  )
);

-- Impede que morador autorize/rejeite a si mesmo via UPDATE direto.
create or replace function public.enforce_reservation_status_change_by_staff()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    if new.status = 'approved' and old.status is distinct from 'approved' then
      if not public.is_condo_staff(public.condominium_id_for_common_area(new.common_area_id)) then
        raise exception 'Somente a administração pode autorizar reservas.';
      end if;
    end if;

    if new.status = 'rejected' and old.status is distinct from 'rejected' then
      if not public.is_condo_staff(public.condominium_id_for_common_area(new.common_area_id)) then
        raise exception 'Somente a administração pode rejeitar reservas.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists reservations_enforce_status_change on public.reservations;

create trigger reservations_enforce_status_change
before update on public.reservations
for each row
execute function public.enforce_reservation_status_change_by_staff();
