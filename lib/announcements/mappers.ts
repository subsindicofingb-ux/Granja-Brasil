import type { AnnouncementFormInput } from "@/lib/announcements/types";
import type { AnnouncementWithDetails } from "@/lib/announcements/types";
import { toDatetimeLocalValue } from "@/lib/reservations/timezone";

export function toAnnouncementFormInput(
  announcement: AnnouncementWithDetails,
): AnnouncementFormInput {
  return {
    title: announcement.title,
    body: announcement.body,
    priority: announcement.priority,
    tower_id: announcement.tower_id,
    publication_status: announcement.publication_status,
    published_at: toDatetimeLocalValue(announcement.published_at),
    expires_at: announcement.expires_at
      ? toDatetimeLocalValue(announcement.expires_at)
      : null,
  };
}
