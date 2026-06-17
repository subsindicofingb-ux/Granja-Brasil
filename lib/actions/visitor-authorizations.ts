"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCondoAccess, requireCondoPermission } from "@/lib/auth/access";
import type { AuthActionState } from "@/lib/auth/types";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { listUnitIdsForProfile } from "@/lib/services/reservations";
import {
  approveVisitorAuthorization,
  cancelVisitorAuthorization,
  createVisitorAuthorization,
  rejectVisitorAuthorization,
  updateVisitorAuthorization,
  updateVisitorDoormanNotes,
} from "@/lib/services/visitor-authorizations";
import {
  parseDoormanNotesFormData,
  parseVisitorAuthorizationFormData,
  toVisitorAuthorizationPayload,
} from "@/lib/validations/visitor-authorization.schema";

function revalidateVisitorPaths(condoSlug: string, authorizationId?: string) {
  revalidatePath(`/app/${condoSlug}/visitors`);
  revalidatePath(`/app/${condoSlug}/visitors/consult`);
  if (authorizationId) {
    revalidatePath(`/app/${condoSlug}/visitors/${authorizationId}`);
  }
}

async function assertCanRegisterForUnit(
  isStaff: boolean,
  profileId: string,
  condominiumId: string,
  unitId: string,
): Promise<AuthActionState | null> {
  if (isStaff) {
    return null;
  }

  const unitsResult = await listUnitIdsForProfile(profileId, condominiumId);

  if (!unitsResult.ok) {
    return { error: unitsResult.error };
  }

  if (!unitsResult.data.includes(unitId)) {
    return { error: "Você só pode autorizar visitantes para suas unidades." };
  }

  return null;
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
  const isGeneralCondo = isGeneralCondominium(condoSlug);
  const scopeCondominiumId = isGeneralCondo ? undefined : access.condominium.id;

  const unitCheck = await assertCanRegisterForUnit(
    isStaff,
    access.profile.id,
    access.condominium.id,
    parsed.data.unit_id,
  );

  if (unitCheck?.error) {
    return unitCheck;
  }

  const result = await createVisitorAuthorization({
    condominiumId: access.condominium.id,
    scopeCondominiumId,
    requestedBy: access.profile.id,
    createdByStaff: isStaff,
    data: toVisitorAuthorizationPayload(parsed.data),
  });

  if (!result.ok) {
    return { error: result.error };
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

  const result = await updateVisitorAuthorization({
    authorizationId,
    condominiumId: access.condominium.id,
    scopeCondominiumId,
    data: toVisitorAuthorizationPayload(parsed.data),
  });

  if (!result.ok) {
    return { error: result.error };
  }

  revalidateVisitorPaths(condoSlug, authorizationId);
  redirect(`/app/${condoSlug}/visitors/${authorizationId}`);
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
