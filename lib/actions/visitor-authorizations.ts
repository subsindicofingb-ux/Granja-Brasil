"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireCondoAccess, requireCondoPermission } from "@/lib/auth/access";
import type { AuthActionState } from "@/lib/auth/types";
import { ROLES } from "@/lib/constants";
import { parseAccessDeviceIdsFromFormData } from "@/lib/access-devices/form";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { resolveUnitContext } from "@/lib/services/unit-access";
import {
  activateVisitorAccessGrantsOnApproval,
  checkInVisitorAuthorization,
  checkOutVisitorAuthorization,
  listUnitIdsForVisitorRegistration,
  replaceVisitorAuthorizationAccessDevices,
} from "@/lib/services/visitor-access-grants";
import { notifyVisitorAuthorizationRequest } from "@/lib/visitors/notifications";
import {
  approveVisitorAuthorization,
  cancelVisitorAuthorization,
  createVisitorAuthorization,
  rejectVisitorAuthorization,
  updateVisitorAuthorization,
  updateVisitorAuthorizationAccess,
  updateVisitorDoormanNotes,
} from "@/lib/services/visitor-authorizations";
import {
  formDataHasRemovePhoto,
  resolvePhotoUrl,
  uploadCondoImage,
} from "@/lib/storage/upload-image";
import {
  parseDoormanNotesFormData,
  parseVisitorAuthorizationFormData,
  toVisitorAuthorizationPayload,
} from "@/lib/validations/visitor-authorization.schema";
import { parseVisitorAccessFormData } from "@/lib/validations/visitor-access.schema";

function revalidateVisitorPaths(condoSlug: string, authorizationId?: string, unitId?: string) {
  revalidatePath(`/app/${condoSlug}/visitors`);
  revalidatePath(`/app/${condoSlug}/visitors/consult`);
  if (authorizationId) {
    revalidatePath(`/app/${condoSlug}/visitors/${authorizationId}`);
  }
  if (unitId) {
    revalidatePath(`/app/${condoSlug}/units/${unitId}`);
  }
}

function getPhotoFile(formData: FormData): File | null {
  const value = formData.get("photo");
  return value instanceof File ? value : null;
}

async function assertCanRegisterForUnit(
  isResidentRegistration: boolean,
  profileId: string,
  condominiumId: string,
  unitId: string,
): Promise<AuthActionState | null> {
  if (!isResidentRegistration) {
    return null;
  }

  const unitsResult = await listUnitIdsForVisitorRegistration(profileId, condominiumId);

  if (!unitsResult.ok) {
    return { error: unitsResult.error };
  }

  if (!unitsResult.data.includes(unitId)) {
    return {
      error: "Você só pode autorizar visitas para a sua unidade neste condomínio.",
    };
  }

  return null;
}

async function assertCanCheckInOutVisitor(
  access: Awaited<ReturnType<typeof requireCondoAccess>>,
  unitId: string,
): Promise<AuthActionState | null> {
  if (
    access.permissions.canManageVisitorAuthorizations ||
    access.permissions.canConsultVisitorAuthorizations
  ) {
    return null;
  }

  if (access.role !== ROLES.RESIDENT || !access.permissions.canRegisterVisitorAuthorizations) {
    return { error: "Sem permissão para registrar entrada ou saída do visitante." };
  }

  const unitsResult = await listUnitIdsForVisitorRegistration(
    access.profile.id,
    access.condominium.id,
  );

  if (!unitsResult.ok) {
    return { error: unitsResult.error };
  }

  if (!unitsResult.data.includes(unitId)) {
    return { error: "Você só pode registrar check-in/out de visitantes da sua unidade." };
  }

  return null;
}

async function resolveVisitorPhotoUrl(
  formData: FormData,
  condominiumId: string,
  existingPhotoUrl?: string | null,
): Promise<AuthActionState | { photoUrl: string | null }> {
  const uploadResult = await uploadCondoImage({
    condominiumId,
    folder: "visitors",
    file: getPhotoFile(formData),
  });

  if (!uploadResult.ok) {
    return { error: uploadResult.error };
  }

  return {
    photoUrl: resolvePhotoUrl(
      uploadResult.data,
      existingPhotoUrl,
      formDataHasRemovePhoto(formData),
    ),
  };
}

