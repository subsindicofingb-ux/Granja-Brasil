-- =============================================================================
-- Cadastrar unidades no condomínio Reserva (Bloco 1 e Bloco 2).
--
-- Bloco 1: 101–121, 201–231, 301–324, 401–424  (100 unidades)
-- Bloco 2: 101–121, 201–212, 301–316, 401–412  (61 unidades)
--
-- ONDE EXECUTAR: Supabase Dashboard → SQL Editor → New query → colar tudo → Run
-- Idempotente: ON CONFLICT DO NOTHING
-- =============================================================================

do $$
declare
  condo record;
  tower_id uuid;
  cfg record;
  apt_number text;
  floor int;
  apt int;
  row_count int;
  block_created int;
  condo_created int;
begin
  for condo in
    select id, name
    from public.condominiums
    where name ilike '%reserva%'
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

    for cfg in
      select *
      from (
        values
          ('Bloco 1', 1, 21),
          ('Bloco 1', 2, 31),
          ('Bloco 1', 3, 24),
          ('Bloco 1', 4, 24),
          ('Bloco 2', 1, 21),
          ('Bloco 2', 2, 12),
          ('Bloco 2', 3, 16),
          ('Bloco 2', 4, 12)
      ) as t(block_name, floor_num, apts_on_floor)
    loop
      block_created := 0;

      for apt in 1..cfg.apts_on_floor loop
        apt_number := (cfg.floor_num * 100 + apt)::text;

        insert into public.units (tower_id, number, block)
        values (tower_id, apt_number, cfg.block_name)
        on conflict on constraint units_unique_number_per_tower do nothing;

        get diagnostics row_count = ROW_COUNT;
        block_created := block_created + row_count;
        condo_created := condo_created + row_count;
      end loop;

      raise notice '% · % · andar %: % unidades novas (% esperadas).',
        condo.name,
        cfg.block_name,
        cfg.floor_num,
        block_created,
        cfg.apts_on_floor;
    end loop;

    raise notice '%: total % unidades novas (161 esperadas).', condo.name, condo_created;
  end loop;
end $$;
