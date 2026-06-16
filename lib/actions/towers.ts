"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCondoPermission } from "@/lib/auth/access";
import type { AuthActionState } from "@/lib/auth/types";
import { createTower, updateTower } from "@/lib/services/towers";
import { towerFormSchema } from "@/lib/validations/structure.schema";

function revalidateTowerPaths(condoSlug: string) {
  revalidatePath(`/app/${condoSlug}/towers`);
  revalidatePath(`/app/${condoSlug}/units`);
}

export async function createTowerAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageStructure,
    { redirectTo: `/app/${condoSlug}/towers` },
  );

  const parsed = towerFormSchema.safeParse({
    name: formData.get("name"),
    floors: formData.get("floors"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const result = await createTower({
    condominiumId: access.condominium.id,
    name: parsed.data.name,
    floors: parsed.data.floors,
  });

  if (result.error) {
    return { error: result.error };
  }

  revalidateTowerPaths(condoSlug);
  redirect(`/app/${condoSlug}/towers/${result.data.id}`);
}

export async function updateTowerAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const towerId = String(formData.get("tower_id") ?? "");

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageStructure,
    { redirectTo: `/app/${condoSlug}/towers/${towerId}` },
  );

  const parsed = towerFormSchema.safeParse({
    name: formData.get("name"),
    floors: formData.get("floors"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const result = await updateTower({
    towerId,
    condominiumId: access.condominium.id,
    name: parsed.data.name,
    floors: parsed.data.floors,
  });

  if (result.error) {
    return { error: result.error };
  }

  revalidateTowerPaths(condoSlug);
  revalidatePath(`/app/${condoSlug}/towers/${towerId}`);
  return { success: "Torre atualizada com sucesso." };
}
