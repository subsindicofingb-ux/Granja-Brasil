-- Tipo adicional: responsável (ex.: responsável legal / titular da unidade)
alter type public.resident_type add value if not exists 'responsible';
