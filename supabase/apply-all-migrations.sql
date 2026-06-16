-- Cole TODO este arquivo no Supabase SQL Editor e clique Run
-- (nao cole o nome do arquivo, cole o CONTEUDO)


-- ===== 00001_init_schema.sql =====

-- =============================================================================
-- CondomÃ­nio SaaS â€” schema inicial (MVP)
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
-- profiles (1:1 com auth.users â€” base para auth futura)
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
-- memberships (perfil â†” condomÃ­nio + papel)
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

-- Impede reservas sobrepostas no mesmo espaÃ§o (exceto canceladas)
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


-- ===== 00002_auth_profile_trigger.sql =====

-- =============================================================================
-- Auth prep â€” profile automÃ¡tico ao criar usuÃ¡rio no Supabase Auth
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1), 'UsuÃ¡rio'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();


-- ===== 00003_rls_helpers.sql =====

-- =============================================================================
-- RLS helpers â€” funÃ§Ãµes security definer para policies
-- =============================================================================

-- Super admin: membership com role super_admin em qualquer condomÃ­nio
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.profile_id = auth.uid()
      and m.role = 'super_admin'
  );
$$;

-- Membro do condomÃ­nio (qualquer papel)
create or replace function public.is_condo_member(p_condominium_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.memberships m
      where m.profile_id = auth.uid()
        and m.condominium_id = p_condominium_id
    );
$$;

-- PapÃ©is de gestÃ£o (CRUD operacional)
create or replace function public.is_condo_staff(p_condominium_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.memberships m
      where m.profile_id = auth.uid()
        and m.condominium_id = p_condominium_id
        and m.role in ('admin', 'syndic')
    );
$$;

-- Portaria: leitura operacional
create or replace function public.is_condo_doorman(p_condominium_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.profile_id = auth.uid()
      and m.condominium_id = p_condominium_id
      and m.role = 'doorman'
  );
$$;

-- Verifica papel especÃ­fico no condomÃ­nio
create or replace function public.has_condo_role(
  p_condominium_id uuid,
  p_roles public.membership_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.memberships m
      where m.profile_id = auth.uid()
        and m.condominium_id = p_condominium_id
        and m.role = any (p_roles)
    );
$$;

-- Ownership: usuÃ¡rio autenticado vinculado Ã  unidade via residents.profile_id
create or replace function public.owns_unit(p_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.residents r
    where r.unit_id = p_unit_id
      and r.profile_id = auth.uid()
  );
$$;

-- Ownership: registro de morador do prÃ³prio usuÃ¡rio
create or replace function public.is_own_resident(p_resident_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.residents r
    where r.id = p_resident_id
      and r.profile_id = auth.uid()
  );
$$;

-- Moradores da mesma unidade (visibilidade entre co-moradores)
create or replace function public.shares_unit_with_auth_user(p_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.residents r
    where r.unit_id = p_unit_id
      and r.profile_id = auth.uid()
  );
$$;

