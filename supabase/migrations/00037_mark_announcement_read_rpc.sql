-- =============================================================================
-- RPC: confirma leitura/resposta visualizada com upsert seguro
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

create or replace function public.mark_announcement_read(p_announcement_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_read_at timestamptz := timezone('utc', now());
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.can_mark_announcement_read(p_announcement_id) then
    raise exception 'not allowed to mark announcement read';
  end if;

  insert into public.announcement_reads (announcement_id, profile_id, read_at)
  values (p_announcement_id, auth.uid(), v_read_at)
  on conflict (announcement_id, profile_id)
  do update set read_at = excluded.read_at;

  return v_read_at;
end;
$$;

grant execute on function public.can_mark_announcement_read(uuid) to authenticated;
grant execute on function public.mark_announcement_read(uuid) to authenticated;

drop policy if exists "announcement_reads_insert_own" on public.announcement_reads;

create policy "announcement_reads_insert_own"
on public.announcement_reads
for insert
to authenticated
with check (
  profile_id = auth.uid()
  and public.can_mark_announcement_read(announcement_id)
);
