import type { Role } from "@/lib/constants";
import { ROLES } from "@/lib/constants";
import { getRolePermissions } from "@/lib/auth/roles";

/** Papéis que só a Granja (super_admin) pode vincular. */
export const GRANJA_ONLY_MEMBER_ROLES: Role[] = [ROLES.ADMIN, ROLES.SYNDIC];

/** Papéis que o síndico pode vincular no condomínio. */
export const SYNDIC_ASSIGNABLE_MEMBER_ROLES: Role[] = [
  ROLES.RESIDENT,
  ROLES.DOORMAN,
  ROLES.STAFF,
  ROLES.SUB_SYNDIC,
];

const ALL_ASSIGNABLE_MEMBER_ROLES: Role[] = [
  ...GRANJA_ONLY_MEMBER_ROLES,
  ...SYNDIC_ASSIGNABLE_MEMBER_ROLES,
];

export function getAssignableMemberRoles(actorRole: Role): Role[] {
  if (actorRole === ROLES.SUPER_ADMIN) {
    return [...ALL_ASSIGNABLE_MEMBER_ROLES, ROLES.SUPER_ADMIN];
  }

  if (actorRole === ROLES.SYNDIC || actorRole === ROLES.SUB_SYNDIC) {
    return SYNDIC_ASSIGNABLE_MEMBER_ROLES;
  }

  if (actorRole === ROLES.ADMIN) {
    return SYNDIC_ASSIGNABLE_MEMBER_ROLES;
  }

  return [];
}

export function canAssignMemberRole(actorRole: Role, targetRole: Role): boolean {
  if (targetRole === ROLES.SUPER_ADMIN) {
    return actorRole === ROLES.SUPER_ADMIN;
  }

  return getAssignableMemberRoles(actorRole).includes(targetRole);
}

export function isGranjaOnlyMemberRole(role: Role): boolean {
  return GRANJA_ONLY_MEMBER_ROLES.includes(role);
}

export function getMemberRoleLabel(role: Role): string {
  if (role === ROLES.DOORMAN) {
    return "Porteiro";
  }

  if (role === ROLES.STAFF) {
    return "Funcionário";
  }

  return getRolePermissions(role).label;
}
