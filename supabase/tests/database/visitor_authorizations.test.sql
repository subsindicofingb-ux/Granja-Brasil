-- =============================================================================
-- Suíte: visitantes (visitor_authorizations) — janela portaria, RLS, integridade
-- Rodar: npm run db:test   (requer Supabase local: supabase start)
-- =============================================================================

begin;

create extension if not exists pgtap with schema extensions;

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
-- Fixtures (IDs prefixo c000…)
-- ---------------------------------------------------------------------------

insert into public.condominiums (id, name, slug, created_at)
values (
  'c0000000-0000-4000-8000-000000000001',
  'Condomínio Teste Visitantes',
  'condominio-teste-visitantes',
  timezone('utc', now())
);

insert into public.towers (id, condominium_id, name, floors, created_at)
values (
  'c0000000-0000-4000-8000-000000000011',
  'c0000000-0000-4000-8000-000000000001',
  'Torre Visitantes',
  8,
  timezone('utc', now())
);

insert into public.units (id, tower_id, number, block, created_at)
values
  (
    'c0000000-0000-4000-8000-000000000021',
    'c0000000-0000-4000-8000-000000000011',
    '101',
    'A',
    timezone('utc', now())
  ),
  (
    'c0000000-0000-4000-8000-000000000022',
    'c0000000-0000-4000-8000-000000000011',
    '102',
    'A',
    timezone('utc', now())
  );

select pg_temp.test_create_auth_user(
  'c0000000-0000-4000-8000-000000000101',
  'admin-visitantes@test.local'
);
select pg_temp.test_create_auth_user(
  'c0000000-0000-4000-8000-000000000102',
  'doorman-visitantes@test.local'
);
select pg_temp.test_create_auth_user(
  'c0000000-0000-4000-8000-000000000103',
  'resident-visitantes@test.local'
);

insert into public.profiles (id, full_name, created_at, updated_at)
values
  ('c0000000-0000-4000-8000-000000000101', 'Admin Visitantes', timezone('utc', now()), timezone('utc', now())),
  ('c0000000-0000-4000-8000-000000000102', 'Portaria Visitantes', timezone('utc', now()), timezone('utc', now())),
  ('c0000000-0000-4000-8000-000000000103', 'Morador Visitantes', timezone('utc', now()), timezone('utc', now()))
on conflict (id) do nothing;

insert into public.memberships (profile_id, condominium_id, role, created_at, updated_at)
values
  ('c0000000-0000-4000-8000-000000000101', 'c0000000-0000-4000-8000-000000000001', 'admin', timezone('utc', now()), timezone('utc', now())),
  ('c0000000-0000-4000-8000-000000000102', 'c0000000-0000-4000-8000-000000000001', 'doorman', timezone('utc', now()), timezone('utc', now())),
  ('c0000000-0000-4000-8000-000000000103', 'c0000000-0000-4000-8000-000000000001', 'resident', timezone('utc', now()), timezone('utc', now()))
on conflict (profile_id, condominium_id) do nothing;

insert into public.residents (id, unit_id, profile_id, full_name, email, type, created_at)
values (
  'c0000000-0000-4000-8000-000000000031',
  'c0000000-0000-4000-8000-000000000021',
  'c0000000-0000-4000-8000-000000000103',
  'Morador Visitantes',
  'resident-visitantes@test.local',
  'owner',
  timezone('utc', now())
);

insert into public.visitor_authorizations (
  id,
  condominium_id,
  unit_id,
  guest_type,
  full_name,
  access_starts_at,
  access_ends_at,
  status,
  created_at
)
values
  (
    'c0000000-0000-4000-8000-000000000301',
    'c0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000021',
    'visitor',
    'Visitante unidade 101',
    timezone('utc', now()) - interval '2 hours',
    timezone('utc', now()) + interval '4 hours',
    'approved',
    timezone('utc', now())
  ),
  (
    'c0000000-0000-4000-8000-000000000302',
    'c0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000022',
    'visitor',
    'Visitante unidade 102',
    timezone('utc', now()) + interval '1 day',
    timezone('utc', now()) + interval '1 day 4 hours',
    'pending',
    timezone('utc', now())
  ),
  (
    'c0000000-0000-4000-8000-000000000303',
    'c0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000021',
    'service_provider',
    'Prestador expirado',
    timezone('utc', now()) - interval '5 days',
    timezone('utc', now()) - interval '4 days',
    'approved',
    timezone('utc', now())
  );

