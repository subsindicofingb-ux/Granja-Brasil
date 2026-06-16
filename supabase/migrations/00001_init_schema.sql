-- =============================================================================
-- Condomínio SaaS — schema inicial (MVP)
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

create type public.membership_role as enum (
  'super_admin',
  'admin',
  'syndic',
  'resident',
  'doorman'
);

create type public.resident_type as enum (
  'owner',
  'tenant',
  'dependent'
);

create type public.reservation_status as enum (
  'pending',
  'confirmed',
  'cancelled'
);

create type public.announcement_priority as enum (
  'normal',
  'important',
  'urgent'
);

-- -----------------------------------------------------------------------------
-- Shared trigger: updated_at
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles (1:1 com auth.users — base para auth futura)
-- -----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- condominiums
-- -----------------------------------------------------------------------------

create table public.condominiums (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint condominiums_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create unique index condominiums_slug_key on public.condominiums (slug);

create trigger condominiums_set_updated_at
before update on public.condominiums
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- memberships (perfil ↔ condomínio + papel)
-- -----------------------------------------------------------------------------

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  role public.membership_role not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint memberships_unique_member unique (profile_id, condominium_id)
);

create index memberships_condominium_id_idx on public.memberships (condominium_id);
create index memberships_profile_id_idx on public.memberships (profile_id);

create trigger memberships_set_updated_at
before update on public.memberships
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- towers
-- -----------------------------------------------------------------------------

create table public.towers (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  name text not null,
  floors integer not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint towers_floors_positive check (floors > 0),
  constraint towers_unique_name_per_condo unique (condominium_id, name)
);

create index towers_condominium_id_idx on public.towers (condominium_id);

create trigger towers_set_updated_at
before update on public.towers
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- units
-- -----------------------------------------------------------------------------

create table public.units (
  id uuid primary key default gen_random_uuid(),
  tower_id uuid not null references public.towers (id) on delete cascade,
  number text not null,
  block text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint units_unique_number_per_tower unique (tower_id, number, block)
);

create index units_tower_id_idx on public.units (tower_id);

create trigger units_set_updated_at
before update on public.units
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- residents
-- -----------------------------------------------------------------------------

create table public.residents (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  type public.resident_type not null default 'owner',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index residents_unit_id_idx on public.residents (unit_id);
create index residents_profile_id_idx on public.residents (profile_id);

create trigger residents_set_updated_at
before update on public.residents
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- common_areas
-- -----------------------------------------------------------------------------

create table public.common_areas (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  name text not null,
  capacity integer not null default 1,
  description text,
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint common_areas_capacity_positive check (capacity > 0),
  constraint common_areas_unique_name_per_condo unique (condominium_id, name)
);

create index common_areas_condominium_id_idx on public.common_areas (condominium_id);

create trigger common_areas_set_updated_at
before update on public.common_areas
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- reservations
-- -----------------------------------------------------------------------------

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  common_area_id uuid not null references public.common_areas (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete restrict,
  requested_by uuid references public.profiles (id) on delete set null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status public.reservation_status not null default 'pending',
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint reservations_valid_period check (end_at > start_at)
);

create index reservations_common_area_id_idx on public.reservations (common_area_id);
create index reservations_unit_id_idx on public.reservations (unit_id);
create index reservations_start_at_idx on public.reservations (start_at);

-- Impede reservas sobrepostas no mesmo espaço (exceto canceladas)
alter table public.reservations
add constraint reservations_no_overlap
exclude using gist (
  common_area_id with =,
  tstzrange(start_at, end_at, '[)') with &&
)
where (status <> 'cancelled');

create trigger reservations_set_updated_at
before update on public.reservations
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- announcements (avisos)
-- -----------------------------------------------------------------------------

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  title text not null,
  body text not null,
  priority public.announcement_priority not null default 'normal',
  published_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint announcements_valid_expiry check (
    expires_at is null or expires_at > published_at
  )
);

create index announcements_condominium_id_idx on public.announcements (condominium_id);
create index announcements_published_at_idx on public.announcements (published_at desc);

create trigger announcements_set_updated_at
before update on public.announcements
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Grants (Supabase roles)
-- -----------------------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;

grant usage, select on all sequences in schema public to authenticated;
grant usage, select on all sequences in schema public to service_role;

alter default privileges in schema public
grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema public
grant usage, select on sequences to authenticated;
