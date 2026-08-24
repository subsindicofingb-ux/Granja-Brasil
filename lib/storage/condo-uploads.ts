import { getAuthUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  CONDO_UPLOADS_BUCKET,
  isValidCondoUploadPath,
  parseCondoUploadPath,
} from "@/lib/storage/condo-upload-path";

export async function canCurrentUserAccessCondoUpload(condominiumId: string): Promise<boolean> {
  const user = await getAuthUser();
  if (!user) {
    return false;
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("condominiums")
      .select("id")
      .eq("id", condominiumId)
      .maybeSingle();

    return !error && Boolean(data);
  } catch {
    return false;
  }
}

export async function downloadCondoUploadBytes(path: string): Promise<{
  bytes: Buffer;
  contentType: string;
}> {
  if (!isValidCondoUploadPath(path)) {
    throw new Error("Caminho de arquivo inválido.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(CONDO_UPLOADS_BUCKET).download(path);

  if (error || !data) {
    throw new Error("Não foi possível ler o arquivo.");
  }

  const bytes = Buffer.from(await data.arrayBuffer());
  if (bytes.length === 0) {
    throw new Error("O arquivo está vazio.");
  }

  const contentType = data.type?.split(";")[0]?.trim() || "application/octet-stream";
  return { bytes, contentType };
}

export async function downloadStoredUpload(photoUrl: string): Promise<{
  bytes: Buffer;
  contentType: string;
} | null> {
  const path = parseCondoUploadPath(photoUrl);
  if (!path || !isValidCondoUploadPath(path)) {
    return null;
  }

  return downloadCondoUploadBytes(path);
}
