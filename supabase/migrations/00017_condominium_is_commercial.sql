-- =============================================================================
-- Condomínio comercial (espaço comercial)
-- =============================================================================

alter table public.condominiums
  add column if not exists is_commercial boolean not null default false;
