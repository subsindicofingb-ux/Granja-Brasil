import { buildControlIdRegistration } from "@/lib/access-devices/registration";
import {
  removeResidentFromControlIdDevice,
  syncResidentToControlIdDevice,
} from "@/lib/access-devices/controlid-sync";
import { shouldSyncAccessDevice } from "@/lib/access-devices/sync-env";
import { decryptAccessDevicePassword } from "@/lib/access-devices/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapSupabaseError, serviceError, serviceOk, type ServiceResult } from "@/lib/services/types";

export type AccessSyncAction = "create" | "update" | "remove";
export type AccessSyncJobStatus = "pending" | "processing" | "completed" | "error";

const FACIAL_ACCESS_TYPES = new Set(["facial_pedestrian", "facial_vehicle"]);

type GrantRow = {
  id: string;
  access_device_id: string;
  controlid_user_id: number | null;
  controlid_registration: string | null;
  sync_status: "pending" | "synced" | "error";
};

type JobRow = {
  id: string;
  resident_id: string | null;
  access_device_id: string;
  grant_id: string | null;
  action: AccessSyncAction;
  status: AccessSyncJobStatus;
  attempts: number;
  max_attempts: number;
  controlid_user_id: number | null;
};

type ResidentRow = {
  id: string;
  full_name: string;
  photo_url: string | null;
};

type DeviceRow = {
  id: string;
  display_name: string;
  host_url: string;
  api_username: string;
  api_password_encrypted: string;
  access_type: string;
  is_pilot: boolean;
  is_active: boolean;
};

function requiresPhotoForAccessType(accessType: string): boolean {
  return FACIAL_ACCESS_TYPES.has(accessType);
}

async function markGrantSyncResult(input: {
  grantId: string | null;
  status: "synced" | "error" | "pending";
  controlIdUserId?: number | null;
  controlIdRegistration?: string | null;
  syncError?: string | null;
}): Promise<void> {
  if (!input.grantId) {
    return;
  }

  const admin = createAdminClient();
  await admin
    .from("resident_access_grants")
    .update({
      sync_status: input.status,
      sync_error: input.syncError ?? null,
      controlid_user_id: input.controlIdUserId ?? null,
      controlid_registration: input.controlIdRegistration ?? null,
      synced_at: input.status === "synced" ? new Date().toISOString() : null,
    })
    .eq("id", input.grantId);
}

async function markJobResult(input: {
  jobId: string;
  status: AccessSyncJobStatus;
  lastError?: string | null;
  attempts: number;
}): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("access_sync_jobs")
    .update({
      status: input.status,
      last_error: input.lastError ?? null,
      attempts: input.attempts,
      completed_at: input.status === "completed" || input.status === "error"
        ? new Date().toISOString()
        : null,
    })
    .eq("id", input.jobId);
}

export async function enqueueAccessSyncJob(input: {
  residentId: string;
  accessDeviceId: string;
  grantId?: string | null;
  action: AccessSyncAction;
  controlIdUserId?: number | null;
}): Promise<void> {
  const admin = createAdminClient();

  const { error } = await admin.from("access_sync_jobs").insert({
    resident_id: input.residentId,
    access_device_id: input.accessDeviceId,
    grant_id: input.grantId ?? null,
    action: input.action,
    status: "pending",
    controlid_user_id: input.controlIdUserId ?? null,
  });

  if (error && error.code !== "23505") {
    console.error("[access-sync:enqueue]", mapSupabaseError(error));
  }
}

export async function enqueueResidentRemovalFromAccessDevices(
  residentId: string,
): Promise<number> {
  const admin = createAdminClient();

  const { data: grants, error } = await admin
    .from("resident_access_grants")
    .select("id, access_device_id, controlid_user_id")
    .eq("resident_id", residentId)
    .not("controlid_user_id", "is", null);

  if (error) {
    console.error("[access-sync:remove-enqueue]", mapSupabaseError(error));
    return 0;
  }

  await admin
    .from("access_sync_jobs")
    .update({
      status: "completed",
      last_error: "Morador excluído antes do sync.",
      completed_at: new Date().toISOString(),
    })
    .eq("resident_id", residentId)
    .in("action", ["create", "update"])
    .in("status", ["pending", "processing"]);

  let enqueued = 0;

  for (const grant of (grants as GrantRow[] | null) ?? []) {
    if (!grant.controlid_user_id) {
      continue;
    }

    await enqueueAccessSyncJob({
      residentId,
      accessDeviceId: grant.access_device_id,
      action: "remove",
      controlIdUserId: grant.controlid_user_id,
    });
    enqueued += 1;
  }

  return enqueued;
}

