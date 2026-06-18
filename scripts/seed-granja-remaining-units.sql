-- =============================================================================
-- Cadastrar unidades nos condomínios filhos da Granja Brasil (lote 2).
--
-- Jacarandás, Jequitibás       → 101–304  (3 andares × 4 aptos)
-- Cambucás, Jabuticabeiras     → 101–404  (4 andares × 4 aptos)
-- Palmeiras                    → 101–412  (4 andares × 12 aptos)
-- Acácias, Cerejeiras           → 101–402  (3 andares × 4 aptos + 4º × 2)
-- Bouganville                   → 101–402  (3 andares × 4 aptos + 4º × 2)
-- Pau Brasil                   → 101–708  (7 andares × 8 aptos)
-- Magnólias                    → 101–702  (7 andares × 2 aptos)
--
-- ONDE EXECUTAR: Supabase Dashboard → SQL Editor → New query → colar tudo → Run
-- Idempotente: ON CONFLICT DO NOTHING
-- =============================================================================

do $$
declare
  cfg record;
  condo record;
  tower_id uuid;
  apt_number text;
  floor int;
  apt int;
  row_count int;
  condo_created int;
  expected_total int;
  apts_on_floor int;
begin
  for cfg in
    select *
    from (
      values
        ('%jacarand%', 3, 4, null::int, '101–304'),
        ('%jequitib%', 3, 4, null::int, '101–304'),
        ('%cambuca%', 4, 4, null::int, '101–404'),
        ('%jabuticabeira%', 4, 4, null::int, '101–404'),
        ('%palmeira%', 4, 12, null::int, '101–412'),
        ('%acácia%', 4, 4, 2, '101–402'),
        ('%bouganville%', 4, 4, 2, '101–402'),
        ('%cerejeira%', 4, 4, 2, '101–402'),
        ('%pau brasil%', 7, 8, null::int, '101–708'),
        ('%magnólia%', 7, 2, null::int, '101–702')
    ) as t(pattern, floors, apts_per_floor, last_floor_apts, range_label)
  loop
    expected_total := (cfg.floors - 1) * cfg.apts_per_floor + coalesce(cfg.last_floor_apts, cfg.apts_per_floor);

    for condo in
      select id, name
      from public.condominiums
      where name ilike cfg.pattern
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
        values (condo.id, 'Unidades', cfg.floors)
        returning id into tower_id;

        raise notice 'Torre "Unidades" criada em % (% andares)', condo.name, cfg.floors;
      end if;

      for floor in 1..cfg.floors loop
        apts_on_floor := cfg.apts_per_floor;
        if cfg.last_floor_apts is not null and floor = cfg.floors then
          apts_on_floor := cfg.last_floor_apts;
        end if;

        for apt in 1..apts_on_floor loop
          apt_number := (floor * 100 + apt)::text;

          insert into public.units (tower_id, number, block)
          values (tower_id, apt_number, condo.name)
          on conflict on constraint units_unique_number_per_tower do nothing;

          get diagnostics row_count = ROW_COUNT;
          condo_created := condo_created + row_count;
        end loop;
      end loop;

      raise notice '%: % unidades novas (% esperadas: %).',
        condo.name, condo_created, expected_total, cfg.range_label;
    end loop;
  end loop;
end $$;
