"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCondoPermission } from "@/lib/auth/access";
import type { AuthActionState } from "@/lib/auth/types";
import { createUnit, updateUnit } from "@/lib/services/units";
import { unitFormSchema } from "@/lib/validations/structure.schema";

function revalidateUnitPaths(condoSlug: string) {
  revalidatePath(`/app/${condoSlug}/units`);
}

export async function createUnitAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageStructure,
    { redirectTo: `/app/${condoSlug}/units` },
  );

  const parsed = unitFormSchema.safeParse({
    tower_id: formData.get("tower_id"),
    number: formData.get("number"),
    block: formData.get("block") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const result = await createUnit({
    towerId: parsed.data.tower_id,
    condominiumId: access.condominium.id,
    number: parsed.data.number,
    block: parsed.data.block,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  revalidateUnitPaths(condoSlug);
  redirect(`/app/${condoSlug}/units/${result.data.id}`);
}

export async function updateUnitAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const unitId = String(formData.get("unit_id") ?? "");

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageStructure,
    { redirectTo: `/app/${condoSlug}/units/${unitId}` },
  );

  const parsed = unitFormSchema.safeParse({
    tower_id: formData.get("tower_id"),
    number: formData.get("number"),
    block: formData.get("block") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const result = await updateUnit({
    unitId,
    condominiumId: access.condominium.id,
    towerId: parsed.data.tower_id,
    number: parsed.data.number,
    block: parsed.data.block,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  revalidateUnitPaths(condoSlug);
  revalidatePath(`/app/${condoSlug}/units/${unitId}`);
  return { success: "Unidade atualizada com sucesso." };
}
