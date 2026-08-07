"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCondoPermission } from "@/lib/auth/access";
import type { AuthActionState } from "@/lib/auth/types";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { getGranjaCondominiumId } from "@/lib/condominiums/granja-shared-areas";
import { ROLES } from "@/lib/constants";
import type { OccurrenceCategory, OccurrenceStatus } from "@/lib/occurrences/types";
import {
  notifyOccurrenceCreated,
  notifyOccurrenceUpdatedToAuthor,
  resolveOccurrenceCondoSlug,
  resolveOccurrenceCondominiumName,
} from "@/lib/email/occurrence-notifications";
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

  const occurredAt = new Date(parsed.data.occurred_at);
  if (Number.isNaN(occurredAt.getTime())) {
    return { error: "Data/hora da ocorrência inválida." };
  }

  const destination = parsed.data.destination;
  const isGranjaContext = isGeneralCondominium(condoSlug);
  let condominiumId = access.condominium.id;
  let sourceCondominiumId: string | null = null;
  let isGranjaDestination = false;

  if (destination === "granja") {
    if (isGranjaContext) {
      return { error: "Você já está no contexto da Granja Brasil." };
    }

    const granjaId = await getGranjaCondominiumId();
    if (!granjaId) {
      return { error: "Condomínio Granja Brasil não encontrado." };
    }

    condominiumId = granjaId;
    sourceCondominiumId = access.condominium.id;
    isGranjaDestination = true;
  } else if (isGranjaContext) {
    // Registro feito na Granja por admin permanece na Granja.
    isGranjaDestination = true;
  }

  const result = await createOccurrence({
    condominiumId,
    sourceCondominiumId,
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

  const notifySlug =
    (await resolveOccurrenceCondoSlug(result.data.condominium_id)) ?? condoSlug;
  const condominiumName = await resolveOccurrenceCondominiumName(
    result.data.condominium_id,
  );

  try {
    await notifyOccurrenceCreated({
      occurrence: result.data,
      condoSlugForLink: isGranjaDestination ? notifySlug : condoSlug,
      isGranjaDestination,
      condominiumName,
    });
  } catch (error) {
    console.error("[email:occurrence-created]", error);
  }

  revalidateOccurrencePaths(condoSlug, result.data.id);
  if (notifySlug !== condoSlug) {
    revalidateOccurrencePaths(notifySlug, result.data.id);
  }

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

  // Na Granja, só super admin e admin gerenciam.
  if (
    isGeneralCondominium(condoSlug) &&
    access.role !== ROLES.SUPER_ADMIN &&
    access.role !== ROLES.ADMIN
  ) {
    return { error: "Sem permissão para gerenciar ocorrências da Granja Brasil." };
  }

  const parsed = parseOccurrenceStatusFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const result = await updateOccurrenceStatus({
    occurrenceId: parsed.data.occurrence_id,
    status: parsed.data.status as OccurrenceStatus,
    actorId: access.profile.id,
    responseText: parsed.data.response_text,
    internalNotes: parsed.data.internal_notes,
  });

  if (!result.ok) {
    return { error: result.error ?? "Não foi possível atualizar o status." };
  }

  try {
    const linkSlug =
      (await resolveOccurrenceCondoSlug(
        result.data.source_condominium_id ?? result.data.condominium_id,
      )) ?? condoSlug;

    await notifyOccurrenceUpdatedToAuthor({
      occurrence: result.data,
      condoSlugForLink: linkSlug,
      responderName: access.profile.fullName || "Administração",
    });
  } catch (error) {
    console.error("[email:occurrence-updated]", error);
  }

  revalidateOccurrencePaths(condoSlug, result.data.id);
  return { success: "Status da ocorrência atualizado. O reclamante foi notificado por e-mail." };
}
