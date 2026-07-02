"use server";

import { revalidatePath } from "next/cache";
import { requireCondoAccess } from "@/lib/auth/access";
import {
  CONFIGURABLE_ROLES,
  PERMISSION_CATEGORY_IDS,
  buildDefaultPermissionMatrix,
  matrixFieldName,
  type RolePermissionMatrix,
} from "@/lib/auth/permission-matrix";
import type { AuthActionState } from "@/lib/auth/types";
import { ROLES } from "@/lib/constants";
import { savePermissionMatrix } from "@/lib/services/permission-matrix";

function parseMatrixFromFormData(formData: FormData): RolePermissionMatrix {
  const matrix = buildDefaultPermissionMatrix();

  for (const role of CONFIGURABLE_ROLES) {
    for (const category of PERMISSION_CATEGORY_IDS) {
      matrix[role][category] = {
        view: formData.get(matrixFieldName(role, category, "view")) === "on",
        create: formData.get(matrixFieldName(role, category, "create")) === "on",
        delete: formData.get(matrixFieldName(role, category, "delete")) === "on",
      };
    }
  }

  return matrix;
}

export async function savePermissionMatrixAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "").trim();

  if (!condoSlug) {
    return { error: "Condomínio inválido." };
  }

  const access = await requireCondoAccess(condoSlug);

  if (access.role !== ROLES.SUPER_ADMIN) {
    return { error: "Somente Super Admin pode alterar a hierarquia de permissões." };
  }

  const matrix = parseMatrixFromFormData(formData);
  const result = await savePermissionMatrix({
    matrix,
    updatedByProfileId: access.profile.id,
  });

  if (!result.ok) {
    return { error: result.error ?? "Não foi possível salvar a matriz." };
  }

  revalidatePath("/", "layout");
  revalidatePath(`/app/${condoSlug}/admin/permission-hierarchy`);

  return { success: "Hierarquia de permissões atualizada." };
}
