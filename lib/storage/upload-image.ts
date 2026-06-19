import { createAdminClient } from "@/lib/supabase/admin";
import { serviceError, serviceOk, type ServiceResult } from "@/lib/services/types";

const MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const RECEIPT_TYPES = new Set([...IMAGE_TYPES, "application/pdf"]);

export async function uploadCondoImage(input: {
  condominiumId: string;
  folder: "residents" | "vehicles" | "reservations" | "announcements";
  file: File | null;
}): Promise<ServiceResult<string | null>> {
  const file = input.file;

  if (!file || file.size === 0) {
    return serviceOk(null);
  }

  if (file.size > MAX_BYTES) {
    return serviceError("O arquivo deve ter no máximo 5 MB.");
  }

  const allowsPdf = input.folder === "reservations" || input.folder === "announcements";
  const allowedTypes = allowsPdf ? RECEIPT_TYPES : IMAGE_TYPES;

  if (!allowedTypes.has(file.type)) {
    return serviceError(
      allowsPdf
        ? "Use imagem JPG, PNG, WebP ou PDF."
        : "Use imagem JPG, PNG ou WebP.",
    );
  }

  const extension =
    file.type === "application/pdf"
      ? "pdf"
      : (file.name.split(".").pop()?.toLowerCase() ?? "jpg");
  const path = `${input.condominiumId}/${input.folder}/${crypto.randomUUID()}.${extension}`;

  try {
    const admin = createAdminClient();
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error } = await admin.storage.from("condo-uploads").upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    });

    if (error) {
      return serviceError(
        error.message.includes("mime") || error.message.includes("Invalid")
          ? "Formato não permitido. Use JPG, PNG, WebP ou PDF (máx. 5 MB)."
          : error.message,
      );
    }

    const { data } = admin.storage.from("condo-uploads").getPublicUrl(path);
    return serviceOk(data.publicUrl);
  } catch {
    return serviceError("Não foi possível enviar a imagem. Verifique o bucket condo-uploads no Supabase.");
  }
}

export function resolvePhotoUrl(
  uploadedUrl: string | null,
  existingUrl: string | null | undefined,
  removePhoto: boolean,
): string | null {
  if (uploadedUrl) {
    return uploadedUrl;
  }

  if (removePhoto) {
    return null;
  }

  return existingUrl ?? null;
}

export function formDataHasRemovePhoto(formData: FormData): boolean {
  return formData.get("remove_photo") === "1";
}
