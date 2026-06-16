import type { CondoAccess } from "@/lib/auth/types";
import { NAV_ITEMS, type NavItem } from "@/lib/constants";

export function getVisibleNavItems(access: CondoAccess): NavItem[] {
  return NAV_ITEMS.filter((item) => {
    if (!item.visible) {
      return true;
    }

    return item.visible(access.permissions);
  });
}
