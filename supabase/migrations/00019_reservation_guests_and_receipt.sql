-- =============================================================================
-- Passo 1/2 — novo status de reserva (execute e confirme antes do 00020)
-- PostgreSQL exige COMMIT antes de usar o novo valor do enum.
-- =============================================================================

alter type public.reservation_status add value if not exists 'awaiting_receipt';
