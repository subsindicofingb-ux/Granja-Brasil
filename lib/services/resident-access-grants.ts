import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AccessDeviceOption, ResidentAccessGrantRecord } from "@/lib/access-devices/grant-types";
import { mapDevicesToOptions } from "@/lib/access-devices/suggested-grants";
import { listAccessDevicesForCondominium } from "@/lib/services/access-devices";
import { runPendingAccessSync, syncDiffResidentAccessGrants } from "@/lib/services/access-sync";
import { mapSupabaseError, serviceError, serviceOk, type ServiceResult } from "@/lib/services/types";

type GrantRow = {
  id: string;
  resident_id: string;
  access_device_id: string;
  sync_status: ResidentAccessGrantRecord["sync_status"];
  sync_error: string | null;
  created_at: string;
  updated_at: string;
};

async function validateAccessDeviceIdsForCondominium(
  condominiumId: string,
  accessDeviceIds: string[],
): Promise<ServiceResult<string[]>> {
  if (accessDeviceIds.length === 0) {
    return serviceOk([]);
  }

  const devicesResult = await listActiveAccessDevicesForCondominium(condominiumId);
  if (!devicesResult.ok) {
    return serviceError(devicesResult.error ?? "Erro ao validar locais de acesso.");
  }

  const allowedIds = new Set(devicesResult.data.map((device) => device.id));
  const invalidIds = accessDeviceIds.filter((deviceId) => !allowedIds.has(deviceId));

  if (invalidIds.length > 0) {
    return serviceError("Um ou mais locais de acesso selecionados não estão disponíveis.");
  }

  return serviceOk(accessDeviceIds);
}

export async function listActiveAccessDevicesForCondominium(
  condominiumId: string,
): Promise<ServiceResult<AccessDeviceOption[]>> {
  const result = await listAccessDevicesForCondominium(condominiumId);
  if (!result.ok) {
    return serviceError(result.error ?? "Erro ao listar locais de acesso.");
  }

  return serviceOk(
    mapDevicesToOptions(result.data.filter((device) => device.is_active)),
  );
}

export async function loadActiveAccessDevicesByCondominiumIds(
  condominiumIds: string[],
): Promise<ServiceResult<Record<string, AccessDeviceOption[]>>> {
  const uniqueIds = Array.from(new Set(condominiumIds.filter(Boolean)));
  const entries = await Promise.all(
    uniqueIds.map(async (condominiumId) => {
      const result = await listActiveAccessDevicesForCondominium(condominiumId);
      return [condominiumId, result.ok ? result.data : []] as const;
    }),
  );

  return serviceOk(Object.fromEntries(entries));
}

export async function getResidentAccessDeviceIds(
  residentId: string,
): Promise<ServiceResult<string[]>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("resident_access_grants")
      .select("access_device_id")
      .eq("resident_id", residentId);

    if (error) {
      return serviceError(mapSupabaseError(error));
    }

    return serviceOk((data ?? []).map((row) => row.access_device_id));
  } catch (error) {
    return serviceError(error instanceof Error ? error.message : "Erro ao carregar locais do morador.");
  }
}

export async function listResidentAccessGrants(
  residentId: string,
): Promise<ServiceResult<ResidentAccessGrantRecord[]>> {
  try {
    const supabase = await createClient();
    const { data: grantRows, error } = await supabase
      .from("resident_access_grants")
      .select(
        "id, resident_id, access_device_id, sync_status, sync_error, created_at, updated_at",
      )
      .eq("resident_id", residentId)
      .order("created_at", { ascending: true });

    if (error) {
      return serviceError(mapSupabaseError(error));
    }

    const rows = (grantRows as GrantRow[] | null) ?? [];
    if (rows.length === 0) {
      return serviceOk([]);
    }

    const { data: deviceRows, error: devicesError } = await supabase
      .from("access_devices")
      .select("id, display_name, access_type, is_pilot, condominium_id")
      .in(
        "id",
        rows.map((row) => row.access_device_id),
      );

    if (devicesError) {
      return serviceError(mapSupabaseError(devicesError));
    }

    const devicesById = new Map(
      (deviceRows ?? []).map((device) => [device.id, device]),
    );

    const grants: ResidentAccessGrantRecord[] = rows.map((row) => {
      const device = devicesById.get(row.access_device_id);

      return {
        id: row.id,
        resident_id: row.resident_id,
        access_device_id: row.access_device_id,
        sync_status: row.sync_status,
        sync_error: row.sync_error,
        created_at: row.created_at,
        updated_at: row.updated_at,
        access_device: device
          ? {
              id: device.id,
              display_name: device.display_name,
              access_type: device.access_type,
              is_pilot: device.is_pilot,
              is_owned: true,
            }
          : undefined,
      };
    });

    grants.sort((a, b) =>
      (a.access_device?.display_name ?? "").localeCompare(
        b.access_device?.display_name ?? "",
        "pt-BR",
      ),
    );

    return serviceOk(grants);
  } catch (error) {
    return serviceError(error instanceof Error ? error.message : "Erro ao carregar locais do morador.");
  }
}

