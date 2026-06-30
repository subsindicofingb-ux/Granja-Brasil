"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireCondoPermission } from "@/lib/auth/access";
import type { AuthActionState } from "@/lib/auth/types";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { loadDoormanBlockPanelData } from "@/lib/condominiums/doorman-block-data";
import { notifyCorrespondenceCreated } from "@/lib/email/correspondence-notifications";
import {
  createCorrespondenceNotice,
  markCorrespondenceAsPickedUp,
  resolveCorrespondenceTargetProfile,
} from "@/lib/services/correspondence";
import { resolveUnitContext } from "@/lib/services/unit-access";
import { parseCorrespondenceFormData, parseCorrespondencePickupFormData } from "@/lib/validations/doorman.schema";

function revalidateCorrespondencePaths(condoSlug: string, extraCondoSlugs: string[] = []) {
  revalidatePath(`/app/${condoSlug}/correspondence`);
  revalidatePath(`/app/${condoSlug}`);
  for (const slug of extraCondoSlugs) {
    if (slug !== condoSlug) {
      revalidatePath(`/app/${slug}`);
      revalidatePath(`/app/${slug}/correspondence`);
    }
  }
}

export async function createCorrespondenceNoticeAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageCorrespondence,
    { redirectTo: `/app/${condoSlug}/correspondence` },
  );

  const parsed = parseCorrespondenceFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const isGranjaSource = isGeneralCondominium(condoSlug);
  const blockPanelResult = !isGranjaSource ? await loadDoormanBlockPanelData(condoSlug) : null;
  const isBlockSource = Boolean(blockPanelResult?.ok && blockPanelResult.data);
  const targetCondominiumId =
    isGranjaSource || isBlockSource
      ? parsed.data.target_condominium_id
      : access.condominium.id;

  if (!targetCondominiumId) {
    return { error: "Selecione o condomínio de destino." };
  }

  const unitContext = await resolveUnitContext(parsed.data.unit_id, targetCondominiumId);
  if (!unitContext.ok) {
    return { error: unitContext.error ?? "Unidade inválida." };
  }

  const targetResult = await resolveCorrespondenceTargetProfile({
    unitId: parsed.data.unit_id,
    recipientResidentId: parsed.data.recipient_resident_id,
    recipientName: parsed.data.recipient_name,
  });
  if (!targetResult.ok) {
    return { error: targetResult.error };
  }

  const result = await createCorrespondenceNotice({
    condominiumId: targetCondominiumId,
    unitId: parsed.data.unit_id,
    targetProfileId: targetResult.data.profileId,
    recipientName: targetResult.data.recipientName,
    notifiedViaResponsible: targetResult.data.notifiedViaResponsible,
    description: parsed.data.description,
    carrier: parsed.data.carrier,
    notes: parsed.data.notes,
    createdBy: access.profile.id,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  after(async () => {
    try {
      await notifyCorrespondenceCreated({
        notice: result.data,
        condominiumName: result.data.condominium_name ?? access.condominium.name,
      });
    } catch (error) {
      console.error("[email:correspondence-created]", error);
    }
  });

  revalidateCorrespondencePaths(condoSlug);

  if (isGranjaSource) {
    const supabase = await createClient();
    const { data: targetCondo } = await supabase
      .from("condominiums")
      .select("slug")
      .eq("id", targetCondominiumId)
      .maybeSingle();

    if (targetCondo?.slug) {
      revalidatePath(`/app/${targetCondo.slug}`);
    }
  }

  redirect(`/app/${condoSlug}/correspondence?enviado=1`);
}

export async function markCorrespondencePickedUpAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");

  await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageCorrespondence,
    { redirectTo: `/app/${condoSlug}/correspondence` },
  );

  const parsed = parseCorrespondencePickupFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const pickedUpByName = parsed.data.picked_up_by_name?.trim() ?? "";
  if (!pickedUpByName) {
    return { error: "Informe o nome de quem retirou." };
  }

  const result = await markCorrespondenceAsPickedUp(parsed.data.notice_id, pickedUpByName);
  if (!result.ok) {
    return { error: result.error };
  }

  const supabase = await createClient();
  const { data: targetCondo } = await supabase
    .from("condominiums")
    .select("slug")
    .eq("id", result.data.condominium_id)
    .maybeSingle();

  revalidateCorrespondencePaths(condoSlug, targetCondo?.slug ? [targetCondo.slug] : []);
  return { success: "Correspondência marcada como retirada." };
}
