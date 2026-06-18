-- =============================================================================
-- Cadastrar unidades no condomínio Begônias (Bloco 1 e Bloco 2).
--
-- Mesma configuração em cada bloco:
--   L01–L10, 101–110, 201–210, 301–310, 401–410  (50 unidades/bloco)
--
-- ONDE EXECUTAR: Supabase Dashboard → SQL Editor → New query → colar tudo → Run
-- Idempotente: ON CONFLICT DO NOTHING
-- =============================================================================

do $$
declare
  condo record;
  tower_id uuid;
  cfg record;
  unit_number text;
  apt int;
  row_count int;
  block_created int;
  condo_created int;
begin
  for condo in
    select id, name
    from public.condominiums
    where name ilike '%begônia%' or name ilike '%begonia%'
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
          ('Bloco 1', 'L', 1, 10),
          ('Bloco 1', 'F', 1, 10),
          ('Bloco 1', 'F', 2, 10),
          ('Bloco 1', 'F', 3, 10),
          ('Bloco 1', 'F', 4, 10),
          ('Bloco 2', 'L', 1, 10),
          ('Bloco 2', 'F', 1, 10),
          ('Bloco 2', 'F', 2, 10),
          ('Bloco 2', 'F', 3, 10),
          ('Bloco 2', 'F', 4, 10)
      ) as t(block_name, unit_kind, floor_num, apts_count)
    loop
      block_created := 0;

      for apt in 1..cfg.apts_count loop
        if cfg.unit_kind = 'L' then
          unit_number := 'L' || lpad(apt::text, 2, '0');
        else
          unit_number := (cfg.floor_num * 100 + apt)::text;
        end if;

        insert into public.units (tower_id, number, block)
        values (tower_id, unit_number, cfg.block_name)
        on conflict on constraint units_unique_number_per_tower do nothing;

        get diagnostics row_count = ROW_COUNT;
        block_created := block_created + row_count;
        condo_created := condo_created + row_count;
      end loop;

      raise notice '% · % · %: % unidades novas (% esperadas).',
        condo.name,
        cfg.block_name,
        case when cfg.unit_kind = 'L' then 'L01–L10' else (cfg.floor_num * 100 + 1)::text || '–' || (cfg.floor_num * 100 + cfg.apts_count)::text end,
        block_created,
        cfg.apts_count;
    end loop;

    raise notice '%: total % unidades novas (100 esperadas).', condo.name, condo_created;
  end loop;
end $$;
