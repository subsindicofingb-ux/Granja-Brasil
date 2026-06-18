-- =============================================================================
-- Corrigir unidades faltantes em Acácias e Cerejeiras (101–402).
--
-- Layout correto:
--   Andares 1–3: 101–104, 201–204, 301–304  (4 aptos)
--   Andar 4:     401–402                      (2 aptos)
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
  apts_on_floor int;
  row_count int;
  condo_created int;
begin
  for condo in
    select id, name
    from public.condominiums
    where name ilike '%acácia%' or name ilike '%cerejeira%'
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
      apts_on_floor := case when floor = 4 then 2 else 4 end;

      for apt in 1..apts_on_floor loop
        apt_number := (floor * 100 + apt)::text;

        insert into public.units (tower_id, number, block)
        values (tower_id, apt_number, condo.name)
        on conflict on constraint units_unique_number_per_tower do nothing;

        get diagnostics row_count = ROW_COUNT;
        condo_created := condo_created + row_count;
      end loop;
    end loop;

    raise notice '%: % unidades novas (14 esperadas: 101–402).', condo.name, condo_created;
  end loop;
end $$;
