-- =============================================================================
-- Fix: recursão infinita em RLS de avisos + limpeza de mensagens de teste
-- =============================================================================

create or replace function public.announcement_thread_root_id(p_announcement_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select coalesce(
    (select parent_id from public.announcements where id = p_announcement_id and parent_id is not null),
    p_announcement_id
  );
$$;

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
          and a.target_profile_id is not null
          and a.target_profile_id = auth.uid()
        )
        or (
          not a.staff_only
          and a.target_profile_id is null
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

create or replace function public.announcement_is_thread_root(p_announcement_id uuid)
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
      and a.parent_id is null
  );
$$;

create or replace function public.announcement_created_by_other(p_announcement_id uuid)
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
      and (a.created_by is null or a.created_by <> auth.uid())
  );
$$;

create or replace function public.can_view_announcement_read_receipts(p_announcement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select
    (
      select a.created_by
      from public.announcements a
      where a.id = p_announcement_id
    ) = auth.uid()
    or public.is_condo_staff(
      (select a.condominium_id from public.announcements a where a.id = p_announcement_id)
    )
    or exists (
      select 1
      from public.announcements a
      where a.id = p_announcement_id
        and public.granja_condominium_id() is not null
        and a.condominium_id = public.granja_condominium_id()
        and exists (
          select 1
          from public.memberships m
          where m.profile_id = auth.uid()
            and public.is_condo_staff(m.condominium_id)
            and m.condominium_id is distinct from public.granja_condominium_id()
            and (
              a.target_condominium_id is null
              or a.target_condominium_id = m.condominium_id
            )
        )
    );
$$;

create or replace function public.can_insert_announcement_reply(p_parent_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select
    public.announcement_is_thread_root(p_parent_id)
    and public.can_access_announcement(p_parent_id);
$$;

grant execute on function public.announcement_is_thread_root(uuid) to authenticated;
grant execute on function public.announcement_created_by_other(uuid) to authenticated;
grant execute on function public.can_view_announcement_read_receipts(uuid) to authenticated;
grant execute on function public.can_insert_announcement_reply(uuid) to authenticated;

drop policy if exists "announcements_insert_reply" on public.announcements;

create policy "announcements_insert_reply"
on public.announcements
for insert
to authenticated
with check (
  created_by = auth.uid()
  and parent_id is not null
  and publication_status = 'published'
  and public.can_insert_announcement_reply(parent_id)
);

drop policy if exists "announcement_reads_select" on public.announcement_reads;

create policy "announcement_reads_select"
on public.announcement_reads
for select
to authenticated
using (
  profile_id = auth.uid()
  or public.is_super_admin()
  or public.can_view_announcement_read_receipts(announcement_id)
);

drop policy if exists "announcement_reads_insert_own" on public.announcement_reads;

create policy "announcement_reads_insert_own"
on public.announcement_reads
for insert
to authenticated
with check (
  profile_id = auth.uid()
  and public.can_access_announcement(announcement_id)
  and public.announcement_created_by_other(announcement_id)
);

-- Limpeza: mensagens de teste (threads morador/síndico e respostas)
delete from public.announcement_reads
where announcement_id in (
  select id
  from public.announcements
  where staff_only = true
     or parent_id is not null
);

delete from public.announcements
where parent_id is not null;

delete from public.announcements
where staff_only = true;
