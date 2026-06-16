-- =============================================================================
-- Espaços comuns — regras estruturadas para reservas (cadastro; booking depois)
-- =============================================================================

alter table public.common_areas
  add column if not exists is_active boolean not null default true,
  add column if not exists requires_approval boolean not null default false,
  add column if not exists max_duration_minutes integer,
  add column if not exists min_advance_minutes integer not null default 0,
  add column if not exists max_advance_days integer,
  add column if not exists max_reservations_per_unit integer,
  add column if not exists reservation_period_days integer not null default 30,
  add column if not exists buffer_minutes integer not null default 0,
  add column if not exists operating_hours jsonb not null default '{"start":"08:00","end":"22:00"}'::jsonb,
  add column if not exists allowed_days jsonb not null default '["mon","tue","wed","thu","fri","sat","sun"]'::jsonb,
  add column if not exists maintenance_blocks jsonb not null default '[]'::jsonb;

alter table public.common_areas
  add constraint common_areas_min_advance_non_negative
    check (min_advance_minutes >= 0),
  add constraint common_areas_buffer_non_negative
    check (buffer_minutes >= 0),
  add constraint common_areas_reservation_period_positive
    check (reservation_period_days > 0),
  add constraint common_areas_max_duration_positive
    check (max_duration_minutes is null or max_duration_minutes > 0),
  add constraint common_areas_max_advance_positive
    check (max_advance_days is null or max_advance_days > 0),
  add constraint common_areas_max_reservations_positive
    check (max_reservations_per_unit is null or max_reservations_per_unit > 0);

comment on column public.common_areas.max_duration_minutes is 'Duração máxima de uma reserva em minutos (null = sem limite)';
comment on column public.common_areas.min_advance_minutes is 'Antecedência mínima para reservar, em minutos';
comment on column public.common_areas.max_advance_days is 'Antecedência máxima para reservar, em dias (null = sem limite)';
comment on column public.common_areas.max_reservations_per_unit is 'Limite de reservas por unidade no período';
comment on column public.common_areas.reservation_period_days is 'Janela em dias para contagem do limite por unidade';
comment on column public.common_areas.buffer_minutes is 'Intervalo obrigatório entre reservas consecutivas';
comment on column public.common_areas.operating_hours is 'Horário de funcionamento {"start":"HH:mm","end":"HH:mm"}';
comment on column public.common_areas.allowed_days is 'Dias permitidos ["mon",...,"sun"]';
comment on column public.common_areas.maintenance_blocks is 'Bloqueios [{"title","start_at","end_at","reason?"}]';

-- Migra dados legados do campo rules (seed antigo) quando existirem
update public.common_areas
set
  max_duration_minutes = coalesce(
    max_duration_minutes,
    (rules ->> 'max_hours')::integer * 60
  ),
  rules = '{}'::jsonb
where rules is not null
  and rules <> '{}'::jsonb
  and rules ? 'max_hours';
