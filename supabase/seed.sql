-- =============================================================================
-- Seed demo — alinhado ao mock do app (Residencial Exemplo)
-- Executado após migrations via: supabase db reset
-- RLS é ignorado no seed (role postgres).
-- =============================================================================

-- UUIDs fixos para referência no app e testes
-- Condomínio:  a0000000-0000-4000-8000-000000000001
-- Torre A:      a0000000-0000-4000-8000-000000000011
-- Torre B:      a0000000-0000-4000-8000-000000000012
-- Unidade 101:  a0000000-0000-4000-8000-000000000021
-- Unidade 102:  a0000000-0000-4000-8000-000000000022
-- Unidade 201:  a0000000-0000-4000-8000-000000000023

insert into public.condominiums (id, name, slug, created_at)
values (
  'a0000000-0000-4000-8000-000000000001',
  'Residencial Exemplo',
  'residencial-exemplo',
  '2025-01-01 00:00:00+00'
);

insert into public.towers (id, condominium_id, name, floors, created_at)
values
  (
    'a0000000-0000-4000-8000-000000000011',
    'a0000000-0000-4000-8000-000000000001',
    'Torre A',
    12,
    '2025-01-01 00:00:00+00'
  ),
  (
    'a0000000-0000-4000-8000-000000000012',
    'a0000000-0000-4000-8000-000000000001',
    'Torre B',
    10,
    '2025-01-01 00:00:00+00'
  );

insert into public.units (id, tower_id, number, block, created_at)
values
  (
    'a0000000-0000-4000-8000-000000000021',
    'a0000000-0000-4000-8000-000000000011',
    '101',
    'A',
    '2025-01-01 00:00:00+00'
  ),
  (
    'a0000000-0000-4000-8000-000000000022',
    'a0000000-0000-4000-8000-000000000011',
    '102',
    'A',
    '2025-01-01 00:00:00+00'
  ),
  (
    'a0000000-0000-4000-8000-000000000023',
    'a0000000-0000-4000-8000-000000000012',
    '201',
    'B',
    '2025-01-01 00:00:00+00'
  );

insert into public.residents (id, unit_id, profile_id, full_name, email, phone, type, created_at)
values
  (
    'a0000000-0000-4000-8000-000000000031',
    'a0000000-0000-4000-8000-000000000021',
    null,
    'Maria Silva',
    'maria@email.com',
    '(11) 99999-0001',
    'owner',
    '2025-01-01 00:00:00+00'
  ),
  (
    'a0000000-0000-4000-8000-000000000032',
    'a0000000-0000-4000-8000-000000000021',
    null,
    'João Silva',
    'joao@email.com',
    '(11) 99999-0002',
    'dependent',
    '2025-01-01 00:00:00+00'
  ),
  (
    'a0000000-0000-4000-8000-000000000033',
    'a0000000-0000-4000-8000-000000000023',
    null,
    'Ana Costa',
    'ana@email.com',
    '(11) 99999-0003',
    'tenant',
    '2025-01-01 00:00:00+00'
  );

insert into public.common_areas (
  id,
  condominium_id,
  name,
  capacity,
  description,
  is_active,
  requires_approval,
  max_duration_minutes,
  min_advance_minutes,
  max_advance_days,
  max_reservations_per_unit,
  reservation_period_days,
  buffer_minutes,
  operating_hours,
  allowed_days,
  maintenance_blocks,
  rules,
  created_at
)
values
  (
    'a0000000-0000-4000-8000-000000000041',
    'a0000000-0000-4000-8000-000000000001',
    'Salão de festas',
    50,
    'Espaço coberto com cozinha e som ambiente.',
    true,
    true,
    360,
    120,
    90,
    2,
    30,
    30,
    '{"start":"09:00","end":"23:00"}'::jsonb,
    '["fri","sat","sun"]'::jsonb,
    '[]'::jsonb,
    '{}'::jsonb,
    '2025-01-01 00:00:00+00'
  ),
  (
    'a0000000-0000-4000-8000-000000000042',
    'a0000000-0000-4000-8000-000000000001',
    'Churrasqueira',
    20,
    'Área externa com churrasqueira e mesas.',
    true,
    false,
    480,
    60,
    60,
    3,
    30,
    60,
    '{"start":"08:00","end":"22:00"}'::jsonb,
    '["mon","tue","wed","thu","fri","sat","sun"]'::jsonb,
    '[]'::jsonb,
    '{}'::jsonb,
    '2025-01-01 00:00:00+00'
  ),
  (
    'a0000000-0000-4000-8000-000000000043',
    'a0000000-0000-4000-8000-000000000001',
    'Academia',
    15,
    'Academia com equipamentos básicos.',
    true,
    false,
    null,
    0,
    null,
    1,
    7,
    0,
    '{"start":"06:00","end":"22:00"}'::jsonb,
    '["mon","tue","wed","thu","fri","sat","sun"]'::jsonb,
    '[{"title":"Manutenção preventiva","start_at":"2026-07-01T08:00:00Z","end_at":"2026-07-01T18:00:00Z","reason":"Revisão dos equipamentos"}]'::jsonb,
    '{}'::jsonb,
    '2025-01-01 00:00:00+00'
  );

