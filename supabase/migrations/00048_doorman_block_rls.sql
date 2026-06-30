-- Portaria compartilhada: blocos de condomínios com um único porteiro.

create or replace function public.condominium_doorman_block_id(p_condominium_id uuid)
returns text
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select case
    when c.slug ilike '%jacaranda%' or c.slug ilike '%jequitiba%'
      or c.name ilike '%jacarand%' or c.name ilike '%jequitib%'
      then 'jacarandas-jequitibas'
    when c.slug ilike '%manaca%' or c.slug ilike '%mangabeira%'
      or c.name ilike '%manac%' or c.name ilike '%mangabeir%'
      then 'manacas-mangabeiras'
    when c.slug ilike '%cambuca%' or c.slug ilike '%jabuticabeira%'
      or c.name ilike '%cambuc%' or c.name ilike '%jabuticabeir%'
      then 'cambucas-jabuticabeiras'
    when c.slug ilike '%bouganvil%' or c.slug ilike '%acacia%' or c.slug ilike '%cerejeira%'
      or c.name ilike '%bouganvil%' or c.name ilike '%acácia%' or c.name ilike '%acacia%'
      or c.name ilike '%cerejeir%'
      then 'bouganville-acacias-cerejeiras'
    else null
  end
  from public.condominiums c
  where c.id = p_condominium_id;
$$;

create or replace function public.is_block_doorman(p_condominium_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.memberships m
    where m.profile_id = auth.uid()
      and m.role = 'doorman'
      and public.condominium_doorman_block_id(m.condominium_id) is not null
      and public.condominium_doorman_block_id(m.condominium_id)
        = public.condominium_doorman_block_id(p_condominium_id)
  );
$$;

grant execute on function public.condominium_doorman_block_id(uuid) to authenticated;
grant execute on function public.is_block_doorman(uuid) to authenticated;

drop policy if exists "correspondence_notices_select" on public.correspondence_notices;
create policy "correspondence_notices_select"
on public.correspondence_notices
for select
to authenticated
using (
  target_profile_id = auth.uid()
  or public.is_condo_doorman(condominium_id)
  or public.is_condo_staff(condominium_id)
  or public.is_block_doorman(condominium_id)
  or (
    public.granja_condominium_id() is not null
    and public.is_condo_doorman(public.granja_condominium_id())
    and condominium_id <> public.granja_condominium_id()
  )
);

drop policy if exists "correspondence_notices_insert" on public.correspondence_notices;
create policy "correspondence_notices_insert"
on public.correspondence_notices
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.condominium_id_for_unit(unit_id) = condominium_id
  and (
    public.is_condo_doorman(condominium_id)
    or public.is_block_doorman(condominium_id)
    or (
      public.granja_condominium_id() is not null
      and public.is_condo_doorman(public.granja_condominium_id())
      and condominium_id <> public.granja_condominium_id()
    )
  )
);

drop policy if exists "correspondence_notices_update" on public.correspondence_notices;
create policy "correspondence_notices_update"
on public.correspondence_notices
for update
to authenticated
using (
  public.is_condo_doorman(condominium_id)
  or public.is_condo_staff(condominium_id)
  or target_profile_id = auth.uid()
  or public.is_block_doorman(condominium_id)
  or (
    public.granja_condominium_id() is not null
    and public.is_condo_doorman(public.granja_condominium_id())
    and condominium_id <> public.granja_condominium_id()
  )
)
with check (
  public.condominium_id_for_unit(unit_id) = condominium_id
);

drop policy if exists "water_meter_readings_select" on public.water_meter_readings;
create policy "water_meter_readings_select"
on public.water_meter_readings
for select
to authenticated
using (
  public.is_condo_doorman(condominium_id)
  or public.is_condo_staff(condominium_id)
  or public.is_block_doorman(condominium_id)
);

drop policy if exists "water_meter_readings_insert" on public.water_meter_readings;
create policy "water_meter_readings_insert"
on public.water_meter_readings
for insert
to authenticated
with check (
  created_by = auth.uid()
  and (
    public.is_condo_doorman(condominium_id)
    or public.is_block_doorman(condominium_id)
  )
);

drop policy if exists "water_meter_readings_update" on public.water_meter_readings;
create policy "water_meter_readings_update"
on public.water_meter_readings
for update
to authenticated
using (
  public.is_condo_doorman(condominium_id)
  or public.is_block_doorman(condominium_id)
)
with check (
  public.is_condo_doorman(condominium_id)
  or public.is_block_doorman(condominium_id)
);

drop policy if exists "water_meter_alerts_select" on public.water_meter_alerts;
create policy "water_meter_alerts_select"
on public.water_meter_alerts
for select
to authenticated
using (
  public.is_condo_doorman(condominium_id)
  or public.is_condo_staff(condominium_id)
  or public.is_block_doorman(condominium_id)
);

drop policy if exists "water_meter_alerts_insert" on public.water_meter_alerts;
create policy "water_meter_alerts_insert"
on public.water_meter_alerts
for insert
to authenticated
with check (
  public.is_condo_doorman(condominium_id)
  or public.is_condo_staff(condominium_id)
  or public.is_block_doorman(condominium_id)
);

drop policy if exists "water_meter_alerts_update" on public.water_meter_alerts;
create policy "water_meter_alerts_update"
on public.water_meter_alerts
for update
to authenticated
using (
  public.is_condo_doorman(condominium_id)
  or public.is_condo_staff(condominium_id)
  or public.is_block_doorman(condominium_id)
)
with check (
  public.is_condo_doorman(condominium_id)
  or public.is_condo_staff(condominium_id)
  or public.is_block_doorman(condominium_id)
);

drop policy if exists "water_meter_alerts_delete" on public.water_meter_alerts;
create policy "water_meter_alerts_delete"
on public.water_meter_alerts
for delete
to authenticated
using (
  public.is_condo_doorman(condominium_id)
  or public.is_condo_staff(condominium_id)
  or public.is_block_doorman(condominium_id)
);