-- Resolvers de condominium_id para tabelas aninhadas
create or replace function public.condominium_id_for_tower(p_tower_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.condominium_id
  from public.towers t
  where t.id = p_tower_id;
$$;

create or replace function public.condominium_id_for_unit(p_unit_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.condominium_id
  from public.units u
  join public.towers t on t.id = u.tower_id
  where u.id = p_unit_id;
$$;

create or replace function public.condominium_id_for_common_area(p_common_area_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select ca.condominium_id
  from public.common_areas ca
  where ca.id = p_common_area_id;
$$;

create or replace function public.condominium_id_for_reservation(p_reservation_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select ca.condominium_id
  from public.reservations r
  join public.common_areas ca on ca.id = r.common_area_id
  where r.id = p_reservation_id;
$$;

-- IDs dos condomÃ­nios do usuÃ¡rio autenticado
create or replace function public.my_condominium_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.condominium_id
  from public.memberships m
  where m.profile_id = auth.uid();
$$;

-- Unidades vinculadas ao usuÃ¡rio autenticado
create or replace function public.my_unit_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select r.unit_id
  from public.residents r
  where r.profile_id = auth.uid();
$$;

grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_condo_member(uuid) to authenticated;
grant execute on function public.is_condo_staff(uuid) to authenticated;
grant execute on function public.is_condo_doorman(uuid) to authenticated;
grant execute on function public.has_condo_role(uuid, public.membership_role[]) to authenticated;
grant execute on function public.owns_unit(uuid) to authenticated;
grant execute on function public.is_own_resident(uuid) to authenticated;
grant execute on function public.shares_unit_with_auth_user(uuid) to authenticated;
grant execute on function public.condominium_id_for_tower(uuid) to authenticated;
grant execute on function public.condominium_id_for_unit(uuid) to authenticated;
grant execute on function public.condominium_id_for_common_area(uuid) to authenticated;
grant execute on function public.condominium_id_for_reservation(uuid) to authenticated;
grant execute on function public.my_condominium_ids() to authenticated;
grant execute on function public.my_unit_ids() to authenticated;


-- ===== 00004_rls_policies.sql =====

-- =============================================================================
-- Row Level Security â€” polÃ­ticas por perfil e ownership
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;

create policy "profiles_select"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.is_super_admin()
  or exists (
    select 1
    from public.memberships mine
    join public.memberships other on other.condominium_id = mine.condominium_id
    where mine.profile_id = auth.uid()
      and other.profile_id = profiles.id
      and mine.role in ('admin', 'syndic', 'doorman')
  )
);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid() or public.is_super_admin())
with check (id = auth.uid() or public.is_super_admin());

-- -----------------------------------------------------------------------------
-- condominiums
-- -----------------------------------------------------------------------------

alter table public.condominiums enable row level security;

create policy "condominiums_select"
on public.condominiums
for select
to authenticated
using (public.is_condo_member(id));

create policy "condominiums_insert"
on public.condominiums
for insert
to authenticated
with check (public.is_super_admin());

create policy "condominiums_update"
on public.condominiums
for update
to authenticated
using (public.is_condo_staff(id))
with check (public.is_condo_staff(id));

create policy "condominiums_delete"
on public.condominiums
for delete
to authenticated
using (public.is_super_admin());

-- -----------------------------------------------------------------------------
-- memberships
-- -----------------------------------------------------------------------------

alter table public.memberships enable row level security;

create policy "memberships_select"
on public.memberships
for select
to authenticated
using (
  profile_id = auth.uid()
  or public.is_condo_staff(condominium_id)
  or public.is_super_admin()
);

create policy "memberships_insert"
on public.memberships
for insert
to authenticated
with check (
  public.is_condo_staff(condominium_id)
  or public.is_super_admin()
);

create policy "memberships_update"
on public.memberships
for update
to authenticated
using (
  public.is_condo_staff(condominium_id)
  or public.is_super_admin()
)
with check (
  public.is_condo_staff(condominium_id)
  or public.is_super_admin()
);

create policy "memberships_delete"
on public.memberships
for delete
to authenticated
using (
  public.is_condo_staff(condominium_id)
  or public.is_super_admin()
);

-- -----------------------------------------------------------------------------
-- towers
-- -----------------------------------------------------------------------------

alter table public.towers enable row level security;

create policy "towers_select"
on public.towers
for select
to authenticated
using (public.is_condo_member(condominium_id));

create policy "towers_insert"
on public.towers
for insert
to authenticated
with check (public.is_condo_staff(condominium_id));

create policy "towers_update"
on public.towers
for update
to authenticated
using (public.is_condo_staff(condominium_id))
with check (public.is_condo_staff(condominium_id));

create policy "towers_delete"
on public.towers
for delete
to authenticated
using (public.is_condo_staff(condominium_id));

-- -----------------------------------------------------------------------------
-- units
-- -----------------------------------------------------------------------------

alter table public.units enable row level security;

create policy "units_select"
on public.units
for select
to authenticated
using (
  public.is_condo_member(public.condominium_id_for_unit(id))
  or public.is_condo_doorman(public.condominium_id_for_unit(id))
);

create policy "units_insert"
on public.units
for insert
to authenticated
with check (public.is_condo_staff(public.condominium_id_for_tower(tower_id)));

create policy "units_update"
on public.units
for update
to authenticated
using (public.is_condo_staff(public.condominium_id_for_unit(id)))
with check (public.is_condo_staff(public.condominium_id_for_tower(tower_id)));

create policy "units_delete"
on public.units
for delete
to authenticated
using (public.is_condo_staff(public.condominium_id_for_unit(id)));

-- -----------------------------------------------------------------------------
-- residents
-- -----------------------------------------------------------------------------

alter table public.residents enable row level security;

create policy "residents_select"
on public.residents
for select
to authenticated
using (
  public.is_condo_staff(public.condominium_id_for_unit(unit_id))
  or public.is_condo_doorman(public.condominium_id_for_unit(unit_id))
  or public.shares_unit_with_auth_user(unit_id)
  or profile_id = auth.uid()
);

create policy "residents_insert"
on public.residents
for insert
to authenticated
with check (
  public.is_condo_staff(public.condominium_id_for_unit(unit_id))
);

create policy "residents_update"
on public.residents
for update
to authenticated
using (
  public.is_condo_staff(public.condominium_id_for_unit(unit_id))
  or (profile_id = auth.uid() and public.is_condo_member(public.condominium_id_for_unit(unit_id)))
)
with check (
  public.is_condo_staff(public.condominium_id_for_unit(unit_id))
  or (profile_id = auth.uid() and public.is_condo_member(public.condominium_id_for_unit(unit_id)))
);

create policy "residents_delete"
on public.residents
for delete
to authenticated
using (public.is_condo_staff(public.condominium_id_for_unit(unit_id)));

-- -----------------------------------------------------------------------------
-- common_areas
-- -----------------------------------------------------------------------------

alter table public.common_areas enable row level security;

create policy "common_areas_select"
on public.common_areas
for select
to authenticated
using (
  public.is_condo_member(condominium_id)
  or public.is_condo_doorman(condominium_id)
);

create policy "common_areas_insert"
on public.common_areas
for insert
to authenticated
with check (public.is_condo_staff(condominium_id));

create policy "common_areas_update"
on public.common_areas
for update
to authenticated
using (public.is_condo_staff(condominium_id))
with check (public.is_condo_staff(condominium_id));

create policy "common_areas_delete"
on public.common_areas
for delete
to authenticated
using (public.is_condo_staff(condominium_id));

-- -----------------------------------------------------------------------------
-- reservations
-- -----------------------------------------------------------------------------

alter table public.reservations enable row level security;

create policy "reservations_select"
on public.reservations
for select
to authenticated
using (
  public.is_condo_member(public.condominium_id_for_common_area(common_area_id))
  or public.is_condo_doorman(public.condominium_id_for_common_area(common_area_id))
);

create policy "reservations_insert"
on public.reservations
for insert
to authenticated
with check (
  public.is_condo_staff(public.condominium_id_for_common_area(common_area_id))
  or (
    public.owns_unit(unit_id)
    and public.is_condo_member(public.condominium_id_for_common_area(common_area_id))
    and public.condominium_id_for_unit(unit_id) = public.condominium_id_for_common_area(common_area_id)
  )
);

create policy "reservations_update"
on public.reservations
for update
to authenticated
using (
  public.is_condo_staff(public.condominium_id_for_common_area(common_area_id))
  or (
    public.owns_unit(unit_id)
    and status in ('pending', 'confirmed')
    and public.is_condo_member(public.condominium_id_for_common_area(common_area_id))
  )
)
with check (
  public.is_condo_staff(public.condominium_id_for_common_area(common_area_id))
  or (
    public.owns_unit(unit_id)
    and status in ('pending', 'cancelled')
    and public.is_condo_member(public.condominium_id_for_common_area(common_area_id))
  )
);

create policy "reservations_delete"
on public.reservations
for delete
to authenticated
using (public.is_condo_staff(public.condominium_id_for_common_area(common_area_id)));

-- -----------------------------------------------------------------------------
-- announcements
-- -----------------------------------------------------------------------------

alter table public.announcements enable row level security;

create policy "announcements_select"
on public.announcements
for select
to authenticated
using (
  (
    public.is_condo_member(condominium_id)
    or public.is_condo_doorman(condominium_id)
  )
  and (expires_at is null or expires_at > timezone('utc', now()))
);

create policy "announcements_insert"
on public.announcements
for insert
to authenticated
with check (public.is_condo_staff(condominium_id));

create policy "announcements_update"
on public.announcements
for update
to authenticated
using (public.is_condo_staff(condominium_id))
with check (public.is_condo_staff(condominium_id));

create policy "announcements_delete"
on public.announcements
for delete
to authenticated
using (public.is_condo_staff(condominium_id));


-- ===== 00005_profiles_insert_policy.sql =====

-- Permite que usuÃ¡rios autenticados garantam o prÃ³prio profile (fallback do trigger)
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());


-- ===== 00006_resident_type_responsible.sql =====

-- Tipo adicional: responsÃ¡vel (ex.: responsÃ¡vel legal / titular da unidade)
alter type public.resident_type add value if not exists 'responsible';


-- ===== 00007_common_areas_rules.sql =====

-- =============================================================================
-- EspaÃ§os comuns â€” regras estruturadas para reservas (cadastro; booking depois)
-- =============================================================================

alter table public.common_areas
  add column if not exists is_active boolean not null default true,
  add column if not exists requires_approval boolean not null default false,
  add column if not exists max_duration_minutes integer,
  add column if not exists min_advance_minutes integer not null default 0,
  add column if not exists max_advance_days integer,
  add column if not exists max_reservations_per_unit integer,
  add column if not exists reservation_period_days integer not null default 30,
  add column if not exists buffer_minutes integer not null default 0,
  add column if not exists operating_hours jsonb not null default '{"start":"08:00","end":"22:00"}'::jsonb,
  add column if not exists allowed_days jsonb not null default '["mon","tue","wed","thu","fri","sat","sun"]'::jsonb,
  add column if not exists maintenance_blocks jsonb not null default '[]'::jsonb;

alter table public.common_areas
  add constraint common_areas_min_advance_non_negative
    check (min_advance_minutes >= 0),
  add constraint common_areas_buffer_non_negative
    check (buffer_minutes >= 0),
  add constraint common_areas_reservation_period_positive
    check (reservation_period_days > 0),
  add constraint common_areas_max_duration_positive
    check (max_duration_minutes is null or max_duration_minutes > 0),
  add constraint common_areas_max_advance_positive
    check (max_advance_days is null or max_advance_days > 0),
  add constraint common_areas_max_reservations_positive
    check (max_reservations_per_unit is null or max_reservations_per_unit > 0);

comment on column public.common_areas.max_duration_minutes is 'DuraÃ§Ã£o mÃ¡xima de uma reserva em minutos (null = sem limite)';
comment on column public.common_areas.min_advance_minutes is 'AntecedÃªncia mÃ­nima para reservar, em minutos';
comment on column public.common_areas.max_advance_days is 'AntecedÃªncia mÃ¡xima para reservar, em dias (null = sem limite)';
comment on column public.common_areas.max_reservations_per_unit is 'Limite de reservas por unidade no perÃ­odo';
comment on column public.common_areas.reservation_period_days is 'Janela em dias para contagem do limite por unidade';
comment on column public.common_areas.buffer_minutes is 'Intervalo obrigatÃ³rio entre reservas consecutivas';
comment on column public.common_areas.operating_hours is 'HorÃ¡rio de funcionamento {"start":"HH:mm","end":"HH:mm"}';
comment on column public.common_areas.allowed_days is 'Dias permitidos ["mon",...,"sun"]';
comment on column public.common_areas.maintenance_blocks is 'Bloqueios [{"title","start_at","end_at","reason?"}]';

-- Migra dados legados do campo rules (seed antigo) quando existirem
update public.common_areas
set
  max_duration_minutes = coalesce(
    max_duration_minutes,
    (rules ->> 'max_hours')::integer * 60
  ),
  rules = '{}'::jsonb
where rules is not null
  and rules <> '{}'::jsonb
  and rules ? 'max_hours';


-- ===== 00008_reservation_status_approval.sql =====

-- =============================================================================
-- Reservas â€” status de aprovaÃ§Ã£o (approved/rejected) e overlap atualizado
-- =============================================================================

alter type public.reservation_status rename value 'confirmed' to 'approved';

alter type public.reservation_status add value 'rejected';

-- Overlap: apenas pending e approved bloqueiam o horÃ¡rio
alter table public.reservations drop constraint if exists reservations_no_overlap;

alter table public.reservations
add constraint reservations_no_overlap
exclude using gist (
  common_area_id with =,
  tstzrange(start_at, end_at, '[)') with &&
)
where (status in ('pending', 'approved'));

-- RLS: residentes podem cancelar pending ou approved
drop policy if exists "reservations_update" on public.reservations;

create policy "reservations_update"
on public.reservations
for update
to authenticated
using (
  public.is_condo_staff(public.condominium_id_for_common_area(common_area_id))
  or (
    public.owns_unit(unit_id)
    and status in ('pending', 'approved')
    and public.is_condo_member(public.condominium_id_for_common_area(common_area_id))
  )
)
with check (
  public.is_condo_staff(public.condominium_id_for_common_area(common_area_id))
  or (
    public.owns_unit(unit_id)
    and status in ('pending', 'cancelled')
    and public.is_condo_member(public.condominium_id_for_common_area(common_area_id))
  )
);


-- ===== 00009_announcements_tower_status.sql =====

-- =============================================================================
-- Avisos â€” torre opcional, status de publicaÃ§Ã£o, Ã­ndices, RLS e integridade
-- =============================================================================

create type public.announcement_publication_status as enum (
  'draft',
  'published'
);

alter table public.announcements
  add column if not exists tower_id uuid references public.towers (id) on delete set null,
  add column if not exists publication_status public.announcement_publication_status not null default 'published';

comment on column public.announcements.tower_id is 'Torre alvo (null = condomÃ­nio inteiro)';
comment on column public.announcements.publication_status is 'draft ou published; agendado/expirado derivado de published_at/expires_at';

-- Ãndices para listagem por condomÃ­nio, torre e visibilidade de membros
create index if not exists announcements_tower_id_idx
  on public.announcements (tower_id);

create index if not exists announcements_condo_publication_published_idx
  on public.announcements (condominium_id, publication_status, published_at desc);

create index if not exists announcements_condo_tower_idx
  on public.announcements (condominium_id, tower_id)
  where tower_id is not null;

create index if not exists announcements_member_visible_idx
  on public.announcements (condominium_id, published_at desc)
  where publication_status = 'published';

-- Torre deve pertencer ao mesmo condomÃ­nio do aviso
create or replace function public.validate_announcement_tower_condo()
returns trigger
language plpgsql
as $$
begin
  if new.tower_id is not null then
    if not exists (
      select 1
      from public.towers t
      where t.id = new.tower_id
        and t.condominium_id = new.condominium_id
    ) then
      raise exception 'A torre informada nÃ£o pertence a este condomÃ­nio.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists announcements_validate_tower_condo on public.announcements;

create trigger announcements_validate_tower_condo
before insert or update of tower_id, condominium_id on public.announcements
for each row execute function public.validate_announcement_tower_condo();

-- CritÃ©rio Ãºnico de visibilidade para moradores/portaria (espelha app + dashboard)
create or replace function public.is_announcement_visible_to_members(
  p_publication_status public.announcement_publication_status,
  p_published_at timestamptz,
  p_expires_at timestamptz
)
returns boolean
language sql
stable
as $$
  select
    p_publication_status = 'published'::public.announcement_publication_status
    and p_published_at <= timezone('utc', now())
    and (p_expires_at is null or p_expires_at > timezone('utc', now()));
$$;

comment on function public.is_announcement_visible_to_members is
  'Aviso visÃ­vel publicamente: publicado, data efetiva e nÃ£o expirado';

grant execute on function public.is_announcement_visible_to_members(
  public.announcement_publication_status,
  timestamptz,
  timestamptz
) to authenticated;

-- RLS SELECT: staff vÃª tudo; demais perfis sÃ³ avisos publicamente visÃ­veis
drop policy if exists "announcements_select" on public.announcements;
drop policy if exists "announcements_select_staff" on public.announcements;
drop policy if exists "announcements_select_members" on public.announcements;

create policy "announcements_select_staff"
on public.announcements
for select
to authenticated
using (public.is_condo_staff(condominium_id));

create policy "announcements_select_members"
on public.announcements
for select
to authenticated
using (
  (
    public.is_condo_member(condominium_id)
    or public.is_condo_doorman(condominium_id)
  )
  and not public.is_condo_staff(condominium_id)
  and public.is_announcement_visible_to_members(
    publication_status,
    published_at,
    expires_at
  )
);

-- INSERT/UPDATE/DELETE permanecem staff-only (00004); reafirmado aqui por clareza
drop policy if exists "announcements_insert" on public.announcements;
drop policy if exists "announcements_update" on public.announcements;
drop policy if exists "announcements_delete" on public.announcements;

create policy "announcements_insert"
on public.announcements
for insert
to authenticated
with check (public.is_condo_staff(condominium_id));

create policy "announcements_update"
on public.announcements
for update
to authenticated
using (public.is_condo_staff(condominium_id))
with check (public.is_condo_staff(condominium_id));

create policy "announcements_delete"
on public.announcements
for delete
to authenticated
using (public.is_condo_staff(condominium_id));


-- ===== 00010_announcements_consolidation.sql =====

-- =============================================================================
-- Avisos â€” consolidaÃ§Ã£o idempotente (ambientes que aplicaram 00009 parcial)
-- =============================================================================

-- Garante enum/colunas (no-op se 00009 completo jÃ¡ rodou)
do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'announcement_publication_status'
  ) then
    create type public.announcement_publication_status as enum ('draft', 'published');
  end if;
