import { buildMembershipControlIdRegistration } from "@/lib/access-devices/registration";
import {
  removeResidentFromControlIdDevice,
  syncResidentToControlIdDevice,
} from "@/lib/access-devices/controlid-sync";
import { decryptAccessDevicePassword } from "@/lib/access-devices/crypto";
import { shouldSyncAccessDevice } from "@/lib/access-devices/sync-env";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapSupabaseError, serviceError, serviceOk, type ServiceResult } from "@/lib/services/types";

const FACIAL_ACCESS_TYPES = new Set(["facial_pedestrian", "facial_vehicle"]);

type MembershipDeviceRow = {
  id: string;
  display_name: string;
  host_url: string;
  api_username: string;
  api_password_encrypted: string;
  access_type: string;
  is_pilot: boolean;
  is_active: boolean;
};

async function loadDevicesByIds(deviceIds: string[]): Promise<MembershipDeviceRow[]> {
  if (deviceIds.length === 0) {
    return [];
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("access_devices")
    .select(
      "id, display_name, host_url, api_username, api_password_encrypted, access_type, is_pilot, is_active",
    )
    .in("id", deviceIds);

  if (error) {
    throw new Error(mapSupabaseError(error));
  }

  return (data as MembershipDeviceRow[] | null) ?? [];
}

function decryptPassword(device: MembershipDeviceRow): string {
  try {
    return decryptAccessDevicePassword(device.api_password_encrypted);
  } catch {
    throw new Error(`${device.display_name}: senha do equipamento indisponível.`);
  }
}

export async function syncMembershipToControlIdDevices(input: {
  membershipId: string;
  fullName: string;
  photoUrl: string | null;
  accessDeviceIds: string[];
  removeDeviceIds?: string[];
}): Promise<ServiceResult<{ synced: number; removed: number; errors: string[] }>> {
  const registration = buildMembershipControlIdRegistration(input.membershipId);
  const errors: string[] = [];
  let synced = 0;
  let removed = 0;

  try {
    const removeIds = Array.from(new Set(input.removeDeviceIds ?? []));
    const syncIds = Array.from(new Set(input.accessDeviceIds));
    const devices = await loadDevicesByIds([...new Set([...syncIds, ...removeIds])]);
    const byId = new Map(devices.map((device) => [device.id, device]));

    for (const deviceId of removeIds) {
      const device = byId.get(deviceId);
      if (!device?.is_active) {
        continue;
      }

      try {
        await removeResidentFromControlIdDevice({
          hostUrl: device.host_url,
          username: device.api_username,
          password: decryptPassword(device),
          registration,
        });
        removed += 1;
      } catch (error) {
        errors.push(
          `${device.display_name}: ${error instanceof Error ? error.message : "falha ao remover"}`,
        );
      }
    }

    for (const deviceId of syncIds) {
      const device = byId.get(deviceId);
      if (!device) {
        errors.push("Local de acesso não encontrado.");
        continue;
      }

      if (!device.is_active) {
        errors.push(`${device.display_name}: equipamento inativo.`);
        continue;
      }

      if (!shouldSyncAccessDevice(device.is_pilot)) {
        continue;
      }

      const requiresPhoto = FACIAL_ACCESS_TYPES.has(device.access_type);

      try {
        await syncResidentToControlIdDevice({
          hostUrl: device.host_url,
          username: device.api_username,
          password: decryptPassword(device),
          residentId: input.membershipId,
          residentName: input.fullName,
          photoUrl: input.photoUrl,
          requiresPhoto,
          registration,
        });
        synced += 1;
      } catch (error) {
        errors.push(
          `${device.display_name}: ${error instanceof Error ? error.message : "falha no sync"}`,
        );
      }
    }

    return serviceOk({ synced, removed, errors });
  } catch (error) {
    return serviceError(
      error instanceof Error ? error.message : "Erro ao sincronizar membro no ControlID.",
    );
  }
}

export async function loadMembershipProfileForSync(membershipId: string): Promise<
  ServiceResult<{
    fullName: string;
    photoUrl: string | null;
    accessDeviceIds: string[];
  }>
> {
  try {
    const admin = createAdminClient();
    const { data: membership, error } = await admin
      .from("memberships")
      .select(
        `
        id,
        profile:profiles (
          full_name,
          avatar_url
        )
      `,
      )
      .eq("id", membershipId)
      .maybeSingle();

    if (error) {
      return serviceError(mapSupabaseError(error));
    }

    if (!membership) {
      return serviceError("Membro não encontrado.");
    }

    const profile = Array.isArray(membership.profile)
      ? membership.profile[0]
      : membership.profile;

    const { data: links, error: linksError } = await admin
      .from("membership_access_devices")
      .select("access_device_id")
      .eq("membership_id", membershipId);

    if (linksError) {
      return serviceError(mapSupabaseError(linksError));
    }

    return serviceOk({
      fullName: profile?.full_name?.trim() || "Membro",
      photoUrl: profile?.avatar_url ?? null,
      accessDeviceIds: (links ?? []).map((row) => row.access_device_id),
    });
  } catch (error) {
    return serviceError(
      error instanceof Error ? error.message : "Erro ao carregar dados do membro para sync.",
    );
  }
}
