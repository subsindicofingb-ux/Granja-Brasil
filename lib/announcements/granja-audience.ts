import type { AnnouncementFormInput, AnnouncementWithDetails } from "@/lib/announcements/types";

export type GranjaAnnouncementAudience =
  | "all_blocks"
  | "block_residents"
  | "block_syndic"
  | "specific_residents";

export const GRANJA_AUDIENCE_OPTIONS: {
  value: GranjaAnnouncementAudience;
  label: string;
  description: string;
}[] = [
  {
    value: "all_blocks",
    label: "Todos os moradores de todos os blocos",
    description:
      "Visível e com e-mail para todos os moradores de Jacarandá, Ipê, Cedro e demais blocos. A equipe da Granja e os síndicos também acompanham no painel.",
  },
  {
    value: "block_residents",
    label: "Todos os moradores de um bloco",
    description:
      "Visível e com e-mail somente para os moradores do bloco escolhido. O síndico daquele bloco também vê no painel.",
  },
  {
    value: "block_syndic",
    label: "Somente o síndico de um bloco",
    description:
      "Visível e com e-mail apenas para a equipe do bloco escolhido (síndico e administração local). Moradores não recebem.",
  },
  {
    value: "specific_residents",
    label: "Moradores específicos",
    description:
      "Visível e com e-mail somente para as pessoas marcadas na lista abaixo. Use quando precisar avisar uma ou poucas unidades.",
  },
];

export function resolveGranjaAudienceFromForm(
  input: Pick<
    AnnouncementFormInput,
    "granja_audience" | "target_condominium_id" | "target_profile_ids" | "target_condominium_staff_only"
  >,
): GranjaAnnouncementAudience {
  if (input.granja_audience) {
    return input.granja_audience;
  }

  if (input.target_profile_ids.length > 0) {
    return "specific_residents";
  }

  if (!input.target_condominium_id) {
    return "all_blocks";
  }

  return input.target_condominium_staff_only === false ? "block_residents" : "block_syndic";
}

export function resolveGranjaAudienceFromAnnouncement(
  announcement: Pick<
    AnnouncementWithDetails,
    "target_condominium_id" | "target_condominium_staff_only" | "target_profile_id"
  > & { target_profile_ids?: string[] },
): GranjaAnnouncementAudience {
  const targetProfileIds =
    announcement.target_profile_ids ??
    (announcement.target_profile_id ? [announcement.target_profile_id] : []);

  if (targetProfileIds.length > 0) {
    return "specific_residents";
  }

  if (!announcement.target_condominium_id) {
    return "all_blocks";
  }

  return announcement.target_condominium_staff_only === false ? "block_residents" : "block_syndic";
}

export function applyGranjaAudienceToPayload(input: {
  granja_audience: GranjaAnnouncementAudience;
  granja_block_condominium_id: string | null;
  target_profile_ids: string[];
}): {
  target_condominium_id: string | null;
  target_condominium_staff_only: boolean;
  target_profile_ids: string[];
  target_profile_id: string | null;
} {
  switch (input.granja_audience) {
    case "all_blocks":
      return {
        target_condominium_id: null,
        target_condominium_staff_only: false,
        target_profile_ids: [],
        target_profile_id: null,
      };
    case "block_residents":
      return {
        target_condominium_id: input.granja_block_condominium_id,
        target_condominium_staff_only: false,
        target_profile_ids: [],
        target_profile_id: null,
      };
    case "block_syndic":
      return {
        target_condominium_id: input.granja_block_condominium_id,
        target_condominium_staff_only: true,
        target_profile_ids: [],
        target_profile_id: null,
      };
    case "specific_residents":
      return {
        target_condominium_id: null,
        target_condominium_staff_only: false,
        target_profile_ids: input.target_profile_ids,
        target_profile_id:
          input.target_profile_ids.length === 1 ? input.target_profile_ids[0] : null,
      };
  }
}
