-- =============================================================================
-- Visitantes / prestadores — autorizações de acesso por unidade
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
    raise exception 'A unidade informada não pertence a este condomínio.';
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
  'Janela operacional padrão da portaria: hoje ±1 dia (interseção com access window)';

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
