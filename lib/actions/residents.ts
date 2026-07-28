"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCondoPermission, requireCondoAccess } from "@/lib/auth/access";
import type { AuthActionState } from "@/lib/auth/types";
import { ROLES } from "@/lib/constants";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { loadDoormanBlockPanelData } from "@/lib/condominiums/doorman-block-data";
import { parseAccessDeviceIdsFromFormData } from "@/lib/access-devices/form";
import {
  enqueueResidentProfileSyncUpdates,
  runPendingAccessSync,
} from "@/lib/services/access-sync";
import { createResident, deleteResident, getResidentById, updateResident, updateResidentPhoto } from "@/lib/services/residents";
import { replaceResidentAccessGrants } from "@/lib/services/resident-access-grants";
import { resolveUnitContext } from "@/lib/services/unit-access";
import {
  formDataHasRemovePhoto,
  resolvePhotoUrl,
  uploadCondoImage,
} from "@/lib/storage/upload-image";
import { residentFormSchema } from "@/lib/validations/structure.schema";

function revalidateResidentPaths(condoSlug: string, residentId?: string) {
  revalidatePath(`/app/${condoSlug}/residents`);
  if (residentId) {
    revalidatePath(`/app/${condoSlug}/residents/${residentId}`);
  }
}

function getPhotoFile(formData: FormData): File | null {
  const value = formData.get("photo");
  return value instanceof File ? value : null;
}

async function resolveResidentUnitScope(input: {
  condoSlug: string;
  membershipCondominiumId: string;
  unitId: string;
}): Promise<
  | {
      ok: true;
      unitCondominiumId: string;
      scopeCondominiumId?: string;
      allowedAccessCondominiumIds?: string[];
    }
  | { ok: false; error: string }
