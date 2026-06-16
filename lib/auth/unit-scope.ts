import type { Role } from "@/lib/constants";
import type { CondoAccess } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";
import { ROLES } from "@/lib/constants";

export type UnitScope = {
  unitIds: string[] | null;
};

export function isUnitScopedRole(role: Role): boolean {
  return role === ROLES.RESIDENT;
}

export function getUnitScopeForAccess(access: CondoAccess): UnitScope {
  if (!isUnitScopedRole(access.role)) {
    return { unitIds: null };
  }

  return { unitIds: [] };
}

export async function resolveUnitScope(access: CondoAccess): Promise<UnitScope> {
  if (!isUnitScopedRole(access.role)) {
    return { unitIds: null };
  }

  const unitIds = await getResidentUnitIds(access.profile.id, access.condominium.id);
  return { unitIds };
}

export async function getResidentUnitIds(
  profileId: string,
  condominiumId: string,
): Promise<string[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("residents")
    .select(
      `
      unit_id,
      units!inner (
        towers!inner (
          condominium_id
        )
      )
    `,
    )
    .eq("profile_id", profileId)
    .eq("units.towers.condominium_id", condominiumId);

  if (error || !data) {
    return [];
  }

  return [...new Set(data.map((row) => row.unit_id))];
}

export function matchesUnitScope(scope: UnitScope, unitId: string | null | undefined): boolean {
  if (scope.unitIds === null) {
    return true;
  }

  if (!unitId) {
    return false;
  }

  return scope.unitIds.includes(unitId);
}

export type UnitListFilter = {
  unitId?: string;
  unitIds?: string[];
};

export function getUnitListFilter(scope: UnitScope): UnitListFilter | "none" {
  if (scope.unitIds === null) {
    return {};
  }

  if (scope.unitIds.length === 0) {
    return "none";
  }

  if (scope.unitIds.length === 1) {
    return { unitId: scope.unitIds[0] };
  }

  return { unitIds: scope.unitIds };
}

export async function getUnitListFilterForAccess(
  access: CondoAccess,
): Promise<UnitListFilter | "none"> {
  const scope = await resolveUnitScope(access);
  return getUnitListFilter(scope);
}

export function unitFilterToQueryOptions(
  filter: UnitListFilter | "none",
): { unitId?: string; unitIds?: string[] } | "none" {
  if (filter === "none") {
    return "none";
  }

  if (filter.unitId) {
    return { unitId: filter.unitId };
  }

  if (filter.unitIds) {
    return { unitIds: filter.unitIds };
  }

  return {};
}
