import type { CondoAccess } from "@/lib/auth/types";
import {
  canAccessCategoryNav,
  type PermissionCategoryId,
} from "@/lib/auth/permission-matrix";
import { NAV_ITEMS, type NavItem } from "@/lib/constants";

export type { NavVisibleContext } from "@/lib/nav-types";

const NAV_CATEGORY_BY_HREF: Partial<Record<string, PermissionCategoryId>> = {
  units: "structure",
  residents: "residents",
  areas: "areas",
  correspondence: "correspondence",
};

function isNavItemVisible(access: CondoAccess, item: NavItem): boolean {
  if (!item.visible) {
    return true;
  }

  const ctx = {
    permissions: access.permissions,
    role: access.role,
    categoryCrud: access.categoryCrud,
  };

  const category = NAV_CATEGORY_BY_HREF[item.href];
  if (category) {
    const managePermission =
      category === "structure"
        ? access.permissions.canManageStructure
        : category === "residents"
          ? access.permissions.canManageResidents
          : category === "areas"
            ? access.permissions.canManageAreas
            : category === "correspondence"
              ? access.permissions.canManageCorrespondence
              : false;

    if (category === "residents") {
      return (
        canAccessCategoryNav(access, category, managePermission) ||
        access.permissions.canConsultResidents
      );
    }

    return canAccessCategoryNav(access, category, managePermission);
  }

  if (item.href === "") {
    return access.permissions.canViewDashboard;
  }

  return item.visible(ctx);
}

export function getVisibleNavItems(access: CondoAccess): NavItem[] {
  return NAV_ITEMS.filter((item) => isNavItemVisible(access, item));
}
