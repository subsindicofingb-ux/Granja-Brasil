import {
  createControlIdRemoteOpenAccessLog,
  executeControlIdDoorPulse,
  loginControlIdSession,
  logoutControlIdSession,
} from "@/lib/access-devices/controlid-sync";
import { decryptAccessDevicePassword } from "@/lib/access-devices/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getLinkedResidentForProfile } from "@/lib/services/residents";
import { listAccessDevicesForCondominium } from "@/lib/services/access-devices";
import { mapSupabaseError, serviceError, serviceOk, type ServiceResult } from "@/lib/services/types";
import { ROLES, type Role } from "@/lib/constants";

export type RemoteOpenReason = "visitor" | "emergency";
export type RemoteOpenOrigin = "app_resident" | "app_doorman" | "app_staff";

export type SyncedAccessDeviceForRemoteOpen = {
  grant_id: string | null;
  access_device_id: string;
  display_name: string;
  access_type: string;
  entry_kind: string;
  direction: string;
  controlid_user_id: number | null;
  unit_id: string | null;
  requires_facial_sync: boolean;
};

export function canRemoteOpenWithoutFacial(input: {
  role: Role;
  canManageAccessDevices: boolean;
}): boolean {
  return (
    input.canManageAccessDevices ||
    input.role === ROLES.SUPER_ADMIN ||
    input.role === ROLES.ADMIN ||
    input.role === ROLES.SYNDIC ||
    input.role === ROLES.SUB_SYNDIC
  );
}

function resolveRemoteOpenOrigin(role: Role): RemoteOpenOrigin {
  if (role === ROLES.RESIDENT) {
    return "app_resident";
  }

  if (role === ROLES.DOORMAN) {
    return "app_doorman";
  }

  return "app_staff";
}

export async function listSyncedAccessDevicesForProfile(input: {
  profileId: string;
  condominiumId: string;
  role: Role;
  canManageAccessDevices: boolean;
}): Promise<ServiceResult<SyncedAccessDeviceForRemoteOpen[]>> {
  if (canRemoteOpenWithoutFacial(input)) {
    const devicesResult = await listAccessDevicesForCondominium(input.condominiumId);
    if (!devicesResult.ok) {
      return serviceError(devicesResult.error);
    }

    return serviceOk(
      devicesResult.data
        .filter((device) => device.is_active)
        .map((device) => ({
          grant_id: null,
          access_device_id: device.id,
          display_name: device.display_name,
          access_type: device.access_type,
          entry_kind: device.entry_kind,
          direction: device.direction,
          controlid_user_id: null,
          unit_id: null,
          requires_facial_sync: false,
        })),
    );
  }

  const linked = await getLinkedResidentForProfile({
    profileId: input.profileId,
    condominiumId: input.condominiumId,
  });

  if (!linked.ok) {
    return serviceError(linked.error);
  }

  if (!linked.data) {
    return serviceOk([]);
  }

  try {
    // Grants: user client (RLS allows the linked resident). Devices: admin client —
    // residents cannot SELECT access_devices under current RLS policies.
    const supabase = await createClient();
    const admin = createAdminClient();

    const { data: grantRows, error } = await supabase
      .from("resident_access_grants")
      .select("id, access_device_id, controlid_user_id")
      .eq("resident_id", linked.data.id)
      .eq("sync_status", "synced")
      .not("controlid_user_id", "is", null)
      .order("created_at", { ascending: true });

    if (error) {
      return serviceError(mapSupabaseError(error));
    }

    const rows = grantRows ?? [];
    if (rows.length === 0) {
      return serviceOk([]);
    }

    const { data: deviceRows, error: devicesError } = await admin
      .from("access_devices")
      .select("id, display_name, access_type, entry_kind, direction, is_active")
      .in(
        "id",
        rows.map((row) => row.access_device_id),
      )
      .eq("is_active", true);

    if (devicesError) {
      return serviceError(mapSupabaseError(devicesError));
    }

    const deviceById = new Map((deviceRows ?? []).map((device) => [device.id, device]));

    const devices: SyncedAccessDeviceForRemoteOpen[] = [];
    for (const row of rows) {
      const device = deviceById.get(row.access_device_id);
      if (!device) {
        continue;
      }

      devices.push({
        grant_id: row.id,
        access_device_id: device.id,
        display_name: device.display_name,
        access_type: device.access_type,
        entry_kind: device.entry_kind,
        direction: device.direction,
        controlid_user_id: row.controlid_user_id,
        unit_id: linked.data.unit_id,
        requires_facial_sync: true,
      });
    }

    return serviceOk(devices);
  } catch (error) {
    return serviceError(
      error instanceof Error ? error.message : "Erro ao listar locais sincronizados.",
    );
  }
}

