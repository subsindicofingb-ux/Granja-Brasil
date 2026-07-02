"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCondoPermission } from "@/lib/auth/access";
import { canCreateInCategory } from "@/lib/auth/permission-matrix";
import type { AuthActionState } from "@/lib/auth/types";
import { createCommonArea, updateCommonArea } from "@/lib/services/common-areas";
import {
  parseCommonAreaFormData,
  toCommonAreaPayload,
} from "@/lib/validations/common-area.schema";

function revalidateAreaPaths(condoSlug: string) {
  revalidatePath(`/app/${condoSlug}/areas`);
}

export async function createCommonAreaAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => canCreateInCategory(ctx, "areas"),
    { redirectTo: `/app/${condoSlug}/areas` },
  );

  const parsed = parseCommonAreaFormData(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const result = await createCommonArea({
    condominiumId: access.condominium.id,
    data: toCommonAreaPayload(parsed.data),
  });

  if (!result.ok) {
    return { error: result.error };
  }

  revalidateAreaPaths(condoSlug);
  redirect(`/app/${condoSlug}/areas/${result.data.id}`);
}

export async function updateCommonAreaAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const areaId = String(formData.get("area_id") ?? "");

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => canCreateInCategory(ctx, "areas"),
    { redirectTo: `/app/${condoSlug}/areas/${areaId}` },
  );

  const parsed = parseCommonAreaFormData(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const result = await updateCommonArea({
    areaId,
    condominiumId: access.condominium.id,
    data: toCommonAreaPayload(parsed.data),
  });

  if (!result.ok) {
    return { error: result.error };
  }

  revalidateAreaPaths(condoSlug);
  revalidatePath(`/app/${condoSlug}/areas/${areaId}`);
  return { success: "Espaço comum atualizado com sucesso." };
}
