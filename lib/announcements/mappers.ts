import { resolveGranjaAudienceFromAnnouncement } from "@/lib/announcements/granja-audience";
import type { AnnouncementFormInput } from "@/lib/announcements/types";
import type { AnnouncementWithDetails } from "@/lib/announcements/types";
import { toDatetimeLocalValue } from "@/lib/reservations/timezone";

export function toAnnouncementFormInput(
  announcement: AnnouncementWithDetails,
  options?: { isGranjaSource?: boolean },
): AnnouncementFormInput {
  const targetProfileIds =
    announcement.target_profile_ids ??
    (announcement.target_profile_id ? [announcement.target_profile_id] : []);
  const granjaAudience = options?.isGranjaSource
    ? resolveGranjaAudienceFromAnnouncement(announcement)
    : null;

  return {
    title: announcement.title,
    body: announcement.body,
    priority: announcement.priority,
    tower_id: announcement.tower_id,
    target_condominium_id: announcement.target_condominium_id,
    target_condominium_staff_only: announcement.target_condominium_staff_only ?? false,
    granja_audience: granjaAudience,
    granja_block_condominium_id: announcement.target_condominium_id,
    target_profile_ids: targetProfileIds,
    publication_status: announcement.publication_status,
    published_at: toDatetimeLocalValue(announcement.published_at),
    expires_at: announcement.expires_at
      ? toDatetimeLocalValue(announcement.expires_at)
      : null,
  };
}