end $$;

alter table public.announcements
  add column if not exists tower_id uuid references public.towers (id) on delete set null,
  add column if not exists publication_status public.announcement_publication_status not null default 'published';

create index if not exists announcements_tower_id_idx
  on public.announcements (tower_id);

create index if not exists announcements_condo_publication_published_idx
  on public.announcements (condominium_id, publication_status, published_at desc);

create index if not exists announcements_condo_tower_idx
  on public.announcements (condominium_id, tower_id)
  where tower_id is not null;

create index if not exists announcements_member_visible_idx
  on public.announcements (condominium_id, published_at desc)
  where publication_status = 'published';

create or replace function public.validate_announcement_tower_condo()
returns trigger
language plpgsql
as $$
begin
  if new.tower_id is not null then
    if not exists (
      select 1
      from public.towers t
      where t.id = new.tower_id
        and t.condominium_id = new.condominium_id
    ) then
      raise exception 'A torre informada nÃ£o pertence a este condomÃ­nio.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists announcements_validate_tower_condo on public.announcements;

create trigger announcements_validate_tower_condo
before insert or update of tower_id, condominium_id on public.announcements
for each row execute function public.validate_announcement_tower_condo();

create or replace function public.is_announcement_visible_to_members(
  p_publication_status public.announcement_publication_status,
  p_published_at timestamptz,
  p_expires_at timestamptz
)
returns boolean
language sql
stable
as $$
  select
    p_publication_status = 'published'::public.announcement_publication_status
    and p_published_at <= timezone('utc', now())
    and (p_expires_at is null or p_expires_at > timezone('utc', now()));