export async function createVisitorAuthorizationAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const access = await requireCondoAccess(condoSlug);

  if (!access.permissions.canRegisterVisitorAuthorizations) {
    return { error: "Sem permissão para registrar visitantes." };
  }

  const parsed = parseVisitorAuthorizationFormData(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const isStaff = access.permissions.canManageVisitorAuthorizations;
  const isResidentRegistration = access.role === ROLES.RESIDENT;
  const isGeneralCondo = isGeneralCondominium(condoSlug);
  const scopeCondominiumId = isGeneralCondo ? undefined : access.condominium.id;

  const unitCheck = await assertCanRegisterForUnit(
    isResidentRegistration,
    access.profile.id,
    access.condominium.id,
    parsed.data.unit_id,
  );

  if (unitCheck?.error) {
    return unitCheck;
  }

  const unitContext = await resolveUnitContext(parsed.data.unit_id, scopeCondominiumId);
  if (!unitContext.ok) {
    return { error: unitContext.error };
  }

  const photoResult = await resolveVisitorPhotoUrl(formData, unitContext.data.unitCondominiumId);
  if ("error" in photoResult && photoResult.error) {
    return { error: photoResult.error };
  }
  const photoUrl = "photoUrl" in photoResult ? photoResult.photoUrl : null;

  const accessDeviceIds = parseAccessDeviceIdsFromFormData(formData);
  const syncControlId = formData.get("sync_controlid") === "1";

  const result = await createVisitorAuthorization({
    condominiumId: access.condominium.id,
    scopeCondominiumId,
    requestedBy: access.profile.id,
    createdByStaff: isStaff,
    data: {
      ...toVisitorAuthorizationPayload(parsed.data),
      photo_url: photoUrl,
      sync_controlid: syncControlId && accessDeviceIds.length > 0,
    },
  });

  if (!result.ok) {
    return { error: result.error };
  }

  if (accessDeviceIds.length > 0) {
    const devicesResult = await replaceVisitorAuthorizationAccessDevices({
      visitorAuthorizationId: result.data.id,
      condominiumId: unitContext.data.unitCondominiumId,
      accessDeviceIds,
    });

    if (!devicesResult.ok) {
      return { error: devicesResult.error ?? "Autorização criada, mas locais de acesso não foram salvos." };
    }
  }

  if (isStaff && syncControlId && accessDeviceIds.length > 0) {
    await activateVisitorAccessGrantsOnApproval(result.data.id, unitContext.data.unitCondominiumId);
  }

  if (!isStaff) {
    after(async () => {
      try {
        await notifyVisitorAuthorizationRequest({
          authorization: result.data,
          condominiumId: access.condominium.id,
          requesterName: access.profile.fullName,
        });
      } catch (error) {
        console.error("[visitors:notify-request]", error);
      }
    });
  }

  revalidateVisitorPaths(condoSlug, result.data.id);
  redirect(`/app/${condoSlug}/visitors/${result.data.id}`);
}

export async function updateVisitorAuthorizationAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const authorizationId = String(formData.get("authorization_id") ?? "");

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageVisitorAuthorizations,
    { redirectTo: `/app/${condoSlug}/visitors/${authorizationId}` },
  );

  const parsed = parseVisitorAuthorizationFormData(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const isGeneralCondo = isGeneralCondominium(condoSlug);
  const scopeCondominiumId = isGeneralCondo ? undefined : access.condominium.id;

  const unitContext = await resolveUnitContext(parsed.data.unit_id, scopeCondominiumId);
  if (!unitContext.ok) {
    return { error: unitContext.error };
  }

  const existingPhotoUrl = String(formData.get("existing_photo_url") ?? "") || null;
  const photoResult = await resolveVisitorPhotoUrl(
    formData,
    unitContext.data.unitCondominiumId,
    existingPhotoUrl,
  );
  if ("error" in photoResult && photoResult.error) {
    return { error: photoResult.error };
  }
  const photoUrl = "photoUrl" in photoResult ? photoResult.photoUrl : null;

  const accessDeviceIds = parseAccessDeviceIdsFromFormData(formData);
  const syncControlId = formData.get("sync_controlid") === "1";

  const result = await updateVisitorAuthorization({
    authorizationId,
    condominiumId: access.condominium.id,
    scopeCondominiumId,
    data: {
      ...toVisitorAuthorizationPayload(parsed.data),
      photo_url: photoUrl,
      sync_controlid: syncControlId && accessDeviceIds.length > 0,
    },
  });

  if (!result.ok) {
    return { error: result.error };
  }

  const devicesResult = await replaceVisitorAuthorizationAccessDevices({
    visitorAuthorizationId: authorizationId,
    condominiumId: unitContext.data.unitCondominiumId,
    accessDeviceIds,
  });

  if (!devicesResult.ok) {
    return { error: devicesResult.error ?? "Dados salvos, mas locais de acesso não foram atualizados." };
  }

  revalidateVisitorPaths(condoSlug, authorizationId);
  redirect(`/app/${condoSlug}/visitors/${authorizationId}`);
}

export async function updateVisitorAuthorizationAccessAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const authorizationId = String(formData.get("authorization_id") ?? "");

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageVisitorAuthorizations,
    { redirectTo: `/app/${condoSlug}/visitors/${authorizationId}` },
  );

  const parsed = parseVisitorAccessFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const accessDeviceIds = parseAccessDeviceIdsFromFormData(formData);
  const syncControlId = formData.get("sync_controlid") === "1";

  const result = await updateVisitorAuthorizationAccess({
    authorizationId,
    condominiumId: access.condominium.id,
    accessStartsAt: parsed.data.access_starts_at,
    accessEndsAt: parsed.data.access_ends_at,
    syncControlId: syncControlId && accessDeviceIds.length > 0,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  const devicesResult = await replaceVisitorAuthorizationAccessDevices({
    visitorAuthorizationId: authorizationId,
    condominiumId: result.data.condominium_id,
    accessDeviceIds: syncControlId ? accessDeviceIds : [],
  });

  if (!devicesResult.ok) {
    return { error: devicesResult.error ?? "Período salvo, mas locais de acesso não foram atualizados." };
  }

  if (result.data.status === "approved" && syncControlId && accessDeviceIds.length > 0) {
    await activateVisitorAccessGrantsOnApproval(authorizationId, result.data.condominium_id);
  }

  revalidateVisitorPaths(condoSlug, authorizationId, result.data.unit_id);
  return { success: "Período e ControlIDs atualizados." };
}

export async function approveVisitorAuthorizationAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const authorizationId = String(formData.get("authorization_id") ?? "");

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canApproveVisitorAuthorizations,
    { redirectTo: `/app/${condoSlug}/visitors/${authorizationId}` },
  );

  const result = await approveVisitorAuthorization(
    authorizationId,
    access.condominium.id,
    access.profile.id,
  );

  if (!result.ok) {
    return { error: result.error };
  }

  if (result.data.sync_controlid) {
    const grantsResult = await activateVisitorAccessGrantsOnApproval(
      authorizationId,
      access.condominium.id,
    );
    if (!grantsResult.ok) {
      return { error: grantsResult.error ?? "Aprovado, mas locais ControlID não foram preparados." };
    }
  }

  revalidateVisitorPaths(condoSlug, authorizationId);
  return { success: "Autorização aprovada com sucesso." };
}

export async function rejectVisitorAuthorizationAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const authorizationId = String(formData.get("authorization_id") ?? "");

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canApproveVisitorAuthorizations,
    { redirectTo: `/app/${condoSlug}/visitors/${authorizationId}` },
  );

  const result = await rejectVisitorAuthorization(
    authorizationId,
    access.condominium.id,
    access.profile.id,
  );

  if (!result.ok) {
    return { error: result.error };
  }

  revalidateVisitorPaths(condoSlug, authorizationId);
  return { success: "Autorização rejeitada." };
}

export async function cancelVisitorAuthorizationAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const authorizationId = String(formData.get("authorization_id") ?? "");

  const access = await requireCondoAccess(condoSlug);

  if (
    !access.permissions.canManageVisitorAuthorizations &&
    !access.permissions.canRegisterVisitorAuthorizations
  ) {
    return { error: "Sem permissão para cancelar autorizações." };
  }

  const result = await cancelVisitorAuthorization(authorizationId, access.condominium.id);

  if (!result.ok) {
    return { error: result.error };
  }

  revalidateVisitorPaths(condoSlug, authorizationId);
  return { success: "Autorização cancelada." };
}

export async function updateDoormanNotesAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const authorizationId = String(formData.get("authorization_id") ?? "");

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canConsultVisitorAuthorizations,
    { redirectTo: `/app/${condoSlug}/visitors/${authorizationId}` },
  );

  const parsed = parseDoormanNotesFormData(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const result = await updateVisitorDoormanNotes({
    authorizationId,
    condominiumId: access.condominium.id,
    doormanNotes: parsed.data.doorman_notes,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  revalidateVisitorPaths(condoSlug, authorizationId);
  return { success: "Notas da portaria salvas." };
}

export async function checkInVisitorAuthorizationAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const authorizationId = String(formData.get("authorization_id") ?? "");
  const unitId = String(formData.get("unit_id") ?? "");

  const access = await requireCondoAccess(condoSlug);
  const permissionCheck = await assertCanCheckInOutVisitor(access, unitId);

  if (permissionCheck?.error) {
    return permissionCheck;
  }

  const result = await checkInVisitorAuthorization({
    visitorAuthorizationId: authorizationId,
    condominiumId: access.condominium.id,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  revalidateVisitorPaths(condoSlug, authorizationId);
  return { success: "Check-in registrado. Sync ControlID em andamento." };
}

export async function checkOutVisitorAuthorizationAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const authorizationId = String(formData.get("authorization_id") ?? "");
  const unitId = String(formData.get("unit_id") ?? "");

  const access = await requireCondoAccess(condoSlug);
  const permissionCheck = await assertCanCheckInOutVisitor(access, unitId);

  if (permissionCheck?.error) {
    return permissionCheck;
  }

  const result = await checkOutVisitorAuthorization({
    visitorAuthorizationId: authorizationId,
    condominiumId: access.condominium.id,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  revalidateVisitorPaths(condoSlug, authorizationId);
  return { success: "Check-out registrado. Remoção facial ControlID em andamento." };
}
