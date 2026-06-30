-- Portaria de bloco: incluir is_block_doorman em is_condo_operational_staff.

create or replace function public.is_condo_operational_staff(p_condominium_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or public.is_condo_staff(p_condominium_id)
    or public.is_condo_doorman(p_condominium_id)
    or public.is_block_doorman(p_condominium_id)
    or public.has_condo_role(
      p_condominium_id,
      array['sub_syndic']::public.membership_role[]
    );
$$;
