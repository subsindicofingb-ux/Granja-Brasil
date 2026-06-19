-- =============================================================================
-- Fix: RLS insert em avisos (morador, staff, resposta)
-- =============================================================================

create or replace function public.is_condo_resident(p_condominium_id uuid)
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
      and m.role = 'resident'
  );
$$;

grant execute on function public.is_condo_resident(uuid) to authenticated;

drop policy if exists "announcements_insert" on public.announcements;
drop policy if exists "announcements_insert_staff" on public.announcements;
drop policy if exists "announcements_insert_resident" on public.announcements;
drop policy if exists "announcements_insert_reply" on public.announcements;

create policy "announcements_insert_staff"
on public.announcements
for insert
to authenticated
with check (
  created_by = auth.uid()
  and parent_id is null
  and public.is_condo_staff(condominium_id)
);

create policy "announcements_insert_resident"
on public.announcements
for insert
to authenticated
with check (
  created_by = auth.uid()
  and staff_only is true
  and parent_id is null
  and publication_status = 'published'
  and (
    (
      public.is_condo_resident(condominium_id)
      and (
        public.granja_condominium_id() is null
        or condominium_id is distinct from public.granja_condominium_id()
      )
      and target_profile_id is null
      and target_condominium_id is null
    )
    or (
      public.granja_condominium_id() is not null
      and condominium_id = public.granja_condominium_id()
      and target_condominium_id is not null
      and public.is_condo_resident(target_condominium_id)
      and target_profile_id is null
    )
  )
);

create policy "announcements_insert_reply"
on public.announcements
for insert
to authenticated
with check (
  created_by = auth.uid()
  and parent_id is not null
  and publication_status = 'published'
  and exists (
    select 1
    from public.announcements parent
    where parent.id = parent_id
      and parent.parent_id is null
      and public.can_access_announcement(parent.id)
  )
);
