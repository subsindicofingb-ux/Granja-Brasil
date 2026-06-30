import { normalizeAccessDeviceHostUrl } from "@/lib/access-devices/controlid-client";

export function isAccessSyncPilotOnly(): boolean {
  return process.env.ACCESS_SYNC_PILOT_ONLY !== "false";
}

export function getAccessSyncWorkerSecret(): string | null {
  return process.env.ACCESS_SYNC_WORKER_SECRET?.trim() || null;
}

export function getSiteUrlForSyncTrigger(): string {
  return (
    process.env.ACCESS_SYNC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

export async function triggerAccessSyncProcessing(limit = 1): Promise<void> {
  const secret = getAccessSyncWorkerSecret();
  if (!secret) {
    return;
  }

  const siteUrl = getSiteUrlForSyncTrigger();

  try {
    await fetch(`${siteUrl}/api/access-sync/process?limit=${limit}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch (error) {
    console.error("[access-sync:trigger]", error);
  }
}

export function shouldSyncAccessDevice(isPilot: boolean): boolean {
  if (!isAccessSyncPilotOnly()) {
    return true;
  }

  return isPilot;
}

export function buildDeviceBaseUrl(hostUrl: string): string {
  return normalizeAccessDeviceHostUrl(hostUrl);
}
