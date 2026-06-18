-- =============================================================================
-- Cadastrar unidades 101–706 (7 andares × 6 aptos) em Bromélias, Orquídeas e
-- Quaresmas.
--
-- ONDE EXECUTAR: Supabase Dashboard → SQL Editor → New query → colar tudo → Run
-- NÃO cole comandos npm/node/bash aqui (o caractere # causa erro de sintaxe).
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
    where name ilike '%bromélia%'
       or name ilike '%bromelia%'
       or name ilike '%orquídea%'
       or name ilike '%orquidea%'
       or name ilike '%quaresma%'
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
      values (condo.id, 'Unidades', 7)
      returning id into tower_id;

      raise notice 'Torre "Unidades" criada em %', condo.name;
    end if;

    for floor in 1..7 loop
      for apt in 1..6 loop
        apt_number := (floor * 100 + apt)::text;

        insert into public.units (tower_id, number, block)
        values (tower_id, apt_number, condo.name)
        on conflict on constraint units_unique_number_per_tower do nothing;

        get diagnostics row_count = ROW_COUNT;
        condo_created := condo_created + row_count;
      end loop;
    end loop;

    raise notice '%: % unidades novas (42 esperadas por condomínio).', condo.name, condo_created;
  end loop;
end $$;
