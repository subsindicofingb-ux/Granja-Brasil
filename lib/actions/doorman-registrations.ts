"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireCondoPermission } from "@/lib/auth/access";
import type { AuthActionState } from "@/lib/auth/types";
import { notifyNewRegistrationRequest } from "@/lib/actions/registration-requests";
import { REGISTRATION_PROFILE_TYPES } from "@/lib/constants";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { loadDoormanBlockPanelData } from "@/lib/condominiums/doorman-block-data";
import { parseAccessDeviceIdsFromFormData } from "@/lib/access-devices/form";
import { createDoormanRegistrationRequest } from "@/lib/services/registration-requests";
import { resolveUnitContext } from "@/lib/services/unit-access";
import { getSupabaseServiceRoleKey, isSupabaseConfigured } from "@/lib/supabase/env";
import { parseDoormanRegistrationRequestFormData } from "@/lib/validations/doorman.schema";

function revalidateDoormanRegistrationPaths(condoSlug: string) {
  revalidatePath(`/app/${condoSlug}/residents/registration-request`);
  revalidatePath(`/app/${condoSlug}/residents`);
  revalidatePath(`/app/${condoSlug}`);
}

export async function createDoormanRegistrationRequestAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canRegisterResidentsWithApproval,
    { redirectTo: `/app/${condoSlug}` },
  );

  if (!isSupabaseConfigured() || !getSupabaseServiceRoleKey()) {
    return {
      error:
        "Cadastro indisponível no momento. Entre em contato com a administração do condomínio.",
    };
  }

  const parsed = parseDoormanRegistrationRequestFormData(formData);
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

  const result = await createDoormanRegistrationRequest({
    condominiumId: targetCondominiumId,
    unitId: parsed.data.unit_id,
    fullName: parsed.data.full_name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    residentType: parsed.data.resident_type,
    accessDeviceIds: parseAccessDeviceIdsFromFormData(formData),
  });

  if (!result.ok) {
    return { error: result.error ?? "Não foi possível enviar a solicitação." };
  }

  after(async () => {
    try {
      await notifyNewRegistrationRequest({
        requestId: result.data.id,
        condominiumId: result.data.condominium_id,
        condominiumName: result.data.condominium?.name ?? "Condomínio",
        fullName: result.data.full_name,
        email: result.data.email,
        unitLabel: result.data.unit_number ?? "—",
        profileType: REGISTRATION_PROFILE_TYPES.RESIDENT,
        residentType: result.data.resident_type,
      });
    } catch (error) {
      console.error("[email:doorman-registration-request]", error);
    }
  });

  revalidateDoormanRegistrationPaths(condoSlug);
  redirect(`/app/${condoSlug}/residents/registration-request?enviado=1`);
}
