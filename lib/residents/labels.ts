import { RESIDENT_TYPES, type ResidentType } from "@/lib/constants";

export const RESIDENT_TYPE_LABELS: Record<ResidentType, string> = {
  [RESIDENT_TYPES.OWNER]: "Proprietário",
  [RESIDENT_TYPES.TENANT]: "Inquilino",
  [RESIDENT_TYPES.DEPENDENT]: "Dependente",
  [RESIDENT_TYPES.RESPONSIBLE]: "Responsável",
};

export const RESIDENT_TYPE_OPTIONS = Object.values(RESIDENT_TYPES).map((value) => ({
  value,
  label: RESIDENT_TYPE_LABELS[value],
}));

export function getResidentTypeLabel(type: string): string {
  return RESIDENT_TYPE_LABELS[type as ResidentType] ?? type;
}

export function isHouseTower(name: string): boolean {
  return name.trim().toLowerCase() === "casa";
}

export function formatUnitWithTower(unit: {
  number: string;
  block: string | null;
  tower: { name: string };
}): string {
  if (isHouseTower(unit.tower.name)) {
    return `Casa ${unit.number}`;
  }

  const blockSuffix = unit.block ? ` · Bloco ${unit.block}` : "";
  return `${unit.tower.name} · Apto ${unit.number}${blockSuffix}`;
}

export function formatUnitOptionLabel(
  unit: {
    number: string;
    block: string | null;
    tower: { name: string; condominium_id: string };
  },
  condominiumNamesById?: Record<string, string>,
): string {
  const unitLabel = formatUnitWithTower(unit);
  const condominiumName = condominiumNamesById?.[unit.tower.condominium_id];

  return condominiumName ? `${condominiumName} · ${unitLabel}` : unitLabel;
}
