export const ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  SYNDIC: "syndic",
  RESIDENT: "resident",
  DOORMAN: "doorman",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const RESERVATION_STATUS = {
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

export const DEMO_CONDO_SLUG = "residencial-exemplo";

export const NAV_ITEMS = [
  { label: "Dashboard", href: "", icon: "LayoutDashboard" },
  { label: "Torres", href: "towers", icon: "Building2" },
  { label: "Unidades", href: "units", icon: "Home" },
  { label: "Moradores", href: "residents", icon: "Users" },
  { label: "Espaços comuns", href: "areas", icon: "Trees" },
  { label: "Reservas", href: "reservations", icon: "CalendarDays" },
  { label: "Avisos", href: "announcements", icon: "Megaphone" },
  { label: "Visitantes", href: "visitors", icon: "UserCheck" },
  { label: "Configurações", href: "settings", icon: "Settings" },
] as const;
