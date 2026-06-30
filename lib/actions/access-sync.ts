"use server";

import { revalidatePath } from "next/cache";
import { requireCondoPermission } from "@/lib/auth/access";
import type { AuthActionState } from "@/lib/auth/types";
import {
  enqueueResidentAccessSyncJobs,
  runPendingAccessSync,
} from "@/lib/services/access-sync";
import {
  getResidentAccessDeviceIds,
  listResidentAccessGrants,
} from "@/lib/services/resident-access-grants";
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

  const processResult = await runPendingAccessSync({
    limit: Math.max(3, deviceIdsResult.data.length),
  });

  revalidatePath(`/app/${condoSlug}/residents/${residentId}`);

  if (!processResult.ok) {
    return { error: processResult.error ?? "Fila criada, mas o sync falhou ao iniciar." };
  }

  const { completed, failed, skipped } = processResult.data;

  if (failed > 0) {
    const grantsResult = await listResidentAccessGrants(residentId);
    const errorDetails =
      grantsResult.ok
        ? grantsResult.data
            .filter((grant) => grant.sync_error)
            .map(
              (grant) =>
                `${grant.access_device?.display_name ?? "Local"}: ${grant.sync_error}`,
            )
            .join(" · ")
        : "";

    return {
      error:
        errorDetails ||
        "Sync concluído com erro em um ou mais locais. Verifique a ficha do morador.",
    };
  }

  if (completed === 0 && skipped > 0) {
    return {
      success:
        "Sync ignorado: equipamento inativo ou ACCESS_SYNC_PILOT_ONLY=true sem equipamento piloto.",
    };
  }

  return {
    success:
      completed > 0
        ? "Sincronização enviada ao equipamento ControlID."
        : "Sync enfileirado. Aguarde alguns instantes e atualize a página.",
  };
}
