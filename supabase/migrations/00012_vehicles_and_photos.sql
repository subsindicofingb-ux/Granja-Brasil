-- =============================================================================
-- Veículos (com TAG e foto) + foto em moradores + bucket de imagens
-- =============================================================================

alter table public.residents
add column if not exists photo_url text;

-- -----------------------------------------------------------------------------
-- vehicles
-- -----------------------------------------------------------------------------

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  resident_id uuid references public.residents (id) on delete set null,
  brand text not null,
  model text not null,
  color text,
  license_plate text not null,
  tag_number text,
  photo_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint vehicles_license_plate_not_empty check (char_length(trim(license_plate)) > 0)
);

alter table public.vehicles
add column if not exists condominium_id uuid references public.condominiums (id) on delete cascade;

update public.vehicles v
set condominium_id = t.condominium_id
from public.units u
join public.towers t on t.id = u.tower_id
where u.id = v.unit_id
  and v.condominium_id is null;

alter table public.vehicles
alter column condominium_id set not null;

create or replace function public.set_vehicle_condominium_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.condominium_id := public.condominium_id_for_unit(new.unit_id);
  return new;
end;
$$;

drop trigger if exists vehicles_set_condominium_id on public.vehicles;
create trigger vehicles_set_condominium_id
before insert or update of unit_id on public.vehicles
for each row execute function public.set_vehicle_condominium_id();

create index if not exists vehicles_condominium_id_idx on public.vehicles (condominium_id);
create index if not exists vehicles_unit_id_idx on public.vehicles (unit_id);
create index if not exists vehicles_resident_id_idx on public.vehicles (resident_id)
where resident_id is not null;

drop index if exists vehicles_unique_plate_per_condo_idx;
create unique index vehicles_unique_plate_per_condo_idx
on public.vehicles (condominium_id, lower(trim(license_plate)));

drop index if exists vehicles_unique_tag_per_condo_idx;
create unique index vehicles_unique_tag_per_condo_idx
on public.vehicles (condominium_id, lower(trim(tag_number)))
where tag_number is not null and char_length(trim(tag_number)) > 0;

drop trigger if exists vehicles_set_updated_at on public.vehicles;
create trigger vehicles_set_updated_at
before update on public.vehicles
for each row execute function public.set_updated_at();

comment on column public.vehicles.tag_number is 'Número da TAG de acesso do veículo';
comment on column public.vehicles.photo_url is 'URL pública da foto do veículo';

-- -----------------------------------------------------------------------------
-- RLS — vehicles
-- -----------------------------------------------------------------------------

alter table public.vehicles enable row level security;

drop policy if exists "vehicles_select" on public.vehicles;
create policy "vehicles_select"
on public.vehicles
for select
to authenticated
using (
  public.is_condo_staff(condominium_id)
  or public.is_condo_doorman(condominium_id)
  or public.shares_unit_with_auth_user(unit_id)
);

drop policy if exists "vehicles_insert" on public.vehicles;
create policy "vehicles_insert"
on public.vehicles
for insert
to authenticated
with check (public.is_condo_staff(condominium_id));

drop policy if exists "vehicles_update" on public.vehicles;
create policy "vehicles_update"
on public.vehicles
for update
to authenticated
using (public.is_condo_staff(condominium_id))
with check (public.is_condo_staff(condominium_id));

drop policy if exists "vehicles_delete" on public.vehicles;
create policy "vehicles_delete"
on public.vehicles
for delete
to authenticated
using (public.is_condo_staff(condominium_id));

-- -----------------------------------------------------------------------------
-- Storage — fotos de moradores e veículos
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'condo-uploads',
  'condo-uploads',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "condo_uploads_public_read" on storage.objects;
create policy "condo_uploads_public_read"
on storage.objects
for select
to public
using (bucket_id = 'condo-uploads');

drop policy if exists "condo_uploads_authenticated_insert" on storage.objects;
create policy "condo_uploads_authenticated_insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'condo-uploads');

drop policy if exists "condo_uploads_authenticated_update" on storage.objects;
create policy "condo_uploads_authenticated_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'condo-uploads')
with check (bucket_id = 'condo-uploads');

drop policy if exists "condo_uploads_authenticated_delete" on storage.objects;
create policy "condo_uploads_authenticated_delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'condo-uploads');
