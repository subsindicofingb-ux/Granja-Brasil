import { createClient } from "@/lib/supabase/server";
import { normalizeAccessDeviceHostUrl } from "@/lib/access-devices/controlid-client";
import type { AccessDeviceRecord, AccessDeviceListItem } from "@/lib/access-devices/types";
import { formatCondominiumDisplayName } from "@/lib/condominiums/display";
import { mapSupabaseError, serviceError, serviceOk, type ServiceResult } from "@/lib/services/types";

const DEVICE_SELECT = `
  id,
  condominium_id,
  display_name,
  access_type,
  manufacturer,
  model,
  host_url,
  api_username,
  direction,
  entry_kind,
  is_active,
  is_pilot,
  last_connection_ok_at,
  last_connection_error,
  created_at,
  updated_at
`;

type DeviceRow = {
  id: string;
  condominium_id: string;
  display_name: string;
  access_type: AccessDeviceRecord["access_type"];
  manufacturer: string;
  model: string;
  host_url: string;
  api_username: string;
  direction: AccessDeviceRecord["direction"];
  entry_kind: AccessDeviceRecord["entry_kind"];
  is_active: boolean;
  is_pilot: boolean;
  last_connection_ok_at: string | null;
  last_connection_error: string | null;
  created_at: string;
  updated_at: string;
};

type ShareRow = {
  access_device_id: string;
  condominium_id: string;
};

function mapDeviceRow(
  row: DeviceRow,
  sharedCondominiumIds: string[],
  ownerCondominium?: AccessDeviceRecord["owner_condominium"],
): AccessDeviceRecord {
  return {
    id: row.id,
    condominium_id: row.condominium_id,
    display_name: row.display_name,
    access_type: row.access_type,
    manufacturer: row.manufacturer,
    model: row.model,
    host_url: row.host_url,
    api_username: row.api_username,
    direction: row.direction,
    entry_kind: row.entry_kind,
    is_active: row.is_active,
    is_pilot: row.is_pilot,
    last_connection_ok_at: row.last_connection_ok_at,
    last_connection_error: row.last_connection_error,
    created_at: row.created_at,
    updated_at: row.updated_at,
    shared_condominium_ids: sharedCondominiumIds,
    owner_condominium: ownerCondominium,
  };
}

