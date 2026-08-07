import type { OccurrenceCategory, OccurrenceStatus } from "@/lib/occurrences/types";
import { OCCURRENCE_CATEGORY, OCCURRENCE_STATUS } from "@/lib/constants";

export const OCCURRENCE_CATEGORY_LABELS: Record<OccurrenceCategory, string> = {
  [OCCURRENCE_CATEGORY.ELEVATOR_STOP]: "Parada de elevador",
  [OCCURRENCE_CATEGORY.POWER_OUTAGE]: "Falta de energia",
  [OCCURRENCE_CATEGORY.ACCIDENT]: "Acidente",
  [OCCURRENCE_CATEGORY.COMPLAINT]: "Reclamação",
  [OCCURRENCE_CATEGORY.REPORT]: "Relato",
  [OCCURRENCE_CATEGORY.OTHER]: "Outro",
};

export const OCCURRENCE_STATUS_LABELS: Record<OccurrenceStatus, string> = {
  [OCCURRENCE_STATUS.OPEN]: "Aberta",
  [OCCURRENCE_STATUS.IN_PROGRESS]: "Em andamento",
  [OCCURRENCE_STATUS.CLOSED]: "Encerrada",
};

export const OCCURRENCE_CATEGORY_OPTIONS = Object.values(OCCURRENCE_CATEGORY).map(
  (value) => ({
    value,
    label: OCCURRENCE_CATEGORY_LABELS[value],
  }),
);

export function getOccurrenceCategoryLabel(category: string): string {
  return OCCURRENCE_CATEGORY_LABELS[category as OccurrenceCategory] ?? category;
}

export function getOccurrenceStatusLabel(status: string): string {
  return OCCURRENCE_STATUS_LABELS[status as OccurrenceStatus] ?? status;
}

export function getOccurrenceStatusBadgeClass(status: OccurrenceStatus): string {
  switch (status) {
    case OCCURRENCE_STATUS.OPEN:
      return "border-amber-200 bg-amber-50 text-amber-800";
    case OCCURRENCE_STATUS.IN_PROGRESS:
      return "border-blue-200 bg-blue-50 text-blue-800";
    case OCCURRENCE_STATUS.CLOSED:
      return "border-gray-200 bg-gray-50 text-gray-700";
    default:
      return "";
  }
}