export async function enqueueResidentProfileSyncUpdates(residentId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: grants } = await admin
    .from("resident_access_grants")
    .select("id, access_device_id, controlid_user_id, sync_status")
    .eq("resident_id", residentId)
    .not("controlid_user_id", "is", null);

  for (const grant of (grants as GrantRow[] | null) ?? []) {
    if (!grant.controlid_user_id) {
      continue;
    }

    await admin
      .from("resident_access_grants")
      .update({ sync_status: "pending", sync_error: null })
      .eq("id", grant.id);

    await enqueueAccessSyncJob({
      residentId,
      accessDeviceId: grant.access_device_id,
      grantId: grant.id,
      action: "update",
      controlIdUserId: grant.controlid_user_id,
    });
  }
}

async function loadJobContext(job: JobRow): Promise<
  | {
      ok: true;
      resident: ResidentRow;
      device: DeviceRow;
      grant: GrantRow | null;
      password: string;
    }
  | { ok: false; error: string; skip?: boolean }
> {
  const admin = createAdminClient();

  const { data: device, error: deviceError } = await admin
    .from("access_devices")
    .select(
      "id, display_name, host_url, api_username, api_password_encrypted, access_type, is_pilot, is_active",
    )
    .eq("id", job.access_device_id)
    .maybeSingle();

  if (deviceError || !device) {
    return { ok: false, error: "Equipamento não encontrado para sync." };
  }

  const deviceRow = device as DeviceRow;

  if (!deviceRow.is_active) {
    return { ok: false, error: "Equipamento inativo.", skip: true };
  }

  if (!shouldSyncAccessDevice(deviceRow.is_pilot)) {
    return {
      ok: false,
      error: "Sync limitado a equipamentos piloto (ACCESS_SYNC_PILOT_ONLY).",
      skip: true,
    };
  }

  let password: string;
  try {
    password = decryptAccessDevicePassword(deviceRow.api_password_encrypted);
  } catch {
    return { ok: false, error: "Não foi possível descriptografar a senha do equipamento." };
  }

  if (job.action === "remove") {
    return {
      ok: true,
      resident: {
        id: job.resident_id ?? "",
        full_name: "",
        photo_url: null,
      },
      device: deviceRow,
      grant: null,
      password,
    };
  }

  if (!job.resident_id) {
    return { ok: false, error: "Morador excluído.", skip: true };
  }

  const { data: resident, error: residentError } = await admin
    .from("residents")
    .select("id, full_name, photo_url")
    .eq("id", job.resident_id)
    .maybeSingle();

  if (residentError || !resident) {
    return { ok: false, error: "Morador não encontrado para sync." };
  }

  let grant: GrantRow | null = null;
  if (job.grant_id) {
    const { data: grantData } = await admin
      .from("resident_access_grants")
      .select("id, access_device_id, controlid_user_id, controlid_registration, sync_status")
      .eq("id", job.grant_id)
      .maybeSingle();

    grant = (grantData as GrantRow | null) ?? null;
  }

  return {
    ok: true,
    resident: resident as ResidentRow,
    device: deviceRow,
    grant,
    password,
  };
}

async function processAccessSyncJob(job: JobRow): Promise<{ ok: boolean; error?: string; skip?: boolean }> {
  const context = await loadJobContext(job);
  if (!context.ok) {
    return { ok: false, error: context.error, skip: context.skip };
  }

  const { resident, device, grant, password } = context;
  const controlIdUserId = job.controlid_user_id ?? grant?.controlid_user_id ?? null;

  if (job.action === "remove") {
    if (!controlIdUserId) {
      return { ok: true };
    }

    await removeResidentFromControlIdDevice({
      hostUrl: device.host_url,
      username: device.api_username,
      password,
      controlIdUserId,
    });

    return { ok: true };
  }

  const requiresPhoto = requiresPhotoForAccessType(device.access_type);
  const result = await syncResidentToControlIdDevice({
    hostUrl: device.host_url,
    username: device.api_username,
    password,
    residentId: resident.id,
    residentName: resident.full_name,
    photoUrl: resident.photo_url,
    requiresPhoto,
    existingControlIdUserId: controlIdUserId,
  });

  await markGrantSyncResult({
    grantId: job.grant_id,
    status: "synced",
    controlIdUserId: result.controlIdUserId,
    controlIdRegistration: result.controlIdRegistration,
    syncError: null,
  });

  return { ok: true };
}

export async function processPendingAccessSyncJobs(input?: {
  limit?: number;
}): Promise<
  ServiceResult<{
    processed: number;
    completed: number;
    failed: number;
    skipped: number;
  }>
