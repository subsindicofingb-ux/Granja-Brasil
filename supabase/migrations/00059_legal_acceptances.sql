-- Registro de aceite dos termos de uso e política de privacidade
create type public.legal_document_type as enum (
  'terms_of_use',
  'privacy_policy'
);

create table public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  document_type public.legal_document_type not null,
  document_version text not null,
  accepted_at timestamptz not null default timezone('utc', now()),
  ip_address text,
  user_agent text,
  registration_request_id uuid references public.registration_requests (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint legal_acceptances_document_version_not_empty check (char_length(trim(document_version)) > 0)
);

create index legal_acceptances_profile_id_idx
  on public.legal_acceptances (profile_id);

create index legal_acceptances_registration_request_id_idx
  on public.legal_acceptances (registration_request_id);

create index legal_acceptances_document_idx
  on public.legal_acceptances (document_type, document_version, accepted_at desc);

alter table public.legal_acceptances enable row level security;

create policy "legal_acceptances_select_own"
on public.legal_acceptances
for select
to authenticated
using (profile_id = auth.uid() or public.is_super_admin());
