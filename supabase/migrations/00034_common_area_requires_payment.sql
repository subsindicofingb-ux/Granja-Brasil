-- Cobrança/recibo obrigatório configurável por espaço comum.

alter table public.common_areas
  add column if not exists requires_payment boolean not null default false;

comment on column public.common_areas.requires_payment is 'Exige envio de recibo antes da aprovação (ex.: churrasqueiras da Granja)';

-- Espaços de churrasqueira existentes seguem o padrão BR 01.
update public.common_areas
set requires_payment = true
where requires_payment = false
  and lower(name) like '%churrasqueira%';
