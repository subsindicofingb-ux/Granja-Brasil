-- =============================================================================
-- Suíte: avisos (announcements) — visibilidade, RLS, integridade e escrita
-- Rodar: npm run db:test   (requer Supabase local: supabase start)
-- =============================================================================

begin;

create extension if not exists pgtap with schema extensions;

-- ---------------------------------------------------------------------------
-- Helpers temporários (rollback ao final do arquivo)
-- ---------------------------------------------------------------------------

create or replace function pg_temp.test_login_as(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', p_user_id::text,
      'role', 'authenticated',
      'aal', 'aal1'
    )::text,
    true
  );
end;
$$;

create or replace function pg_temp.test_reset_auth()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
  reset role;
end;
$$;

create or replace function pg_temp.test_create_auth_user(
  p_id uuid,
  p_email text
)
returns void
language plpgsql
security definer
set search_path = auth, public, extensions
as $$
begin
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values (
    p_id,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    p_email,
    crypt('test-password', gen_salt('bf')),
    timezone('utc', now()),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixtures (IDs prefixo b000… — isolados do seed demo)
-- ---------------------------------------------------------------------------

-- Condomínios e torres
insert into public.condominiums (id, name, slug, created_at)
values
  (
    'b0000000-0000-4000-8000-000000000001',
    'Condomínio Teste Avisos',
    'condominio-teste-avisos',
    timezone('utc', now())
  ),
  (
    'b0000000-0000-4000-8000-000000000002',
    'Condomínio Outro',
    'condominio-outro',
    timezone('utc', now())
  );

insert into public.towers (id, condominium_id, name, floors, created_at)
values
  (
    'b0000000-0000-4000-8000-000000000011',
    'b0000000-0000-4000-8000-000000000001',
    'Torre Teste',
    8,
    timezone('utc', now())
  ),
  (
    'b0000000-0000-4000-8000-000000000021',
    'b0000000-0000-4000-8000-000000000002',
    'Torre Outro Condomínio',
    5,
    timezone('utc', now())
  );

-- Usuários de teste
select pg_temp.test_create_auth_user(
  'b0000000-0000-4000-8000-000000000101',
  'super-admin-avisos@test.local'
);
select pg_temp.test_create_auth_user(
  'b0000000-0000-4000-8000-000000000102',
  'admin-avisos@test.local'
);
select pg_temp.test_create_auth_user(
  'b0000000-0000-4000-8000-000000000103',
  'syndic-avisos@test.local'
);
select pg_temp.test_create_auth_user(
  'b0000000-0000-4000-8000-000000000104',
  'doorman-avisos@test.local'
);
select pg_temp.test_create_auth_user(
  'b0000000-0000-4000-8000-000000000105',
  'resident-avisos@test.local'
);

insert into public.profiles (id, full_name, created_at, updated_at)
values
  ('b0000000-0000-4000-8000-000000000101', 'Super Admin Teste', timezone('utc', now()), timezone('utc', now())),
  ('b0000000-0000-4000-8000-000000000102', 'Admin Teste', timezone('utc', now()), timezone('utc', now())),
  ('b0000000-0000-4000-8000-000000000103', 'Síndico Teste', timezone('utc', now()), timezone('utc', now())),
  ('b0000000-0000-4000-8000-000000000104', 'Portaria Teste', timezone('utc', now()), timezone('utc', now())),
  ('b0000000-0000-4000-8000-000000000105', 'Morador Teste', timezone('utc', now()), timezone('utc', now()))
on conflict (id) do nothing;

insert into public.memberships (profile_id, condominium_id, role, created_at, updated_at)
values
  ('b0000000-0000-4000-8000-000000000101', 'b0000000-0000-4000-8000-000000000001', 'super_admin', timezone('utc', now()), timezone('utc', now())),
  ('b0000000-0000-4000-8000-000000000102', 'b0000000-0000-4000-8000-000000000001', 'admin', timezone('utc', now()), timezone('utc', now())),
  ('b0000000-0000-4000-8000-000000000103', 'b0000000-0000-4000-8000-000000000001', 'syndic', timezone('utc', now()), timezone('utc', now())),
  ('b0000000-0000-4000-8000-000000000104', 'b0000000-0000-4000-8000-000000000001', 'doorman', timezone('utc', now()), timezone('utc', now())),
  ('b0000000-0000-4000-8000-000000000105', 'b0000000-0000-4000-8000-000000000001', 'resident', timezone('utc', now()), timezone('utc', now()))
on conflict (profile_id, condominium_id) do nothing;

-- Avisos: rascunho, agendado, expirado, vigente
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
  created_at,
  updated_at
)
values
  (
    'b0000000-0000-4000-8000-000000000301',
    'b0000000-0000-4000-8000-000000000001',
    null,
    'Rascunho interno',
    'Conteúdo rascunho.',
    'normal',
    'draft',
    timezone('utc', now()) - interval '1 day',
    null,
    'b0000000-0000-4000-8000-000000000103',
    timezone('utc', now()),
    timezone('utc', now())
  ),
  (
    'b0000000-0000-4000-8000-000000000302',
    'b0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000011',
    'Aviso agendado',
    'Publicação futura.',
    'important',
    'published',
    timezone('utc', now()) + interval '7 days',
    null,
    'b0000000-0000-4000-8000-000000000103',
    timezone('utc', now()),
    timezone('utc', now())
  ),
  (
    'b0000000-0000-4000-8000-000000000303',
    'b0000000-0000-4000-8000-000000000001',
    null,
    'Aviso expirado',
    'Já passou do prazo.',
    'normal',
    'published',
    timezone('utc', now()) - interval '30 days',
    timezone('utc', now()) - interval '1 day',
    'b0000000-0000-4000-8000-000000000103',
    timezone('utc', now()),
    timezone('utc', now())
  ),
  (
    'b0000000-0000-4000-8000-000000000304',
    'b0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000011',
    'Aviso vigente',
    'Visível para moradores.',
    'urgent',
    'published',
    timezone('utc', now()) - interval '1 day',
    timezone('utc', now()) + interval '30 days',
    'b0000000-0000-4000-8000-000000000103',
    timezone('utc', now()),
    timezone('utc', now())
  );

