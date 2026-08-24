-- Bucket de uploads privado: fotos e anexos deixam de ser listáveis/baixáveis sem autenticação.
-- O app passa a servir os arquivos em /api/uploads com sessão e vínculo ao condomínio.

update storage.buckets
set public = false
where id = 'condo-uploads';

drop policy if exists "condo_uploads_public_read" on storage.objects;
drop policy if exists "condo_uploads_authenticated_insert" on storage.objects;
drop policy if exists "condo_uploads_authenticated_update" on storage.objects;
drop policy if exists "condo_uploads_authenticated_delete" on storage.objects;
