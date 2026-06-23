-- Aceite do morador na entrega do espaço (assinatura coletada pelo funcionário).

alter table public.reservations
  add column if not exists handover_signature_data text,
  add column if not exists handover_signed_at timestamptz,
  add column if not exists handover_signed_by uuid references public.profiles (id) on delete set null,
  add column if not exists handover_collected_by uuid references public.profiles (id) on delete set null;

comment on column public.reservations.handover_signature_data is 'Assinatura do morador (data URL PNG)';
comment on column public.reservations.handover_signed_at is 'Data/hora do aceite na entrega do espaço';
comment on column public.reservations.handover_signed_by is 'Morador que assinou o aceite';
comment on column public.reservations.handover_collected_by is 'Funcionário que coletou a assinatura';
