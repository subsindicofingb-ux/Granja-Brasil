-- Limpeza completa de mensagens do app (avisos, Fale com condomínio, respostas e notificações)
-- Execute manualmente no SQL Editor do Supabase antes do teste final.
-- ATENÇÃO: remove TODAS as mensagens; não há como desfazer.

begin;

delete from public.announcement_reads;
delete from public.announcements;

delete from public.unit_notification_reads;
delete from public.unit_notification_replies;
delete from public.unit_notifications;

commit;

-- Conferência
select
  (select count(*) from public.announcements) as avisos_restantes,
  (select count(*) from public.announcement_reads) as leituras_restantes,
  (select count(*) from public.unit_notifications) as notificacoes_restantes,
  (select count(*) from public.unit_notification_replies) as respostas_notificacao_restantes;
