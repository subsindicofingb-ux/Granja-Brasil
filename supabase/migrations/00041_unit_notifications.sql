-- Notificações formais para unidade (morador responsável), com anexo de comprovação.

create table if not exists public.unit_notifications (
  id uuid primary key default gen_random_uuid(),
  source_condominium_id uuid not null references public.condominiums (id) on delete cascade,
  target_condominium_id uuid not null references public.condominiums (id) on delete cascade,
  target_unit_id uuid not null references public.units (id) on delete cascade,
  target_profile_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null,
  attachment_url text,
  attachment_name text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unit_notifications_title_not_empty check (char_length(trim(title)) > 0),
  constraint unit_notifications_body_not_empty check (char_length(trim(body)) > 0)
);

create table if not exists public.unit_notification_reads (
  notification_id uuid not null references public.unit_notifications (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, profile_id)
);

create index if not exists unit_notifications_target_profile_idx
  on public.unit_notifications (target_profile_id, created_at desc);

create index if not exists unit_notifications_target_condo_idx
  on public.unit_notifications (target_condominium_id, created_at desc);

create index if not exists unit_notifications_source_condo_idx
  on public.unit_notifications (source_condominium_id, created_at desc);

drop trigger if exists unit_notifications_set_updated_at on public.unit_notifications;
create trigger unit_notifications_set_updated_at
before update on public.unit_notifications
for each row execute function public.set_updated_at();

alter table public.unit_notifications enable row level security;
alter table public.unit_notification_reads enable row level security;

create or replace function public.unit_notification_unit_condominium_id(p_unit_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select t.condominium_id
  from public.units u
  inner join public.towers t on t.id = u.tower_id
  where u.id = p_unit_id;
$$;

drop policy if exists "unit_notifications_select" on public.unit_notifications;
create policy "unit_notifications_select"
on public.unit_notifications
for select
to authenticated
using (
  target_profile_id = auth.uid()
  or public.is_condo_staff(source_condominium_id)
  or public.is_condo_staff(target_condominium_id)
);

drop policy if exists "unit_notifications_insert" on public.unit_notifications;
create policy "unit_notifications_insert"
on public.unit_notifications
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_condo_staff(source_condominium_id)
  and target_profile_id is not null
  and public.unit_notification_unit_condominium_id(target_unit_id) = target_condominium_id
  and (
    (
      public.granja_condominium_id() is not null
      and source_condominium_id = public.granja_condominium_id()
      and target_condominium_id <> public.granja_condominium_id()
    )
    or (
      source_condominium_id = target_condominium_id
      and (
        public.granja_condominium_id() is null
        or source_condominium_id <> public.granja_condominium_id()
      )
    )
  )
);

drop policy if exists "unit_notification_reads_select" on public.unit_notification_reads;
create policy "unit_notification_reads_select"
on public.unit_notification_reads
for select
to authenticated
using (
  profile_id = auth.uid()
  or exists (
    select 1
    from public.unit_notifications n
    where n.id = notification_id
      and (
        public.is_condo_staff(n.source_condominium_id)
        or public.is_condo_staff(n.target_condominium_id)
      )
  )
);

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
      and n.target_profile_id = auth.uid()
  )
);