async function insertRemoteOpenEvent(input: {
  condominiumId: string;
  residentId: string | null;
  profileId: string;
  unitId: string | null;
  accessDeviceId: string;
  controlIdUserId: number | null;
  reason: RemoteOpenReason;
  origin: RemoteOpenOrigin;
  result: "ok" | "error";
  errorMessage?: string | null;
  notes?: string | null;
  visitorAuthorizationId?: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  await admin.from("access_remote_open_events").insert({
    condominium_id: input.condominiumId,
    resident_id: input.residentId,
    profile_id: input.profileId,
    unit_id: input.unitId,
    access_device_id: input.accessDeviceId,
    controlid_user_id: input.controlIdUserId,
    reason: input.reason,
    origin: input.origin,
    result: input.result,
    error_message: input.errorMessage ?? null,
    notes: input.notes ?? null,
    visitor_authorization_id: input.visitorAuthorizationId ?? null,
  });
}

async function pulseDeviceAndLog(input: {
  condominiumId: string;
  profileId: string;
  role: Role;
  device: {
    id: string;
    display_name: string;
    host_url: string;
    api_username: string;
    api_password_encrypted: string;
  };
  residentId: string | null;
  unitId: string | null;
  controlIdUserId: number | null;
  reason: RemoteOpenReason;
  notes?: string | null;
  visitorAuthorizationId?: string | null;
}): Promise<ServiceResult<{ deviceName: string }>> {
  const origin = resolveRemoteOpenOrigin(input.role);
  const admin = createAdminClient();

  const tenSecondsAgo = new Date(Date.now() - 10_000).toISOString();
  const { data: recent } = await admin
    .from("access_remote_open_events")
    .select("id")
    .eq("profile_id", input.profileId)
    .eq("access_device_id", input.device.id)
    .eq("result", "ok")
    .gte("created_at", tenSecondsAgo)
    .limit(1)
    .maybeSingle();

  if (recent) {
    return serviceError("Aguarde alguns segundos antes de enviar outro pulso neste local.");
  }

  let password: string;
  try {
    password = decryptAccessDevicePassword(input.device.api_password_encrypted);
  } catch (error) {
    return serviceError(
      error instanceof Error ? error.message : "Falha ao ler a senha do equipamento.",
    );
  }

  try {
    const { session, baseUrl } = await loginControlIdSession({
      hostUrl: input.device.host_url,
      username: input.device.api_username,
      password,
    });

    try {
      await executeControlIdDoorPulse({ baseUrl, session });

      try {
        await createControlIdRemoteOpenAccessLog({
          baseUrl,
          session,
          controlIdUserId: input.controlIdUserId,
          origin,
        });
      } catch {
        // Door already opened — device Relatórios audit is best-effort.
      }
    } finally {
      await logoutControlIdSession(baseUrl, session);
    }

    await insertRemoteOpenEvent({
      condominiumId: input.condominiumId,
      residentId: input.residentId,
      profileId: input.profileId,
      unitId: input.unitId,
      accessDeviceId: input.device.id,
      controlIdUserId: input.controlIdUserId,
      reason: input.reason,
      origin,
      result: "ok",
      notes: input.notes,
      visitorAuthorizationId: input.visitorAuthorizationId,
    });

    return serviceOk({ deviceName: input.device.display_name });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao enviar pulso de abertura.";

    await insertRemoteOpenEvent({
      condominiumId: input.condominiumId,
      residentId: input.residentId,
      profileId: input.profileId,
      unitId: input.unitId,
      accessDeviceId: input.device.id,
      controlIdUserId: input.controlIdUserId,
      reason: input.reason,
      origin,
      result: "error",
      errorMessage: message,
      notes: input.notes,
      visitorAuthorizationId: input.visitorAuthorizationId,
    });

    return serviceError(message);
  }
}

export async function remoteOpenAccessDevice(input: {
  condominiumId: string;
  profileId: string;
  role: Role;
  canManageAccessDevices: boolean;
  accessDeviceId: string;
  reason: RemoteOpenReason;
  notes?: string | null;
  visitorAuthorizationId?: string | null;
}): Promise<ServiceResult<{ deviceName: string }>> {
  const admin = createAdminClient();
  const staffBypass = canRemoteOpenWithoutFacial({
    role: input.role,
    canManageAccessDevices: input.canManageAccessDevices,
  });

  if (staffBypass) {
    const devicesResult = await listAccessDevicesForCondominium(input.condominiumId);
    if (!devicesResult.ok) {
      return serviceError(devicesResult.error);
    }

    const deviceMeta = devicesResult.data.find(
      (device) => device.id === input.accessDeviceId && device.is_active,
    );

    if (!deviceMeta) {
      return serviceError("Este local de acesso não está disponível neste condomínio.");
    }

    const { data: device, error: deviceError } = await admin
      .from("access_devices")
      .select("id, display_name, host_url, api_username, api_password_encrypted, is_active")
      .eq("id", deviceMeta.id)
      .maybeSingle();

    if (deviceError) {
      return serviceError(mapSupabaseError(deviceError));
    }

    if (!device?.is_active) {
      return serviceError("Este equipamento está inativo.");
    }

    return pulseDeviceAndLog({
      condominiumId: input.condominiumId,
      profileId: input.profileId,
      role: input.role,
      device,
      residentId: null,
      unitId: null,
      controlIdUserId: null,
      reason: input.reason,
      notes: input.notes,
      visitorAuthorizationId: input.visitorAuthorizationId,
    });
  }

  const linked = await getLinkedResidentForProfile({
    profileId: input.profileId,
    condominiumId: input.condominiumId,
  });

  if (!linked.ok) {
    return serviceError(linked.error);
  }

  if (!linked.data) {
    return serviceError(
      "Nenhum morador vinculado ao seu usuário neste condomínio. A abertura remota é feita pela unidade.",
    );
  }

  const origin = resolveRemoteOpenOrigin(input.role);

  const { data: grant, error: grantError } = await admin
    .from("resident_access_grants")
    .select("id, controlid_user_id, sync_status, access_device_id")
    .eq("resident_id", linked.data.id)
    .eq("access_device_id", input.accessDeviceId)
    .maybeSingle();

  if (grantError) {
    return serviceError(mapSupabaseError(grantError));
  }

  if (!grant) {
    return serviceError("Este local de acesso não está liberado para a sua unidade.");
  }

  const { data: device, error: deviceError } = await admin
    .from("access_devices")
    .select("id, display_name, host_url, api_username, api_password_encrypted, is_active")
    .eq("id", grant.access_device_id)
    .maybeSingle();

  if (deviceError) {
    return serviceError(mapSupabaseError(deviceError));
  }

  if (!device) {
    return serviceError("Este local de acesso não está liberado para a sua unidade.");
  }

  if (!device.is_active) {
    return serviceError("Este equipamento está inativo.");
  }

  if (grant.sync_status !== "synced" || !grant.controlid_user_id) {
    await insertRemoteOpenEvent({
      condominiumId: input.condominiumId,
      residentId: linked.data.id,
      profileId: input.profileId,
      unitId: linked.data.unit_id,
      accessDeviceId: device.id,
      controlIdUserId: grant.controlid_user_id ?? null,
      reason: input.reason,
      origin,
      result: "error",
      errorMessage: "Usuário não sincronizado neste equipamento.",
      notes: input.notes,
      visitorAuthorizationId: input.visitorAuthorizationId,
    });
    return serviceError(
      "Abertura bloqueada: você só pode abrir onde estiver sincronizado no ControlID.",
    );
  }

  return pulseDeviceAndLog({
    condominiumId: input.condominiumId,
    profileId: input.profileId,
    role: input.role,
    device,
    residentId: linked.data.id,
    unitId: linked.data.unit_id,
    controlIdUserId: grant.controlid_user_id,
    reason: input.reason,
    notes: input.notes,
    visitorAuthorizationId: input.visitorAuthorizationId,
  });
}

export async function listRecentRemoteOpenEventsForCondo(input: {
  condominiumId: string;
  limit?: number;
}): Promise<
  ServiceResult<
    Array<{
      id: string;
      reason: RemoteOpenReason;
      origin: RemoteOpenOrigin;
      result: "ok" | "error";
      error_message: string | null;
      created_at: string;
      device_name: string | null;
      resident_name: string | null;
    }>
  >
> {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();
    const { data, error } = await supabase
      .from("access_remote_open_events")
      .select("id, reason, origin, result, error_message, created_at, access_device_id, resident_id")
      .eq("condominium_id", input.condominiumId)
      .order("created_at", { ascending: false })
      .limit(Math.max(1, Math.min(input.limit ?? 20, 50)));

    if (error) {
      return serviceError(mapSupabaseError(error));
    }

    const rows = data ?? [];
    const deviceIds = [...new Set(rows.map((row) => row.access_device_id))];
    const residentIds = [
      ...new Set(rows.map((row) => row.resident_id).filter((id): id is string => Boolean(id))),
    ];

    // Device names via admin: residents cannot SELECT access_devices (staff-only RLS).
    const [{ data: devices }, { data: residents }] = await Promise.all([
      deviceIds.length > 0
        ? admin.from("access_devices").select("id, display_name").in("id", deviceIds)
        : Promise.resolve({ data: [] as Array<{ id: string; display_name: string }> }),
      residentIds.length > 0
        ? admin.from("residents").select("id, full_name").in("id", residentIds)
        : Promise.resolve({ data: [] as Array<{ id: string; full_name: string }> }),
    ]);

    const deviceNameById = new Map((devices ?? []).map((device) => [device.id, device.display_name]));
    const residentNameById = new Map(
      (residents ?? []).map((resident) => [resident.id, resident.full_name]),
    );

    return serviceOk(
      rows.map((row) => ({
        id: row.id,
        reason: row.reason as RemoteOpenReason,
        origin: row.origin as RemoteOpenOrigin,
        result: row.result as "ok" | "error",
        error_message: row.error_message,
        created_at: row.created_at,
        device_name: deviceNameById.get(row.access_device_id) ?? null,
        resident_name: row.resident_id
          ? (residentNameById.get(row.resident_id) ?? null)
          : null,
      })),
    );
  } catch (error) {
    return serviceError(
      error instanceof Error ? error.message : "Erro ao listar aberturas remotas.",
    );
  }
}
