-- E-mail e telefone únicos por unidade (mesmo contato permitido em unidades diferentes).

create unique index if not exists residents_unique_email_per_unit_idx
  on public.residents (unit_id, lower(trim(email)))
  where email is not null and char_length(trim(email)) > 0;

create unique index if not exists residents_unique_phone_per_unit_idx
  on public.residents (unit_id, regexp_replace(phone, '\D', '', 'g'))
  where phone is not null and char_length(regexp_replace(phone, '\D', '', 'g')) > 0;
