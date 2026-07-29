"use server";

import { revalidatePath } from "next/cache";
import { requireCondoAccess } from "@/lib/auth/access";
import { canCreateInCategory, canDeleteInCategory } from "@/lib/auth/permission-matrix";
import type { AuthActionState } from "@/lib/auth/types";
import { parseAccessDeviceIdsFromFormData } from "@/lib/access-devices/form";
import { replaceMembershipAccessDevices } from "@/lib/services/membership-access-devices";
import { createClient } from "@/lib/supabase/server";

export async function updateMembershipAccessDevicesAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const membershipId = String(formData.get("membership_id") ?? "");

  if (!condoSlug || !membershipId) {
    return { error: "Dados inválidos." };
  }

  const access = await requireCondoAccess(condoSlug);

  if (!canCreateInCategory(access, "members") && !canDeleteInCategory(access, "members")) {
    return { error: "Sem permissão para configurar membros." };
  }

  const supabase = await createClient();
  const { data: membership, error } = await supabase
    .from("memberships")
    .select("id, role, condominium_id")
    .eq("id", membershipId)
    .eq("condominium_id", access.condominium.id)
    .maybeSingle();

  if (error || !membership) {
    return { error: "Membro não encontrado neste condomínio." };
  }

  const result = await replaceMembershipAccessDevices({
    membershipId,
    condominiumId: access.condominium.id,
    accessDeviceIds: parseAccessDeviceIdsFromFormData(formData),
  });

  if (!result.ok) {
    return { error: result.error ?? "Não foi possível salvar os locais de acesso." };
  }

  revalidatePath(`/app/${condoSlug}/settings/members`);
  revalidatePath(`/app/${condoSlug}/settings/members/${membershipId}`);
  return { success: "Locais de acesso do membro atualizados." };
}
