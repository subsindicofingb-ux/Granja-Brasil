"use server";

import { revalidatePath } from "next/cache";
import { requireCondoAccess } from "@/lib/auth/access";
import { canCreateInCategory, canDeleteInCategory } from "@/lib/auth/permission-matrix";
import type { AuthActionState } from "@/lib/auth/types";
import { parseAccessDeviceIdsFromFormData } from "@/lib/access-devices/form";
import { replaceMembershipAccessDevices } from "@/lib/services/membership-access-devices";
import {
  formDataHasRemovePhoto,
  resolvePhotoUrl,
  uploadCondoImage,
} from "@/lib/storage/upload-image";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function canConfigureMembers(access: Awaited<ReturnType<typeof requireCondoAccess>>): boolean {
  return canCreateInCategory(access, "members") || canDeleteInCategory(access, "members");
}

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

  if (!canConfigureMembers(access)) {
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

export async function updateMembershipProfileAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const membershipId = String(formData.get("membership_id") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const existingAvatarUrl = String(formData.get("existing_avatar_url") ?? "") || null;
  const photoValue = formData.get("photo");
  const photoFile = photoValue instanceof File ? photoValue : null;

  if (!condoSlug || !membershipId) {
    return { error: "Dados inválidos." };
  }

  if (!fullName) {
    return { error: "Informe o nome completo." };
  }

  if (!email || !email.includes("@")) {
    return { error: "Informe um e-mail válido." };
  }

  const access = await requireCondoAccess(condoSlug);

  if (!canConfigureMembers(access)) {
    return { error: "Sem permissão para configurar membros." };
  }

  const supabase = await createClient();
  const { data: membership, error } = await supabase
    .from("memberships")
    .select("id, profile_id, condominium_id")
    .eq("id", membershipId)
    .eq("condominium_id", access.condominium.id)
    .maybeSingle();

  if (error || !membership) {
    return { error: "Membro não encontrado neste condomínio." };
  }

  const uploadResult = await uploadCondoImage({
    condominiumId: access.condominium.id,
    folder: "members",
    file: photoFile,
  });

  if (!uploadResult.ok) {
    return { error: uploadResult.error };
  }

  const avatarUrl = resolvePhotoUrl(
    uploadResult.data,
    existingAvatarUrl,
    formDataHasRemovePhoto(formData),
  );

  const admin = createAdminClient();

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      full_name: fullName,
      avatar_url: avatarUrl,
    })
    .eq("id", membership.profile_id);

  if (profileError) {
    return { error: profileError.message };
  }

  const { error: authError } = await admin.auth.admin.updateUserById(membership.profile_id, {
    email,
    user_metadata: {
      full_name: fullName,
      phone: phone || null,
    },
  });

  if (authError) {
    return { error: authError.message };
  }

  revalidatePath(`/app/${condoSlug}/settings/members`);
  revalidatePath(`/app/${condoSlug}/settings/members/${membershipId}`);
  return { success: "Dados pessoais atualizados." };
}
