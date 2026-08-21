-- Portaria não visualiza conversas privadas entre síndico e moradores.

create or replace function public.is_announcement_syndic_resident_private(p_announcement_id uuid)
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
      and (
        a.staff_only
        or public.announcement_has_target_profiles(a.id)
        or (
          a.target_condominium_id is not null
          and coalesce(a.target_condominium_staff_only, true) = true
        )
      )
  );
$$;

grant execute on function public.is_announcement_syndic_resident_private(uuid) to authenticated;

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
      and not (
        (
          public.is_condo_doorman(a.condominium_id)
          or public.is_block_doorman(a.condominium_id)
        )
        and public.is_announcement_syndic_resident_private(a.id)
        and a.created_by is distinct from auth.uid()
        and not public.is_announcement_target_profile(a.id, auth.uid())
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

create or replace function public.can_access_announcement(p_announcement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select
    (
      public.is_condo_staff((
        select condominium_id
        from public.announcements
        where id = p_announcement_id
      ))
      and not (
        (
          public.is_condo_doorman((
            select condominium_id
            from public.announcements
            where id = p_announcement_id
          ))
          or public.is_block_doorman((
            select condominium_id
            from public.announcements
            where id = p_announcement_id
          ))
        )
        and public.is_announcement_syndic_resident_private(p_announcement_id)
      )
    )
    or public.is_announcement_visible_to_profile(p_announcement_id)
    or exists (
      select 1
      from public.announcements a
      where a.id = p_announcement_id
        and a.staff_only
        and a.created_by = auth.uid()
    )
    or exists (
      select 1
      from public.announcements a
      where a.id = p_announcement_id
        and public.granja_condominium_id() is not null
        and a.condominium_id = public.granja_condominium_id()
        and public.is_condo_staff(public.granja_condominium_id())
    )
    or exists (
      select 1
      from public.announcements a
      where a.id = p_announcement_id
        and public.granja_condominium_id() is not null
        and a.condominium_id = public.granja_condominium_id()
        and a.target_condominium_id is not null
        and exists (
          select 1
          from public.memberships m
          where m.profile_id = auth.uid()
            and public.is_condo_staff(m.condominium_id)
            and m.condominium_id = a.target_condominium_id
        )
    );
$$;

drop policy if exists "announcements_select_staff" on public.announcements;

create policy "announcements_select_staff"
on public.announcements
for select
to authenticated
using (
  (
    staff_only = true
    and created_by = auth.uid()
  )
  or (
    public.is_condo_staff(condominium_id)
    and not public.is_condo_doorman(condominium_id)
    and not public.is_block_doorman(condominium_id)
  )
  or (
    public.granja_condominium_id() is not null
    and condominium_id = public.granja_condominium_id()
    and target_profile_id is null
    and exists (
      select 1
      from public.memberships m
      where m.profile_id = auth.uid()
        and public.is_condo_staff(m.condominium_id)
        and m.condominium_id <> public.granja_condominium_id()
        and (
          (target_condominium_id is not null and target_condominium_id = m.condominium_id)
          or target_condominium_id is null
        )
    )
  )
);
