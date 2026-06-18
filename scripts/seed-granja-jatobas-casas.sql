-- =============================================================================
-- Cadastrar casas 01–11 no condomínio Jatobás.
--
-- Torre: Casa (unidades exibidas como Casa 01 … Casa 11)
--
-- ONDE EXECUTAR: Supabase Dashboard → SQL Editor → New query → colar tudo → Run
-- Idempotente: ON CONFLICT DO NOTHING
-- =============================================================================

do $$
declare
  condo record;
  tower_id uuid;
  unit_number text;
  house int;
  row_count int;
  condo_created int;
begin
  for condo in
    select id, name
    from public.condominiums
    where name ilike '%jatob%'
    order by name
  loop
    condo_created := 0;

    select t.id
    into tower_id
    from public.towers t
    where t.condominium_id = condo.id
      and lower(trim(t.name)) = 'casa'
    order by t.created_at asc
    limit 1;

    if tower_id is null then
      insert into public.towers (condominium_id, name, floors)
      values (condo.id, 'Casa', 1)
      returning id into tower_id;

      raise notice 'Torre "Casa" criada em %', condo.name;
    end if;

    for house in 1..11 loop
      unit_number := lpad(house::text, 2, '0');

      insert into public.units (tower_id, number, block)
      values (tower_id, unit_number, null)
      on conflict on constraint units_unique_number_per_tower do nothing;

      get diagnostics row_count = ROW_COUNT;
      condo_created := condo_created + row_count;
    end loop;

    raise notice '%: % casas novas (11 esperadas: Casa 01–Casa 11).', condo.name, condo_created;
  end loop;
end $$;