> {
  const limit = Math.max(1, Math.min(input?.limit ?? 1, 10));

  try {
    const admin = createAdminClient();
    const { data: jobs, error } = await admin
      .from("access_sync_jobs")
      .select(
        "id, resident_id, access_device_id, grant_id, action, status, attempts, max_attempts, controlid_user_id",
      )
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(limit);

    if (error) {
      return serviceError(mapSupabaseError(error));
    }

    let completed = 0;
    let failed = 0;
    let skipped = 0;

    for (const rawJob of (jobs as JobRow[] | null) ?? []) {
      const attempts = rawJob.attempts + 1;
      const startedAt = new Date().toISOString();

      await admin
        .from("access_sync_jobs")
        .update({ status: "processing", attempts, started_at: startedAt })
        .eq("id", rawJob.id)
        .eq("status", "pending");

      try {
        const result = await processAccessSyncJob(rawJob);

        if (result.ok) {
          await markJobResult({
            jobId: rawJob.id,
            status: "completed",
            attempts,
          });
          completed += 1;
          continue;
        }

        if (result.skip) {
          await markJobResult({
            jobId: rawJob.id,
            status: "completed",
            lastError: result.error,
            attempts,
          });
          skipped += 1;
          continue;
        }

        throw new Error(result.error ?? "Falha no sync ControlID.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha no sync ControlID.";
        const isFinalAttempt = attempts >= rawJob.max_attempts;

        await markGrantSyncResult({
          grantId: rawJob.grant_id,
          status: isFinalAttempt ? "error" : "pending",
          syncError: message,
        });

        await markJobResult({
          jobId: rawJob.id,
          status: isFinalAttempt ? "error" : "pending",
          lastError: message,
          attempts,
        });

        failed += 1;
      }
    }

    return serviceOk({
      processed: (jobs ?? []).length,
      completed,
      failed,
      skipped,
    });
  } catch (error) {
    return serviceError(error instanceof Error ? error.message : "Erro ao processar fila de sync.");
  }
}

export async function enqueueResidentAccessSyncJobs(input: {
  residentId: string;
  accessDeviceIds: string[];
}): Promise<void> {
  const registration = buildControlIdRegistration(input.residentId);

  for (const accessDeviceId of input.accessDeviceIds) {
    const admin = createAdminClient();
    const { data: grant } = await admin
      .from("resident_access_grants")
      .select("id, controlid_user_id")
      .eq("resident_id", input.residentId)
      .eq("access_device_id", accessDeviceId)
      .maybeSingle();

    if (!grant) {
      continue;
    }

    await admin
      .from("resident_access_grants")
      .update({
        sync_status: "pending",
        sync_error: null,
        controlid_registration: registration,
      })
      .eq("id", grant.id);

    await enqueueAccessSyncJob({
      residentId: input.residentId,
      accessDeviceId,
      grantId: grant.id,
      action: grant.controlid_user_id ? "update" : "create",
      controlIdUserId: grant.controlid_user_id,
    });
  }
}

export async function syncDiffResidentAccessGrants(input: {
  residentId: string;
  condominiumId: string;
  accessDeviceIds: string[];
}): Promise<ServiceResult<string[]>> {
  const admin = createAdminClient();

  const { data: existingRows, error: existingError } = await admin
    .from("resident_access_grants")
    .select("id, access_device_id, controlid_user_id, controlid_registration, sync_status")
    .eq("resident_id", input.residentId);

  if (existingError) {
    return serviceError(mapSupabaseError(existingError));
  }

  const existing = (existingRows as GrantRow[] | null) ?? [];
  const existingByDevice = new Map(existing.map((grant) => [grant.access_device_id, grant]));
  const newDeviceIds = new Set(input.accessDeviceIds);
  const registration = buildControlIdRegistration(input.residentId);

  for (const grant of existing) {
    if (!newDeviceIds.has(grant.access_device_id)) {
      await admin.from("resident_access_grants").delete().eq("id", grant.id);

      if (grant.controlid_user_id) {
        await enqueueAccessSyncJob({
          residentId: input.residentId,
          accessDeviceId: grant.access_device_id,
          action: "remove",
          controlIdUserId: grant.controlid_user_id,
        });
      }
    }
  }

  const addedDeviceIds: string[] = [];

  for (const accessDeviceId of input.accessDeviceIds) {
    if (existingByDevice.has(accessDeviceId)) {
      continue;
    }

    const { data: inserted, error: insertError } = await admin
      .from("resident_access_grants")
      .insert({
        resident_id: input.residentId,
        access_device_id: accessDeviceId,
        sync_status: "pending",
        controlid_registration: registration,
      })
      .select("id")
      .single();

    if (insertError) {
      return serviceError(mapSupabaseError(insertError));
    }

    addedDeviceIds.push(accessDeviceId);

    await enqueueAccessSyncJob({
      residentId: input.residentId,
      accessDeviceId,
      grantId: inserted.id,
      action: "create",
    });
  }

  return serviceOk(addedDeviceIds);
}
