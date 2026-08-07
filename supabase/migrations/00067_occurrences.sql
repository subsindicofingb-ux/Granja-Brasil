-- Livro de ocorrências (portaria + moradores): registro oficial.

do $$ begin
  create type public.occurrence_category as enum (
    'elevator_stop',
    'power_outage',
    'accident',
    'complaint',
    'report',
    'other'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.occurrence_status as enum (
    'open',
    'in_progress',
    'closed'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.occurrences (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums (id) on delete cascade,
  unit_id uuid references public.units (id) on delete set null,
  category public.occurrence_category not null default 'report',
  title text not null,
  description text not null,
  location_text text,
  status public.occurrence_status not null default 'open',
  occurred_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references public.profiles (id) on delete set null,
  internal_notes text,
  constraint occurrences_title_not_empty check (char_length(trim(title)) > 0),
  constraint occurrences_description_not_empty check (char_length(trim(description)) > 0)
);

create index if not exists occurrences_condo_occurred_idx
  on public.occurrences (condominium_id, occurred_at desc);

create index if not exists occurrences_condo_status_idx
  on public.occurrences (condominium_id, status);

create index if not exists occurrences_created_by_idx
  on public.occurrences (created_by, created_at desc);

drop trigger if exists occurrences_set_updated_at on public.occurrences;
create trigger occurrences_set_updated_at
before update on public.occurrences
for each row execute function public.set_updated_at();

alter table public.occurrences enable row level security;

drop policy if exists "occurrences_select" on public.occurrences;
create policy "occurrences_select"
on public.occurrences
for select
to authenticated
using (
  public.is_super_admin()
  or public.is_condo_member(condominium_id)
  or public.is_block_staff(condominium_id)
  or public.is_block_doorman(condominium_id)
);

drop policy if exists "occurrences_insert" on public.occurrences;
create policy "occurrences_insert"
on public.occurrences
for insert
to authenticated
with check (
  created_by = auth.uid()
  and (
    public.is_super_admin()
    or public.is_condo_member(condominium_id)
    or public.is_block_staff(condominium_id)
    or public.is_block_doorman(condominium_id)
  )
  and (
    unit_id is null
    or public.condominium_id_for_unit(unit_id) = condominium_id
  )
);

drop policy if exists "occurrences_update" on public.occurrences;
create policy "occurrences_update"
on public.occurrences
for update
to authenticated
using (
  public.is_super_admin()
  or public.is_condo_staff(condominium_id)
  or public.is_condo_doorman(condominium_id)
  or public.is_condo_employee(condominium_id)
  or public.is_block_staff(condominium_id)
  or public.is_block_doorman(condominium_id)
)
with check (
  public.is_super_admin()
  or public.is_condo_staff(condominium_id)
  or public.is_condo_doorman(condominium_id)
  or public.is_condo_employee(condominium_id)
  or public.is_block_staff(condominium_id)
  or public.is_block_doorman(condominium_id)
);

-- Hierarquia: categoria ocorrencias (defaults)
do $$
declare
  current_matrix jsonb;
  role_key text;
  role_defaults jsonb;
begin
  select matrix into current_matrix
  from public.app_permission_matrix
  where id = 1;

  if current_matrix is null then
    return;
  end if;

  foreach role_key in array array['admin', 'syndic', 'sub_syndic', 'doorman', 'staff', 'resident']
  loop
    role_defaults := case role_key
      when 'resident' then jsonb_build_object('view', true, 'create', true, 'delete', false)
      else jsonb_build_object('view', true, 'create', true, 'delete', true)
    end;

    if current_matrix ? role_key then
      current_matrix := jsonb_set(
        current_matrix,
        array[role_key, 'occurrences'],
        role_defaults,
        true
      );
    end if;
  end loop;

  update public.app_permission_matrix
  set
    matrix = current_matrix,
    updated_at = now()
  where id = 1;
end;
$$;
