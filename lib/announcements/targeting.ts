import { DEMO_CONDO_SLUG } from "@/lib/constants";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import type { AnnouncementRecord, AnnouncementWithDetails } from "@/lib/announcements/types";

export type AnnouncementAudienceScope = "all" | "condominium" | "resident";

export function resolveAnnouncementAudienceScope(
  announcement: Pick<AnnouncementRecord, "target_condominium_id" | "target_profile_id">,
): AnnouncementAudienceScope {
  if (announcement.target_profile_id) {
    return "resident";
  }

  if (announcement.target_condominium_id) {
    return "condominium";
  }

  return "all";
}

export function formatAnnouncementAudienceLabel(input: {
  announcement: Pick<
    AnnouncementWithDetails,
    "target_condominium_id" | "target_profile_id" | "tower"
  >;
  targetCondominiumName?: string | null;
  targetProfileName?: string | null;
  isGranjaSource?: boolean;
}): string {
  if (input.announcement.target_profile_id) {
    return input.targetProfileName
      ? `Morador: ${input.targetProfileName}`
      : "Morador específico";
  }

  if (input.announcement.target_condominium_id) {
    return input.targetCondominiumName
      ? `Condomínio: ${input.targetCondominiumName}`
      : "Condomínio específico";
  }

  if (input.announcement.tower) {
    return `Torre: ${input.announcement.tower.name}`;
  }

  return input.isGranjaSource ? "Todos os condomínios" : "Todo o condomínio";
}

export function isGranjaAnnouncementSource(
  condominiumSlug: string,
  granjaCondominiumId: string | null,
  announcementCondominiumId: string,
): boolean {
  return Boolean(
    granjaCondominiumId &&
      isGeneralCondominium(condominiumSlug) &&
      announcementCondominiumId === granjaCondominiumId,
  );
}

export function matchesAnnouncementCondominiumFilter(
  announcement: Pick<AnnouncementRecord, "target_condominium_id" | "condominium_id">,
  filterCondominiumId: string | undefined,
  granjaCondominiumId: string | null,
): boolean {
  if (!filterCondominiumId) {
    return true;
  }

  if (announcement.condominium_id === filterCondominiumId) {
    return announcement.target_condominium_id == null;
  }

  if (granjaCondominiumId && announcement.condominium_id === granjaCondominiumId) {
    return (
      announcement.target_condominium_id == null ||
      announcement.target_condominium_id === filterCondominiumId
    );
  }

  return false;
}

export function getGranjaSlugReference(): string {
  return DEMO_CONDO_SLUG;
}