async function loadOwnerCondominiumMap(
  condominiumIds: string[],
): Promise<Map<string, AccessDeviceRecord["owner_condominium"]>> {
  if (condominiumIds.length === 0) {
    return new Map();
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("condominiums")
    .select("id, name, slug")
    .in("id", condominiumIds);

  return new Map(
    (data ?? []).map((condominium) => [
      condominium.id,
      {
        id: condominium.id,
        name: formatCondominiumDisplayName(condominium.name, condominium.slug),
        slug: condominium.slug,
      },
    ]),
  );
}

async function loadSharesByDeviceIds(deviceIds: string[]): Promise<Map<string, string[]>> {
  if (deviceIds.length === 0) {
    return new Map();
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("access_device_shares")
    .select("access_device_id, condominium_id")
    .in("access_device_id", deviceIds);

  if (error) {
    throw new Error(mapSupabaseError(error));
  }

  const sharesByDevice = new Map<string, string[]>();
  for (const row of (data as ShareRow[] | null) ?? []) {
    const current = sharesByDevice.get(row.access_device_id) ?? [];
    current.push(row.condominium_id);
    sharesByDevice.set(row.access_device_id, current);
  }

  return sharesByDevice;
}

export async function listAccessDevicesForCondominium(
  condominiumId: string,
): Promise<ServiceResult<AccessDeviceListItem[]>> {
  try {
    const supabase = await createClient();

    const [ownedResult, sharedLinksResult] = await Promise.all([
      supabase
        .from("access_devices")
        .select(DEVICE_SELECT)
        .eq("condominium_id", condominiumId)
        .order("display_name", { ascending: true }),
      supabase
        .from("access_device_shares")
        .select("access_device_id")
        .eq("condominium_id", condominiumId),
    ]);

    if (ownedResult.error) {
      return serviceError(mapSupabaseError(ownedResult.error));
    }

    if (sharedLinksResult.error) {
      return serviceError(mapSupabaseError(sharedLinksResult.error));
    }

    const sharedDeviceIds = Array.from(
      new Set((sharedLinksResult.data ?? []).map((row) => row.access_device_id)),
    );

    let sharedDevices: DeviceRow[] = [];
    if (sharedDeviceIds.length > 0) {
      const sharedResult = await supabase
        .from("access_devices")
        .select(DEVICE_SELECT)
        .in("id", sharedDeviceIds)
        .neq("condominium_id", condominiumId)
        .order("display_name", { ascending: true });

      if (sharedResult.error) {
        return serviceError(mapSupabaseError(sharedResult.error));
      }

      sharedDevices = (sharedResult.data as DeviceRow[] | null) ?? [];
    }

    const ownedRows = (ownedResult.data as DeviceRow[] | null) ?? [];
    const allRows = [...ownedRows, ...sharedDevices];
    const sharesByDevice = await loadSharesByDeviceIds(allRows.map((row) => row.id));
    const ownerMap = await loadOwnerCondominiumMap(
      Array.from(new Set(allRows.map((row) => row.condominium_id))),
    );

    const items: AccessDeviceListItem[] = allRows.map((row) => ({
      ...mapDeviceRow(
        row,
        sharesByDevice.get(row.id) ?? [],
        ownerMap.get(row.condominium_id),
      ),
      is_owned: row.condominium_id === condominiumId,
    }));

    items.sort((a, b) => a.display_name.localeCompare(b.display_name, "pt-BR"));

    return serviceOk(items);
  } catch (error) {
    return serviceError(error instanceof Error ? error.message : "Erro ao listar equipamentos.");
  }
}

export async function getAccessDeviceById(
  deviceId: string,
  condominiumId: string,
): Promise<ServiceResult<AccessDeviceRecord & { is_owned: boolean }>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("access_devices")
      .select(DEVICE_SELECT)
      .eq("id", deviceId)
      .maybeSingle();

    if (error) {
      return serviceError(mapSupabaseError(error));
    }

    if (!data) {
      return serviceError("Equipamento não encontrado.");
    }

    const row = data as DeviceRow;
    const isOwned = row.condominium_id === condominiumId;
    const sharesByDevice = await loadSharesByDeviceIds([row.id]);
    const sharedIds = sharesByDevice.get(row.id) ?? [];
    const ownerMap = await loadOwnerCondominiumMap([row.condominium_id]);

    return serviceOk({
      ...mapDeviceRow(row, sharedIds, ownerMap.get(row.condominium_id)),
      is_owned: isOwned,
    });
  } catch (error) {
    return serviceError(error instanceof Error ? error.message : "Erro ao carregar equipamento.");
  }
}

export async function createAccessDevice(input: {
  condominiumId: string;
  createdBy: string;
  displayName: string;
  accessType: AccessDeviceRecord["access_type"];
  manufacturer: string;
  model: string;
  hostUrl: string;
  apiUsername: string;
  apiPasswordEncrypted: string;
  direction: AccessDeviceRecord["direction"];
  entryKind: AccessDeviceRecord["entry_kind"];
  isActive: boolean;
  isPilot: boolean;
  sharedCondominiumIds: string[];
}): Promise<ServiceResult<AccessDeviceRecord>> {
  try {
    const supabase = await createClient();
    const normalizedHost = normalizeAccessDeviceHostUrl(input.hostUrl);

    const { data, error } = await supabase
      .from("access_devices")
      .insert({
        condominium_id: input.condominiumId,
        display_name: input.displayName.trim(),
        access_type: input.accessType,
        manufacturer: input.manufacturer.trim(),
        model: input.model.trim(),
        host_url: normalizedHost,
        api_username: input.apiUsername.trim(),
        api_password_encrypted: input.apiPasswordEncrypted,
        direction: input.direction,
        entry_kind: input.entryKind,
        is_active: input.isActive,
        is_pilot: input.isPilot,
        created_by: input.createdBy,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return serviceError("Já existe um local de acesso com este nome neste condomínio.");
      }
      return serviceError(mapSupabaseError(error));
    }

    const shareResult = await replaceAccessDeviceShares(data.id, input.sharedCondominiumIds);
    if (!shareResult.ok) {
      return serviceError(shareResult.error);
    }

    const deviceResult = await getAccessDeviceById(data.id, input.condominiumId);
    if (!deviceResult.ok) {
      return serviceError(deviceResult.error ?? "Equipamento criado, mas não foi possível recarregar.");
    }

    return serviceOk(deviceResult.data);
  } catch (error) {
    return serviceError(error instanceof Error ? error.message : "Erro ao cadastrar equipamento.");
  }
}

