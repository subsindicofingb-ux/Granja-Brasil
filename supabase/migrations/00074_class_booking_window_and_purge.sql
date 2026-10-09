-- =============================================================================
-- Aulas: janela de 12h para abrir reservas, confirmação até o início
-- e limpeza do histórico ao término de cada aula.
-- =============================================================================

update public.common_areas
set
  max_advance_days = null,
  description = replace(
    coalesce(description, ''),
    'A participação deve ser confirmada por reserva com até 12 horas de antecedência do horário da aula.',
    'As reservas abrem 12 horas antes da aula. Com vaga, a confirmação pode ser feita até o início. Após o término, a lista é limpa para a próxima turma.'
  )
where booking_mode = 'class';

create or replace function public.purge_ended_class_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.reservations r
  using public.common_areas ca
  where r.common_area_id = ca.id
    and ca.booking_mode = 'class'
    and r.end_at <= now();

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

comment on function public.purge_ended_class_reservations() is
  'Remove reservas de aula cujo horário já terminou, para rotatividade da lista de presença.';

revoke all on function public.purge_ended_class_reservations() from public;
grant execute on function public.purge_ended_class_reservations() to authenticated;
grant execute on function public.purge_ended_class_reservations() to service_role;
