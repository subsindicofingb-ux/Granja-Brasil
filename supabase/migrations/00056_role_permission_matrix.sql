-- Matriz global de permissões por papel (configurável pelo Super Admin)
create table if not exists public.app_permission_matrix (
  id int primary key default 1 check (id = 1),
  matrix jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

insert into public.app_permission_matrix (id, matrix)
values (1, '{}'::jsonb)
on conflict (id) do nothing;

alter table public.app_permission_matrix enable row level security;

drop policy if exists app_permission_matrix_select on public.app_permission_matrix;
create policy app_permission_matrix_select
  on public.app_permission_matrix
  for select
  to authenticated
  using (true);

drop policy if exists app_permission_matrix_write on public.app_permission_matrix;
create policy app_permission_matrix_write
  on public.app_permission_matrix
  for insert
  to authenticated
  with check (public.is_super_admin());

drop policy if exists app_permission_matrix_update on public.app_permission_matrix;
create policy app_permission_matrix_update
  on public.app_permission_matrix
  for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