export async function updateAccessDevice(input: {
  deviceId: string;
  condominiumId: string;
  displayName: string;
  accessType: AccessDeviceRecord["access_type"];
  manufacturer: string;
  model: string;
  hostUrl: string;
  apiUsername: string;
  apiPasswordEncrypted?: string;
  direction: AccessDeviceRecord["direction"];
  entryKind: AccessDeviceRecord["entry_kind"];
  isActive: boolean;
  isPilot: boolean;
  sharedCondominiumIds: string[];
}): Promise<ServiceResult<AccessDeviceRecord>> {
  try {
    const supabase = await createClient();
    const normalizedHost = normalizeAccessDeviceHostUrl(input.hostUrl);

    const payload = {
      display_name: input.displayName.trim(),
      access_type: input.accessType,
      manufacturer: input.manufacturer.trim(),
      model: input.model.trim(),
      host_url: normalizedHost,
      api_username: input.apiUsername.trim(),
      direction: input.direction,
      entry_kind: input.entryKind,
      is_active: input.isActive,
      is_pilot: input.isPilot,
      ...(input.apiPasswordEncrypted
        ? { api_password_encrypted: input.apiPasswordEncrypted }
        : {}),
    };

    const { error } = await supabase
      .from("access_devices")
      .update(payload)
      .eq("id", input.deviceId)
      .eq("condominium_id", input.condominiumId);

    if (error) {
      if (error.code === "23505") {
        return serviceError("Já existe um local de acesso com este nome neste condomínio.");
      }
      return serviceError(mapSupabaseError(error));
    }

    const shareResult = await replaceAccessDeviceShares(input.deviceId, input.sharedCondominiumIds);
    if (!shareResult.ok) {
      return serviceError(shareResult.error);
    }

    const deviceResult = await getAccessDeviceById(input.deviceId, input.condominiumId);
    if (!deviceResult.ok) {
      return serviceError(deviceResult.error ?? "Equipamento atualizado, mas não foi possível recarregar.");
    }

    return serviceOk(deviceResult.data);
  } catch (error) {
    return serviceError(error instanceof Error ? error.message : "Erro ao atualizar equipamento.");
  }
}

async function replaceAccessDeviceShares(
  deviceId: string,
  sharedCondominiumIds: string[],
): Promise<ServiceResult<void>> {
  const supabase = await createClient();

  const { error: deleteError } = await supabase
    .from("access_device_shares")
    .delete()
    .eq("access_device_id", deviceId);

  if (deleteError) {
    return serviceError(mapSupabaseError(deleteError));
  }

  if (sharedCondominiumIds.length === 0) {
    return serviceOk(undefined);
  }

  const { error: insertError } = await supabase.from("access_device_shares").insert(
    sharedCondominiumIds.map((condominiumId) => ({
      access_device_id: deviceId,
      condominium_id: condominiumId,
    })),
  );

  if (insertError) {
    return serviceError(mapSupabaseError(insertError));
  }

  return serviceOk(undefined);
}

export async function recordAccessDeviceConnectionResult(input: {
  deviceId: string;
  ok: boolean;
  errorMessage?: string;
}): Promise<ServiceResult<void>> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("access_devices")
      .update({
        last_connection_ok_at: input.ok ? new Date().toISOString() : null,
        last_connection_error: input.ok ? null : (input.errorMessage ?? "Falha na conexão."),
      })
      .eq("id", input.deviceId);

    if (error) {
      return serviceError(mapSupabaseError(error));
    }

    return serviceOk(undefined);
  } catch (error) {
    return serviceError(error instanceof Error ? error.message : "Erro ao registrar teste.");
  }
}

export async function getAccessDevicePasswordEncrypted(
  deviceId: string,
): Promise<ServiceResult<string>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("access_devices")
      .select("api_password_encrypted")
      .eq("id", deviceId)
      .maybeSingle();

    if (error) {
      return serviceError(mapSupabaseError(error));
    }

    if (!data?.api_password_encrypted) {
      return serviceError("Senha do equipamento não encontrada.");
    }

    return serviceOk(data.api_password_encrypted);
  } catch (error) {
    return serviceError(error instanceof Error ? error.message : "Erro ao carregar senha.");
  }
}
