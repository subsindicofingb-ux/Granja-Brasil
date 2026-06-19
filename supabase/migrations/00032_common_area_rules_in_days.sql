-- Regras de reserva em dias (buffer e antecedência mínima).

alter table public.common_areas
  add column if not exists buffer_days integer not null default 0,
  add column if not exists min_advance_days integer not null default 0;

update public.common_areas
set
  buffer_days = case
    when coalesce(buffer_minutes, 0) >= 1440 then (buffer_minutes / 1440)::integer
    when coalesce(buffer_minutes, 0) > 0 then 1
    else 0
  end,
  min_advance_days = case
    when coalesce(min_advance_minutes, 0) >= 1440 then (min_advance_minutes / 1440)::integer
    when coalesce(min_advance_minutes, 0) > 0 then 1
    else 0
  end
where buffer_days = 0
  and min_advance_days = 0
  and (coalesce(buffer_minutes, 0) > 0 or coalesce(min_advance_minutes, 0) > 0);

alter table public.common_areas
  drop constraint if exists common_areas_buffer_days_check;

alter table public.common_areas
  add constraint common_areas_buffer_days_check check (buffer_days >= 0),
  add constraint common_areas_min_advance_days_check check (min_advance_days >= 0);

comment on column public.common_areas.buffer_days is 'Intervalo mínimo entre reservas, em dias de calendário';
comment on column public.common_areas.min_advance_days is 'Antecedência mínima para reservar, em dias';
