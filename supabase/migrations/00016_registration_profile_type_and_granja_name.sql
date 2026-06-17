-- Perfil informado no signup (pré-cadastro) e nome do condomínio geral
create type public.registration_profile_type as enum (
  'resident',
  'syndic',
  'staff',
  'visitor',
  'service_provider'
);

alter table public.registration_requests
  add column if not exists profile_type public.registration_profile_type not null default 'resident';

update public.condominiums
set name = 'Granja Brasil'
where slug = 'residencial-exemplo';
