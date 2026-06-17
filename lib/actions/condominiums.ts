"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCondoAccess } from "@/lib/auth/access";
import { isSuperAdmin } from "@/lib/auth/session";
import type { AuthActionState } from "@/lib/auth/types";
import { ROLES } from "@/lib/constants";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { createCondominium } from "@/lib/services/condominiums-admin";
import { condominiumFormSchema } from "@/lib/validations/condominium.schema";

export async function createCondominiumAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const returnTo = String(formData.get("return_to") ?? "admin");
  const access = await requireCondoAccess(condoSlug);

  if (access.role !== ROLES.SUPER_ADMIN) {
    const superAdmin = await isSuperAdmin();
    if (!superAdmin) {
      return { error: "Sem permissão para cadastrar condomínios." };
    }
  }

  if (returnTo === "units" && !isGeneralCondominium(condoSlug)) {
    return { error: "Somente o condomínio Granja Brasil pode cadastrar condomínios por aqui." };
  }

  const parsed = condominiumFormSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    is_commercial: formData.get("is_commercial") === "1",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const result = await createCondominium({
    name: parsed.data.name,
    slug: parsed.data.slug,
    isCommercial: parsed.data.is_commercial,
  });

  if (!result.ok) {
    return { error: result.error ?? "Não foi possível cadastrar o condomínio." };
  }

  revalidatePath(`/app/${condoSlug}/admin/condominiums`);
  revalidatePath(`/app/${condoSlug}/units`);
  revalidatePath(`/app/${condoSlug}/units/new`);
  revalidatePath(`/app/${condoSlug}`);
  revalidatePath("/app");

  if (returnTo === "units") {
    redirect(`/app/${condoSlug}/units?condominium=${result.data.slug}`);
  }

  redirect(`/app/${result.data.slug}`);
}