-- ---------------------------------------------------------------------------
-- Plano de testes (22 asserções)
-- ---------------------------------------------------------------------------

select plan(20);

-- === Função is_announcement_visible_to_members =============================

select ok(
  not public.is_announcement_visible_to_members(
    'draft'::public.announcement_publication_status,
    timezone('utc', now()) - interval '1 day',
    null
  ),
  'visibility: rascunho não é visível'
);

select ok(
  not public.is_announcement_visible_to_members(
    'published'::public.announcement_publication_status,
    timezone('utc', now()) + interval '1 day',
    null
  ),
  'visibility: agendado (published_at futuro) não é visível'
);

select ok(
  not public.is_announcement_visible_to_members(
    'published'::public.announcement_publication_status,
    timezone('utc', now()) - interval '10 days',
    timezone('utc', now()) - interval '1 hour'
  ),
  'visibility: expirado não é visível'
);

select ok(
  public.is_announcement_visible_to_members(
    'published'::public.announcement_publication_status,
    timezone('utc', now()) - interval '1 day',
    timezone('utc', now()) + interval '30 days'
  ),
  'visibility: publicado vigente é visível'
);

select ok(
  public.is_announcement_visible_to_members(
    'published'::public.announcement_publication_status,
    timezone('utc', now()) - interval '1 hour',
    null
  ),
  'visibility: publicado sem expiração é visível'
);

-- === RLS SELECT — staff vê os 4 avisos ====================================

select pg_temp.test_login_as('b0000000-0000-4000-8000-000000000101');
select results_eq(
  $$select count(*)::bigint from public.announcements
    where condominium_id = 'b0000000-0000-4000-8000-000000000001'$$,
  ARRAY[4::bigint],
  'RLS: super_admin vê todos os avisos'
);
select pg_temp.test_reset_auth();

select pg_temp.test_login_as('b0000000-0000-4000-8000-000000000102');
select results_eq(
  $$select count(*)::bigint from public.announcements
    where condominium_id = 'b0000000-0000-4000-8000-000000000001'$$,
  ARRAY[4::bigint],
  'RLS: admin vê todos os avisos'
);
select pg_temp.test_reset_auth();

select pg_temp.test_login_as('b0000000-0000-4000-8000-000000000103');
select results_eq(
  $$select count(*)::bigint from public.announcements
    where condominium_id = 'b0000000-0000-4000-8000-000000000001'$$,
  ARRAY[4::bigint],
  'RLS: syndic vê todos os avisos'
);
select pg_temp.test_reset_auth();

-- === RLS SELECT — não-staff vê só o vigente ================================

select pg_temp.test_login_as('b0000000-0000-4000-8000-000000000104');
select results_eq(
  $$select count(*)::bigint from public.announcements
    where condominium_id = 'b0000000-0000-4000-8000-000000000001'$$,
  ARRAY[1::bigint],
  'RLS: portaria vê apenas avisos visíveis'
);
select pg_temp.test_reset_auth();

