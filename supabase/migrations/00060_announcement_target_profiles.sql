-- =============================================================================
-- Avisos: destino para múltiplos moradores
-- =============================================================================

create table if not exists public.announcement_target_profiles (
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (announcement_id, profile_id)
);

create index if not exists announcement_target_profiles_profile_idx
  on public.announcement_target_profiles (profile_id);

insert into public.announcement_target_profiles (announcement_id, profile_id)
select id, target_profile_id
from public.announcements
where target_profile_id is not null
on conflict do nothing;

alter table public.announcement_target_profiles enable row level security;

drop policy if exists "announcement_target_profiles_select" on public.announcement_target_profiles;

create policy "announcement_target_profiles_select"
on public.announcement_target_profiles
for select
to authenticated
using (
  profile_id = auth.uid()
  or public.is_condo_staff(
    (select condominium_id from public.announcements where id = announcement_id)
  )
  or exists (
    select 1
    from public.announcements a
    where a.id = announcement_id
      and public.granja_condominium_id() is not null
      and a.condominium_id = public.granja_condominium_id()
      and public.is_condo_staff(public.granja_condominium_id())
  )
);

drop policy if exists "announcement_target_profiles_manage" on public.announcement_target_profiles;

create policy "announcement_target_profiles_manage"
on public.announcement_target_profiles
for all
to authenticated
using (
  public.is_condo_staff(
    (select condominium_id from public.announcements where id = announcement_id)
  )
  or (
    public.granja_condominium_id() is not null
    and exists (
      select 1
      from public.announcements a
      where a.id = announcement_id
        and a.condominium_id = public.granja_condominium_id()
        and public.is_condo_staff(public.granja_condominium_id())
    )
  )
)
with check (
  public.is_condo_staff(
    (select condominium_id from public.announcements where id = announcement_id)
  )
  or (
    public.granja_condominium_id() is not null
    and exists (
      select 1
      from public.announcements a
      where a.id = announcement_id
        and a.condominium_id = public.granja_condominium_id()
        and public.is_condo_staff(public.granja_condominium_id())
    )
  )
);

create or replace function public.announcement_has_target_profiles(p_announcement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.announcement_target_profiles atp
    where atp.announcement_id = p_announcement_id
  )
  or exists (
    select 1
    from public.announcements a
    where a.id = p_announcement_id
      and a.target_profile_id is not null
  );
$$;

create or replace function public.is_announcement_target_profile(
  p_announcement_id uuid,
  p_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.announcements a
    where a.id = p_announcement_id
      and a.target_profile_id = p_profile_id
  )
  or exists (
    select 1
    from public.announcement_target_profiles atp
    where atp.announcement_id = p_announcement_id
      and atp.profile_id = p_profile_id
  );
$$;

create or replace function public.is_announcement_visible_to_profile(p_announcement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
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
        (
          a.staff_only
          and a.created_by = auth.uid()
        )
        or (
          not a.staff_only
          and public.announcement_has_target_profiles(a.id)
          and public.is_announcement_target_profile(a.id, auth.uid())
        )
        or (
          not a.staff_only
          and not public.announcement_has_target_profiles(a.id)
          and a.target_condominium_id is null
          and (
            (
              a.condominium_id is distinct from public.granja_condominium_id()
              and exists (
                select 1
                from public.memberships m
                where m.profile_id = auth.uid()
                  and m.condominium_id = a.condominium_id
                  and m.role in ('resident', 'doorman')
              )
            )
            or (
              a.condominium_id = public.granja_condominium_id()
              and exists (
                select 1
                from public.memberships m
                where m.profile_id = auth.uid()
                  and m.condominium_id is distinct from public.granja_condominium_id()
                  and m.role in ('resident', 'doorman')
              )
            )
          )
        )
      )
  );
$$;

grant execute on function public.announcement_has_target_profiles(uuid) to authenticated;
grant execute on function public.is_announcement_target_profile(uuid, uuid) to authenticated;
