import { DEMO_CONDO_SLUG } from "@/lib/constants";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import type { AnnouncementRecord, AnnouncementWithDetails } from "@/lib/announcements/types";

export type AnnouncementAudienceScope = "all" | "condominium" | "resident";

export function resolveAnnouncementAudienceScope(
  announcement: Pick<AnnouncementRecord, "target_condominium_id" | "target_profile_id"> & {
    target_profile_ids?: string[];
  },
): AnnouncementAudienceScope {
  if (announcement.target_profile_id || (announcement.target_profile_ids?.length ?? 0) > 0) {
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
    "target_condominium_id" | "target_condominium_staff_only" | "target_profile_id" | "tower" | "staff_only"
  >;
  targetCondominiumName?: string | null;
  targetProfileName?: string | null;
  targetProfileNames?: string[];
  isGranjaSource?: boolean;
}): string {
  if (input.announcement.staff_only) {
    if (input.announcement.target_condominium_id && input.isGranjaSource) {
      return input.targetCondominiumName
        ? `Granja Brasil · ${input.targetCondominiumName}`
        : "Granja Brasil";
    }

    return "Síndico / administração";
  }

  if (input.targetProfileNames && input.targetProfileNames.length > 1) {
    return `Moradores: ${input.targetProfileNames.join(", ")}`;
  }

  if (input.announcement.target_profile_id || input.targetProfileNames?.length === 1) {
    const name =
      input.targetProfileName ??
      (input.targetProfileNames?.length === 1 ? input.targetProfileNames[0] : null);

    return name ? `Morador: ${name}` : "Morador específico";
  }

  if (input.announcement.target_condominium_id) {
    if (input.announcement.target_condominium_staff_only === false) {
      return input.targetCondominiumName
        ? `Moradores do bloco: ${input.targetCondominiumName}`
        : "Moradores de um bloco";
    }

    return input.targetCondominiumName
      ? `Síndico do bloco: ${input.targetCondominiumName}`
      : "Síndico de um bloco";
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