$$;

grant execute on function public.is_announcement_visible_to_members(
  public.announcement_publication_status,
  timestamptz,
  timestamptz
) to authenticated;

drop policy if exists "announcements_select" on public.announcements;
drop policy if exists "announcements_select_staff" on public.announcements;
drop policy if exists "announcements_select_members" on public.announcements;

create policy "announcements_select_staff"
on public.announcements
for select
to authenticated
using (public.is_condo_staff(condominium_id));

create policy "announcements_select_members"
on public.announcements
for select
to authenticated
using (
  (
    public.is_condo_member(condominium_id)
    or public.is_condo_doorman(condominium_id)
  )
  and not public.is_condo_staff(condominium_id)
  and public.is_announcement_visible_to_members(
    publication_status,
    published_at,
    expires_at
  )
);

drop policy if exists "announcements_insert" on public.announcements;
drop policy if exists "announcements_update" on public.announcements;
drop policy if exists "announcements_delete" on public.announcements;

create policy "announcements_insert"
on public.announcements
for insert
to authenticated
with check (public.is_condo_staff(condominium_id));

create policy "announcements_update"
on public.announcements
for update
to authenticated
using (public.is_condo_staff(condominium_id))
with check (public.is_condo_staff(condominium_id));

create policy "announcements_delete"
on public.announcements
for delete
to authenticated
using (public.is_condo_staff(condominium_id));


