-- =============================================================================
-- Aulas em espaços comuns da Granja: lista de presença (vagas compartilhadas)
-- e antecedência mínima em horas (12h).
-- =============================================================================

alter table public.common_areas
  add column if not exists booking_mode text not null default 'exclusive',
  add column if not exists class_sessions jsonb not null default '[]'::jsonb;

alter table public.common_areas
  drop constraint if exists common_areas_booking_mode_check;

alter table public.common_areas
  add constraint common_areas_booking_mode_check
  check (booking_mode in ('exclusive', 'class'));

comment on column public.common_areas.booking_mode is
  'exclusive = uma reserva ocupa o espaço; class = lista de presença até a capacidade';
comment on column public.common_areas.class_sessions is
  'Horários fixos de aula [{"day":"mon","start":"08:30","end":"09:30"}]';

alter table public.reservations
  add column if not exists allows_overlap boolean not null default false;

comment on column public.reservations.allows_overlap is
  'Cópia de booking_mode=class para a constraint de sobreposição';

create or replace function public.sync_reservation_allows_overlap()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  select (ca.booking_mode = 'class')
  into new.allows_overlap
  from public.common_areas ca
  where ca.id = new.common_area_id;

  if new.allows_overlap is null then
    new.allows_overlap := false;
  end if;

  return new;
end;
$$;

drop trigger if exists reservations_sync_allows_overlap on public.reservations;

create trigger reservations_sync_allows_overlap
before insert or update of common_area_id
on public.reservations
for each row
execute function public.sync_reservation_allows_overlap();

create or replace function public.enforce_class_reservation_capacity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_mode text;
  v_capacity integer;
  v_count integer;
begin
  if new.status not in ('pending', 'approved', 'awaiting_receipt') then
    return new;
  end if;

  select ca.booking_mode, ca.capacity
  into v_mode, v_capacity
  from public.common_areas ca
  where ca.id = new.common_area_id
  for update;

  if v_mode is distinct from 'class' then
    return new;
  end if;

  select count(*)
  into v_count
  from public.reservations r
  where r.common_area_id = new.common_area_id
    and r.status in ('pending', 'approved', 'awaiting_receipt')
    and r.id is distinct from new.id
    and r.start_at = new.start_at;

  if v_count >= v_capacity then
    raise exception 'Turma lotada (% vagas).', v_capacity
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists reservations_enforce_class_capacity on public.reservations;

create trigger reservations_enforce_class_capacity
before insert or update of common_area_id, start_at, end_at, status
on public.reservations
for each row
execute function public.enforce_class_reservation_capacity();

alter table public.reservations drop constraint if exists reservations_no_overlap;

alter table public.reservations
add constraint reservations_no_overlap
exclude using gist (
  common_area_id with =,
  tstzrange(start_at, end_at, '[)') with &&
)
where (status in ('pending', 'approved', 'awaiting_receipt') and allows_overlap = false);

create unique index if not exists reservations_unit_class_slot_key
  on public.reservations (common_area_id, unit_id, start_at)
  where (status in ('pending', 'approved', 'awaiting_receipt'));

-- Atividades da programação da Granja (no-op se o condomínio ainda não existir no seed)
insert into public.common_areas (
  id,
  condominium_id,
  name,
  capacity,
  description,
  is_active,
  requires_approval,
  requires_payment,
  booking_mode,
  class_sessions,
  max_duration_minutes,
  min_advance_minutes,
  min_advance_days,
  max_advance_days,
  max_reservations_per_unit,
  reservation_period_days,
  buffer_minutes,
  buffer_days,
  operating_hours,
  allowed_days,
  maintenance_blocks,
  rules
)
select
  payload.id,
  public.granja_condominium_id(),
  payload.name,
  13,
  payload.description,
  true,
  false,
  false,
  'class',
  payload.class_sessions,
  60,
  720,
  0,
  14,
  null,
  30,
  0,
  0,
  payload.operating_hours,
  payload.allowed_days,
  '[]'::jsonb,
  '{"slot_interval_minutes":60}'::jsonb
