-- Papéis adicionais para vínculo de membros (funcionário e sub-síndico).
-- IMPORTANTE: rode este arquivo sozinho no SQL Editor e confirme antes do 00031.
-- PostgreSQL não permite usar novos valores de enum na mesma transação.

alter type public.membership_role add value if not exists 'staff';
alter type public.membership_role add value if not exists 'sub_syndic';
