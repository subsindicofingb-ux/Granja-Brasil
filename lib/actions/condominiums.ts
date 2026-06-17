"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCondoAccess } from "@/lib/auth/access";
import { isSuperAdmin } from "@/lib/auth/session";
import type { AuthActionState } from "@/lib/auth/types";
import { ROLES } from "@/lib/constants";
import { createCondominium } from "@/lib/services/condominiums-admin";
import { condominiumFormSchema } from "@/lib/validations/condominium.schema";

export async function createCondominiumAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const access = await requireCondoAccess(condoSlug);

  if (access.role !== ROLES.SUPER_ADMIN) {
    const superAdmin = await isSuperAdmin();
    if (!superAdmin) {
      return { error: "Sem permissão para cadastrar condomínios." };
    }
  }

  const parsed = condominiumFormSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const result = await createCondominium(parsed.data);

  if (!result.ok) {
    return { error: result.error ?? "Não foi possível cadastrar o condomínio." };
  }

  revalidatePath(`/app/${condoSlug}/admin/condominiums`);
  revalidatePath("/app");
  redirect(`/app/${result.data.slug}`);
}
