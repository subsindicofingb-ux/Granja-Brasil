-- =============================================================================
-- Fix: política INSERT morador + limpeza garantida de mensagens de teste
-- Rode no SQL Editor do Supabase (como postgres / service role).
-- =============================================================================

create or replace function public.is_condo_resident(p_condominium_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select public.has_condo_role(
    p_condominium_id,
    array['resident']::public.membership_role[]
  )
  and not public.is_condo_staff(p_condominium_id);
$$;

create or replace function public.can_insert_resident_announcement(
  p_condominium_id uuid,
  p_target_condominium_id uuid,
  p_target_profile_id uuid,
  p_staff_only boolean,
  p_parent_id uuid,
  p_created_by uuid,
  p_publication_status public.announcement_publication_status
)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select
    p_created_by = auth.uid()
    and p_staff_only is true
    and p_parent_id is null
    and p_publication_status = 'published'::public.announcement_publication_status
    and (
      (
        public.is_condo_resident(p_condominium_id)
        and p_condominium_id is distinct from public.granja_condominium_id()
        and p_target_profile_id is null
        and p_target_condominium_id is null
      )
      or (
        public.granja_condominium_id() is not null
        and p_condominium_id = public.granja_condominium_id()
        and p_target_condominium_id is not null
        and public.is_condo_resident(p_target_condominium_id)
        and p_target_profile_id is null
      )
    );
$$;

grant execute on function public.can_insert_resident_announcement(
  uuid,
  uuid,
  uuid,
  boolean,
  uuid,
  uuid,
  public.announcement_publication_status
) to authenticated;

drop policy if exists "announcements_insert_resident" on public.announcements;

create policy "announcements_insert_resident"
on public.announcements
for insert
to authenticated
with check (
  public.can_insert_resident_announcement(
    condominium_id,
    target_condominium_id,
    target_profile_id,
    staff_only,
    parent_id,
    created_by,
    publication_status
  )
);

-- Limpeza: respostas e mensagens privadas morador/síndico
delete from public.announcement_reads
where announcement_id in (
  select id
  from public.announcements
  where coalesce(staff_only, false) = true
     or parent_id is not null
);

delete from public.announcements
where parent_id is not null;

delete from public.announcements
where coalesce(staff_only, false) = true;
