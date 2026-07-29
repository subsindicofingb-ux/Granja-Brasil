import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { listAccessDevicesForCondominium } from "@/lib/services/access-devices";
import { mapSupabaseError, serviceError, serviceOk, type ServiceResult } from "@/lib/services/types";

export async function listMembershipAccessDeviceIds(
  membershipId: string,
): Promise<ServiceResult<string[]>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("membership_access_devices")
      .select("access_device_id")
      .eq("membership_id", membershipId);

    if (error) {
      return serviceError(mapSupabaseError(error));
    }

    return serviceOk((data ?? []).map((row) => row.access_device_id));
  } catch (error) {
    return serviceError(
      error instanceof Error ? error.message : "Erro ao carregar locais do membro.",
    );
  }
}

export async function replaceMembershipAccessDevices(input: {
  membershipId: string;
  condominiumId: string;
  accessDeviceIds: string[];
}): Promise<ServiceResult<void>> {
  const devicesResult = await listAccessDevicesForCondominium(input.condominiumId);
  if (!devicesResult.ok) {
    return serviceError(devicesResult.error ?? "Erro ao validar locais de acesso.");
  }

  const allowed = new Set(
    devicesResult.data.filter((device) => device.is_active).map((device) => device.id),
  );
  const invalid = input.accessDeviceIds.filter((id) => !allowed.has(id));
  if (invalid.length > 0) {
    return serviceError("Um ou mais locais de acesso selecionados não estão disponíveis.");
  }

  try {
    const admin = createAdminClient();
    const { error: deleteError } = await admin
      .from("membership_access_devices")
      .delete()
      .eq("membership_id", input.membershipId);

    if (deleteError) {
      return serviceError(mapSupabaseError(deleteError));
    }

    if (input.accessDeviceIds.length === 0) {
      return serviceOk(undefined);
    }

    const { error: insertError } = await admin.from("membership_access_devices").insert(
      input.accessDeviceIds.map((accessDeviceId) => ({
        membership_id: input.membershipId,
        access_device_id: accessDeviceId,
      })),
    );

    if (insertError) {
      return serviceError(mapSupabaseError(insertError));
    }

    return serviceOk(undefined);
  } catch (error) {
    return serviceError(
      error instanceof Error ? error.message : "Erro ao salvar locais do membro.",
    );
  }
}

export async function listAccessDevicesForMembershipProfile(input: {
  profileId: string;
  condominiumId: string;
}): Promise<
  ServiceResult<
    Array<{
      access_device_id: string;
      display_name: string;
      access_type: string;
      entry_kind: string;
      direction: string;
    }>
  >
> {
  try {
    const admin = createAdminClient();
    const { data: membership, error: membershipError } = await admin
      .from("memberships")
      .select("id")
      .eq("profile_id", input.profileId)
      .eq("condominium_id", input.condominiumId)
      .eq("role", "staff")
      .maybeSingle();

    if (membershipError) {
      return serviceError(mapSupabaseError(membershipError));
    }

    if (!membership) {
      return serviceOk([]);
    }

    const { data: rows, error } = await admin
      .from("membership_access_devices")
      .select("access_device_id")
      .eq("membership_id", membership.id);

    if (error) {
      return serviceError(mapSupabaseError(error));
    }

    const deviceIds = (rows ?? []).map((row) => row.access_device_id);
    if (deviceIds.length === 0) {
      return serviceOk([]);
    }

    const devicesResult = await listAccessDevicesForCondominium(input.condominiumId);
    if (!devicesResult.ok) {
      return serviceError(devicesResult.error);
    }

    const byId = new Map(devicesResult.data.map((device) => [device.id, device]));
    return serviceOk(
      deviceIds
        .map((id) => byId.get(id))
        .filter((device): device is NonNullable<typeof device> => Boolean(device?.is_active))
        .map((device) => ({
          access_device_id: device.id,
          display_name: device.display_name,
          access_type: device.access_type,
          entry_kind: device.entry_kind,
          direction: device.direction,
        })),
    );
  } catch (error) {
    return serviceError(
      error instanceof Error ? error.message : "Erro ao carregar locais habilitados.",
    );
  }
}
