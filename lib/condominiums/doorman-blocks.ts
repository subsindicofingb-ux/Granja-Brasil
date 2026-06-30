import type { CondominiumRecord } from "@/lib/services/condominiums-admin";

export type DoormanBlockDefinition = {
  id: string;
  label: string;
  slugPatterns: string[];
  namePatterns: string[];
};

export const DOORMAN_BLOCKS: DoormanBlockDefinition[] = [
  {
    id: "jacarandas-jequitibas",
    label: "Jacarandás e Jequitibás",
    slugPatterns: ["jacaranda", "jequitiba"],
    namePatterns: ["jacarand", "jequitib"],
  },
  {
    id: "manacas-mangabeiras",
    label: "Manacás e Mangabeiras",
    slugPatterns: ["manaca", "mangabeira"],
    namePatterns: ["manac", "mangabeir"],
  },
  {
    id: "cambucas-jabuticabeiras",
    label: "Cambucás e Jabuticabeiras",
    slugPatterns: ["cambuca", "jabuticabeira"],
    namePatterns: ["cambuc", "jabuticabeir"],
  },
  {
    id: "bouganville-acacias-cerejeiras",
    label: "Bouganville, Acácias e Cerejeiras",
    slugPatterns: ["bouganvil", "acacia", "cerejeira"],
    namePatterns: ["bouganvil", "acácia", "acacia", "cerejeir"],
  },
];

function normalizeMatchValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function matchesPatterns(value: string, patterns: string[]): boolean {
  const normalized = normalizeMatchValue(value);
  return patterns.some((pattern) => normalized.includes(normalizeMatchValue(pattern)));
}

export function getDoormanBlockForCondominium(
  condominium: Pick<CondominiumRecord, "slug" | "name">,
): DoormanBlockDefinition | null {
  return (
    DOORMAN_BLOCKS.find(
      (block) =>
        matchesPatterns(condominium.slug, block.slugPatterns) ||
        matchesPatterns(condominium.name, block.namePatterns),
    ) ?? null
  );
}

export function getCondominiumsInDoormanBlock(
  block: DoormanBlockDefinition,
  condominiums: CondominiumRecord[],
): CondominiumRecord[] {
  return condominiums.filter(
    (condominium) =>
      matchesPatterns(condominium.slug, block.slugPatterns) ||
      matchesPatterns(condominium.name, block.namePatterns),
  );
}

export function isDoormanBlockCondominium(
  condominium: Pick<CondominiumRecord, "slug" | "name">,
): boolean {
  return getDoormanBlockForCondominium(condominium) !== null;
}
