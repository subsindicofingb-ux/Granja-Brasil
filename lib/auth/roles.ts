import type { Role } from "@/lib/constants";

/**
 * Mapeamento papel → permissões (espelha RLS do Supabase).
 * Referência para UI e auth futura — enforcement real está no banco.
 */
export const ROLE_PERMISSIONS = {
  super_admin: {
    label: "Super Admin",
    canManageCondo: true,
    canManageMembers: true,
    canManageStructure: true,
    canManageResidents: true,
    canManageRegistrationRequests: true,
    canManageVehicles: true,
    canManageAreas: true,
    canManageReservations: true,
    canManageAnnouncements: true,
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
    canManageAreas: true,
    canManageReservations: true,
    canManageAnnouncements: true,
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
    canManageAreas: true,
    canManageReservations: true,
    canManageAnnouncements: true,
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
    canManageAreas: false,
    canManageReservations: true,
    canManageAnnouncements: false,
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
    canManageAreas: false,
    canManageReservations: false,
    canManageAnnouncements: false,
    canApproveReservations: false,
    canViewVisitorAuthorizations: true,
    canManageVisitorAuthorizations: false,
    canRegisterVisitorAuthorizations: false,
    canApproveVisitorAuthorizations: false,
    canConsultVisitorAuthorizations: true,
  },
} as const satisfies Record<
  Role,
  {
    label: string;
    canManageCondo: boolean;
    canManageMembers: boolean;
    canManageStructure: boolean;
    canManageResidents: boolean;
    canManageRegistrationRequests: boolean;
    canManageVehicles: boolean;
    canManageAreas: boolean;
    canManageReservations: boolean;
    canManageAnnouncements: boolean;
    canApproveReservations: boolean;
    canViewVisitorAuthorizations: boolean;
    canManageVisitorAuthorizations: boolean;
    canRegisterVisitorAuthorizations: boolean;
    canApproveVisitorAuthorizations: boolean;
    canConsultVisitorAuthorizations: boolean;
  }
>;

export function getRolePermissions(role: Role) {
  return ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.admin;
}
