-- =============================================================================
-- Avisos: aviso para síndico (target_condominium_id) não visível a moradores
-- =============================================================================

create or replace function public.is_announcement_visible_to_profile(p_announcement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
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
        a.target_profile_id is null
        or a.target_profile_id = auth.uid()
      )
      and (
        exists (
          select 1
          from public.memberships m
          where m.profile_id = auth.uid()
            and m.condominium_id = a.condominium_id
            and a.target_condominium_id is null
            and a.condominium_id <> public.granja_condominium_id()
        )
        or exists (
          select 1
          from public.memberships m
          where m.profile_id = auth.uid()
            and a.condominium_id = public.granja_condominium_id()
            and a.target_condominium_id is null
        )
      )
  );
$$;

drop policy if exists "announcements_select_members" on public.announcements;

create policy "announcements_select_members"
on public.announcements
for select
to authenticated
using (
  (
    public.is_condo_member(condominium_id)
    or public.is_condo_doorman(condominium_id)
    or (
      public.granja_condominium_id() is not null
      and target_condominium_id is null
      and exists (
        select 1
        from public.memberships m
        where m.profile_id = auth.uid()
      )
      and condominium_id = public.granja_condominium_id()
    )
  )
  and not public.is_condo_staff(condominium_id)
  and public.is_announcement_visible_to_profile(id)
);
