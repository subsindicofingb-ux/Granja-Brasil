-- Permite jobs de remoção ControlID sobreviverem à exclusão do morador.

alter table public.access_sync_jobs
  drop constraint if exists access_sync_jobs_resident_id_fkey;

alter table public.access_sync_jobs
  alter column resident_id drop not null;

alter table public.access_sync_jobs
  add constraint access_sync_jobs_resident_id_fkey
  foreign key (resident_id) references public.residents (id) on delete set null;
