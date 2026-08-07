"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCondoPermission } from "@/lib/auth/access";
import type { AuthActionState } from "@/lib/auth/types";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import {
  getOperationalCondominiumIds,
  resolveDoormanOperationalPanel,
} from "@/lib/condominiums/doorman-panel";
import type { OccurrenceCategory, OccurrenceStatus } from "@/lib/occurrences/types";
import {
  createOccurrence,
  updateOccurrenceStatus,
} from "@/lib/services/occurrences";
import {
  parseOccurrenceFormData,
  parseOccurrenceStatusFormData,
} from "@/lib/validations/occurrence.schema";

function revalidateOccurrencePaths(condoSlug: string, occurrenceId?: string) {
  revalidatePath(`/app/${condoSlug}/occurrences`);
  if (occurrenceId) {
    revalidatePath(`/app/${condoSlug}/occurrences/${occurrenceId}`);
  }
}

async function resolveOccurrenceCondominiumId(
  condoSlug: string,
  membershipCondominiumId: string,
  targetCondominiumId?: string,
): Promise<{ ok: true; condominiumId: string } | { ok: false; error: string }> {
  if (isGeneralCondominium(condoSlug)) {
    return { ok: false, error: "Selecione um condomínio específico para registrar." };
  }

  const panelResult = await resolveDoormanOperationalPanel(condoSlug);
  if (panelResult.ok && panelResult.data.mode === "block") {
    const ids = getOperationalCondominiumIds(panelResult.data, membershipCondominiumId);
    if (targetCondominiumId) {
      if (!ids.includes(targetCondominiumId)) {
        return { ok: false, error: "Condomínio fora do bloco operacional." };
      }
      return { ok: true, condominiumId: targetCondominiumId };
    }
    return { ok: true, condominiumId: membershipCondominiumId };
  }

  return { ok: true, condominiumId: membershipCondominiumId };
}

export async function createOccurrenceAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  if (!condoSlug) {
    return { error: "Dados inválidos." };
  }

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canRegisterOccurrences,
    { redirectTo: `/app/${condoSlug}/occurrences` },
  );

  const parsed = parseOccurrenceFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const targetCondominiumId = String(formData.get("target_condominium_id") ?? "") || undefined;
  const condoScope = await resolveOccurrenceCondominiumId(
    condoSlug,
    access.condominium.id,
    targetCondominiumId,
  );
  if (!condoScope.ok) {
    return { error: condoScope.error };
  }

  const occurredAt = new Date(parsed.data.occurred_at);
  if (Number.isNaN(occurredAt.getTime())) {
    return { error: "Data/hora da ocorrência inválida." };
  }

  const result = await createOccurrence({
    condominiumId: condoScope.condominiumId,
    createdBy: access.profile.id,
    category: parsed.data.category as OccurrenceCategory,
    title: parsed.data.title,
    description: parsed.data.description,
    locationText: parsed.data.location_text,
    unitId: parsed.data.unit_id || null,
    occurredAt: occurredAt.toISOString(),
  });

  if (!result.ok) {
    return { error: result.error ?? "Não foi possível registrar a ocorrência." };
  }

  revalidateOccurrencePaths(condoSlug, result.data.id);
  redirect(`/app/${condoSlug}/occurrences/${result.data.id}?registrado=1`);
}

export async function updateOccurrenceStatusAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  if (!condoSlug) {
    return { error: "Dados inválidos." };
  }

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageOccurrences,
    { redirectTo: `/app/${condoSlug}/occurrences` },
  );

  const parsed = parseOccurrenceStatusFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const result = await updateOccurrenceStatus({
    occurrenceId: parsed.data.occurrence_id,
    status: parsed.data.status as OccurrenceStatus,
    actorId: access.profile.id,
    internalNotes: parsed.data.internal_notes,
  });

  if (!result.ok) {
    return { error: result.error ?? "Não foi possível atualizar o status." };
  }

  revalidateOccurrencePaths(condoSlug, result.data.id);
  return { success: "Status da ocorrência atualizado." };
}
