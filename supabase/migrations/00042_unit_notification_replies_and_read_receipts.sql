-- Respostas, confirmação de leitura ao remetente e controle de visualização.

alter table public.unit_notifications
  add column if not exists sender_last_seen_at timestamptz;

alter table public.unit_notification_reads
  add column if not exists read_receipt_sent_at timestamptz;

create table if not exists public.unit_notification_replies (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.unit_notifications (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete restrict,
  body text not null,
  attachment_url text,
  attachment_name text,
  created_at timestamptz not null default now(),
  constraint unit_notification_replies_body_not_empty check (char_length(trim(body)) > 0)
);

create index if not exists unit_notification_replies_notification_idx
  on public.unit_notification_replies (notification_id, created_at asc);

alter table public.unit_notification_replies enable row level security;

drop policy if exists "unit_notification_replies_select" on public.unit_notification_replies;
create policy "unit_notification_replies_select"
on public.unit_notification_replies
for select
to authenticated
using (
  exists (
    select 1
    from public.unit_notifications n
    where n.id = notification_id
      and (
        n.target_profile_id = auth.uid()
        or n.created_by = auth.uid()
        or public.is_condo_staff(n.source_condominium_id)
        or public.is_condo_staff(n.target_condominium_id)
      )
  )
);

drop policy if exists "unit_notification_replies_insert" on public.unit_notification_replies;
create policy "unit_notification_replies_insert"
on public.unit_notification_replies
for insert
to authenticated
with check (
  created_by = auth.uid()
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
