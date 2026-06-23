-- =============================================================================
-- Limpeza: mensagens de teste morador/síndico e respostas
-- =============================================================================

delete from public.announcement_reads
where announcement_id in (
  select id
  from public.announcements
  where coalesce(staff_only, false) = true
     or parent_id is not null
     or title ilike 'teste%'
);

delete from public.announcements
where parent_id is not null;

delete from public.announcements
where coalesce(staff_only, false) = true
   or title ilike 'teste%';
