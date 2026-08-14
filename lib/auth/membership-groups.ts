import type { Role } from "@/lib/constants";
import type { MembershipWithCondo } from "@/lib/auth/types";
import {
  DOORMAN_BLOCKS,
  getCondominiumsInDoormanBlock,
  getDoormanBlockForCondominium,
  type DoormanBlockDefinition,
} from "@/lib/condominiums/doorman-blocks";

function pickPrimaryMembership(group: MembershipWithCondo[]): MembershipWithCondo {
  return [...group].sort((left, right) =>
    left.condominium.name.localeCompare(right.condominium.name, "pt-BR"),
  )[0];
}

export function groupAccessibleCondominiums(
  memberships: MembershipWithCondo[],
): MembershipWithCondo[] {
  const standalone: MembershipWithCondo[] = [];
  const blockGroups = new Map<string, { block: DoormanBlockDefinition; items: MembershipWithCondo[] }>();

  for (const membership of memberships) {
    const block = getDoormanBlockForCondominium(membership.condominium);
    if (!block) {
      standalone.push(membership);
      continue;
    }

    const existing = blockGroups.get(block.id);
    if (existing) {
      existing.items.push(membership);
      continue;
    }

    blockGroups.set(block.id, { block, items: [membership] });
  }

  const grouped = Array.from(blockGroups.values()).map(({ block, items }) => {
    const primary = pickPrimaryMembership(items);
    return {
      ...primary,
      id: `block-${block.id}`,
      condominium: {
        ...primary.condominium,
        name: block.label,
      },
    } satisfies MembershipWithCondo;
  });

  return [...standalone, ...grouped].sort((left, right) =>
    left.condominium.name.localeCompare(right.condominium.name, "pt-BR"),
  );
}

type CondominiumCatalogEntry = {
  id: string;
  name: string;
  slug: string;
};

export function appendMissingDoormanBlockEntries(
  grouped: MembershipWithCondo[],
  condominiums: CondominiumCatalogEntry[],
  defaultRole: Role,
): MembershipWithCondo[] {
  const existingBlockIds = new Set(
    grouped
      .filter((membership) => membership.id.startsWith("block-"))
      .map((membership) => membership.id.slice("block-".length)),
  );

  const additions: MembershipWithCondo[] = [];

  for (const block of DOORMAN_BLOCKS) {
    if (existingBlockIds.has(block.id)) {
      continue;
    }

    const matches = getCondominiumsInDoormanBlock(
      block,
      condominiums.map((condominium) => ({
        ...condominium,
        is_commercial: false,
        created_at: "",
        updated_at: "",
      })),
    );

    if (matches.length === 0) {
      continue;
    }

    const primary = [...matches].sort((left, right) =>
      left.name.localeCompare(right.name, "pt-BR"),
    )[0];

    additions.push({
      id: `block-${block.id}`,
      role: defaultRole,
      condominium: {
        id: primary.id,
        name: block.label,
        slug: primary.slug,
      },
    });
  }

  if (additions.length === 0) {
    return grouped;
  }

  return [...grouped, ...additions].sort((left, right) =>
    left.condominium.name.localeCompare(right.condominium.name, "pt-BR"),
  );
}

export function findMembershipForCondoSlug(
  memberships: MembershipWithCondo[],
  condoSlug: string,
  targetBlock: DoormanBlockDefinition | null,
): MembershipWithCondo | undefined {
  const direct = memberships.find((membership) => membership.condominium.slug === condoSlug);
  if (direct) {
    return direct;
  }

  if (!targetBlock) {
    return undefined;
  }

  return memberships.find((membership) => {
    const block = getDoormanBlockForCondominium(membership.condominium);
    return block?.id === targetBlock.id;
  });
}
