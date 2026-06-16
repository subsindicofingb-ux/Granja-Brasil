-- Habilita pgTAP e verifica que o runner está operacional.
begin;

create extension if not exists pgtap with schema extensions;

select plan(1);

select ok(true, 'pgtap extension available');

select * from finish();

rollback;
