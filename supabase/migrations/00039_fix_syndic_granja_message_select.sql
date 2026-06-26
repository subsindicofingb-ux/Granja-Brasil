-- Permite síndicos lerem mensagens staff_only enviadas à Granja Brasil
-- (condominium_id = granja, target_condominium_id = condomínio de origem).

drop policy if exists "announcements_select_staff" on public.announcements;

create policy "announcements_select_staff"
on public.announcements
for select
to authenticated
using (
  (staff_only = true and created_by = auth.uid())
  or public.is_condo_staff(condominium_id)
  or (
    public.granja_condominium_id() is not null
    and condominium_id = public.granja_condominium_id()
    and target_profile_id is null
    and exists (
      select 1
      from public.memberships m
      where m.profile_id = auth.uid()
        and public.is_condo_staff(m.condominium_id)
        and m.condominium_id <> public.granja_condominium_id()
        and (
          (target_condominium_id is not null and target_condominium_id = m.condominium_id)
          or target_condominium_id is null
        )
    )
  )
);
