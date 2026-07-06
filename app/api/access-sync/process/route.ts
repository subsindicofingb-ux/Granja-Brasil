import { NextResponse } from "next/server";
import { getAccessSyncWorkerSecret } from "@/lib/access-devices/sync-env";
import {
  processExpiredVisitorAuthorizations,
  processPendingVisitorAccessSyncJobs,
} from "@/lib/services/visitor-access-sync";
import { processPendingAccessSyncJobs } from "@/lib/services/access-sync";

export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const secret = getAccessSyncWorkerSecret();
  if (!secret) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) {
    return true;
  }

  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  if (request.headers.get("x-cron-secret") === secret) {
    return true;
  }

  return request.headers.get("x-vercel-cron") === "1" && Boolean(cronSecret || secret);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "1");

  await processExpiredVisitorAuthorizations();

  const [residentResult, visitorResult] = await Promise.all([
    processPendingAccessSyncJobs({
      limit: Number.isFinite(limit) ? limit : 1,
    }),
    processPendingVisitorAccessSyncJobs({
      limit: Number.isFinite(limit) ? limit : 1,
    }),
  ]);

  if (!residentResult.ok) {
    return NextResponse.json({ error: residentResult.error }, { status: 500 });
  }

  if (!visitorResult.ok) {
    return NextResponse.json({ error: visitorResult.error }, { status: 500 });
  }

  return NextResponse.json({
    residents: residentResult.data,
    visitors: visitorResult.data,
  });
}

export async function GET(request: Request) {
  return POST(request);
}
