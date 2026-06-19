-- Atualiza is_condo_staff para incluir sub-síndico.
-- Rode APÓS o 00030 (em execução separada no SQL Editor).

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
        and m.role in ('admin', 'syndic', 'sub_syndic')
    );
$$;
