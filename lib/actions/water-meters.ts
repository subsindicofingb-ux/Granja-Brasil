"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireCondoPermission } from "@/lib/auth/access";
import type { AuthActionState } from "@/lib/auth/types";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { loadDoormanBlockPanelData } from "@/lib/condominiums/doorman-block-data";
import { notifyWaterMeterAbnormalConsumption } from "@/lib/email/water-meter-notifications";
import { createWaterMeterReading, updateWaterMeterReading } from "@/lib/services/water-meters";
import {
  parseWaterMeterReadingFormData,
  parseWaterMeterReadingUpdateFormData,
} from "@/lib/validations/doorman.schema";

function revalidateWaterMeterPaths(condoSlug: string) {
  revalidatePath(`/app/${condoSlug}/water-meters`);
  revalidatePath(`/app/${condoSlug}`);
}

export async function createWaterMeterReadingAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageWaterMeters,
    { redirectTo: `/app/${condoSlug}/water-meters` },
  );

  if (isGeneralCondominium(condoSlug)) {
    return { error: "Leituras de hidrômetro são registradas nos condomínios filhos." };
  }

  const parsed = parseWaterMeterReadingFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const blockPanelResult = await loadDoormanBlockPanelData(condoSlug);
  const isBlockSource = Boolean(blockPanelResult.ok && blockPanelResult.data);
  const targetCondominiumId = isBlockSource
    ? parsed.data.target_condominium_id
    : access.condominium.id;

  if (!targetCondominiumId) {
    return { error: "Selecione o condomínio de destino." };
  }

  if (isBlockSource && blockPanelResult?.ok && blockPanelResult.data) {
    const allowedIds = blockPanelResult.data.condominiums.map((condominium) => condominium.id);
    if (!allowedIds.includes(targetCondominiumId)) {
      return { error: "Condomínio inválido para este bloco." };
    }
  }

  const result = await createWaterMeterReading({
    condominiumId: targetCondominiumId,
    readingDate: parsed.data.reading_date,
    readingValue: parsed.data.reading_value,
    createdBy: access.profile.id,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  if (result.data.alert) {
    after(async () => {
      try {
        await notifyWaterMeterAbnormalConsumption({
          alert: result.data.alert!,
          readingDate: parsed.data.reading_date,
        });
      } catch (error) {
        console.error("[email:water-meter-alert]", error);
      }
    });
  }

  revalidateWaterMeterPaths(condoSlug);

  if (result.data.alert) {
    redirect(`/app/${condoSlug}/water-meters?alerta=1`);
  }

  redirect(`/app/${condoSlug}/water-meters?registrado=1`);
}

export async function updateWaterMeterReadingAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageWaterMeters,
    { redirectTo: `/app/${condoSlug}/water-meters` },
  );

  if (isGeneralCondominium(condoSlug)) {
    return { error: "Leituras de hidrômetro são registradas nos condomínios filhos." };
  }

  const parsed = parseWaterMeterReadingUpdateFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const result = await updateWaterMeterReading({
    condominiumId: access.condominium.id,
    readingId: parsed.data.reading_id,
    readingValue: parsed.data.reading_value,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  revalidateWaterMeterPaths(condoSlug);
  return { success: "Leitura atualizada com sucesso." };
}
