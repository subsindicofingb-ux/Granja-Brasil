-- =============================================================================
-- Solicitações de cadastro (pré-qualificação no signup)
-- =============================================================================

create type public.registration_request_status as enum (
  'pending',
  'approved',
  'rejected'
);

create type public.registration_unit_kind as enum (
  'apartment',
  'house'
);

create table public.registration_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  resident_type public.resident_type not null default 'owner',
  unit_kind public.registration_unit_kind not null,
  unit_number text not null,
  full_name text not null,
  email text not null,
  status public.registration_request_status not null default 'pending',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  unit_id uuid references public.units (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint registration_requests_unit_number_not_empty check (char_length(trim(unit_number)) > 0),
  constraint registration_requests_email_not_empty check (char_length(trim(email)) > 0)
);

create index registration_requests_condominium_id_idx
  on public.registration_requests (condominium_id);

create index registration_requests_profile_id_idx
  on public.registration_requests (profile_id);

create index registration_requests_status_idx
  on public.registration_requests (condominium_id, status);

create unique index registration_requests_one_pending_per_profile_condo
  on public.registration_requests (profile_id, condominium_id)
  where (status = 'pending');

create trigger registration_requests_set_updated_at
before update on public.registration_requests
for each row execute function public.set_updated_at();

-- Torre virtual "Casa" para unidades residenciais tipo casa
insert into public.towers (condominium_id, name, floors)
select c.id, 'Casa', 1
from public.condominiums c
where not exists (
  select 1
  from public.towers t
  where t.condominium_id = c.id
    and lower(trim(t.name)) = 'casa'
);

-- Lista pública de condomínios para o formulário de cadastro
create policy "condominiums_select_signup"
on public.condominiums
for select
to anon, authenticated
using (true);

-- -----------------------------------------------------------------------------
-- RLS registration_requests
-- -----------------------------------------------------------------------------

alter table public.registration_requests enable row level security;

create policy "registration_requests_select"
on public.registration_requests
for select
to authenticated
using (
  profile_id = auth.uid()
  or public.is_condo_staff(condominium_id)
  or public.is_super_admin()
);

create policy "registration_requests_insert"
on public.registration_requests
for insert
to authenticated
with check (
  profile_id = auth.uid()
  and status = 'pending'
);

create policy "registration_requests_update_staff"
on public.registration_requests
for update
to authenticated
using (public.is_condo_staff(condominium_id) or public.is_super_admin())
with check (public.is_condo_staff(condominium_id) or public.is_super_admin());

create policy "registration_requests_update_own_pending"
on public.registration_requests
for update
to authenticated
using (profile_id = auth.uid() and status = 'pending')
with check (profile_id = auth.uid() and status = 'pending');
