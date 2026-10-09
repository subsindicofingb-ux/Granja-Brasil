-- =============================================================================
-- Aulas: várias reservas por unidade, nome do participante e conferência de presença.
-- =============================================================================

alter table public.reservations
  drop constraint if exists reservations_unit_class_slot_key;

drop index if exists public.reservations_unit_class_slot_key;

alter table public.reservations
  add column if not exists attendee_name text,
  add column if not exists attended_at timestamptz,
  add column if not exists attended_by uuid references public.profiles (id) on delete set null;

alter table public.reservations
  drop constraint if exists reservations_attendee_name_length;

alter table public.reservations
  add constraint reservations_attendee_name_length
  check (attendee_name is null or char_length(trim(attendee_name)) between 2 and 120);

comment on column public.reservations.attendee_name is
  'Nome de quem vai à aula (uma reserva por pessoa; a mesma unidade pode ter várias)';
comment on column public.reservations.attended_at is
  'Horário em que a administração/funcionário conferiu a presença';
comment on column public.reservations.attended_by is
  'Quem marcou a presença na lista da aula';

update public.reservations r
set attendee_name = trim(p.full_name)
from public.profiles p
where r.requested_by = p.id
  and r.attendee_name is null
  and exists (
    select 1
    from public.common_areas ca
    where ca.id = r.common_area_id
      and ca.booking_mode = 'class'
  )
  and char_length(trim(p.full_name)) between 2 and 120;

create unique index if not exists reservations_class_attendee_slot_key
  on public.reservations (
    common_area_id,
    start_at,
    unit_id,
    (lower(trim(attendee_name)))
  )
  where (
    status in ('pending', 'approved', 'awaiting_receipt')
    and attendee_name is not null
  );