-- ===== 00011_visitor_authorizations.sql =====

-- =============================================================================
-- Visitantes / prestadores â€” autorizaÃ§Ãµes de acesso por unidade
-- =============================================================================

create type public.guest_type as enum (
  'visitor',
  'service_provider'
);

create type public.visitor_authorization_status as enum (
  'pending',
  'approved',
  'rejected',
  'cancelled'
);

create table public.visitor_authorizations (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  guest_type public.guest_type not null default 'visitor',
  full_name text not null,
  document_type text,
  document_number text,
  company_name text,
  vehicle_plate text,
  access_starts_at timestamptz not null,
  access_ends_at timestamptz not null,
  status public.visitor_authorization_status not null default 'pending',
  notes text,
  doorman_notes text,
  requested_by uuid references public.profiles (id) on delete set null,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint visitor_authorizations_valid_period check (access_ends_at > access_starts_at),
  constraint visitor_authorizations_company_for_provider check (
    guest_type = 'service_provider' or company_name is null
  )
);

create index visitor_authorizations_condominium_id_idx
  on public.visitor_authorizations (condominium_id);

create index visitor_authorizations_unit_starts_idx
  on public.visitor_authorizations (unit_id, access_starts_at desc);

create index visitor_authorizations_condo_starts_idx
  on public.visitor_authorizations (condominium_id, access_starts_at desc);

