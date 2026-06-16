import {
  ANNOUNCEMENT_PRIORITY,
  ANNOUNCEMENT_PUBLICATION_STATUS,
  type AnnouncementPriority,
  type AnnouncementPublicationStatus,
} from "@/lib/constants";
import type { AnnouncementDisplayStatus } from "@/lib/announcements/types";

export const ANNOUNCEMENT_PRIORITY_LABELS: Record<AnnouncementPriority, string> = {
  [ANNOUNCEMENT_PRIORITY.NORMAL]: "Normal",
  [ANNOUNCEMENT_PRIORITY.IMPORTANT]: "Importante",
  [ANNOUNCEMENT_PRIORITY.URGENT]: "Urgente",
};

export const ANNOUNCEMENT_PRIORITY_OPTIONS = Object.values(ANNOUNCEMENT_PRIORITY).map(
  (value) => ({
    value,
    label: ANNOUNCEMENT_PRIORITY_LABELS[value],
  }),
);

export const ANNOUNCEMENT_PUBLICATION_STATUS_LABELS: Record<
  AnnouncementPublicationStatus,
  string
> = {
  [ANNOUNCEMENT_PUBLICATION_STATUS.DRAFT]: "Rascunho",
  [ANNOUNCEMENT_PUBLICATION_STATUS.PUBLISHED]: "Publicado",
};

export const ANNOUNCEMENT_PUBLICATION_STATUS_OPTIONS = Object.values(
  ANNOUNCEMENT_PUBLICATION_STATUS,
).map((value) => ({
  value,
  label: ANNOUNCEMENT_PUBLICATION_STATUS_LABELS[value],
}));

export const ANNOUNCEMENT_DISPLAY_STATUS_LABELS: Record<AnnouncementDisplayStatus, string> = {
  draft: "Rascunho",
  scheduled: "Agendado",
  published: "Publicado",
  expired: "Expirado",
};

export function getAnnouncementPriorityLabel(priority: string): string {
  return ANNOUNCEMENT_PRIORITY_LABELS[priority as AnnouncementPriority] ?? priority;
}

export function getAnnouncementDisplayStatusLabel(status: AnnouncementDisplayStatus): string {
  return ANNOUNCEMENT_DISPLAY_STATUS_LABELS[status];
}

export function getAnnouncementPriorityBadgeClass(priority: AnnouncementPriority): string {
  switch (priority) {
    case ANNOUNCEMENT_PRIORITY.URGENT:
      return "border-red-200 bg-red-50 text-red-700";
    case ANNOUNCEMENT_PRIORITY.IMPORTANT:
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border bg-background";
  }
}

export function getAnnouncementDisplayStatusBadgeClass(
  status: AnnouncementDisplayStatus,
): string {
  switch (status) {
    case "draft":
      return "border-gray-200 bg-gray-50 text-gray-600";
    case "scheduled":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "published":
      return "border-green-200 bg-green-50 text-green-700";
    case "expired":
      return "border bg-muted text-muted-foreground";
    default:
      return "";
  }
}
