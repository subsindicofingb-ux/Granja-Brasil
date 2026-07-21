import { buildVisitorControlIdRegistration } from "@/lib/access-devices/registration";
import {
  ControlIdPhotoSyncError,
  removeResidentFromControlIdDevice,
  syncResidentToControlIdDevice,
} from "@/lib/access-devices/controlid-sync";
import { shouldSyncAccessDevice } from "@/lib/access-devices/sync-env";
import { decryptAccessDevicePassword } from "@/lib/access-devices/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapSupabaseError, serviceError, serviceOk, type ServiceResult } from "@/lib/services/types";

const FACIAL_ACCESS_TYPES = new Set(["facial_pedestrian", "facial_vehicle"]);

type VisitorRow = {
  id: string;
  full_name: string;
  photo_url: string | null;
  condominium_id: string;
  controlid_registration: string | null;
};

type GrantRow = {
  id: string;
  access_device_id: string;
  controlid_user_id: number | null;
  controlid_registration: string | null;
};

type JobRow = {
  id: string;
  visitor_authorization_id: string;
  access_device_id: string;
  grant_id: string | null;
  action: "create" | "update" | "remove";
  status: "pending" | "processing" | "completed" | "error";
  attempts: number;
  max_attempts: number;
  controlid_user_id: number | null;
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

async function loadDevice(deviceId: string): Promise<DeviceRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("access_devices")
    .select(
      "id, display_name, host_url, api_username, api_password_encrypted, access_type, is_pilot, is_active",
    )
    .eq("id", deviceId)
    .maybeSingle();

  return (data as DeviceRow | null) ?? null;
}

async function markGrantResult(input: {
  grantId: string | null;
  status: "synced" | "error" | "pending";
  controlIdUserId?: number | null;
  controlIdRegistration?: string | null;
  syncError?: string | null;
}): Promise<void> {
  if (!input.grantId) return;

  const admin = createAdminClient();
  const payload: {
    sync_status: "synced" | "error" | "pending";
    sync_error: string | null;
    synced_at: string | null;
    controlid_user_id?: number | null;
    controlid_registration?: string | null;
  } = {
    sync_status: input.status,
    sync_error: input.syncError ?? null,
    synced_at: input.status === "synced" ? new Date().toISOString() : null,
  };

  if (input.controlIdUserId !== undefined) {
    payload.controlid_user_id = input.controlIdUserId;
  }

  if (input.controlIdRegistration !== undefined) {
    payload.controlid_registration = input.controlIdRegistration;
  }

  await admin.from("visitor_access_grants").update(payload).eq("id", input.grantId);
}

async function markJobResult(input: {
  jobId: string;
  status: JobRow["status"];
  lastError?: string | null;
  attempts: number;
}): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("visitor_access_sync_jobs")
    .update({
      status: input.status,
      last_error: input.lastError ?? null,
      attempts: input.attempts,
      completed_at:
        input.status === "completed" || input.status === "error"
          ? new Date().toISOString()
          : null,
    })
    .eq("id", input.jobId);
}

