-- =============================================================================
-- Avisos Granja: distinguir bloco (moradores) vs bloco (somente síndico)
-- =============================================================================

alter table public.announcements
  add column if not exists target_condominium_staff_only boolean;

update public.announcements
set target_condominium_staff_only = true
where target_condominium_id is not null
  and target_condominium_staff_only is null;

create or replace function public.is_announcement_visible_to_profile(p_announcement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.announcements a
    where a.id = p_announcement_id
      and public.is_announcement_visible_to_members(
        a.publication_status,
        a.published_at,
        a.expires_at
      )
      and (
        (
          a.staff_only
          and a.created_by = auth.uid()
        )
        or (
          not a.staff_only
          and public.announcement_has_target_profiles(a.id)
          and public.is_announcement_target_profile(a.id, auth.uid())
        )
        or (
          not a.staff_only
          and not public.announcement_has_target_profiles(a.id)
          and a.target_condominium_id is not null
          and coalesce(a.target_condominium_staff_only, true) = false
          and exists (
            select 1
            from public.memberships m
            where m.profile_id = auth.uid()
              and m.condominium_id = a.target_condominium_id
              and m.role in ('resident', 'doorman')
          )
        )
        or (
          not a.staff_only
          and not public.announcement_has_target_profiles(a.id)
          and a.target_condominium_id is null
          and (
            (
              a.condominium_id is distinct from public.granja_condominium_id()
              and exists (
                select 1
                from public.memberships m
                where m.profile_id = auth.uid()
                  and m.condominium_id = a.condominium_id
                  and m.role in ('resident', 'doorman')
              )
            )
            or (
              a.condominium_id = public.granja_condominium_id()
              and exists (
                select 1
                from public.memberships m
                where m.profile_id = auth.uid()
                  and m.condominium_id is distinct from public.granja_condominium_id()
                  and m.role in ('resident', 'doorman')
              )
            )
          )
        )
      )
  );
$$;
