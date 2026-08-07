import { OCCURRENCE_CATEGORY, OCCURRENCE_STATUS } from "@/lib/constants";

export type OccurrenceCategory =
  (typeof OCCURRENCE_CATEGORY)[keyof typeof OCCURRENCE_CATEGORY];

export type OccurrenceStatus =
  (typeof OCCURRENCE_STATUS)[keyof typeof OCCURRENCE_STATUS];

export type OccurrenceDestination = "building" | "granja";

export type OccurrenceRecord = {
  id: string;
  condominium_id: string;
  source_condominium_id: string | null;
  unit_id: string | null;
  category: OccurrenceCategory;
  title: string;
  description: string;
  location_text: string | null;
  status: OccurrenceStatus;
  occurred_at: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  closed_by: string | null;
  internal_notes: string | null;
  response_text: string | null;
};

export type OccurrenceWithDetails = OccurrenceRecord & {
  author: { id: string; full_name: string } | null;
  closed_by_profile: { id: string; full_name: string } | null;
  unit: {
    id: string;
    number: string;
    block: string | null;
    tower: { id: string; name: string };
  } | null;
};