insert into public.reservations (
  id, common_area_id, unit_id, requested_by, start_at, end_at, status, notes, created_at
)
values
  (
    'a0000000-0000-4000-8000-000000000051',
    'a0000000-0000-4000-8000-000000000041',
    'a0000000-0000-4000-8000-000000000021',
    null,
    '2026-06-20 18:00:00+00',
    '2026-06-20 23:00:00+00',
    'approved',
    'Aniversário familiar',
    '2025-06-01 00:00:00+00'
  ),
  (
    'a0000000-0000-4000-8000-000000000052',
    'a0000000-0000-4000-8000-000000000042',
    'a0000000-0000-4000-8000-000000000023',
    null,
    '2026-06-22 12:00:00+00',
    '2026-06-22 18:00:00+00',
    'pending',
    null,
    '2025-06-10 00:00:00+00'
  );

insert into public.announcements (
  id,
  condominium_id,
  tower_id,
  title,
  body,
  priority,
  publication_status,
  published_at,
  expires_at,
  created_by,
  created_at
)
values
  (
    'a0000000-0000-4000-8000-000000000061',
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000011',
    'Manutenção dos elevadores',
    'No dia 25/06 das 8h às 12h a Torre A passará por manutenção preventiva nos elevadores. Pedimos compreensão pelo transtorno.',
    'important',
    'published',
    '2025-06-15 09:00:00+00',
    '2026-06-25 23:59:59+00',
    null,
    '2025-06-15 09:00:00+00'
  ),
  (
    'a0000000-0000-4000-8000-000000000062',
    'a0000000-0000-4000-8000-000000000001',
    null,
    'Horário da piscina no verão',
    'A partir de julho, a piscina funcionará das 7h às 22h. Respeitem as regras de uso e o limite de ocupação.',
    'normal',
    'published',
    '2025-06-01 10:00:00+00',
    null,
    null,
    '2025-06-01 10:00:00+00'
  ),
  (
    'a0000000-0000-4000-8000-000000000063',
    'a0000000-0000-4000-8000-000000000001',
    null,
    'Vaga de garagem — visitante',
    'Unidade 201: favor não utilizar vaga de visitante por período prolongado. Infrações serão notificadas.',
    'urgent',
    'published',
    '2025-06-18 14:00:00+00',
    '2025-07-18 14:00:00+00',
    null,
    '2025-06-18 14:00:00+00'
  );

insert into public.visitor_authorizations (
  id,
  condominium_id,
  unit_id,
  guest_type,
  full_name,
  document_type,
  document_number,
  company_name,
  vehicle_plate,
  access_starts_at,
  access_ends_at,
  status,
  notes,
  doorman_notes,
  requested_by,
  reviewed_by,
  reviewed_at,
  created_at
)
values
  (
    'a0000000-0000-4000-8000-000000000071',
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000021',
    'visitor',
    'Carlos Mendes',
    'RG',
    '12.345.678-9',
    null,
    'ABC1D23',
    '2026-06-16 14:00:00+00',
    '2026-06-16 20:00:00+00',
    'approved',
    'Visita familiar',
    null,
    null,
    null,
    null,
    '2026-06-15 10:00:00+00'
  ),
  (
    'a0000000-0000-4000-8000-000000000072',
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000023',
    'service_provider',
    'Técnico Elevadores Ltda',
    'CPF',
    '987.654.321-0',
    'Técnico Elevadores Ltda',
    null,
    '2026-06-17 08:00:00+00',
    '2026-06-17 12:00:00+00',
    'pending',
    'Manutenção preventiva',
    null,
    null,
    null,
    null,
    '2026-06-16 09:00:00+00'
  ),
  (
    'a0000000-0000-4000-8000-000000000073',
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000022',
    'visitor',
    'Pedro Alves',
    null,
    null,
    null,
    null,
    '2026-06-10 10:00:00+00',
    '2026-06-10 18:00:00+00',
    'approved',
    null,
    'Entrada registrada sem placa.',
    null,
    null,
    null,
    '2026-06-09 15:00:00+00'
  );

-- Bootstrap do primeiro usuário (após /signup):
--   npm run db:link-member -- admin@example.com admin
--   npm run db:link-member -- admin@example.com super_admin
