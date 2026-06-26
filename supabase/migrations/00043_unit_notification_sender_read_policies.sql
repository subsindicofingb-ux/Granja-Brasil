-- Permite remetente registrar visualização e atualizar leituras próprias.

drop policy if exists "unit_notifications_update_sender" on public.unit_notifications;
create policy "unit_notifications_update_sender"
on public.unit_notifications
for update
to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

drop policy if exists "unit_notification_reads_update_own" on public.unit_notification_reads;
create policy "unit_notification_reads_update_own"
on public.unit_notification_reads
for update
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

drop policy if exists "unit_notification_reads_insert" on public.unit_notification_reads;
create policy "unit_notification_reads_insert"
on public.unit_notification_reads
for insert
to authenticated
with check (
  profile_id = auth.uid()
  and exists (
    select 1
    from public.unit_notifications n
    where n.id = notification_id
      and (
        n.target_profile_id = auth.uid()
        or n.created_by = auth.uid()
      )
  )
);
