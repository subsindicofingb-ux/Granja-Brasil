-- Correspondência: destinatário nomeado, fallback ao responsável e portaria Granja.

alter table public.correspondence_notices
  add column if not exists recipient_name text,
  add column if not exists notified_via_responsible boolean not null default false;

create index if not exists correspondence_notices_target_profile_idx
  on public.correspondence_notices (target_profile_id, created_at desc)
  where picked_up_at is null;

drop policy if exists "correspondence_notices_select" on public.correspondence_notices;
create policy "correspondence_notices_select"
on public.correspondence_notices
for select
to authenticated
using (
  target_profile_id = auth.uid()
  or public.is_condo_doorman(condominium_id)
  or public.is_condo_staff(condominium_id)
  or (
    public.granja_condominium_id() is not null
    and public.is_condo_doorman(public.granja_condominium_id())
    and condominium_id <> public.granja_condominium_id()
  )
);

drop policy if exists "correspondence_notices_insert" on public.correspondence_notices;
create policy "correspondence_notices_insert"
on public.correspondence_notices
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.condominium_id_for_unit(unit_id) = condominium_id
  and (
    public.is_condo_doorman(condominium_id)
    or (
      public.granja_condominium_id() is not null
      and public.is_condo_doorman(public.granja_condominium_id())
      and condominium_id <> public.granja_condominium_id()
    )
  )
);

drop policy if exists "correspondence_notices_update" on public.correspondence_notices;
create policy "correspondence_notices_update"
on public.correspondence_notices
for update
to authenticated
using (
  public.is_condo_doorman(condominium_id)
  or public.is_condo_staff(condominium_id)
  or target_profile_id = auth.uid()
  or (
    public.granja_condominium_id() is not null
    and public.is_condo_doorman(public.granja_condominium_id())
    and condominium_id <> public.granja_condominium_id()
  )
)
with check (
  public.condominium_id_for_unit(unit_id) = condominium_id
);
