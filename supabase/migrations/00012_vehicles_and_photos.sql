-- =============================================================================
-- Veículos (com TAG e foto) + foto em moradores + bucket de imagens
-- =============================================================================

alter table public.residents
add column if not exists photo_url text;

-- -----------------------------------------------------------------------------
-- vehicles
-- -----------------------------------------------------------------------------

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
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

create index vehicles_unit_id_idx on public.vehicles (unit_id);
create index vehicles_resident_id_idx on public.vehicles (resident_id)
where resident_id is not null;

create unique index vehicles_unique_plate_per_condo_idx
on public.vehicles (public.condominium_id_for_unit(unit_id), lower(trim(license_plate)));

create unique index vehicles_unique_tag_per_condo_idx
on public.vehicles (public.condominium_id_for_unit(unit_id), lower(trim(tag_number)))
where tag_number is not null and char_length(trim(tag_number)) > 0;

create trigger vehicles_set_updated_at
before update on public.vehicles
for each row execute function public.set_updated_at();

comment on column public.vehicles.tag_number is 'Número da TAG de acesso do veículo';
comment on column public.vehicles.photo_url is 'URL pública da foto do veículo';

-- -----------------------------------------------------------------------------
-- RLS — vehicles
-- -----------------------------------------------------------------------------

alter table public.vehicles enable row level security;

create policy "vehicles_select"
on public.vehicles
for select
to authenticated
using (
  public.is_condo_staff(public.condominium_id_for_unit(unit_id))
  or public.is_condo_doorman(public.condominium_id_for_unit(unit_id))
  or public.shares_unit_with_auth_user(unit_id)
);

create policy "vehicles_insert"
on public.vehicles
for insert
to authenticated
with check (public.is_condo_staff(public.condominium_id_for_unit(unit_id)));

create policy "vehicles_update"
on public.vehicles
for update
to authenticated
using (public.is_condo_staff(public.condominium_id_for_unit(unit_id)))
with check (public.is_condo_staff(public.condominium_id_for_unit(unit_id)));

create policy "vehicles_delete"
on public.vehicles
for delete
to authenticated
using (public.is_condo_staff(public.condominium_id_for_unit(unit_id)));

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

create policy "condo_uploads_public_read"
on storage.objects
for select
to public
using (bucket_id = 'condo-uploads');

create policy "condo_uploads_authenticated_insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'condo-uploads');

create policy "condo_uploads_authenticated_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'condo-uploads')
with check (bucket_id = 'condo-uploads');

create policy "condo_uploads_authenticated_delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'condo-uploads');