export async function enqueueVisitorAccessSyncJob(input: {
  visitorAuthorizationId: string;
  accessDeviceId: string;
  grantId?: string | null;
  action: "create" | "update" | "remove";
  controlIdUserId?: number | null;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("visitor_access_sync_jobs").insert({
    visitor_authorization_id: input.visitorAuthorizationId,
    access_device_id: input.accessDeviceId,
    grant_id: input.grantId ?? null,
    action: input.action,
    status: "pending",
    controlid_user_id: input.controlIdUserId ?? null,
  });

  if (error && error.code !== "23505") {
    console.error("[visitor-access-sync:enqueue]", mapSupabaseError(error));
  }
}

async function processVisitorJob(job: JobRow): Promise<{ ok: boolean; error?: string; skip?: boolean }> {
  const admin = createAdminClient();

  const { data: visitorData } = await admin
    .from("visitor_authorizations")
    .select("id, full_name, photo_url, condominium_id, controlid_registration")
    .eq("id", job.visitor_authorization_id)
    .maybeSingle();

  const visitor = visitorData as VisitorRow | null;
  if (!visitor) {
    return { ok: false, error: "Visitante não encontrado.", skip: true };
  }

  const device = await loadDevice(job.access_device_id);
  if (!device?.is_active) {
    return { ok: false, error: "Equipamento inativo.", skip: true };
  }

  if (!shouldSyncAccessDevice(device.is_pilot)) {
    return { ok: false, error: "Sync desabilitado para este equipamento.", skip: true };
  }

  let password: string;
  try {
    password = decryptAccessDevicePassword(device.api_password_encrypted);
  } catch {
    return { ok: false, error: `${device.display_name}: senha indisponível.` };
  }

  let grant: GrantRow | null = null;
  if (job.grant_id) {
    const { data } = await admin
      .from("visitor_access_grants")
      .select("id, access_device_id, controlid_user_id, controlid_registration")
      .eq("id", job.grant_id)
      .maybeSingle();
    grant = (data as GrantRow | null) ?? null;
  }

  const registration =
    visitor.controlid_registration ??
    grant?.controlid_registration ??
    buildVisitorControlIdRegistration(visitor.id);

  if (job.action === "remove") {
    await removeResidentFromControlIdDevice({
      hostUrl: device.host_url,
      username: device.api_username,
      password,
      controlIdUserId: job.controlid_user_id ?? grant?.controlid_user_id ?? null,
      registration,
    });
    return { ok: true };
  }

  const requiresPhoto = requiresPhotoForAccessType(device.access_type);

  try {
    const result = await syncResidentToControlIdDevice({
      hostUrl: device.host_url,
      username: device.api_username,
      password,
      residentId: visitor.id,
      residentName: visitor.full_name,
      photoUrl: visitor.photo_url,
      requiresPhoto,
      existingControlIdUserId: job.controlid_user_id ?? grant?.controlid_user_id ?? null,
      registration,
    });

    await admin
      .from("visitor_authorizations")
      .update({ controlid_registration: result.controlIdRegistration })
      .eq("id", visitor.id);

    await markGrantResult({
      grantId: job.grant_id,
      status: "synced",
      controlIdUserId: result.controlIdUserId,
      controlIdRegistration: result.controlIdRegistration,
      syncError: null,
    });

    return { ok: true };
  } catch (error) {
    if (error instanceof ControlIdPhotoSyncError) {
      await admin
        .from("visitor_authorizations")
        .update({ controlid_registration: error.controlIdRegistration })
        .eq("id", visitor.id);

      await markGrantResult({
        grantId: job.grant_id,
        status: "error",
        controlIdUserId: error.controlIdUserId,
        controlIdRegistration: error.controlIdRegistration,
        syncError: error.message,
      });
      return { ok: false, error: error.message };
    }

    throw error;
  }
}

export async function processPendingVisitorAccessSyncJobs(input?: {
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
      .from("visitor_access_sync_jobs")
      .select(
        "id, visitor_authorization_id, access_device_id, grant_id, action, status, attempts, max_attempts, controlid_user_id",
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

      await admin
        .from("visitor_access_sync_jobs")
        .update({ status: "processing", attempts, started_at: new Date().toISOString() })
        .eq("id", rawJob.id)
        .eq("status", "pending");

      try {
        const result = await processVisitorJob(rawJob);

        if (result.ok) {
          await markJobResult({ jobId: rawJob.id, status: "completed", attempts });
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

        throw new Error(result.error ?? "Falha no sync ControlID do visitante.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha no sync ControlID.";
        const isFinalAttempt = attempts >= rawJob.max_attempts;

        await markGrantResult({
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
    return serviceError(
      error instanceof Error ? error.message : "Erro ao processar fila de sync de visitantes.",
    );
  }
}

export async function processExpiredVisitorAuthorizations(): Promise<ServiceResult<number>> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: expired, error } = await admin
    .from("visitor_authorizations")
    .select("id, sync_controlid, checked_out_at")
    .eq("status", "approved")
    .lt("access_ends_at", now)
    .is("checked_out_at", null);

  if (error) {
    return serviceError(mapSupabaseError(error));
  }

  let processed = 0;

  for (const row of expired ?? []) {
    const { data: grants } = await admin
      .from("visitor_access_grants")
      .select("id, access_device_id, controlid_user_id")
      .eq("visitor_authorization_id", row.id)
      .eq("sync_status", "synced");

    await admin
      .from("visitor_authorizations")
      .update({ checked_out_at: now })
      .eq("id", row.id);

    if (row.sync_controlid && grants?.length) {
      for (const grant of grants) {
        await enqueueVisitorAccessSyncJob({
          visitorAuthorizationId: row.id,
          accessDeviceId: grant.access_device_id,
          grantId: grant.id,
          action: "remove",
          controlIdUserId: grant.controlid_user_id,
        });
      }
    }

    processed += 1;
  }

  return serviceOk(processed);
}

export async function runPendingVisitorAccessSync(limit = 3): Promise<void> {
  await processPendingVisitorAccessSyncJobs({ limit });
}
