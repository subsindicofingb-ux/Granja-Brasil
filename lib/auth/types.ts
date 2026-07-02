import type { User } from "@supabase/supabase-js";
import type { Role } from "@/lib/constants";
import type { Profile } from "@/types";
import {
  getAllCategoryCrudForRole,
  type PermissionCategoryId,
  type CategoryCrud,
} from "@/lib/auth/permission-matrix";
import { getRolePermissions, type RolePermissions } from "@/lib/auth/roles";

export type CondoSummary = {
  id: string;
  name: string;
  slug: string;
};

export type MembershipWithCondo = {
  id: string;
  role: Role;
  condominium: CondoSummary;
};

export type CondoAccess = {
  membershipId: string | null;
  role: Role;
  permissions: RolePermissions;
  categoryCrud: Record<PermissionCategoryId, CategoryCrud>;
  condominium: CondoSummary;
  profile: {
    id: string;
    fullName: string;
    email: string;
  };
};

export type SessionUser = {
  user: User;
  profile: Profile;
};

export type AuthActionState = {
  error?: string;
  success?: string;
  redirectTo?: string;
};

export function buildCondoAccess(input: {
  membershipId: string | null;
  role: Role;
  condominium: CondoSummary;
  profile: Profile;
  email: string;
  permissions?: RolePermissions;
  categoryCrud?: Record<PermissionCategoryId, CategoryCrud>;
}): CondoAccess {
  const categoryCrud =
    input.categoryCrud ?? getAllCategoryCrudForRole(input.role, null);

  return {
    membershipId: input.membershipId,
    role: input.role,
    permissions: input.permissions ?? getRolePermissions(input.role),
    categoryCrud,
    condominium: input.condominium,
    profile: {
      id: input.profile.id,
      fullName: input.profile.full_name,
      email: input.email,
    },
  };
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
