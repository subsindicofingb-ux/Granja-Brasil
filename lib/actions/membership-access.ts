"use server";

import { revalidatePath } from "next/cache";
import { requireCondoAccess } from "@/lib/auth/access";
import { canCreateInCategory, canDeleteInCategory } from "@/lib/auth/permission-matrix";
import type { AuthActionState } from "@/lib/auth/types";
import { parseAccessDeviceIdsFromFormData } from "@/lib/access-devices/form";
import { replaceMembershipAccessDevices, listMembershipAccessDeviceIds } from "@/lib/services/membership-access-devices";
import {
  loadMembershipProfileForSync,
  syncMembershipToControlIdDevices,
} from "@/lib/services/membership-access-sync";
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

function formatMembershipSyncMessage(input: {
  baseSuccess: string;
  synced: number;
  removed: number;
  errors: string[];
}): string {
  const parts = [input.baseSuccess];

  if (input.synced > 0 || input.removed > 0) {
    const syncBits: string[] = [];
    if (input.synced > 0) {
      syncBits.push(`${input.synced} local(is) sincronizado(s)`);
    }
    if (input.removed > 0) {
      syncBits.push(`${input.removed} removido(s)`);
    }
    parts.push(`ControlID: ${syncBits.join(", ")}.`);
  }

  if (input.errors.length > 0) {
    parts.push(`Pendências: ${input.errors.join(" · ")}`);
  }

  return parts.join(" ");
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

  const previousIdsResult = await listMembershipAccessDeviceIds(membershipId);
  if (!previousIdsResult.ok) {
    return { error: previousIdsResult.error ?? "Erro ao carregar locais atuais." };
  }

  const nextAccessDeviceIds = parseAccessDeviceIdsFromFormData(formData);
  const result = await replaceMembershipAccessDevices({
    membershipId,
    condominiumId: access.condominium.id,
    accessDeviceIds: nextAccessDeviceIds,
  });

  if (!result.ok) {
    return { error: result.error ?? "Não foi possível salvar os locais de acesso." };
  }

  const profileResult = await loadMembershipProfileForSync(membershipId);
  if (!profileResult.ok) {
    revalidatePath(`/app/${condoSlug}/settings/members`);
    revalidatePath(`/app/${condoSlug}/settings/members/${membershipId}`);
    return {
      success:
        "Locais de acesso salvos, mas não foi possível sincronizar o ControlID: " +
        (profileResult.error ?? "erro desconhecido"),
    };
  }

  const nextSet = new Set(nextAccessDeviceIds);
  const removeDeviceIds = previousIdsResult.data.filter((id) => !nextSet.has(id));

  const syncResult = await syncMembershipToControlIdDevices({
    membershipId,
    fullName: profileResult.data.fullName,
    photoUrl: profileResult.data.photoUrl,
    accessDeviceIds: nextAccessDeviceIds,
    removeDeviceIds,
  });

  revalidatePath(`/app/${condoSlug}/settings/members`);
  revalidatePath(`/app/${condoSlug}/settings/members/${membershipId}`);

  if (!syncResult.ok) {
    return {
      success:
        "Locais de acesso atualizados, mas o ControlID falhou: " +
        (syncResult.error ?? "erro desconhecido"),
    };
  }

  return {
    success: formatMembershipSyncMessage({
      baseSuccess: "Locais de acesso do membro atualizados.",
      synced: syncResult.data.synced,
      removed: syncResult.data.removed,
      errors: syncResult.data.errors,
    }),
  };
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

  const deviceIdsResult = await listMembershipAccessDeviceIds(membershipId);
  if (!deviceIdsResult.ok) {
    revalidatePath(`/app/${condoSlug}/settings/members`);
    revalidatePath(`/app/${condoSlug}/settings/members/${membershipId}`);
    return {
      success:
        "Dados pessoais atualizados, mas não foi possível sincronizar o ControlID: " +
        (deviceIdsResult.error ?? "erro desconhecido"),
    };
  }

  let syncMessage = "Dados pessoais atualizados.";

  if (deviceIdsResult.data.length > 0) {
    const syncResult = await syncMembershipToControlIdDevices({
      membershipId,
      fullName,
      photoUrl: avatarUrl,
      accessDeviceIds: deviceIdsResult.data,
    });

    if (!syncResult.ok) {
      revalidatePath(`/app/${condoSlug}/settings/members`);
      revalidatePath(`/app/${condoSlug}/settings/members/${membershipId}`);
      return {
        success:
          "Dados pessoais atualizados, mas o ControlID falhou: " +
          (syncResult.error ?? "erro desconhecido"),
      };
    }

    syncMessage = formatMembershipSyncMessage({
      baseSuccess: "Dados pessoais atualizados.",
      synced: syncResult.data.synced,
      removed: syncResult.data.removed,
      errors: syncResult.data.errors,
    });
  }

  revalidatePath(`/app/${condoSlug}/settings/members`);
  revalidatePath(`/app/${condoSlug}/settings/members/${membershipId}`);
  return { success: syncMessage };
}
