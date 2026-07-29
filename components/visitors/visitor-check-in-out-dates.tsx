import type { VisitorAuthorizationRecord } from "@/lib/visitor-authorizations/types";
import { getVisitorAuthorizationDisplayStatus } from "@/lib/visitor-authorizations/status";
import { cn, formatDateTime } from "@/lib/utils";

interface VisitorCheckInOutDatesProps {
  record: Pick<
    VisitorAuthorizationRecord,
    "status" | "access_starts_at" | "access_ends_at"
  >;
  className?: string;
}

export function VisitorCheckInOutDates({ record, className }: VisitorCheckInOutDatesProps) {
  const expired = getVisitorAuthorizationDisplayStatus(record) === "expired";

  return (
    <span className={cn(expired ? "text-red-700" : "text-muted-foreground", className)}>
      <span className="block">Check-in: {formatDateTime(record.access_starts_at)}</span>
      <span className="block text-xs">Check-out: {formatDateTime(record.access_ends_at)}</span>
    </span>
  );
}
