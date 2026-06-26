-- Correspondência: registrar nome de quem retirou.

alter table public.correspondence_notices
  add column if not exists picked_up_by_name text;
