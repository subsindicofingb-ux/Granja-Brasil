-- Anexos em ocorrências (foto ou documento do reclamante).

alter table public.occurrences
  add column if not exists attachment_url text;

alter table public.occurrences
  add column if not exists attachment_name text;
