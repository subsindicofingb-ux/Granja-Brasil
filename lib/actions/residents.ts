"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCondoPermission } from "@/lib/auth/access";
import type { AuthActionState } from "@/lib/auth/types";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { createResident, updateResident } from "@/lib/services/residents";
import { resolveUnitContext } from "@/lib/services/unit-access";
import {
  formDataHasRemovePhoto,
  resolvePhotoUrl,
  uploadCondoImage,
} from "@/lib/storage/upload-image";
import { residentFormSchema } from "@/lib/validations/structure.schema";

function revalidateResidentPaths(condoSlug: string) {
  revalidatePath(`/app/${condoSlug}/residents`);
}

function getPhotoFile(formData: FormData): File | null {
  const value = formData.get("photo");
  return value instanceof File ? value : null;
}

export async function createResidentAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageResidents,
    { redirectTo: `/app/${condoSlug}/residents` },
  );

  const parsed = residentFormSchema.safeParse({
    unit_id: formData.get("unit_id"),
    full_name: formData.get("full_name"),
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    type: formData.get("type"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const isGeneralCondo = isGeneralCondominium(condoSlug);
  const scopeCondominiumId = isGeneralCondo ? undefined : access.condominium.id;
  const unitContext = await resolveUnitContext(parsed.data.unit_id, scopeCondominiumId);

  if (!unitContext.ok) {
    return { error: unitContext.error };
  }

  const uploadResult = await uploadCondoImage({
    condominiumId: unitContext.data.unitCondominiumId,
    folder: "residents",
    file: getPhotoFile(formData),
  });

  if (!uploadResult.ok) {
    return { error: uploadResult.error };
  }

  const result = await createResident({
    condominiumId: scopeCondominiumId,
    unitId: parsed.data.unit_id,
    fullName: parsed.data.full_name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    photoUrl: uploadResult.data,
    type: parsed.data.type,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  revalidateResidentPaths(condoSlug);
  redirect(`/app/${condoSlug}/residents/${result.data.id}`);
}

export async function updateResidentAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const residentId = String(formData.get("resident_id") ?? "");
  const existingPhotoUrl = String(formData.get("existing_photo_url") ?? "") || null;

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageResidents,
    { redirectTo: `/app/${condoSlug}/residents/${residentId}` },
  );

  const parsed = residentFormSchema.safeParse({
    unit_id: formData.get("unit_id"),
    full_name: formData.get("full_name"),
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    type: formData.get("type"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const isGeneralCondo = isGeneralCondominium(condoSlug);
  const scopeCondominiumId = isGeneralCondo ? undefined : access.condominium.id;
  const unitContext = await resolveUnitContext(parsed.data.unit_id, scopeCondominiumId);

  if (!unitContext.ok) {
    return { error: unitContext.error };
  }

  const uploadResult = await uploadCondoImage({
    condominiumId: unitContext.data.unitCondominiumId,
    folder: "residents",
    file: getPhotoFile(formData),
  });

  if (!uploadResult.ok) {
    return { error: uploadResult.error };
  }

  const result = await updateResident({
    residentId,
    condominiumId: scopeCondominiumId,
    unitId: parsed.data.unit_id,
    fullName: parsed.data.full_name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    photoUrl: resolvePhotoUrl(
      uploadResult.data,
      existingPhotoUrl,
      formDataHasRemovePhoto(formData),
    ),
    type: parsed.data.type,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  revalidateResidentPaths(condoSlug);
  revalidatePath(`/app/${condoSlug}/residents/${residentId}`);
  return { success: "Morador atualizado com sucesso." };
}
