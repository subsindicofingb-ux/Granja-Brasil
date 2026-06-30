-- Fase 4 ControlID: fila de sync por aparelho

create type public.access_sync_action as enum (
  'create',
  'update',
  'remove'
);

create type public.access_sync_job_status as enum (
  'pending',
  'processing',
  'completed',
  'error'
);

alter table public.resident_access_grants
  add column if not exists controlid_user_id bigint,
  add column if not exists controlid_registration text,
  add column if not exists synced_at timestamptz;

create index resident_access_grants_controlid_registration_idx
  on public.resident_access_grants (controlid_registration);

create table public.access_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references public.residents (id) on delete cascade,
  access_device_id uuid not null references public.access_devices (id) on delete cascade,
  grant_id uuid references public.resident_access_grants (id) on delete set null,
  action public.access_sync_action not null,
  status public.access_sync_job_status not null default 'pending',
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  last_error text,
  controlid_user_id bigint,
  scheduled_at timestamptz not null default timezone('utc', now()),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index access_sync_jobs_status_scheduled_idx
  on public.access_sync_jobs (status, scheduled_at);

create index access_sync_jobs_resident_id_idx
  on public.access_sync_jobs (resident_id);

create unique index access_sync_jobs_pending_unique
  on public.access_sync_jobs (resident_id, access_device_id, action)
  where status in ('pending', 'processing');

create trigger access_sync_jobs_set_updated_at
before update on public.access_sync_jobs
for each row execute function public.set_updated_at();

alter table public.access_sync_jobs enable row level security;

create policy "access_sync_jobs_select"
on public.access_sync_jobs
for select
to authenticated
using (
  exists (
    select 1
    from public.residents r
    join public.units u on u.id = r.unit_id
    join public.towers t on t.id = u.tower_id
    where r.id = access_sync_jobs.resident_id
      and public.is_condo_operational_staff(t.condominium_id)
  )
);
