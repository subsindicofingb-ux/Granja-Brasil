-- Hidrômetros: permitir atualizar/remover alertas ao corrigir leituras.

drop policy if exists "water_meter_alerts_update" on public.water_meter_alerts;
create policy "water_meter_alerts_update"
on public.water_meter_alerts
for update
to authenticated
using (
  public.is_condo_doorman(condominium_id)
  or public.is_condo_staff(condominium_id)
)
with check (
  public.is_condo_doorman(condominium_id)
  or public.is_condo_staff(condominium_id)
);

drop policy if exists "water_meter_alerts_delete" on public.water_meter_alerts;
create policy "water_meter_alerts_delete"
on public.water_meter_alerts
for delete
to authenticated
using (
  public.is_condo_doorman(condominium_id)
  or public.is_condo_staff(condominium_id)
);
