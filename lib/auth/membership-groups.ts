import type { MembershipWithCondo } from "@/lib/auth/types";
import {
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
