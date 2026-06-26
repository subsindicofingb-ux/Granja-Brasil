-- Portaria: correspondência, hidrômetros e permissões operacionais.

create table if not exists public.correspondence_notices (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  target_profile_id uuid not null references public.profiles (id) on delete cascade,
  description text not null,
  carrier text,
  notes text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  picked_up_at timestamptz,
  constraint correspondence_description_not_empty check (char_length(trim(description)) > 0)
);

create index if not exists correspondence_notices_condo_idx
  on public.correspondence_notices (condominium_id, created_at desc);

create table if not exists public.water_meter_readings (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  reading_date date not null,
  reading_value numeric(12, 3) not null check (reading_value >= 0),
  daily_consumption numeric(12, 3),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint water_meter_readings_unique_day unique (condominium_id, reading_date)
);

create index if not exists water_meter_readings_condo_date_idx
  on public.water_meter_readings (condominium_id, reading_date desc);

create table if not exists public.water_meter_alerts (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  reading_id uuid not null references public.water_meter_readings (id) on delete cascade,
  daily_consumption numeric(12, 3) not null,
  average_consumption numeric(12, 3) not null,
  excess_percent numeric(6, 2) not null,
  created_at timestamptz not null default now(),
  constraint water_meter_alerts_reading_unique unique (reading_id)
);

alter table public.correspondence_notices enable row level security;
alter table public.water_meter_readings enable row level security;
alter table public.water_meter_alerts enable row level security;

-- Correspondência
drop policy if exists "correspondence_notices_select" on public.correspondence_notices;
create policy "correspondence_notices_select"
on public.correspondence_notices
for select
to authenticated
using (
  target_profile_id = auth.uid()
  or public.is_condo_doorman(condominium_id)
  or public.is_condo_staff(condominium_id)
);

drop policy if exists "correspondence_notices_insert" on public.correspondence_notices;
create policy "correspondence_notices_insert"
on public.correspondence_notices
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_condo_doorman(condominium_id)
  and public.condominium_id_for_unit(unit_id) = condominium_id
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
)
with check (
  public.condominium_id_for_unit(unit_id) = condominium_id
);

-- Hidrômetros
drop policy if exists "water_meter_readings_select" on public.water_meter_readings;
create policy "water_meter_readings_select"
on public.water_meter_readings
for select
to authenticated
using (
  public.is_condo_doorman(condominium_id)
  or public.is_condo_staff(condominium_id)
);

drop policy if exists "water_meter_readings_insert" on public.water_meter_readings;
create policy "water_meter_readings_insert"
on public.water_meter_readings
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_condo_doorman(condominium_id)
);

drop policy if exists "water_meter_readings_update" on public.water_meter_readings;
create policy "water_meter_readings_update"
on public.water_meter_readings
for update
to authenticated
using (public.is_condo_doorman(condominium_id))
with check (public.is_condo_doorman(condominium_id));

drop policy if exists "water_meter_alerts_select" on public.water_meter_alerts;
create policy "water_meter_alerts_select"
on public.water_meter_alerts
for select
to authenticated
using (
  public.is_condo_doorman(condominium_id)
  or public.is_condo_staff(condominium_id)
);

drop policy if exists "water_meter_alerts_insert" on public.water_meter_alerts;
create policy "water_meter_alerts_insert"
on public.water_meter_alerts
for insert
to authenticated
with check (
  public.is_condo_doorman(condominium_id)
  or public.is_condo_staff(condominium_id)
);

-- Reservas: porteiro apenas em espaços do próprio condomínio (não Granja compartilhada).
drop policy if exists "reservations_insert" on public.reservations;

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
  or (
    public.can_use_granja_shared_common_areas()
    and public.is_granja_common_area(common_area_id)
    and public.owns_unit(unit_id)
    and public.condominium_id_for_unit(unit_id) <> public.granja_condominium_id()
  )
  or (
    public.can_use_granja_shared_common_areas()
    and public.is_granja_common_area(common_area_id)
    and public.is_condo_staff(public.condominium_id_for_unit(unit_id))
    and public.condominium_id_for_unit(unit_id) <> public.granja_condominium_id()
  )
  or (
    public.is_condo_doorman(public.condominium_id_for_common_area(common_area_id))
    and not public.is_granja_common_area(common_area_id)
  )
);

-- Avisos: porteiro publica avisos e envia mensagens.
drop policy if exists "announcements_insert_doorman" on public.announcements;
create policy "announcements_insert_doorman"
on public.announcements
for insert
to authenticated
with check (
  created_by = auth.uid()
  and parent_id is null
  and coalesce(staff_only, false) = false
  and public.is_condo_doorman(condominium_id)
);

drop policy if exists "announcements_insert_doorman_granja" on public.announcements;
create policy "announcements_insert_doorman_granja"
on public.announcements
for insert
to authenticated
with check (
  created_by = auth.uid()
  and parent_id is null
  and staff_only is true
  and public.granja_condominium_id() is not null
  and condominium_id = public.granja_condominium_id()
  and target_condominium_id is not null
  and public.is_condo_doorman(target_condominium_id)
);

drop policy if exists "announcements_insert_doorman_resident" on public.announcements;
create policy "announcements_insert_doorman_resident"
on public.announcements
for insert
to authenticated
with check (
  created_by = auth.uid()
  and parent_id is null
  and coalesce(staff_only, false) = false
  and target_profile_id is not null
  and public.is_condo_doorman(condominium_id)
);
