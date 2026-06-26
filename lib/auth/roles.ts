import type { Role } from "@/lib/constants";

/**
 * Mapeamento papel → permissões (espelha RLS do Supabase).
 * Referência para UI e auth futura — enforcement real está no banco.
 */
export type RolePermissions = {
  label: string;
  canManageCondo: boolean;
  canManageMembers: boolean;
  canManageStructure: boolean;
  canManageResidents: boolean;
  canManageRegistrationRequests: boolean;
  canManageVehicles: boolean;
  canViewUnitVehicles: boolean;
  canRegisterUnitVehicles: boolean;
  canManageAreas: boolean;
  canManageReservations: boolean;
  canManageAnnouncements: boolean;
  canSendAnnouncements: boolean;
  canSendUnitNotifications: boolean;
  canViewUnitNotifications: boolean;
  canApproveReservations: boolean;
  canViewVisitorAuthorizations: boolean;
  canManageVisitorAuthorizations: boolean;
  canRegisterVisitorAuthorizations: boolean;
  canApproveVisitorAuthorizations: boolean;
  canConsultVisitorAuthorizations: boolean;
};

export const ROLE_PERMISSIONS = {
  super_admin: {
    label: "Super Admin",
    canManageCondo: true,
    canManageMembers: true,
    canManageStructure: true,
    canManageResidents: true,
    canManageRegistrationRequests: true,
    canManageVehicles: true,
    canViewUnitVehicles: true,
    canRegisterUnitVehicles: false,
    canManageAreas: true,
    canManageReservations: true,
    canManageAnnouncements: true,
    canSendAnnouncements: true,
    canSendUnitNotifications: true,
    canViewUnitNotifications: false,
    canApproveReservations: true,
    canViewVisitorAuthorizations: true,
    canManageVisitorAuthorizations: true,
    canRegisterVisitorAuthorizations: true,
    canApproveVisitorAuthorizations: true,
    canConsultVisitorAuthorizations: true,
  },
  admin: {
    label: "Administrador",
    canManageCondo: true,
    canManageMembers: true,
    canManageStructure: true,
    canManageResidents: true,
    canManageRegistrationRequests: true,
    canManageVehicles: true,
    canViewUnitVehicles: true,
    canRegisterUnitVehicles: false,
    canManageAreas: true,
    canManageReservations: true,
    canManageAnnouncements: true,
    canSendAnnouncements: true,
    canSendUnitNotifications: true,
    canViewUnitNotifications: false,
    canApproveReservations: true,
    canViewVisitorAuthorizations: true,
    canManageVisitorAuthorizations: true,
    canRegisterVisitorAuthorizations: true,
    canApproveVisitorAuthorizations: true,
    canConsultVisitorAuthorizations: true,
  },
  syndic: {
    label: "Síndico",
    canManageCondo: true,
    canManageMembers: true,
    canManageStructure: true,
    canManageResidents: true,
    canManageRegistrationRequests: true,
    canManageVehicles: true,
    canViewUnitVehicles: true,
    canRegisterUnitVehicles: false,
    canManageAreas: true,
    canManageReservations: true,
    canManageAnnouncements: true,
    canSendAnnouncements: true,
    canSendUnitNotifications: true,
    canViewUnitNotifications: false,
    canApproveReservations: true,
    canViewVisitorAuthorizations: true,
    canManageVisitorAuthorizations: true,
    canRegisterVisitorAuthorizations: true,
    canApproveVisitorAuthorizations: true,
    canConsultVisitorAuthorizations: true,
  },
  sub_syndic: {
    label: "Sub-síndico",
    canManageCondo: true,
    canManageMembers: true,
    canManageStructure: true,
    canManageResidents: true,
    canManageRegistrationRequests: true,
    canManageVehicles: true,
    canViewUnitVehicles: true,
    canRegisterUnitVehicles: false,
    canManageAreas: true,
    canManageReservations: true,
    canManageAnnouncements: true,
    canSendAnnouncements: true,
    canSendUnitNotifications: true,
    canViewUnitNotifications: false,
    canApproveReservations: true,
    canViewVisitorAuthorizations: true,
    canManageVisitorAuthorizations: true,
    canRegisterVisitorAuthorizations: true,
    canApproveVisitorAuthorizations: true,
    canConsultVisitorAuthorizations: true,
  },
  resident: {
    label: "Morador",
    canManageCondo: false,
    canManageMembers: false,
    canManageStructure: false,
    canManageResidents: false,
    canManageRegistrationRequests: false,
    canManageVehicles: false,
    canViewUnitVehicles: true,
    canRegisterUnitVehicles: true,
    canManageAreas: false,
    canManageReservations: true,
    canManageAnnouncements: false,
    canSendAnnouncements: true,
    canSendUnitNotifications: false,
    canViewUnitNotifications: false,
    canApproveReservations: false,
    canViewVisitorAuthorizations: true,
    canManageVisitorAuthorizations: false,
    canRegisterVisitorAuthorizations: true,
    canApproveVisitorAuthorizations: false,
    canConsultVisitorAuthorizations: false,
  },
  doorman: {
    label: "Portaria",
    canManageCondo: false,
    canManageMembers: false,
    canManageStructure: false,
    canManageResidents: false,
    canManageRegistrationRequests: false,
    canManageVehicles: false,
    canViewUnitVehicles: false,
    canRegisterUnitVehicles: false,
    canManageAreas: false,
    canManageReservations: false,
    canManageAnnouncements: false,
    canSendAnnouncements: false,
    canSendUnitNotifications: false,
    canViewUnitNotifications: false,
    canApproveReservations: false,
    canViewVisitorAuthorizations: true,
    canManageVisitorAuthorizations: false,
    canRegisterVisitorAuthorizations: false,
    canApproveVisitorAuthorizations: false,
    canConsultVisitorAuthorizations: true,
  },
  staff: {
    label: "Funcionário",
    canManageCondo: false,
    canManageMembers: false,
    canManageStructure: false,
    canManageResidents: false,
    canManageRegistrationRequests: false,
    canManageVehicles: false,
    canViewUnitVehicles: false,
    canRegisterUnitVehicles: false,
    canManageAreas: false,
    canManageReservations: false,
    canManageAnnouncements: false,
    canSendAnnouncements: false,
    canSendUnitNotifications: false,
    canViewUnitNotifications: false,
    canApproveReservations: false,
    canViewVisitorAuthorizations: true,
    canManageVisitorAuthorizations: false,
    canRegisterVisitorAuthorizations: false,
    canApproveVisitorAuthorizations: false,
    canConsultVisitorAuthorizations: true,
  },
} satisfies Record<Role, RolePermissions>;

export function getRolePermissions(role: Role): RolePermissions {
  return ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.admin;
}
