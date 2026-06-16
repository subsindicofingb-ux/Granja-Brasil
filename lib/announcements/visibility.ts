import { ANNOUNCEMENT_PUBLICATION_STATUS } from "@/lib/constants";
import type { AnnouncementRecord } from "@/lib/announcements/types";

/**
 * Espelha public.is_announcement_visible_to_members() no Postgres.
 * Usado pelo dashboard e listagens públicas no app (defesa em profundidade).
 */
export function isAnnouncementVisibleToMembers(
  announcement: Pick<
    AnnouncementRecord,
    "publication_status" | "published_at" | "expires_at"
  >,
  now = new Date(),
): boolean {
  if (announcement.publication_status !== ANNOUNCEMENT_PUBLICATION_STATUS.PUBLISHED) {
    return false;
  }

  const publishedAt = new Date(announcement.published_at);
  if (publishedAt > now) {
    return false;
  }

  if (announcement.expires_at && new Date(announcement.expires_at) <= now) {
    return false;
  }

  return true;
}

/** ISO timestamp UTC para filtros Supabase alinhados ao RLS. */
export function getMemberVisibilityNowIso(now = new Date()): string {
  return now.toISOString();
}

/**
 * Filtros de query para avisos visíveis a moradores/portaria.
 * Staff bypassa isto na listagem administrativa (RLS retorna tudo).
 */
export function getMemberVisibleAnnouncementFilters(now = new Date()) {
  const nowIso = getMemberVisibilityNowIso(now);

  return {
    nowIso,
    publication_status: ANNOUNCEMENT_PUBLICATION_STATUS.PUBLISHED,
    expires_or: `expires_at.is.null,expires_at.gt.${nowIso}`,
  } as const;
}

export function filterAnnouncementsVisibleToMembers<T extends Pick<
  AnnouncementRecord,
  "publication_status" | "published_at" | "expires_at"
>>(
  announcements: T[],
  now = new Date(),
): T[] {
  return announcements.filter((item) => isAnnouncementVisibleToMembers(item, now));
}
