import type { AnnouncementDisplayStatus, AnnouncementRecord } from "@/lib/announcements/types";
import { ANNOUNCEMENT_PUBLICATION_STATUS } from "@/lib/constants";

export { isAnnouncementVisibleToMembers } from "@/lib/announcements/visibility";

export function getAnnouncementDisplayStatus(
  announcement: Pick<
    AnnouncementRecord,
    "publication_status" | "published_at" | "expires_at"
  >,
  now = new Date(),
): AnnouncementDisplayStatus {
  if (announcement.publication_status === ANNOUNCEMENT_PUBLICATION_STATUS.DRAFT) {
    return "draft";
  }

  const publishedAt = new Date(announcement.published_at);
  if (publishedAt > now) {
    return "scheduled";
  }

  if (announcement.expires_at && new Date(announcement.expires_at) <= now) {
    return "expired";
  }

  return "published";
}
