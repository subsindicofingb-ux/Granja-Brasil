import type { CondoAccess } from "@/lib/auth/types";
import {
  canAccessCategoryNav,
  type PermissionCategoryId,
} from "@/lib/auth/permission-matrix";
import { NAV_ITEMS, type NavItem } from "@/lib/constants";

export type { NavVisibleContext } from "@/lib/nav-types";

const NAV_CATEGORY_BY_HREF: Partial<Record<string, PermissionCategoryId>> = {
  "": "dashboard",
  "settings/registration-requests": "registration_requests",
  units: "structure",
  residents: "residents",
  vehicles: "vehicles",
  areas: "areas",
  reservations: "reservations",
  announcements: "announcements",
  correspondence: "correspondence",
  "water-meters": "water_meters",
  notifications: "notifications",
  visitors: "visitors",
  settings: "condo_settings",
};

function getManagePermissionForCategory(
  access: CondoAccess,
  category: PermissionCategoryId,
): boolean {
  const { permissions } = access;

  switch (category) {
    case "dashboard":
      return permissions.canViewDashboard;
    case "registration_requests":
      return permissions.canManageRegistrationRequests;
    case "structure":
      return permissions.canManageStructure;
    case "residents":
      return permissions.canManageResidents;
    case "vehicles":
      return permissions.canManageVehicles;
    case "areas":
      return permissions.canManageAreas;
    case "reservations":
      return permissions.canManageReservations || permissions.canApproveReservations;
    case "announcements":
      return permissions.canManageAnnouncements;
    case "correspondence":
      return permissions.canManageCorrespondence;
    case "water_meters":
      return permissions.canManageWaterMeters;
    case "notifications":
      return permissions.canSendUnitNotifications;
    case "visitors":
      return permissions.canManageVisitorAuthorizations;
    case "members":
      return permissions.canManageMembers;
    case "access_devices":
      return permissions.canManageAccessDevices;
    case "condo_settings":
      return permissions.canManageCondo;
    default:
      return false;
  }
}

function hasCategoryNavAccess(access: CondoAccess, category: PermissionCategoryId): boolean {
  const managePermission = getManagePermissionForCategory(access, category);

  if (category === "residents") {
    return (
      canAccessCategoryNav(access, category, managePermission) ||
      access.permissions.canConsultResidents
    );
  }

  if (category === "vehicles") {
    return (
      canAccessCategoryNav(access, category, managePermission) ||
      access.permissions.canConsultVehicles ||
      access.permissions.canViewUnitVehicles
    );
  }

  if (category === "visitors") {
    return (
      canAccessCategoryNav(access, category, managePermission) ||
      access.permissions.canViewVisitorAuthorizations ||
      access.permissions.canConsultVisitorAuthorizations ||
      access.permissions.canRegisterVisitorAuthorizations
    );
  }

  if (category === "announcements") {
    return (
      canAccessCategoryNav(access, category, managePermission) ||
      access.permissions.canSendAnnouncements
    );
  }

  if (category === "notifications") {
    return (
      canAccessCategoryNav(access, category, managePermission) ||
      access.permissions.canViewUnitNotifications
    );
  }

  if (category === "water_meters") {
    return (
      canAccessCategoryNav(access, category, managePermission) ||
      access.permissions.canViewWaterMeters
    );
  }

  return canAccessCategoryNav(access, category, managePermission);
}

function isNavItemVisible(access: CondoAccess, item: NavItem): boolean {
  if (!item.visible) {
    return true;
  }

  const category = NAV_CATEGORY_BY_HREF[item.href];
  if (category) {
    return hasCategoryNavAccess(access, category);
  }

  return item.visible({
    permissions: access.permissions,
    role: access.role,
    categoryCrud: access.categoryCrud,
  });
}

export function getVisibleNavItems(access: CondoAccess): NavItem[] {
  return NAV_ITEMS.filter((item) => isNavItemVisible(access, item));
}
