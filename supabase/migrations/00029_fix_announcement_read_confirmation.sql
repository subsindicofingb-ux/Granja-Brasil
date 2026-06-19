-- =============================================================================
-- Fix: confirmação de leitura em avisos
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
    and public.announcement_created_by_other(p_announcement_id);
$$;

grant execute on function public.can_mark_announcement_read(uuid) to authenticated;

drop policy if exists "announcement_reads_insert_own" on public.announcement_reads;

create policy "announcement_reads_insert_own"
on public.announcement_reads
for insert
to authenticated
with check (
  profile_id = auth.uid()
  and public.can_mark_announcement_read(announcement_id)
);
