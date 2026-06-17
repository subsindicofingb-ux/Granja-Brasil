"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCondoPermission } from "@/lib/auth/access";
import type { AuthActionState } from "@/lib/auth/types";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { createVehicle, updateVehicle } from "@/lib/services/vehicles";
import { resolveUnitContext } from "@/lib/services/unit-access";
import {
  formDataHasRemovePhoto,
  resolvePhotoUrl,
  uploadCondoImage,
} from "@/lib/storage/upload-image";
import { vehicleFormSchema } from "@/lib/validations/vehicle.schema";

function revalidateVehiclePaths(condoSlug: string) {
  revalidatePath(`/app/${condoSlug}/vehicles`);
}

function getPhotoFile(formData: FormData): File | null {
  const value = formData.get("photo");
  return value instanceof File ? value : null;
}

export async function createVehicleAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageVehicles,
    { redirectTo: `/app/${condoSlug}/vehicles` },
  );

  const parsed = vehicleFormSchema.safeParse({
    unit_id: formData.get("unit_id"),
    resident_id: formData.get("resident_id") ?? "",
    brand: formData.get("brand"),
    model: formData.get("model"),
    color: formData.get("color") ?? "",
    license_plate: formData.get("license_plate"),
    tag_number: formData.get("tag_number") ?? "",
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
    folder: "vehicles",
    file: getPhotoFile(formData),
  });

  if (!uploadResult.ok) {
    return { error: uploadResult.error };
  }

  const result = await createVehicle({
    scopeCondominiumId,
    unitId: parsed.data.unit_id,
    residentId: parsed.data.resident_id,
    brand: parsed.data.brand,
    model: parsed.data.model,
    color: parsed.data.color,
    licensePlate: parsed.data.license_plate,
    tagNumber: parsed.data.tag_number,
    photoUrl: uploadResult.data,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  revalidateVehiclePaths(condoSlug);
  redirect(`/app/${condoSlug}/vehicles/${result.data.id}`);
}

export async function updateVehicleAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const vehicleId = String(formData.get("vehicle_id") ?? "");
  const existingPhotoUrl = String(formData.get("existing_photo_url") ?? "") || null;

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageVehicles,
    { redirectTo: `/app/${condoSlug}/vehicles/${vehicleId}` },
  );

  const parsed = vehicleFormSchema.safeParse({
    unit_id: formData.get("unit_id"),
    resident_id: formData.get("resident_id") ?? "",
    brand: formData.get("brand"),
    model: formData.get("model"),
    color: formData.get("color") ?? "",
    license_plate: formData.get("license_plate"),
    tag_number: formData.get("tag_number") ?? "",
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
    folder: "vehicles",
    file: getPhotoFile(formData),
  });

  if (!uploadResult.ok) {
    return { error: uploadResult.error };
  }

  const result = await updateVehicle({
    vehicleId,
    scopeCondominiumId,
    unitId: parsed.data.unit_id,
    residentId: parsed.data.resident_id,
    brand: parsed.data.brand,
    model: parsed.data.model,
    color: parsed.data.color,
    licensePlate: parsed.data.license_plate,
    tagNumber: parsed.data.tag_number,
    photoUrl: resolvePhotoUrl(
      uploadResult.data,
      existingPhotoUrl,
      formDataHasRemovePhoto(formData),
    ),
  });

  if (!result.ok) {
    return { error: result.error };
  }

  revalidateVehiclePaths(condoSlug);
  revalidatePath(`/app/${condoSlug}/vehicles/${vehicleId}`);
  return { success: "Veículo atualizado com sucesso." };
}
