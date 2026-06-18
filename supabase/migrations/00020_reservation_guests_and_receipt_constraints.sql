-- =============================================================================
-- Passo 2/2 — colunas e constraint de overlap (após 00019 commitado)
-- =============================================================================

alter table public.reservations
  add column if not exists guest_count integer,
  add column if not exists payment_receipt_url text,
  add column if not exists payment_receipt_submitted_at timestamptz;

alter table public.reservations
  drop constraint if exists reservations_guest_count_positive;

alter table public.reservations
  add constraint reservations_guest_count_positive
  check (guest_count is null or guest_count > 0);

comment on column public.reservations.guest_count is 'Número de convidados (festa, salão, churrasqueira)';
comment on column public.reservations.payment_receipt_url is 'URL do recibo enviado pelo morador (churrasqueiras Granja)';
comment on column public.reservations.payment_receipt_submitted_at is 'Data/hora do envio do recibo';

alter table public.reservations drop constraint if exists reservations_no_overlap;

alter table public.reservations
add constraint reservations_no_overlap
exclude using gist (
  common_area_id with =,
  tstzrange(start_at, end_at, '[)') with &&
)
where (status in ('pending', 'approved', 'awaiting_receipt'));