-- ---------------------------------------------------------------------------
-- Plano de testes (20 asserções)
-- ---------------------------------------------------------------------------

select plan(20);

-- === Função is_visitor_in_doorman_consult_window ===========================

select ok(
  public.is_visitor_in_doorman_consult_window(
    timezone('utc', now()) - interval '2 hours',
    timezone('utc', now()) + interval '2 hours'
  ),
  'janela: acesso vigente hoje intersecta ±1 dia'
);

select ok(
  public.is_visitor_in_doorman_consult_window(
    timezone('utc', now()) + interval '12 hours',
    timezone('utc', now()) + interval '18 hours'
  ),
  'janela: acesso amanhã intersecta ±1 dia'
);

select ok(
  not public.is_visitor_in_doorman_consult_window(
    timezone('utc', now()) - interval '5 days',
    timezone('utc', now()) - interval '4 days'
  ),
  'janela: acesso há 5 dias não intersecta ±1 dia'
);

-- === RLS SELECT =============================================================

select pg_temp.test_login_as('c0000000-0000-4000-8000-000000000101');

select results_eq(
  $$select count(*)::bigint from public.visitor_authorizations
    where condominium_id = 'c0000000-0000-4000-8000-000000000001'$$,
  ARRAY[3::bigint],
  'RLS: admin vê todas as autorizações do condomínio'
);

select pg_temp.test_reset_auth();
select pg_temp.test_login_as('c0000000-0000-4000-8000-000000000102');

select results_eq(
  $$select count(*)::bigint from public.visitor_authorizations
    where condominium_id = 'c0000000-0000-4000-8000-000000000001'$$,
  ARRAY[3::bigint],
  'RLS: portaria vê todas as autorizações do condomínio'
);

select pg_temp.test_reset_auth();
select pg_temp.test_login_as('c0000000-0000-4000-8000-000000000103');

select results_eq(
  $$select count(*)::bigint from public.visitor_authorizations
    where id = 'c0000000-0000-4000-8000-000000000301'$$,
  ARRAY[1::bigint],
  'RLS: morador vê autorização da própria unidade'
);

select results_eq(
  $$select count(*)::bigint from public.visitor_authorizations
    where id = 'c0000000-0000-4000-8000-000000000302'$$,
  ARRAY[0::bigint],
  'RLS: morador não vê autorização de outra unidade'
);

select pg_temp.test_reset_auth();

-- === Integridade unidade × condomínio ======================================

select throws_ok(
  $$
    insert into public.visitor_authorizations (
      condominium_id,
      unit_id,
      guest_type,
      full_name,
      access_starts_at,
      access_ends_at,
      status
    )
    values (
      'c0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000021',
      'visitor',
      'Unidade errada',
      timezone('utc', now()),
      timezone('utc', now()) + interval '2 hours',
      'pending'
    )
  $$,
  'P0001',
  'A unidade informada não pertence a este condomínio.',
  'integridade: unidade de outro condomínio é rejeitada'
);

select throws_ok(
  $$
    insert into public.visitor_authorizations (
      condominium_id,
      unit_id,
      guest_type,
      full_name,
      company_name,
      access_starts_at,
      access_ends_at,
      status
    )
    values (
      'c0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000021',
      'visitor',
      'Visitante com empresa',
      'Empresa X',
      timezone('utc', now()),
      timezone('utc', now()) + interval '2 hours',
      'pending'
    )
  $$,
  '23514',
  null,
  'integridade: visitante não pode ter company_name'
);

-- === RLS INSERT ==============================================================

select pg_temp.test_login_as('c0000000-0000-4000-8000-000000000103');

select lives_ok(
  $$
    insert into public.visitor_authorizations (
      id,
      condominium_id,
      unit_id,
      guest_type,
      full_name,
      access_starts_at,
      access_ends_at,
      status,
      requested_by
    )
    values (
      'c0000000-0000-4000-8000-000000000401',
      'c0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000021',
      'visitor',
      'Novo visitante morador',
      timezone('utc', now()) + interval '1 day',
      timezone('utc', now()) + interval '1 day 2 hours',
      'pending',
      'c0000000-0000-4000-8000-000000000103'
    )
  $$,
  'RLS: morador insere autorização pending na própria unidade'
);

