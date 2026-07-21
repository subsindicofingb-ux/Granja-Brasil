"use server";

import { revalidatePath } from "next/cache";
import { requireCondoAccess } from "@/lib/auth/access";
import type { AuthActionState } from "@/lib/auth/types";
import { remoteOpenAccessDevice, type RemoteOpenReason } from "@/lib/services/access-remote-open";

function parseReason(value: FormDataEntryValue | null): RemoteOpenReason | null {
  if (value === "visitor" || value === "emergency") {
    return value;
  }
  return null;
}

export async function remoteOpenAccessDeviceAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const accessDeviceId = String(formData.get("access_device_id") ?? "").trim();
  const reason = parseReason(formData.get("reason"));
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!condoSlug) {
    return { error: "Condomínio inválido." };
  }

  if (!accessDeviceId) {
    return { error: "Selecione o local de acesso." };
  }

  if (!reason) {
    return { error: "Informe o motivo: visita ou emergência." };
  }

  const access = await requireCondoAccess(condoSlug);

  const result = await remoteOpenAccessDevice({
    condominiumId: access.condominium.id,
    profileId: access.profile.id,
    role: access.role,
    accessDeviceId,
    reason,
    notes,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath(`/app/${condoSlug}/access-open`);
  return {
    success:
      reason === "emergency"
        ? `Pulso de emergência enviado para ${result.data.deviceName}.`
        : `Pulso de visita enviado para ${result.data.deviceName}.`,
  };
}
