"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireCondoPermission } from "@/lib/auth/access";
import type { AuthActionState } from "@/lib/auth/types";
import { triggerAccessSyncProcessing } from "@/lib/access-devices/sync-env";
import {
  enqueueResidentAccessSyncJobs,
  processPendingAccessSyncJobs,
} from "@/lib/services/access-sync";
import { getResidentAccessDeviceIds } from "@/lib/services/resident-access-grants";
import { getResidentById } from "@/lib/services/residents";

export async function syncResidentAccessAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const residentId = String(formData.get("resident_id") ?? "");

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageResidents,
    { redirectTo: `/app/${condoSlug}/residents/${residentId}` },
  );

  const residentResult = await getResidentById(residentId, {
    condominiumId: access.condominium.id,
  });

  if (!residentResult.ok) {
    return { error: residentResult.error ?? "Morador não encontrado." };
  }

  const deviceIdsResult = await getResidentAccessDeviceIds(residentId);
  if (!deviceIdsResult.ok) {
    return { error: deviceIdsResult.error ?? "Erro ao carregar locais do morador." };
  }

  if (deviceIdsResult.data.length === 0) {
    return { error: "Nenhum local de acesso vinculado para sincronizar." };
  }

  await enqueueResidentAccessSyncJobs({
    residentId,
    accessDeviceIds: deviceIdsResult.data,
  });

  const processResult = await processPendingAccessSyncJobs({ limit: 3 });

  after(async () => {
    await triggerAccessSyncProcessing(3);
  });

  revalidatePath(`/app/${condoSlug}/residents/${residentId}`);

  if (!processResult.ok) {
    return { error: processResult.error ?? "Fila criada, mas o sync falhou ao iniciar." };
  }

  const { completed, failed, skipped } = processResult.data;

  if (failed > 0) {
    return {
      error: "Sync concluído com erro em um ou mais locais. Verifique a ficha do morador.",
    };
  }

  if (completed === 0 && skipped > 0) {
    return {
      success: "Nenhum equipamento piloto elegível no momento. Ajuste ACCESS_SYNC_PILOT_ONLY se necessário.",
    };
  }

  return {
    success:
      completed > 0
        ? "Sincronização enviada ao equipamento ControlID."
        : "Sync enfileirado. Aguarde alguns instantes e atualize a página.",
  };
}
