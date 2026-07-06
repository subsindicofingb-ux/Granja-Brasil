import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { UnitWithTower } from "@/lib/services/units";
import { buildVisitorControlIdRegistration } from "@/lib/access-devices/registration";
import {
  enqueueVisitorAccessSyncJob,
  runPendingVisitorAccessSync,
} from "@/lib/services/visitor-access-sync";
import { listActiveAccessDevicesForCondominium } from "@/lib/services/resident-access-grants";
import { mapSupabaseError, serviceError, serviceOk, type ServiceResult } from "@/lib/services/types";

export async function replaceVisitorAuthorizationAccessDevices(input: {
  visitorAuthorizationId: string;
  condominiumId: string;
  accessDeviceIds: string[];
}): Promise<ServiceResult<null>> {
  if (input.accessDeviceIds.length > 0) {
    const devicesResult = await listActiveAccessDevicesForCondominium(input.condominiumId);
    if (!devicesResult.ok) {
      return serviceError(devicesResult.error ?? "Erro ao validar locais de acesso.");
    }

    const allowed = new Set(devicesResult.data.map((device) => device.id));
    const invalid = input.accessDeviceIds.filter((id) => !allowed.has(id));
    if (invalid.length > 0) {
      return serviceError("Um ou mais locais de acesso selecionados não estão disponíveis.");
    }
  }

  const supabase = await createClient();

  const { error: deleteError } = await supabase
    .from("visitor_authorization_access_devices")
    .delete()
    .eq("visitor_authorization_id", input.visitorAuthorizationId);

  if (deleteError) {
    return serviceError(mapSupabaseError(deleteError));
  }

  if (input.accessDeviceIds.length === 0) {
    return serviceOk(null);
  }

  const { error: insertError } = await supabase
    .from("visitor_authorization_access_devices")
    .insert(
      input.accessDeviceIds.map((accessDeviceId) => ({
        visitor_authorization_id: input.visitorAuthorizationId,
        access_device_id: accessDeviceId,
      })),
    );

  if (insertError) {
    return serviceError(mapSupabaseError(insertError));
  }

  return serviceOk(null);
}

export async function getVisitorAuthorizationAccessDeviceIds(
  visitorAuthorizationId: string,
): Promise<ServiceResult<string[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("visitor_authorization_access_devices")
    .select("access_device_id")
    .eq("visitor_authorization_id", visitorAuthorizationId);

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  return serviceOk((data ?? []).map((row) => row.access_device_id as string));
}

export async function activateVisitorAccessGrantsOnApproval(
  visitorAuthorizationId: string,
  _condominiumId: string,
): Promise<ServiceResult<null>> {
  const deviceIdsResult = await getVisitorAuthorizationAccessDeviceIds(visitorAuthorizationId);
  if (!deviceIdsResult.ok) {
    return serviceError(deviceIdsResult.error);
  }

  if (deviceIdsResult.data.length === 0) {
    return serviceOk(null);
  }

  const admin = createAdminClient();
  const registration = buildVisitorControlIdRegistration(visitorAuthorizationId);

  await admin
    .from("visitor_authorizations")
    .update({ sync_controlid: true, controlid_registration: registration })
    .eq("id", visitorAuthorizationId);

  const { error: deleteError } = await admin
    .from("visitor_access_grants")
    .delete()
    .eq("visitor_authorization_id", visitorAuthorizationId);

  if (deleteError) {
    return serviceError(mapSupabaseError(deleteError));
  }

  const { error: insertError } = await admin
    .from("visitor_access_grants")
    .insert(
      deviceIdsResult.data.map((accessDeviceId) => ({
        visitor_authorization_id: visitorAuthorizationId,
        access_device_id: accessDeviceId,
        sync_status: "pending" as const,
        controlid_registration: registration,
      })),
    );

  if (insertError) {
    return serviceError(mapSupabaseError(insertError));
  }

  return serviceOk(null);
}

export async function checkInVisitorAuthorization(input: {
  visitorAuthorizationId: string;
  condominiumId: string;
}): Promise<ServiceResult<null>> {
  const admin = createAdminClient();

  const { data: visitor, error: visitorError } = await admin
    .from("visitor_authorizations")
    .select("id, status, sync_controlid, checked_in_at, checked_out_at, photo_url")
    .eq("id", input.visitorAuthorizationId)
    .eq("condominium_id", input.condominiumId)
    .maybeSingle();

  if (visitorError || !visitor) {
    return serviceError("Autorização não encontrada.");
  }

  if (visitor.status !== "approved") {
    return serviceError("Somente autorizações aprovadas podem fazer check-in.");
  }

  if (visitor.checked_out_at) {
    return serviceError("Visitante já fez check-out.");
  }

  if (visitor.checked_in_at) {
    return serviceError("Check-in já registrado.");
  }

  const now = new Date().toISOString();

  const { error: updateError } = await admin
    .from("visitor_authorizations")
    .update({ checked_in_at: now })
    .eq("id", input.visitorAuthorizationId);

  if (updateError) {
    return serviceError(mapSupabaseError(updateError));
  }

  if (!visitor.sync_controlid) {
    return serviceOk(null);
  }

  const { data: grants } = await admin
    .from("visitor_access_grants")
    .select("id, access_device_id, controlid_user_id")
    .eq("visitor_authorization_id", input.visitorAuthorizationId);

  for (const grant of grants ?? []) {
    await enqueueVisitorAccessSyncJob({
      visitorAuthorizationId: input.visitorAuthorizationId,
      accessDeviceId: grant.access_device_id,
      grantId: grant.id,
      action: "create",
      controlIdUserId: grant.controlid_user_id,
    });
  }

  await runPendingVisitorAccessSync(5);
  return serviceOk(null);
}