export async function getRegistrationRequestAccessDeviceIds(
  registrationRequestId: string,
): Promise<ServiceResult<string[]>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("registration_request_access_devices")
      .select("access_device_id")
      .eq("registration_request_id", registrationRequestId);

    if (error) {
      return serviceError(mapSupabaseError(error));
    }

    return serviceOk((data ?? []).map((row) => row.access_device_id));
  } catch (error) {
    return serviceError(
      error instanceof Error ? error.message : "Erro ao carregar locais da solicitação.",
    );
  }
}

export async function loadRegistrationRequestAccessDeviceIdsByRequestIds(
  requestIds: string[],
): Promise<ServiceResult<Record<string, string[]>>> {
  if (requestIds.length === 0) {
    return serviceOk({});
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("registration_request_access_devices")
      .select("registration_request_id, access_device_id")
      .in("registration_request_id", requestIds);

    if (error) {
      return serviceError(mapSupabaseError(error));
    }

    const map: Record<string, string[]> = {};
    for (const row of data ?? []) {
      const current = map[row.registration_request_id] ?? [];
      current.push(row.access_device_id);
      map[row.registration_request_id] = current;
    }

    return serviceOk(map);
  } catch (error) {
    return serviceError(
      error instanceof Error ? error.message : "Erro ao carregar locais das solicitações.",
    );
  }
}

export async function replaceResidentAccessGrants(input: {
  residentId: string;
  condominiumId: string;
  accessDeviceIds: string[];
  processSync?: boolean;
}): Promise<ServiceResult<void>> {
  const validated = await validateAccessDeviceIdsForCondominium(
    input.condominiumId,
    input.accessDeviceIds,
  );
  if (!validated.ok) {
    return serviceError(validated.error);
  }

  const diffResult = await syncDiffResidentAccessGrants({
    residentId: input.residentId,
    condominiumId: input.condominiumId,
    accessDeviceIds: input.accessDeviceIds,
  });

  if (!diffResult.ok) {
    return serviceError(diffResult.error ?? "Erro ao salvar locais do morador.");
  }

  if (input.processSync !== false) {
    await runPendingAccessSync({
      limit: Math.max(5, input.accessDeviceIds.length + 2),
    });
  }

  return serviceOk(undefined);
}

export async function replaceRegistrationRequestAccessDevices(input: {
  registrationRequestId: string;
  condominiumId: string;
  accessDeviceIds: string[];
}): Promise<ServiceResult<void>> {
  const validated = await validateAccessDeviceIdsForCondominium(
    input.condominiumId,
    input.accessDeviceIds,
  );
  if (!validated.ok) {
    return serviceError(validated.error);
  }

  try {
    const admin = createAdminClient();

    const { error: deleteError } = await admin
      .from("registration_request_access_devices")
      .delete()
      .eq("registration_request_id", input.registrationRequestId);

    if (deleteError) {
      return serviceError(mapSupabaseError(deleteError));
    }

    if (input.accessDeviceIds.length === 0) {
      return serviceOk(undefined);
    }

    const { error: insertError } = await admin.from("registration_request_access_devices").insert(
      input.accessDeviceIds.map((accessDeviceId) => ({
        registration_request_id: input.registrationRequestId,
        access_device_id: accessDeviceId,
      })),
    );

    if (insertError) {
      return serviceError(mapSupabaseError(insertError));
    }

    return serviceOk(undefined);
  } catch (error) {
    return serviceError(
      error instanceof Error ? error.message : "Erro ao salvar locais da solicitação.",
    );
  }
}
