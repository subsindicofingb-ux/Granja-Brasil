-- =============================================================================
-- Fix: morador/autor pode confirmar leitura de resposta na própria conversa
-- =============================================================================

create or replace function public.can_mark_announcement_read(p_announcement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select
    public.can_access_announcement(p_announcement_id)
    and (
      public.announcement_created_by_other(p_announcement_id)
      or exists (
        select 1
        from public.announcements root
        where root.id = p_announcement_id
          and root.parent_id is null
          and root.created_by = auth.uid()
          and exists (
            select 1
            from public.announcements reply
            where reply.parent_id = root.id
              and reply.created_by is distinct from auth.uid()
          )
      )
    );
$$;

drop policy if exists "announcement_reads_insert_own" on public.announcement_reads;

create policy "announcement_reads_insert_own"
on public.announcement_reads
for insert
to authenticated
with check (
  profile_id = auth.uid()
  and public.can_mark_announcement_read(announcement_id)
);
