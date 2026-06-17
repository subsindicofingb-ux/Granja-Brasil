import type { CondoAccess } from "@/lib/auth/types";
import { NAV_ITEMS, type NavItem } from "@/lib/constants";

export type { NavVisibleContext } from "@/lib/nav-types";

export function getVisibleNavItems(access: CondoAccess): NavItem[] {
  const ctx = { permissions: access.permissions, role: access.role };

  return NAV_ITEMS.filter((item) => {
    if (!item.visible) {
      return true;
    }

    return item.visible(ctx);
  });
}
