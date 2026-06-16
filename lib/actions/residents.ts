"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCondoPermission } from "@/lib/auth/access";
import type { AuthActionState } from "@/lib/auth/types";
import { createResident, updateResident } from "@/lib/services/residents";
import { residentFormSchema } from "@/lib/validations/structure.schema";

function revalidateResidentPaths(condoSlug: string) {
  revalidatePath(`/app/${condoSlug}/residents`);
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

  const result = await createResident({
    condominiumId: access.condominium.id,
    unitId: parsed.data.unit_id,
    fullName: parsed.data.full_name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    type: parsed.data.type,
  });

  if (result.error) {
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

  const result = await updateResident({
    residentId,
    condominiumId: access.condominium.id,
    unitId: parsed.data.unit_id,
    fullName: parsed.data.full_name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    type: parsed.data.type,
  });

  if (result.error) {
    return { error: result.error };
  }

  revalidateResidentPaths(condoSlug);
  revalidatePath(`/app/${condoSlug}/residents/${residentId}`);
  return { success: "Morador atualizado com sucesso." };
}