> {
  const isGeneralCondo = isGeneralCondominium(input.condoSlug);
  if (isGeneralCondo) {
    const unitContext = await resolveUnitContext(input.unitId);
    if (!unitContext.ok) {
      return { ok: false, error: unitContext.error };
    }

    return {
      ok: true,
      unitCondominiumId: unitContext.data.unitCondominiumId,
    };
  }

  const blockPanelResult = await loadDoormanBlockPanelData(input.condoSlug);
  if (blockPanelResult.ok && blockPanelResult.data) {
    const allowedIds = blockPanelResult.data.condominiums.map((condominium) => condominium.id);
    const allowedSet = new Set(allowedIds);
    const unitContext = await resolveUnitContext(input.unitId);
    if (!unitContext.ok) {
      return { ok: false, error: unitContext.error };
    }

    if (!allowedSet.has(unitContext.data.unitCondominiumId)) {
      return { ok: false, error: "Unidade inválida para este bloco." };
    }

    return {
      ok: true,
      unitCondominiumId: unitContext.data.unitCondominiumId,
      scopeCondominiumId: unitContext.data.unitCondominiumId,
      allowedAccessCondominiumIds: allowedIds,
    };
  }

  const unitContext = await resolveUnitContext(
    input.unitId,
    input.membershipCondominiumId,
  );
  if (!unitContext.ok) {
    return { ok: false, error: unitContext.error };
  }

  return {
    ok: true,
    unitCondominiumId: unitContext.data.unitCondominiumId,
    scopeCondominiumId: input.membershipCondominiumId,
    allowedAccessCondominiumIds: [input.membershipCondominiumId],
  };
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

  const unitScope = await resolveResidentUnitScope({
    condoSlug,
    membershipCondominiumId: access.condominium.id,
    unitId: parsed.data.unit_id,
  });

  if (!unitScope.ok) {
    return { error: unitScope.error };
  }

  const uploadResult = await uploadCondoImage({
    condominiumId: unitScope.unitCondominiumId,
    folder: "residents",
    file: getPhotoFile(formData),
  });

  if (!uploadResult.ok) {
    return { error: uploadResult.error };
  }

  const result = await createResident({
    condominiumId: unitScope.scopeCondominiumId,
    unitId: parsed.data.unit_id,
    fullName: parsed.data.full_name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    photoUrl: uploadResult.data,
    type: parsed.data.type,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  const grantsResult = await replaceResidentAccessGrants({
    residentId: result.data.id,
    condominiumId: unitScope.unitCondominiumId,
    accessDeviceIds: parseAccessDeviceIdsFromFormData(formData),
    allowedCondominiumIds: unitScope.allowedAccessCondominiumIds,
  });

  if (!grantsResult.ok) {
    return { error: grantsResult.error ?? "Morador criado, mas locais de acesso não foram salvos." };
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
  const existingPhotoUrl = String(formData.get("existing_photo_url") ?? "") || null;

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

  const unitScope = await resolveResidentUnitScope({
    condoSlug,
    membershipCondominiumId: access.condominium.id,
    unitId: parsed.data.unit_id,
  });

  if (!unitScope.ok) {
    return { error: unitScope.error };
  }

  const uploadResult = await uploadCondoImage({
    condominiumId: unitScope.unitCondominiumId,
    folder: "residents",
    file: getPhotoFile(formData),
  });

  if (!uploadResult.ok) {
    return { error: uploadResult.error };
  }

  const result = await updateResident({
    residentId,
    condominiumId: unitScope.scopeCondominiumId,
    unitId: parsed.data.unit_id,
    fullName: parsed.data.full_name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    photoUrl: resolvePhotoUrl(
      uploadResult.data,
      existingPhotoUrl,
      formDataHasRemovePhoto(formData),
    ),
    type: parsed.data.type,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  const grantsResult = await replaceResidentAccessGrants({
    residentId,
    condominiumId: unitScope.unitCondominiumId,
    accessDeviceIds: parseAccessDeviceIdsFromFormData(formData),
    allowedCondominiumIds: unitScope.allowedAccessCondominiumIds,
    processSync: false,
  });

  if (!grantsResult.ok) {
    return { error: grantsResult.error ?? "Morador atualizado, mas locais de acesso não foram salvos." };
  }

  await enqueueResidentProfileSyncUpdates(residentId);
  await runPendingAccessSync({
    limit: Math.max(5, parseAccessDeviceIdsFromFormData(formData).length + 2),
  });

  revalidateResidentPaths(condoSlug, residentId);
  return { success: "Morador atualizado com sucesso." };
}

export async function updateResidentAccessGrantsAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const residentId = String(formData.get("resident_id") ?? "");

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) =>
      ctx.permissions.canViewAccessDevices ||
      ctx.permissions.canManageAccessDevices ||
      ctx.permissions.canManageResidents,
    { redirectTo: `/app/${condoSlug}/residents/${residentId}` },
  );

  const isGeneralCondo = isGeneralCondominium(condoSlug);
  const blockPanelResult = !isGeneralCondo
    ? await loadDoormanBlockPanelData(condoSlug)
    : { ok: true as const, data: null };
  const blockPanel = blockPanelResult.ok ? blockPanelResult.data : null;
  const scopeCondominiumId =
    isGeneralCondo || blockPanel ? undefined : access.condominium.id;

  const residentResult = await getResidentById(residentId, {
    condominiumId: scopeCondominiumId,
  });

  if (!residentResult.ok) {
    return { error: residentResult.error ?? "Morador não encontrado." };
  }

  const unitCondominiumId = residentResult.data.unit.tower.condominium_id;

  if (
    blockPanel &&
    !blockPanel.condominiums.some((condominium) => condominium.id === unitCondominiumId)
  ) {
    return { error: "Morador fora do bloco operacional desta portaria." };
  }

  const allowedAccessCondominiumIds = blockPanel
    ? blockPanel.condominiums.map((condominium) => condominium.id)
    : isGeneralCondo
      ? undefined
      : [access.condominium.id];

  const accessDeviceIds = parseAccessDeviceIdsFromFormData(formData);
  const grantsResult = await replaceResidentAccessGrants({
    residentId,
    condominiumId: unitCondominiumId,
    accessDeviceIds,
    allowedCondominiumIds: allowedAccessCondominiumIds,
  });

  if (!grantsResult.ok) {
    return { error: grantsResult.error ?? "Não foi possível salvar os locais de acesso." };
  }

  revalidateResidentPaths(condoSlug, residentId);
  return { success: "Locais de acesso atualizados." };
}

export async function updateResidentPhotoAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const residentId = String(formData.get("resident_id") ?? "");
  const existingPhotoUrl = String(formData.get("existing_photo_url") ?? "") || null;

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageResidents || ctx.permissions.canConsultResidents,
    { redirectTo: `/app/${condoSlug}/residents/${residentId}` },
  );

  const isGeneralCondo = isGeneralCondominium(condoSlug);
  const scopeCondominiumId = isGeneralCondo ? undefined : access.condominium.id;

  const residentResult = await getResidentById(residentId, { condominiumId: scopeCondominiumId });

  if (!residentResult.ok) {
    return { error: residentResult.error };
  }

  const unitCondominiumId = residentResult.data.unit.tower.condominium_id;

  const uploadResult = await uploadCondoImage({
    condominiumId: unitCondominiumId,
    folder: "residents",
    file: getPhotoFile(formData),
  });

  if (!uploadResult.ok) {
    return { error: uploadResult.error };
  }

  const photoUrl = resolvePhotoUrl(
    uploadResult.data,
    existingPhotoUrl,
    formDataHasRemovePhoto(formData),
  );

  if (!photoUrl && !formDataHasRemovePhoto(formData) && !getPhotoFile(formData)) {
    return { error: "Selecione uma foto para enviar." };
  }

  const result = await updateResidentPhoto({
    residentId,
    condominiumId: scopeCondominiumId,
    photoUrl,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  await enqueueResidentProfileSyncUpdates(residentId);
  await runPendingAccessSync({ limit: 5 });

  revalidateResidentPaths(condoSlug, residentId);
  return { success: "Foto atualizada com sucesso." };
}

export async function deleteResidentAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const residentId = String(formData.get("resident_id") ?? "");

  const access = await requireCondoAccess(condoSlug);

  if (access.role !== ROLES.SYNDIC && access.role !== ROLES.SUPER_ADMIN) {
    return { error: "Somente o síndico ou a Granja podem excluir moradores." };
  }

  if (!access.permissions.canManageResidents) {
    return { error: "Sem permissão para excluir moradores." };
  }

  const isGeneralCondo = isGeneralCondominium(condoSlug);
  const blockPanelResult = !isGeneralCondo
    ? await loadDoormanBlockPanelData(condoSlug)
    : null;
  const isBlockSource = Boolean(blockPanelResult?.ok && blockPanelResult.data);

  let scopeCondominiumId: string | undefined = isGeneralCondo
    ? undefined
    : access.condominium.id;

  if (isBlockSource && blockPanelResult?.ok && blockPanelResult.data) {
    const residentResult = await getResidentById(residentId);
    if (!residentResult.ok) {
      return { error: residentResult.error };
    }

    const residentCondominiumId = residentResult.data.unit.tower.condominium_id;
    const allowed = blockPanelResult.data.condominiums.some(
      (condominium) => condominium.id === residentCondominiumId,
    );

    if (!allowed) {
      return { error: "Morador inválido para este bloco." };
    }

    scopeCondominiumId = residentCondominiumId;
  }

  const result = await deleteResident({
    residentId,
    condominiumId: scopeCondominiumId,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  revalidateResidentPaths(condoSlug);
  redirect(`/app/${condoSlug}/residents`);
}