export async function checkOutVisitorAuthorization(input: {
  visitorAuthorizationId: string;
  condominiumId: string;
}): Promise<ServiceResult<null>> {
  const admin = createAdminClient();

  const { data: visitor, error: visitorError } = await admin
    .from("visitor_authorizations")
    .select("id, status, sync_controlid, checked_in_at, checked_out_at")
    .eq("id", input.visitorAuthorizationId)
    .eq("condominium_id", input.condominiumId)
    .maybeSingle();

  if (visitorError || !visitor) {
    return serviceError("Autorização não encontrada.");
  }

  if (visitor.status !== "approved") {
    return serviceError("Somente autorizações aprovadas podem fazer check-out.");
  }

  if (visitor.checked_out_at) {
    return serviceError("Check-out já registrado.");
  }

  const now = new Date().toISOString();

  const { error: updateError } = await admin
    .from("visitor_authorizations")
    .update({ checked_out_at: now })
    .eq("id", input.visitorAuthorizationId);

  if (updateError) {
    return serviceError(mapSupabaseError(updateError));
  }

  if (!visitor.sync_controlid) {
    return serviceOk(null);
  }

  const { data: grants } = await admin
    .from("visitor_access_grants")
    .select("id, access_device_id, controlid_user_id, sync_status")
    .eq("visitor_authorization_id", input.visitorAuthorizationId);

  for (const grant of grants ?? []) {
    if (grant.sync_status !== "synced" && !grant.controlid_user_id) {
      continue;
    }

    await enqueueVisitorAccessSyncJob({
      visitorAuthorizationId: input.visitorAuthorizationId,
      accessDeviceId: grant.access_device_id,
      grantId: grant.id,
      action: "remove",
      controlIdUserId: grant.controlid_user_id,
    });
  }

  await runPendingVisitorAccessSync(5);
  return serviceOk(null);
}

export async function listVisitorAccessGrants(visitorAuthorizationId: string) {
  const supabase = await createClient();
  const { data: grantRows, error } = await supabase
    .from("visitor_access_grants")
    .select("id, access_device_id, sync_status, sync_error, controlid_user_id, synced_at")
    .eq("visitor_authorization_id", visitorAuthorizationId)
    .order("created_at", { ascending: true });

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  const rows = grantRows ?? [];
  if (rows.length === 0) {
    return serviceOk([]);
  }

  const { data: deviceRows, error: devicesError } = await supabase
    .from("access_devices")
    .select("id, display_name, access_type, is_pilot")
    .in(
      "id",
      rows.map((row) => row.access_device_id),
    );

  if (devicesError) {
    return serviceError(mapSupabaseError(devicesError));
  }

  const devicesById = new Map((deviceRows ?? []).map((device) => [device.id, device]));

  return serviceOk(
    rows.map((row) => ({
      ...row,
      access_device: devicesById.get(row.access_device_id) ?? null,
    })),
  );
}

type ResidentUnitRow = {
  unit_id: string;
  units: {
    id: string;
    tower_id: string;
    number: string;
    block: string | null;
    created_at: string;
    updated_at: string;
    towers: {
      id: string;
      name: string;
      condominium_id: string;
    };
  };
};

function mapResidentUnitRow(row: ResidentUnitRow) {
  return {
    id: row.units.id,
    tower_id: row.units.tower_id,
    number: row.units.number,
    block: row.units.block,
    created_at: row.units.created_at,
    updated_at: row.units.updated_at,
    tower: row.units.towers,
  };
}

export async function listUnitIdsForVisitorRegistration(
  profileId: string,
  condominiumId: string,
): Promise<ServiceResult<string[]>> {
  const unitsResult = await listUnitsForVisitorRegistration(profileId, condominiumId);

  if (!unitsResult.ok) {
    return unitsResult;
  }

  return serviceOk(unitsResult.data.map((unit) => unit.id));
}

export async function listUnitsForVisitorRegistration(
  profileId: string,
  condominiumId: string,
): Promise<ServiceResult<UnitWithTower[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("residents")
    .select(
      `
      unit_id,
      units!inner (
        id,
        tower_id,
        number,
        block,
        created_at,
        updated_at,
        towers!inner (
          id,
          name,
          condominium_id
        )
      )
    `,
    )
    .eq("profile_id", profileId)
    .eq("units.towers.condominium_id", condominiumId)
    .in("type", ["owner", "responsible", "tenant"]);

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  const seen = new Set<string>();
  const units: UnitWithTower[] = [];

  for (const row of (data as ResidentUnitRow[] | null) ?? []) {
    if (seen.has(row.unit_id)) {
      continue;
    }
    seen.add(row.unit_id);
    units.push(mapResidentUnitRow(row));
  }

  units.sort((left, right) => left.number.localeCompare(right.number, "pt-BR"));

  return serviceOk(units);
}
