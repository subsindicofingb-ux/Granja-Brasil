-- =============================================================================
-- Abertura remota: síndico/equipe sem cadastro facial (resident_id opcional)
-- =============================================================================

alter table public.access_remote_open_events
  alter column resident_id drop not null;

drop policy if exists "access_remote_open_events_insert" on public.access_remote_open_events;

create policy "access_remote_open_events_insert"
on public.access_remote_open_events
for insert
to authenticated
with check (
  profile_id = auth.uid()
  and (
    (
      resident_id is not null
      and public.resident_belongs_to_condominium(resident_id, condominium_id)
      and exists (
        select 1
        from public.resident_access_grants g
        where g.resident_id = access_remote_open_events.resident_id
          and g.access_device_id = access_remote_open_events.access_device_id
          and g.sync_status = 'synced'
      )
    )
    or (
      resident_id is null
      and (
        public.is_super_admin()
        or public.is_condo_staff(condominium_id)
      )
    )
  )
);
