import { formatUnitWithTower } from "@/lib/residents/labels";

export type AnnouncementResidentLabelInput = {
  full_name: string;
  unit_label: string;
  condominium_name?: string;
};

export function formatAnnouncementResidentLabel(resident: AnnouncementResidentLabelInput): string {
  if (resident.condominium_name) {
    return `${resident.condominium_name} · ${resident.full_name} · ${resident.unit_label}`;
  }

  return `${resident.full_name} · ${resident.unit_label}`;
}

export function buildAnnouncementResidentUnitLabel(resident: {
  unit: {
    number: string;
    block: string | null;
    tower: { name: string };
  };
}): string {
  return formatUnitWithTower(resident.unit);
}
