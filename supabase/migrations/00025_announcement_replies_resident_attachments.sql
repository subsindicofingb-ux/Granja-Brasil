-- =============================================================================
-- Avisos: respostas, mensagens do morador, anexos e leitura
-- =============================================================================

alter table public.announcements
  add column if not exists parent_id uuid references public.announcements (id) on delete cascade,
  add column if not exists attachment_url text,
  add column if not exists attachment_name text,
  add column if not exists staff_only boolean not null default false;

create index if not exists announcements_parent_id_idx
  on public.announcements (parent_id)
  where parent_id is not null;

create index if not exists announcements_staff_only_idx
  on public.announcements (condominium_id, staff_only)
  where staff_only = true;

create or replace function public.announcement_thread_root_id(p_announcement_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select parent_id from public.announcements where id = p_announcement_id and parent_id is not null),
    p_announcement_id
  );
$$;

create or replace function public.can_access_announcement(p_announcement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_condo_staff((select condominium_id from public.announcements where id = p_announcement_id))
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

grant execute on function public.announcement_thread_root_id(uuid) to authenticated;
grant execute on function public.can_access_announcement(uuid) to authenticated;

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
        (
          a.staff_only
          and a.created_by = auth.uid()
        )
        or (
          not a.staff_only
          and a.target_profile_id is not null
          and a.target_profile_id = auth.uid()
        )
        or (
          not a.staff_only
          and a.target_profile_id is null
          and a.target_condominium_id is null
          and (
            (
              a.condominium_id <> public.granja_condominium_id()
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
                  and m.condominium_id <> public.granja_condominium_id()
                  and m.role in ('resident', 'doorman')
              )
            )
          )
        )
      )
  );
$$;

drop policy if exists "announcement_reads_select" on public.announcement_reads;

create policy "announcement_reads_select"
on public.announcement_reads
for select
to authenticated
using (
  profile_id = auth.uid()
  or public.is_super_admin()
  or exists (
    select 1
    from public.announcements a
    where a.id = announcement_id
      and a.created_by = auth.uid()
  )
  or exists (
    select 1
    from public.announcements a
    where a.id = announcement_id
      and public.is_condo_staff(a.condominium_id)
  )
  or exists (
    select 1
    from public.announcements a
    where a.id = announcement_id
      and public.granja_condominium_id() is not null
      and a.condominium_id = public.granja_condominium_id()
      and exists (
        select 1
        from public.memberships m
        where m.profile_id = auth.uid()
          and public.is_condo_staff(m.condominium_id)
          and m.condominium_id <> public.granja_condominium_id()
          and (
            a.target_condominium_id is null
            or a.target_condominium_id = m.condominium_id
          )
      )
  )
);

drop policy if exists "announcement_reads_insert_own" on public.announcement_reads;

create policy "announcement_reads_insert_own"
on public.announcement_reads
for insert
to authenticated
with check (
  profile_id = auth.uid()
  and public.can_access_announcement(announcement_id)
  and exists (
    select 1
    from public.announcements a
    where a.id = announcement_id
      and (a.created_by is null or a.created_by <> auth.uid())
  )
);

drop policy if exists "announcements_insert" on public.announcements;

create policy "announcements_insert_staff"
on public.announcements
for insert
to authenticated
with check (
  public.is_condo_staff(condominium_id)
  and created_by = auth.uid()
);

create policy "announcements_insert_resident"
on public.announcements
for insert
to authenticated
with check (
  created_by = auth.uid()
  and staff_only = true
  and parent_id is null
  and publication_status = 'published'
  and exists (
    select 1
    from public.memberships m
    where m.profile_id = auth.uid()
      and m.role = 'resident'
      and (
        (
          m.condominium_id = condominium_id
          and condominium_id <> public.granja_condominium_id()
          and target_profile_id is null
          and target_condominium_id is null
        )
        or (
          public.granja_condominium_id() is not null
          and condominium_id = public.granja_condominium_id()
          and target_condominium_id = m.condominium_id
          and target_profile_id is null
        )
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
  and public.can_access_announcement(parent_id)
  and exists (
    select 1
    from public.announcements parent
    where parent.id = parent_id
      and parent.parent_id is null
  )
);

drop policy if exists "announcements_select_staff" on public.announcements;

create policy "announcements_select_staff"
on public.announcements
for select
to authenticated
using (
  public.is_condo_staff(condominium_id)
  or (
    public.granja_condominium_id() is not null
    and condominium_id = public.granja_condominium_id()
    and target_profile_id is null
    and staff_only = false
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
