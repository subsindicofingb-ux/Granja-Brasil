-- =============================================================================
-- RLS helpers — funções security definer para policies
-- =============================================================================

-- Super admin: membership com role super_admin em qualquer condomínio
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

-- Membro do condomínio (qualquer papel)
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

-- Papéis de gestão (CRUD operacional)
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

-- Verifica papel específico no condomínio
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

-- Ownership: usuário autenticado vinculado à unidade via residents.profile_id
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

-- Ownership: registro de morador do próprio usuário
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

-- IDs dos condomínios do usuário autenticado
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

-- Unidades vinculadas ao usuário autenticado
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
