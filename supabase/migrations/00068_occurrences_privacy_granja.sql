-- Privacidade por condomínio + destino Granja + resposta ao reclamante.

alter table public.occurrences
  add column if not exists source_condominium_id uuid references public.condominiums (id) on delete set null;

alter table public.occurrences
  add column if not exists response_text text;

create index if not exists occurrences_source_condo_idx
  on public.occurrences (source_condominium_id, created_at desc);

create index if not exists occurrences_created_by_condo_idx
  on public.occurrences (created_by, condominium_id);

-- Gestor operacional do condomínio (sem spillover da Granja).
create or replace function public.is_occurrence_condo_manager(p_condominium_id uuid)
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
        and m.role in ('admin', 'syndic', 'sub_syndic', 'doorman', 'staff')
    );
$$;

grant execute on function public.is_occurrence_condo_manager(uuid) to authenticated;

-- Visualização de ocorrências da Granja: só super admin e admin da Granja.
create or replace function public.is_granja_occurrence_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or (
      public.granja_condominium_id() is not null
      and exists (
        select 1
        from public.memberships m
        where m.profile_id = auth.uid()
          and m.condominium_id = public.granja_condominium_id()
          and m.role = 'admin'
      )
    );
$$;

grant execute on function public.is_granja_occurrence_admin() to authenticated;

drop policy if exists "occurrences_select" on public.occurrences;
create policy "occurrences_select"
on public.occurrences
for select
to authenticated
using (
  created_by = auth.uid()
  or (
    public.granja_condominium_id() is not null
    and condominium_id = public.granja_condominium_id()
    and public.is_granja_occurrence_admin()
  )
  or (
    (
      public.granja_condominium_id() is null
      or condominium_id is distinct from public.granja_condominium_id()
    )
    and public.is_occurrence_condo_manager(condominium_id)
  )
);

drop policy if exists "occurrences_insert" on public.occurrences;
create policy "occurrences_insert"
on public.occurrences
for insert
to authenticated
with check (
  created_by = auth.uid()
  and (
    -- Registro no próprio condomínio (prédio)
    (
      (
        public.granja_condominium_id() is null
        or condominium_id is distinct from public.granja_condominium_id()
      )
      and public.is_condo_member(condominium_id)
      and (
        unit_id is null
        or public.condominium_id_for_unit(unit_id) = condominium_id
      )
    )
    -- Registro direcionado à Granja
    or (
      public.granja_condominium_id() is not null
      and condominium_id = public.granja_condominium_id()
      and source_condominium_id is not null
      and public.is_condo_member(source_condominium_id)
      and (
        unit_id is null
        or public.condominium_id_for_unit(unit_id) = source_condominium_id
      )
    )
    -- Admin/super registrando direto na Granja
    or (
      public.granja_condominium_id() is not null
      and condominium_id = public.granja_condominium_id()
      and public.is_granja_occurrence_admin()
    )
  )
);

drop policy if exists "occurrences_update" on public.occurrences;
create policy "occurrences_update"
on public.occurrences
for update
to authenticated
using (
  (
    public.granja_condominium_id() is not null
    and condominium_id = public.granja_condominium_id()
    and public.is_granja_occurrence_admin()
  )
  or (
    (
      public.granja_condominium_id() is null
      or condominium_id is distinct from public.granja_condominium_id()
    )
    and public.is_occurrence_condo_manager(condominium_id)
  )
)
with check (
  (
    public.granja_condominium_id() is not null
    and condominium_id = public.granja_condominium_id()
    and public.is_granja_occurrence_admin()
  )
  or (
    (
      public.granja_condominium_id() is null
      or condominium_id is distinct from public.granja_condominium_id()
    )
    and public.is_occurrence_condo_manager(condominium_id)
  )
);
