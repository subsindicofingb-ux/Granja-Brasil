import type {
  VisitorAuthorizationDisplayStatus,
  VisitorAuthorizationRecord,
} from "@/lib/visitor-authorizations/types";
import {
  getVisitorDisplayStatusBadgeClass,
  getVisitorDisplayStatusLabel,
} from "@/lib/visitor-authorizations/labels";
import { getVisitorAuthorizationDisplayStatus } from "@/lib/visitor-authorizations/status";
import { Badge } from "@/components/ui/badge";

interface VisitorDisplayStatusBadgeProps {
  record: Pick<
    VisitorAuthorizationRecord,
    "status" | "access_starts_at" | "access_ends_at"
  >;
}

export function VisitorDisplayStatusBadge({ record }: VisitorDisplayStatusBadgeProps) {
  const displayStatus = getVisitorAuthorizationDisplayStatus(record);

  return (
    <Badge className={getVisitorDisplayStatusBadgeClass(displayStatus)}>
      {getVisitorDisplayStatusLabel(displayStatus)}
    </Badge>
  );
}

export function VisitorDisplayStatusBadgeFromStatus({
  status,
}: {
  status: VisitorAuthorizationDisplayStatus;
}) {
  return (
    <Badge className={getVisitorDisplayStatusBadgeClass(status)}>
      {getVisitorDisplayStatusLabel(status)}
    </Badge>
  );
}
