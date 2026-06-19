import type { AnnouncementRecord } from "@/lib/announcements/types";

export type AnnouncementViewContext = {
  condominiumId: string;
  profileId: string;
  isStaff: boolean;
};

/**
 * Defesa em profundidade: restringe avisos ao condomínio/contexto atual.
 * Espelha as regras de audiência (geral, síndico, morador específico).
 */
export function isAnnouncementVisibleInContext(
  announcement: Pick<
    AnnouncementRecord,
    | "condominium_id"
    | "target_condominium_id"
    | "target_profile_id"
  >,
  context: AnnouncementViewContext,
  granjaCondominiumId: string | null,
): boolean {
  const isGranjaSource =
    granjaCondominiumId !== null && announcement.condominium_id === granjaCondominiumId;
  const isLocalToContext = announcement.condominium_id === context.condominiumId;
  const isGranjaContext = granjaCondominiumId !== null && context.condominiumId === granjaCondominiumId;

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
>>(
  announcements: T[],
  context: AnnouncementViewContext,
  granjaCondominiumId: string | null,
): T[] {
  return announcements.filter((announcement) =>
    isAnnouncementVisibleInContext(announcement, context, granjaCondominiumId),
  );
}
