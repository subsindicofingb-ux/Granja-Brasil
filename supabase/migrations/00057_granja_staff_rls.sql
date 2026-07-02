-- Administrador/Síndico da Granja Brasil: acesso operacional aos condomínios filhos
-- (mesmo escopo do Super Admin, exceto operações exclusivas de super_admin).

create or replace function public.is_granja_staff()
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
        and public.granja_condominium_id() is not null
        and m.condominium_id = public.granja_condominium_id()
        and m.role in ('admin', 'syndic')
    );
$$;

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
    )
    or (
      public.is_granja_staff()
      and public.granja_condominium_id() is not null
      and p_condominium_id is distinct from public.granja_condominium_id()
    );
$$;

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
    )
    or (
      public.is_granja_staff()
      and public.granja_condominium_id() is not null
      and p_condominium_id is distinct from public.granja_condominium_id()
    );
$$;

grant execute on function public.is_granja_staff() to authenticated;
