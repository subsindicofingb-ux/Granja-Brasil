import type {
  VisitorAuthorizationDisplayStatus,
  VisitorAuthorizationRecord,
} from "@/lib/visitor-authorizations/types";
import { VISITOR_AUTHORIZATION_STATUS } from "@/lib/constants";

export function getVisitorAuthorizationDisplayStatus(
  record: Pick<
    VisitorAuthorizationRecord,
    "status" | "access_starts_at" | "access_ends_at"
  >,
  now = new Date(),
): VisitorAuthorizationDisplayStatus {
  if (record.status === VISITOR_AUTHORIZATION_STATUS.PENDING) return "pending";
  if (record.status === VISITOR_AUTHORIZATION_STATUS.REJECTED) return "rejected";
  if (record.status === VISITOR_AUTHORIZATION_STATUS.CANCELLED) return "cancelled";

  const starts = new Date(record.access_starts_at);
  const ends = new Date(record.access_ends_at);

  if (ends < now) return "expired";
  if (starts > now) return "scheduled";
  return "active";
}

export function isInDoormanConsultWindow(
  record: Pick<VisitorAuthorizationRecord, "access_starts_at" | "access_ends_at">,
  horizonDays = 1,
  now = new Date(),
): boolean {
  const horizonMs = horizonDays * 24 * 60 * 60_000;
  const windowStart = new Date(now.getTime() - horizonMs);
  const windowEnd = new Date(now.getTime() + horizonMs);
  const accessStart = new Date(record.access_starts_at);
  const accessEnd = new Date(record.access_ends_at);

  return accessEnd >= windowStart && accessStart <= windowEnd;
}