select throws_ok(
  $$
    insert into public.visitor_authorizations (
      condominium_id,
      unit_id,
      guest_type,
      full_name,
      access_starts_at,
      access_ends_at,
      status,
      requested_by
    )
    values (
      'c0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000022',
      'visitor',
      'Tentativa outra unidade',
      timezone('utc', now()),
      timezone('utc', now()) + interval '2 hours',
      'pending',
      'c0000000-0000-4000-8000-000000000103'
    )
  $$,
  '42501',
  null,
  'RLS: morador não insere em unidade alheia'
);

select pg_temp.test_reset_auth();
select pg_temp.test_login_as('c0000000-0000-4000-8000-000000000101');

select lives_ok(
  $$
    insert into public.visitor_authorizations (
      id,
      condominium_id,
      unit_id,
      guest_type,
      full_name,
      access_starts_at,
      access_ends_at,
      status,
      requested_by,
      reviewed_by,
      reviewed_at
    )
    values (
      'c0000000-0000-4000-8000-000000000402',
      'c0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000022',
      'service_provider',
      'Prestador staff',
      timezone('utc', now()),
      timezone('utc', now()) + interval '3 hours',
      'approved',
      'c0000000-0000-4000-8000-000000000101',
      'c0000000-0000-4000-8000-000000000101',
      timezone('utc', now())
    )
  $$,
  'RLS: staff insere autorização approved em qualquer unidade'
);

select pg_temp.test_reset_auth();

-- === RLS UPDATE — morador cancela ===========================================

select pg_temp.test_login_as('c0000000-0000-4000-8000-000000000103');

select results_eq(
  $$
    with updated as (
      update public.visitor_authorizations
      set status = 'cancelled'
      where id = 'c0000000-0000-4000-8000-000000000301'
      returning id
    )
    select count(*)::bigint from updated
  $$,
  ARRAY[1::bigint],
  'RLS: morador cancela autorização approved da própria unidade'
);

select pg_temp.test_reset_auth();

-- === RLS UPDATE — portaria notas (sem mudar status) =========================

select pg_temp.test_login_as('c0000000-0000-4000-8000-000000000102');

select results_eq(
  $$
    with updated as (
      update public.visitor_authorizations
      set doorman_notes = 'Orientado ao elevador social.'
      where id = 'c0000000-0000-4000-8000-000000000302'
      returning id
    )
    select count(*)::bigint from updated
  $$,
  ARRAY[1::bigint],
  'RLS: portaria atualiza doorman_notes'
);

select results_eq(
  $$
    with updated as (
      update public.visitor_authorizations
      set status = 'approved'
      where id = 'c0000000-0000-4000-8000-000000000302'
      returning id
    )
    select count(*)::bigint from updated
  $$,
  ARRAY[0::bigint],
  'RLS: portaria não altera status (approve)'
);

select pg_temp.test_reset_auth();

-- === RLS UPDATE — staff aprova ==============================================

select pg_temp.test_login_as('c0000000-0000-4000-8000-000000000101');

select results_eq(
  $$
    with updated as (
      update public.visitor_authorizations
      set
        status = 'approved',
        reviewed_by = 'c0000000-0000-4000-8000-000000000101',
        reviewed_at = timezone('utc', now())
      where id = 'c0000000-0000-4000-8000-000000000302'
      returning id
    )
    select count(*)::bigint from updated
  $$,
  ARRAY[1::bigint],
  'RLS: staff aprova autorização pending'
);

select pg_temp.test_reset_auth();

-- === RLS DELETE — somente staff =============================================

select pg_temp.test_login_as('c0000000-0000-4000-8000-000000000103');

select results_eq(
  $$
    with deleted as (
      delete from public.visitor_authorizations
      where id = 'c0000000-0000-4000-8000-000000000303'
      returning id
    )
    select count(*)::bigint from deleted
  $$,
  ARRAY[0::bigint],
  'RLS: morador não pode deletar autorização'
);

select pg_temp.test_reset_auth();
select pg_temp.test_login_as('c0000000-0000-4000-8000-000000000101');

select results_eq(
  $$
    with deleted as (
      delete from public.visitor_authorizations
      where id = 'c0000000-0000-4000-8000-000000000303'
      returning id
    )
    select count(*)::bigint from deleted
  $$,
  ARRAY[1::bigint],
  'RLS: staff pode deletar autorização'
);

select pg_temp.test_reset_auth();

select * from finish();

rollback;
