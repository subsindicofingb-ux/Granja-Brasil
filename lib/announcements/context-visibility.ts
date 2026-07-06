import type { AnnouncementRecord } from "@/lib/announcements/types";

export type AnnouncementViewContext = {
  condominiumId: string;
  profileId: string;
  isStaff: boolean;
};

/**
 * Defesa em profundidade: restringe avisos ao condomínio/contexto atual.
 */
export function isAnnouncementVisibleInContext(
  announcement: Pick<
    AnnouncementRecord,
    | "condominium_id"
    | "target_condominium_id"
    | "target_profile_id"
    | "staff_only"
    | "created_by"
  >,
  context: AnnouncementViewContext,
  granjaCondominiumId: string | null,
): boolean {
  const isGranjaSource =
    granjaCondominiumId !== null && announcement.condominium_id === granjaCondominiumId;
  const isLocalToContext = announcement.condominium_id === context.condominiumId;
  const isGranjaContext = granjaCondominiumId !== null && context.condominiumId === granjaCondominiumId;

  if (announcement.staff_only) {
    if (announcement.created_by === context.profileId) {
      return true;
    }

    if (!context.isStaff) {
      return false;
    }

    // Morador → Granja: visível só na administração Granja.
    if (isGranjaSource && announcement.target_condominium_id) {
      return isGranjaContext;
    }

    // Morador → síndico local: visível só no condomínio de origem (Granja não vê).
    if (isLocalToContext) {
      return true;
    }

    return false;
  }

  if (announcement.target_profile_id) {
    if (announcement.target_profile_id === context.profileId) {
      return true;
    }

    if (context.isStaff && isLocalToContext) {
      return true;
    }

    if (context.isStaff && isGranjaSource && isGranjaContext) {
      return true;
    }

    return false;
  }

  if (announcement.target_condominium_id) {
    if (!context.isStaff) {
      return false;
    }

    if (isGranjaSource && isGranjaContext) {
      return true;
    }

    return announcement.target_condominium_id === context.condominiumId;
  }

  if (isLocalToContext) {
    return true;
  }

  if (isGranjaSource && !isGranjaContext) {
    return true;
  }

  return false;
}

export function filterAnnouncementsForContext<T extends Pick<
  AnnouncementRecord,
  | "condominium_id"
  | "target_condominium_id"
  | "target_profile_id"
  | "staff_only"
  | "created_by"
  | "parent_id"
>>(
  announcements: T[],
  context: AnnouncementViewContext,
  granjaCondominiumId: string | null,
): T[] {
  const roots = announcements.filter((announcement) => !announcement.parent_id);

  return roots.filter((announcement) =>
    isAnnouncementVisibleInContext(announcement, context, granjaCondominiumId),
  );
}
