-- =============================================================================
-- Avisos: destino (condomínio / morador) e confirmação de leitura
-- =============================================================================

alter table public.announcements
  add column if not exists target_condominium_id uuid references public.condominiums (id) on delete set null,
  add column if not exists target_profile_id uuid references public.profiles (id) on delete set null;

create index if not exists announcements_target_condominium_id_idx
  on public.announcements (target_condominium_id)
  where target_condominium_id is not null;

create index if not exists announcements_target_profile_id_idx
  on public.announcements (target_profile_id)
  where target_profile_id is not null;

create table if not exists public.announcement_reads (
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default timezone('utc', now()),
  primary key (announcement_id, profile_id)
);

create index if not exists announcement_reads_profile_id_idx
  on public.announcement_reads (profile_id);

alter table public.announcement_reads enable row level security;

create policy "announcement_reads_select"
on public.announcement_reads
for select
to authenticated
using (
  profile_id = auth.uid()
  or public.is_super_admin()
  or exists (
    select 1
    from public.announcements a
    where a.id = announcement_id
      and public.is_condo_staff(a.condominium_id)
  )
);

create policy "announcement_reads_insert_own"
on public.announcement_reads
for insert
to authenticated
with check (profile_id = auth.uid());

create policy "announcement_reads_update_own"
on public.announcement_reads
for update
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create or replace function public.is_announcement_visible_to_profile(p_announcement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.announcements a
    where a.id = p_announcement_id
      and public.is_announcement_visible_to_members(
        a.publication_status,
        a.published_at,
        a.expires_at
      )
      and (
        a.target_profile_id is null
        or a.target_profile_id = auth.uid()
      )
      and (
        exists (
          select 1
          from public.memberships m
          where m.profile_id = auth.uid()
            and m.condominium_id = a.condominium_id
            and a.target_condominium_id is null
            and a.condominium_id <> public.granja_condominium_id()
        )
        or exists (
          select 1
          from public.memberships m
          where m.profile_id = auth.uid()
            and a.condominium_id = public.granja_condominium_id()
            and (
              a.target_condominium_id is null
              or a.target_condominium_id = m.condominium_id
            )
        )
        or exists (
          select 1
          from public.memberships m
          where m.profile_id = auth.uid()
            and m.condominium_id = a.target_condominium_id
            and a.target_condominium_id is not null
            and a.condominium_id = public.granja_condominium_id()
        )
      )
  );
$$;

grant execute on function public.is_announcement_visible_to_profile(uuid) to authenticated;

drop policy if exists "announcements_select_staff" on public.announcements;

create policy "announcements_select_staff"
on public.announcements
for select
to authenticated
using (
  public.is_condo_staff(condominium_id)
  or (
    public.granja_condominium_id() is not null
    and condominium_id = public.granja_condominium_id()
    and exists (
      select 1
      from public.memberships m
      where m.profile_id = auth.uid()
        and public.is_condo_staff(m.condominium_id)
        and m.condominium_id <> public.granja_condominium_id()
        and (
          target_condominium_id is null
          or target_condominium_id = m.condominium_id
        )
        and target_profile_id is null
    )
  )
);

drop policy if exists "announcements_select_members" on public.announcements;

create policy "announcements_select_members"
on public.announcements
for select
to authenticated
using (
  (
    public.is_condo_member(condominium_id)
    or public.is_condo_doorman(condominium_id)
    or (
      public.granja_condominium_id() is not null
      and exists (
        select 1
        from public.memberships m
        where m.profile_id = auth.uid()
          and (
            target_condominium_id is null
            or target_condominium_id = m.condominium_id
          )
      )
      and condominium_id = public.granja_condominium_id()
    )
  )
  and not public.is_condo_staff(condominium_id)
  and public.is_announcement_visible_to_profile(id)
);
