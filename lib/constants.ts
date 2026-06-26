export const ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  SYNDIC: "syndic",
  SUB_SYNDIC: "sub_syndic",
  RESIDENT: "resident",
  DOORMAN: "doorman",
  STAFF: "staff",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const RESERVATION_STATUS = {
  AWAITING_RECEIPT: "awaiting_receipt",
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
} as const;

export type ReservationStatus =
  (typeof RESERVATION_STATUS)[keyof typeof RESERVATION_STATUS];

export const RESIDENT_TYPES = {
  OWNER: "owner",
  TENANT: "tenant",
  DEPENDENT: "dependent",
  RESPONSIBLE: "responsible",
} as const;

export type ResidentType = (typeof RESIDENT_TYPES)[keyof typeof RESIDENT_TYPES];

export const ANNOUNCEMENT_PRIORITY = {
  NORMAL: "normal",
  IMPORTANT: "important",
  URGENT: "urgent",
} as const;

export type AnnouncementPriority =
  (typeof ANNOUNCEMENT_PRIORITY)[keyof typeof ANNOUNCEMENT_PRIORITY];

export const ANNOUNCEMENT_PUBLICATION_STATUS = {
  DRAFT: "draft",
  PUBLISHED: "published",
} as const;

export type AnnouncementPublicationStatus =
  (typeof ANNOUNCEMENT_PUBLICATION_STATUS)[keyof typeof ANNOUNCEMENT_PUBLICATION_STATUS];

export const GUEST_TYPE = {
  VISITOR: "visitor",
  SERVICE_PROVIDER: "service_provider",
} as const;

export type GuestType = (typeof GUEST_TYPE)[keyof typeof GUEST_TYPE];

export const VISITOR_AUTHORIZATION_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
} as const;

export type VisitorAuthorizationStatus =
  (typeof VISITOR_AUTHORIZATION_STATUS)[keyof typeof VISITOR_AUTHORIZATION_STATUS];

export const REGISTRATION_REQUEST_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export type RegistrationRequestStatus =
  (typeof REGISTRATION_REQUEST_STATUS)[keyof typeof REGISTRATION_REQUEST_STATUS];

export const REGISTRATION_UNIT_KIND = {
  APARTMENT: "apartment",
  HOUSE: "house",
} as const;

export type RegistrationUnitKind =
  (typeof REGISTRATION_UNIT_KIND)[keyof typeof REGISTRATION_UNIT_KIND];

export const DEMO_CONDO_SLUG = "residencial-exemplo";

export function getGranjaCondoSlug(): string {
  return process.env.NEXT_PUBLIC_GRANJA_CONDO_SLUG?.trim() || DEMO_CONDO_SLUG;
}

export const REGISTRATION_PROFILE_TYPES = {
  RESIDENT: "resident",
  SYNDIC: "syndic",
  STAFF: "staff",
  VISITOR: "visitor",
  SERVICE_PROVIDER: "service_provider",
  OTHER: "other",
} as const;

export const VEHICLE_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export type VehicleStatus = (typeof VEHICLE_STATUS)[keyof typeof VEHICLE_STATUS];

export type RegistrationProfileType =
  (typeof REGISTRATION_PROFILE_TYPES)[keyof typeof REGISTRATION_PROFILE_TYPES];

export type NavIcon =
  | "LayoutDashboard"
  | "Building2"
  | "Home"
  | "Users"
  | "Car"
  | "Trees"
  | "CalendarDays"
  | "Megaphone"
  | "Bell"
  | "UserCheck"
  | "Inbox"
  | "Settings"
  | "Package"
  | "Droplets";

import type { NavVisibleContext } from "@/lib/nav-types";

export type NavItem = {
  label: string;
  href: string;
  icon: NavIcon;
  visible?: (ctx: NavVisibleContext) => boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "", icon: "LayoutDashboard" },
  {
    label: "Condomínios",
    href: "admin/condominiums",
    icon: "Building2",
    visible: ({ role }) => role === ROLES.SUPER_ADMIN,
  },
  {
    label: "Solicitações",
    href: "settings/registration-requests",
    icon: "Inbox",
    visible: ({ permissions }) => permissions.canManageRegistrationRequests,
  },
  {
    label: "Unidades",
    href: "units",
    icon: "Home",
    visible: ({ permissions }) => permissions.canManageStructure,
  },
  {
    label: "Moradores",
    href: "residents",
    icon: "Users",
    visible: ({ permissions }) => permissions.canManageResidents,
  },
  {
    label: "Veículos",
    href: "vehicles",
    icon: "Car",
    visible: ({ permissions }) =>
      permissions.canManageVehicles || permissions.canViewUnitVehicles,
  },
  {
    label: "Espaços comuns",
    href: "areas",
    icon: "Trees",
    visible: ({ permissions }) => permissions.canManageAreas,
  },
  {
    label: "Reservas",
    href: "reservations",
    icon: "CalendarDays",
    visible: ({ permissions }) => permissions.canManageReservations,
  },
  { label: "Avisos", href: "announcements", icon: "Megaphone" },
  {
    label: "Correspondências",
    href: "correspondence",
    icon: "Package",
    visible: ({ permissions }) => permissions.canManageCorrespondence,
  },
  {
    label: "Hidrômetros",
    href: "water-meters",
    icon: "Droplets",
    visible: ({ permissions }) =>
      permissions.canManageWaterMeters || permissions.canViewWaterMeters,
  },
  {
    label: "Notificações",
    href: "notifications",
    icon: "Bell",
    visible: ({ permissions }) =>
      permissions.canSendUnitNotifications || permissions.canViewUnitNotifications,
  },
  {
    label: "Visitantes",
    href: "visitors",
    icon: "UserCheck",
    visible: ({ permissions }) => permissions.canViewVisitorAuthorizations,
  },
  { label: "Configurações", href: "settings", icon: "Settings" },
];
