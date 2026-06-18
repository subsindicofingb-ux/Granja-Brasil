-- =============================================================================
-- Cadastrar unidades 101–404 em Cambucás.
--
-- Layout: 4 andares × 4 aptos
--   101–104, 201–204, 301–304, 401–404  (16 unidades)
--
-- ONDE EXECUTAR: Supabase Dashboard → SQL Editor → New query → colar tudo → Run
-- Idempotente: ON CONFLICT DO NOTHING
-- =============================================================================

do $$
declare
  condo record;
  tower_id uuid;
  apt_number text;
  floor int;
  apt int;
  row_count int;
  condo_created int;
begin
  for condo in
    select id, name
    from public.condominiums
    where name ilike '%cambuc%'
    order by name
  loop
    condo_created := 0;

    select t.id
    into tower_id
    from public.towers t
    where t.condominium_id = condo.id
    order by t.created_at asc
    limit 1;

    if tower_id is null then
      insert into public.towers (condominium_id, name, floors)
      values (condo.id, 'Unidades', 4)
      returning id into tower_id;

      raise notice 'Torre "Unidades" criada em %', condo.name;
    end if;

    for floor in 1..4 loop
      for apt in 1..4 loop
        apt_number := (floor * 100 + apt)::text;

        insert into public.units (tower_id, number, block)
        values (tower_id, apt_number, condo.name)
        on conflict on constraint units_unique_number_per_tower do nothing;

        get diagnostics row_count = ROW_COUNT;
        condo_created := condo_created + row_count;
      end loop;
    end loop;

    raise notice '%: % unidades novas (16 esperadas: 101–404).', condo.name, condo_created;
  end loop;
end $$;
