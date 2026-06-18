-- =============================================================================
-- Cadastrar unidades nos condomínios Manacás e Mangabeiras.
--
-- Manacás (182 unidades):
--   101–120, 201–220, 301–320, 401–420, 501–520, 601–612, 701–724
--   L00–L11, M01–M22, PUC 01–PUC 11, PUC 20
--
-- Mangabeiras (160 unidades):
--   101–120, 201–220, 301–320, 401–420, 501–520, 601–612, 701–712
--   M23–M46, PUC 01, PUC 10–PUC 20
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
  section_created int;
  condo_created int;
  expected_total int;
begin
  for condo in
    select id, name, case
      when name ilike '%manac%' then 182
      when name ilike '%mangabeir%' then 160
    end as expected_units
    from public.condominiums
    where name ilike '%manac%' or name ilike '%mangabeir%'
    order by name
  loop
    condo_created := 0;
    expected_total := condo.expected_units;

    select t.id
    into tower_id
    from public.towers t
    where t.condominium_id = condo.id
    order by t.created_at asc
    limit 1;

    if tower_id is null then
      insert into public.towers (condominium_id, name, floors)
      values (condo.id, 'Unidades', 7)
      returning id into tower_id;

      raise notice 'Torre "Unidades" criada em %', condo.name;
    end if;

    for cfg in
      select *
      from (
        values
          -- Manacás — apartamentos
          ('%manac%', 'F', 1, 1, 20, '101–120'),
          ('%manac%', 'F', 2, 1, 20, '201–220'),
          ('%manac%', 'F', 3, 1, 20, '301–320'),
          ('%manac%', 'F', 4, 1, 20, '401–420'),
          ('%manac%', 'F', 5, 1, 20, '501–520'),
          ('%manac%', 'F', 6, 1, 12, '601–612'),
          ('%manac%', 'F', 7, 1, 24, '701–724'),
          ('%manac%', 'L', 0, 0, 11, 'L00–L11'),
          ('%manac%', 'M', 0, 1, 22, 'M01–M22'),
          ('%manac%', 'PUC', 0, 1, 11, 'PUC 01–PUC 11'),
          ('%manac%', 'PUC_SINGLE', 0, 20, 20, 'PUC 20'),
          -- Mangabeiras — apartamentos
          ('%mangabeir%', 'F', 1, 1, 20, '101–120'),
          ('%mangabeir%', 'F', 2, 1, 20, '201–220'),
          ('%mangabeir%', 'F', 3, 1, 20, '301–320'),
          ('%mangabeir%', 'F', 4, 1, 20, '401–420'),
          ('%mangabeir%', 'F', 5, 1, 20, '501–520'),
          ('%mangabeir%', 'F', 6, 1, 12, '601–612'),
          ('%mangabeir%', 'F', 7, 1, 12, '701–712'),
          ('%mangabeir%', 'M', 0, 23, 46, 'M23–M46'),
          ('%mangabeir%', 'PUC_SINGLE', 0, 1, 1, 'PUC 01'),
          ('%mangabeir%', 'PUC', 0, 10, 20, 'PUC 10–PUC 20')
      ) as t(condo_pattern, unit_kind, floor_num, apt_from, apt_to, range_label)
      where condo.name ilike t.condo_pattern
    loop
      section_created := 0;

      for apt in cfg.apt_from..cfg.apt_to loop
        unit_number := case cfg.unit_kind
          when 'F' then (cfg.floor_num * 100 + apt)::text
          when 'L' then 'L' || lpad(apt::text, 2, '0')
          when 'M' then 'M' || lpad(apt::text, 2, '0')
          when 'PUC' then 'PUC ' || lpad(apt::text, 2, '0')
          when 'PUC_SINGLE' then 'PUC ' || lpad(apt::text, 2, '0')
        end;

        insert into public.units (tower_id, number, block)
        values (tower_id, unit_number, condo.name)
        on conflict on constraint units_unique_number_per_tower do nothing;

        get diagnostics row_count = ROW_COUNT;
        section_created := section_created + row_count;
        condo_created := condo_created + row_count;
      end loop;

      raise notice '% · %: % unidades novas.',
        condo.name, cfg.range_label, section_created;
    end loop;

    raise notice '%: total % unidades novas (% esperadas).',
      condo.name, condo_created, expected_total;
  end loop;
end $$;