create index visitor_authorizations_condo_status_starts_idx
  on public.visitor_authorizations (condominium_id, status, access_starts_at desc);

create index visitor_authorizations_condo_approved_window_idx
  on public.visitor_authorizations (condominium_id, access_starts_at, access_ends_at)
  where status = 'approved';

create index visitor_authorizations_condo_document_idx
  on public.visitor_authorizations (condominium_id, document_number)
  where document_number is not null;

create index visitor_authorizations_condo_plate_idx
  on public.visitor_authorizations (condominium_id, vehicle_plate)
  where vehicle_plate is not null;

create trigger visitor_authorizations_set_updated_at
before update on public.visitor_authorizations
for each row execute function public.set_updated_at();

create or replace function public.validate_visitor_authorization_unit_condo()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.units u
    join public.towers t on t.id = u.tower_id
    where u.id = new.unit_id
      and t.condominium_id = new.condominium_id
  ) then
    raise exception 'A unidade informada nÃ£o pertence a este condomÃ­nio.';
  end if;

  return new;
end;
$$;

create trigger visitor_authorizations_validate_unit_condo
before insert or update of unit_id, condominium_id on public.visitor_authorizations
for each row execute function public.validate_visitor_authorization_unit_condo();

create or replace function public.condominium_id_for_visitor_authorization(p_authorization_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select va.condominium_id
  from public.visitor_authorizations va
  where va.id = p_authorization_id;
$$;

create or replace function public.is_visitor_in_doorman_consult_window(
  p_access_starts_at timestamptz,
  p_access_ends_at timestamptz,
  p_horizon interval default interval '1 day'
)
returns boolean
language sql
stable
as $$
  select
    p_access_ends_at >= (timezone('utc', now()) - p_horizon)
    and p_access_starts_at <= (timezone('utc', now()) + p_horizon);
$$;

comment on function public.is_visitor_in_doorman_consult_window is
  'Janela operacional padrÃ£o da portaria: hoje Â±1 dia (interseÃ§Ã£o com access window)';

grant execute on function public.condominium_id_for_visitor_authorization(uuid) to authenticated;
grant execute on function public.is_visitor_in_doorman_consult_window(timestamptz, timestamptz, interval) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.visitor_authorizations enable row level security;

create policy "visitor_authorizations_select_staff"
on public.visitor_authorizations
for select
to authenticated
using (public.is_condo_staff(condominium_id));

create policy "visitor_authorizations_select_doorman"
on public.visitor_authorizations
for select
to authenticated
using (
  public.is_condo_doorman(condominium_id)
  and not public.is_condo_staff(condominium_id)
);

create policy "visitor_authorizations_select_resident"
on public.visitor_authorizations
for select
to authenticated
using (
  public.is_condo_member(condominium_id)
  and not public.is_condo_staff(condominium_id)
  and not public.is_condo_doorman(condominium_id)
  and (
    public.owns_unit(unit_id)
    or public.shares_unit_with_auth_user(unit_id)
  )
);

create policy "visitor_authorizations_insert_staff"
on public.visitor_authorizations
for insert
to authenticated
with check (public.is_condo_staff(condominium_id));

create policy "visitor_authorizations_insert_resident"
on public.visitor_authorizations
for insert
to authenticated
with check (
  public.is_condo_member(condominium_id)
  and not public.is_condo_staff(condominium_id)
  and public.owns_unit(unit_id)
  and public.condominium_id_for_unit(unit_id) = condominium_id
);

create policy "visitor_authorizations_update_staff"
on public.visitor_authorizations
for update
to authenticated
using (public.is_condo_staff(condominium_id))
with check (public.is_condo_staff(condominium_id));

create policy "visitor_authorizations_update_resident_cancel"
on public.visitor_authorizations
for update
to authenticated
using (
  public.owns_unit(unit_id)
  and public.is_condo_member(condominium_id)
  and not public.is_condo_staff(condominium_id)
  and status in ('pending', 'approved')
)
with check (
  public.owns_unit(unit_id)
  and public.is_condo_member(condominium_id)
  and not public.is_condo_staff(condominium_id)
  and status = 'cancelled'
);

create policy "visitor_authorizations_update_doorman_notes"
on public.visitor_authorizations
for update
to authenticated
using (
  public.is_condo_doorman(condominium_id)
  and not public.is_condo_staff(condominium_id)
  and status in ('pending', 'approved')
)
with check (
  public.is_condo_doorman(condominium_id)
  and not public.is_condo_staff(condominium_id)
  and status in ('pending', 'approved')
);

create policy "visitor_authorizations_delete_staff"
on public.visitor_authorizations
for delete
to authenticated
using (public.is_condo_staff(condominium_id));

