-- Permite várias solicitações na fila (uma pendente por e-mail + condomínio, não por perfil).

drop index if exists public.registration_requests_one_pending_per_profile_condo;

create unique index registration_requests_one_pending_per_email_condo
  on public.registration_requests (condominium_id, lower(trim(email)))
  where (status = 'pending');