select pg_temp.test_login_as('b0000000-0000-4000-8000-000000000105');
select results_eq(
  $$select count(*)::bigint from public.announcements
    where condominium_id = 'b0000000-0000-4000-8000-000000000001'$$,
  ARRAY[1::bigint],
  'RLS: morador vê apenas avisos visíveis'
);
select pg_temp.test_reset_auth();

-- === RLS SELECT — casos explícitos (morador) ================================

select pg_temp.test_login_as('b0000000-0000-4000-8000-000000000105');

select results_eq(
  $$select count(*)::bigint from public.announcements
    where id = 'b0000000-0000-4000-8000-000000000301'$$,
  ARRAY[0::bigint],
  'RLS: morador não vê rascunho'
);

select results_eq(
  $$select count(*)::bigint from public.announcements
    where id = 'b0000000-0000-4000-8000-000000000302'$$,
  ARRAY[0::bigint],
  'RLS: morador não vê aviso agendado'
);

select results_eq(
  $$select count(*)::bigint from public.announcements
    where id = 'b0000000-0000-4000-8000-000000000303'$$,
  ARRAY[0::bigint],
  'RLS: morador não vê aviso expirado'
);

select results_eq(
  $$select count(*)::bigint from public.announcements
    where id = 'b0000000-0000-4000-8000-000000000304'$$,
  ARRAY[1::bigint],
  'RLS: morador vê aviso publicado vigente'
);

select pg_temp.test_reset_auth();

-- === Integridade torre × condomínio ========================================

select throws_ok(
  $$
    insert into public.announcements (
      condominium_id,
      tower_id,
      title,
      body,
      priority,
      publication_status,
      published_at
    )
    values (
      'b0000000-0000-4000-8000-000000000001',
      'b0000000-0000-4000-8000-000000000021',
      'Torre errada',
      'Deve falhar.',
      'normal',
      'draft',
      timezone('utc', now())
    )
  $$,
  'P0001',
  'A torre informada não pertence a este condomínio.',
  'integridade: torre de outro condomínio é rejeitada'
);

-- === RLS INSERT/UPDATE — bloqueio para não-staff ===========================

select pg_temp.test_login_as('b0000000-0000-4000-8000-000000000105');

select throws_ok(
  $$
    insert into public.announcements (
      condominium_id,
      title,
      body,
      priority,
      publication_status,
      published_at,
      created_by
    )
    values (
      'b0000000-0000-4000-8000-000000000001',
      'Tentativa morador',
      'Não deve gravar.',
      'normal',
      'published',
      timezone('utc', now()),
      'b0000000-0000-4000-8000-000000000105'
    )
  $$,
  '42501',
  null,
  'RLS: morador não pode inserir aviso'
);

select pg_temp.test_reset_auth();

select pg_temp.test_login_as('b0000000-0000-4000-8000-000000000104');

select results_eq(
  $$with upd as (
      update public.announcements
      set title = 'Portaria tentou editar'
      where id = 'b0000000-0000-4000-8000-000000000304'
      returning id
    )
    select count(*)::bigint from upd$$,
  ARRAY[0::bigint],
  'RLS: portaria não pode atualizar aviso'
);

select pg_temp.test_reset_auth();

-- === RLS INSERT/UPDATE — permitido para staff ==============================

select pg_temp.test_login_as('b0000000-0000-4000-8000-000000000103');

select lives_ok(
  $$
    insert into public.announcements (
      id,
      condominium_id,
      title,
      body,
      priority,
      publication_status,
      published_at,
      created_by
    )
    values (
      'b0000000-0000-4000-8000-000000000401',
      'b0000000-0000-4000-8000-000000000001',
      'Novo pelo síndico',
      'Insert permitido.',
      'normal',
      'draft',
      timezone('utc', now()),
      'b0000000-0000-4000-8000-000000000103'
    )
  $$,
  'RLS: syndic pode inserir aviso'
);

select lives_ok(
  $$
    update public.announcements
    set body = 'Atualizado pelo admin'
    where id = 'b0000000-0000-4000-8000-000000000304'
  $$,
  'RLS: staff autenticado (syndic) pode atualizar aviso'
);

select pg_temp.test_reset_auth();

select pg_temp.test_login_as('b0000000-0000-4000-8000-000000000102');

select lives_ok(
  $$
    update public.announcements
    set priority = 'important'
    where id = 'b0000000-0000-4000-8000-000000000304'
  $$,
  'RLS: admin pode atualizar aviso'
);

select pg_temp.test_reset_auth();

select * from finish();

rollback;
