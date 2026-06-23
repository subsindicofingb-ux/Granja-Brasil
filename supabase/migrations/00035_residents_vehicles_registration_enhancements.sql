-- Pré-cadastro: telefone, foto e perfil "Outros"
alter type public.registration_profile_type add value if not exists 'other';

alter table public.registration_requests
  add column if not exists phone text,
  add column if not exists photo_url text;

-- Veículos: aprovação pelo síndico após cadastro do morador
do $$
begin
  if not exists (select 1 from pg_type where typname = 'vehicle_status') then
    create type public.vehicle_status as enum ('pending', 'approved', 'rejected');
  end if;
end $$;

alter table public.vehicles
  add column if not exists status public.vehicle_status not null default 'approved',
  add column if not exists reviewed_by uuid references public.profiles (id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_notes text;

create index if not exists vehicles_condo_status_idx
  on public.vehicles (condominium_id, status);

-- RLS — vehicles (morador cadastra pendente; portaria só vê aprovados)
drop policy if exists "vehicles_select" on public.vehicles;
create policy "vehicles_select"
on public.vehicles
for select
to authenticated
using (
  public.is_condo_staff(condominium_id)
  or (
    public.is_condo_doorman(condominium_id)
    and status = 'approved'
  )
  or public.shares_unit_with_auth_user(unit_id)
);

drop policy if exists "vehicles_insert" on public.vehicles;
create policy "vehicles_insert"
on public.vehicles
for insert
to authenticated
with check (
  (
    public.is_condo_staff(condominium_id)
    and status in ('approved', 'pending')
  )
  or (
    status = 'pending'
    and public.shares_unit_with_auth_user(unit_id)
  )
);

drop policy if exists "vehicles_update" on public.vehicles;
create policy "vehicles_update"
on public.vehicles
for update
to authenticated
using (
  public.is_condo_staff(condominium_id)
  or (
    status = 'pending'
    and public.shares_unit_with_auth_user(unit_id)
  )
)
with check (
  public.is_condo_staff(condominium_id)
  or (
    status = 'pending'
    and public.shares_unit_with_auth_user(unit_id)
  )
);

drop policy if exists "vehicles_delete" on public.vehicles;
create policy "vehicles_delete"
on public.vehicles
for delete
to authenticated
using (
  public.is_condo_staff(condominium_id)
  or (
    status = 'pending'
    and public.shares_unit_with_auth_user(unit_id)
  )
);
