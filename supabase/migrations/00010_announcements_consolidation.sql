-- =============================================================================
-- Avisos — consolidação idempotente (ambientes que aplicaram 00009 parcial)
-- =============================================================================

-- Garante enum/colunas (no-op se 00009 completo já rodou)
do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'announcement_publication_status'
  ) then
    create type public.announcement_publication_status as enum ('draft', 'published');
  end if;
end $$;

alter table public.announcements
  add column if not exists tower_id uuid references public.towers (id) on delete set null,
  add column if not exists publication_status public.announcement_publication_status not null default 'published';

create index if not exists announcements_tower_id_idx
  on public.announcements (tower_id);

create index if not exists announcements_condo_publication_published_idx
  on public.announcements (condominium_id, publication_status, published_at desc);

create index if not exists announcements_condo_tower_idx
  on public.announcements (condominium_id, tower_id)
  where tower_id is not null;

create index if not exists announcements_member_visible_idx
  on public.announcements (condominium_id, published_at desc)
  where publication_status = 'published';

create or replace function public.validate_announcement_tower_condo()
returns trigger
language plpgsql
as $$
begin
  if new.tower_id is not null then
    if not exists (
      select 1
      from public.towers t
      where t.id = new.tower_id
        and t.condominium_id = new.condominium_id
    ) then
      raise exception 'A torre informada não pertence a este condomínio.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists announcements_validate_tower_condo on public.announcements;

create trigger announcements_validate_tower_condo
before insert or update of tower_id, condominium_id on public.announcements
for each row execute function public.validate_announcement_tower_condo();

create or replace function public.is_announcement_visible_to_members(
  p_publication_status public.announcement_publication_status,
  p_published_at timestamptz,
  p_expires_at timestamptz
)
returns boolean
language sql
stable
as $$
  select
    p_publication_status = 'published'::public.announcement_publication_status
    and p_published_at <= timezone('utc', now())
    and (p_expires_at is null or p_expires_at > timezone('utc', now()));
$$;

grant execute on function public.is_announcement_visible_to_members(
  public.announcement_publication_status,
  timestamptz,
  timestamptz
) to authenticated;

drop policy if exists "announcements_select" on public.announcements;
drop policy if exists "announcements_select_staff" on public.announcements;
drop policy if exists "announcements_select_members" on public.announcements;

create policy "announcements_select_staff"
on public.announcements
for select
to authenticated
using (public.is_condo_staff(condominium_id));

create policy "announcements_select_members"
on public.announcements
for select
to authenticated
using (
  (
    public.is_condo_member(condominium_id)
    or public.is_condo_doorman(condominium_id)
  )
  and not public.is_condo_staff(condominium_id)
  and public.is_announcement_visible_to_members(
    publication_status,
    published_at,
    expires_at
  )
);

drop policy if exists "announcements_insert" on public.announcements;
drop policy if exists "announcements_update" on public.announcements;
drop policy if exists "announcements_delete" on public.announcements;

create policy "announcements_insert"
on public.announcements
for insert
to authenticated
with check (public.is_condo_staff(condominium_id));

create policy "announcements_update"
on public.announcements
for update
to authenticated
using (public.is_condo_staff(condominium_id))
with check (public.is_condo_staff(condominium_id));

create policy "announcements_delete"
on public.announcements
for delete
to authenticated
using (public.is_condo_staff(condominium_id));
