import type { AnnouncementDisplayStatus } from "@/lib/announcements/types";
import {
  getAnnouncementDisplayStatusBadgeClass,
  getAnnouncementDisplayStatusLabel,
} from "@/lib/announcements/labels";
import { Badge } from "@/components/ui/badge";

interface AnnouncementDisplayStatusBadgeProps {
  status: AnnouncementDisplayStatus;
}

export function AnnouncementDisplayStatusBadge({ status }: AnnouncementDisplayStatusBadgeProps) {
  return (
    <Badge className={getAnnouncementDisplayStatusBadgeClass(status)}>
      {getAnnouncementDisplayStatusLabel(status)}
    </Badge>
  );
}