from (
  values
    (
      'a0000000-0000-4000-8000-000000000044'::uuid,
      'Mat Pilates',
      'Local: Academia Nova (antigo restaurante).' || chr(10) ||
      'Lista de presença com 13 vagas por aula.' || chr(10) ||
      'A participação deve ser confirmada por reserva com até 12 horas de antecedência do horário da aula.',
      '[{"day":"mon","start":"08:30","end":"09:30"},{"day":"wed","start":"09:30","end":"10:30"},{"day":"sat","start":"09:30","end":"10:30"}]'::jsonb,
      '{"start":"08:30","end":"10:30"}'::jsonb,
      '["mon","wed","sat"]'::jsonb
    ),
    (
      'a0000000-0000-4000-8000-000000000045'::uuid,
      'Yoga',
      'Local provisório: Academia Nova.' || chr(10) ||
      'Lista de presença com 13 vagas por aula.' || chr(10) ||
      'A participação deve ser confirmada por reserva com até 12 horas de antecedência do horário da aula.',
      '[{"day":"tue","start":"09:30","end":"10:30"},{"day":"thu","start":"09:30","end":"10:30"}]'::jsonb,
      '{"start":"09:30","end":"10:30"}'::jsonb,
      '["tue","thu"]'::jsonb
    ),
    (
      'a0000000-0000-4000-8000-000000000046'::uuid,
      'Zumba',
      'Local: Condomínio Pau Brasil.' || chr(10) ||
      'Lista de presença com 13 vagas por aula.' || chr(10) ||
      'A participação deve ser confirmada por reserva com até 12 horas de antecedência do horário da aula.',
      '[{"day":"mon","start":"17:00","end":"18:00"},{"day":"mon","start":"18:00","end":"19:00"},{"day":"thu","start":"17:00","end":"18:00"},{"day":"thu","start":"18:00","end":"19:00"}]'::jsonb,
      '{"start":"17:00","end":"19:00"}'::jsonb,
      '["mon","thu"]'::jsonb
    ),
    (
      'a0000000-0000-4000-8000-000000000047'::uuid,
      'Hidroginástica',
      'Lista de presença com 13 vagas por aula.' || chr(10) ||
      'A participação deve ser confirmada por reserva com até 12 horas de antecedência do horário da aula.',
      '[{"day":"tue","start":"08:00","end":"09:00"},{"day":"tue","start":"09:00","end":"10:00"},{"day":"wed","start":"08:00","end":"09:00"},{"day":"wed","start":"09:00","end":"10:00"},{"day":"thu","start":"08:00","end":"09:00"},{"day":"thu","start":"09:00","end":"10:00"},{"day":"fri","start":"08:00","end":"09:00"},{"day":"fri","start":"09:00","end":"10:00"}]'::jsonb,
      '{"start":"08:00","end":"10:00"}'::jsonb,
      '["tue","wed","thu","fri"]'::jsonb
    )
) as payload(id, name, description, class_sessions, operating_hours, allowed_days)
where public.granja_condominium_id() is not null
on conflict (condominium_id, name) do update
set
  capacity = excluded.capacity,
  description = excluded.description,
  is_active = excluded.is_active,
  requires_approval = excluded.requires_approval,
  booking_mode = excluded.booking_mode,
  class_sessions = excluded.class_sessions,
  max_duration_minutes = excluded.max_duration_minutes,
  min_advance_minutes = excluded.min_advance_minutes,
  min_advance_days = excluded.min_advance_days,
  max_advance_days = excluded.max_advance_days,
  max_reservations_per_unit = excluded.max_reservations_per_unit,
  buffer_minutes = excluded.buffer_minutes,
  buffer_days = excluded.buffer_days,
  operating_hours = excluded.operating_hours,
  allowed_days = excluded.allowed_days,
  rules = excluded.rules;
