"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireCondoPermission } from "@/lib/auth/access";
import type { AuthActionState } from "@/lib/auth/types";
import {
  notifyNewRegistrationRequest,
} from "@/lib/actions/registration-requests";
import { notifyRegistrationApprovedEvent } from "@/lib/registrations/notifications";
import { REGISTRATION_PROFILE_TYPES } from "@/lib/constants";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { loadDoormanBlockPanelData } from "@/lib/condominiums/doorman-block-data";
import { parseAccessDeviceIdsFromFormData } from "@/lib/access-devices/form";
import {
  listActiveAccessDevicesForCondominium,
} from "@/lib/services/resident-access-grants";
import { createDoormanRegistrationRequest } from "@/lib/services/registration-requests";
import { resolveUnitContext } from "@/lib/services/unit-access";
import { getSupabaseServiceRoleKey, isSupabaseConfigured } from "@/lib/supabase/env";
import { uploadCondoImage } from "@/lib/storage/upload-image";
import { parseDoormanRegistrationRequestFormData } from "@/lib/validations/doorman.schema";

function revalidateDoormanRegistrationPaths(condoSlug: string, targetCondoSlug?: string) {
  revalidatePath(`/app/${condoSlug}/residents/registration-request`);
  revalidatePath(`/app/${condoSlug}/residents`);
  revalidatePath(`/app/${condoSlug}`);
  revalidatePath(`/app/${condoSlug}/settings/registration-requests`);
  if (targetCondoSlug && targetCondoSlug !== condoSlug) {
    revalidatePath(`/app/${targetCondoSlug}/residents`);
    revalidatePath(`/app/${targetCondoSlug}/settings/registration-requests`);
  }
}

function getPhotoFile(formData: FormData): File | null {
  const value = formData.get("photo");
  return value instanceof File && value.size > 0 ? value : null;
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

  const accessDeviceIds = parseAccessDeviceIdsFromFormData(formData);

  if (accessDeviceIds.length > 0 && !getPhotoFile(formData)) {
    return {
      error: "Informe a foto do morador para liberar o acesso facial nos locais selecionados.",
    };
  }

  const uploadResult = await uploadCondoImage({
    condominiumId: targetCondominiumId,
    folder: "registration-requests",
    file: getPhotoFile(formData),
  });

  if (!uploadResult.ok) {
    return { error: uploadResult.error };
  }

  const result = await createDoormanRegistrationRequest({
    condominiumId: targetCondominiumId,
    unitId: parsed.data.unit_id,
    fullName: parsed.data.full_name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    photoUrl: uploadResult.data,
    residentType: parsed.data.resident_type,
    accessDeviceIds,
    doormanProfileId: access.profile.id,
    password: parsed.data.password,
  });

  if (!result.ok) {
    return { error: result.error ?? "Não foi possível concluir o cadastro." };
  }

  const devicesResult = await listActiveAccessDevicesForCondominium(targetCondominiumId);
  const accessDeviceNames =
    devicesResult.ok
      ? devicesResult.data
          .filter((device) => accessDeviceIds.includes(device.id))
          .map((device) => device.display_name)
      : [];

  const unitLabel = result.data.request.unit_number ?? "—";
  const condominiumName = result.data.request.condominium?.name ?? "Condomínio";

  after(async () => {
    try {
      await notifyNewRegistrationRequest({
        requestId: result.data.request.id,
        condominiumId: result.data.request.condominium_id,
        condominiumName,
        fullName: result.data.request.full_name,
        email: result.data.request.email,
        unitLabel,
        profileType: REGISTRATION_PROFILE_TYPES.RESIDENT,
        residentType: result.data.request.resident_type,
        source: "doorman",
        fulfilledImmediately: true,
        accessDeviceNames,
      });

      await notifyRegistrationApprovedEvent({
        type: "registration_request_approved",
        condominiumId: result.data.request.condominium_id,
        condominiumName,
        fullName: result.data.request.full_name,
        email: result.data.request.email,
        unitLabel,
        accessDeviceNames,
      });
    } catch (error) {
      console.error("[email:doorman-registration-request]", error);
    }
  });

  revalidateDoormanRegistrationPaths(
    condoSlug,
    result.data.request.condominium?.slug ?? undefined,
  );

  const redirectQuery = "enviado=1";
  redirect(`/app/${condoSlug}/residents/registration-request?${redirectQuery}`);
}
