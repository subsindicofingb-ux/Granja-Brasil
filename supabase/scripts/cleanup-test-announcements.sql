-- Limpeza manual de mensagens de teste (avisos morador/síndico e respostas)
-- Execute no SQL Editor do Supabase.

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

-- Conferência (deve retornar 0 linhas de threads de teste)
select count(*) as respostas_restantes
from public.announcements
where parent_id is not null;

select count(*) as mensagens_privadas_restantes
from public.announcements
where coalesce(staff_only, false) = true;
