import type { Role } from "@/lib/constants";
import { ROLES } from "@/lib/constants";
import { ROLE_PERMISSIONS, type RolePermissions } from "@/lib/auth/roles";

export const PERMISSION_CATEGORY_IDS = [
  "registration_requests",
  "structure",
  "residents",
  "vehicles",
  "areas",
  "reservations",
  "announcements",
  "correspondence",
  "water_meters",
  "notifications",
  "visitors",
  "members",
  "access_devices",
  "condo_settings",
] as const;

export type PermissionCategoryId = (typeof PERMISSION_CATEGORY_IDS)[number];

export type CategoryCrud = {
  view: boolean;
  create: boolean;
  delete: boolean;
};

export type ConfigurableRole = Exclude<Role, typeof ROLES.SUPER_ADMIN>;

export type RolePermissionMatrix = Record<ConfigurableRole, Record<PermissionCategoryId, CategoryCrud>>;

export const CONFIGURABLE_ROLES: ConfigurableRole[] = [
  ROLES.ADMIN,
  ROLES.SYNDIC,
  ROLES.SUB_SYNDIC,
  ROLES.DOORMAN,
  ROLES.STAFF,
  ROLES.RESIDENT,
];

export const PERMISSION_CATEGORY_LABELS: Record<PermissionCategoryId, string> = {
  registration_requests: "Solicitações de cadastro",
  structure: "Unidades e estrutura",
  residents: "Moradores",
  vehicles: "Veículos",
  areas: "Espaços comuns",
  reservations: "Reservas",
  announcements: "Avisos",
  correspondence: "Correspondências",
  water_meters: "Hidrômetros",
  notifications: "Notificações",
  visitors: "Visitantes",
  members: "Membros",
  access_devices: "Locais de acesso",
  condo_settings: "Configurações do condomínio",
};

export const CONFIGURABLE_ROLE_LABELS: Record<ConfigurableRole, string> = {
  [ROLES.ADMIN]: "Administrador",
  [ROLES.SYNDIC]: "Síndico",
  [ROLES.SUB_SYNDIC]: "Sub-síndico",
  [ROLES.DOORMAN]: "Portaria",
  [ROLES.STAFF]: "Funcionário",
  [ROLES.RESIDENT]: "Morador",
};

function emptyCrud(): CategoryCrud {
  return { view: false, create: false, delete: false };
}

function deriveCategoryCrud(role: Role, category: PermissionCategoryId): CategoryCrud {
  const permissions = ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.admin;

  switch (category) {
    case "registration_requests":
      return {
        view: permissions.canManageRegistrationRequests,
        create: permissions.canManageRegistrationRequests,
        delete: permissions.canManageRegistrationRequests,
      };
    case "structure":
      return {
        view: permissions.canManageStructure,
        create: permissions.canManageStructure,
        delete: permissions.canManageStructure,
      };
    case "residents":
      return {
        view: permissions.canManageResidents || permissions.canConsultResidents,
        create:
          permissions.canManageResidents || permissions.canRegisterResidentsWithApproval,
        delete: permissions.canManageResidents,
      };
    case "vehicles":
      return {
        view:
          permissions.canManageVehicles ||
          permissions.canViewUnitVehicles ||
          permissions.canConsultVehicles,
        create:
          permissions.canManageVehicles ||
          permissions.canRegisterUnitVehicles ||
          permissions.canRegisterVehiclesWithApproval,
        delete: permissions.canManageVehicles,
      };
    case "areas":
      return {
        view: permissions.canManageAreas,
        create: permissions.canManageAreas,
        delete: permissions.canManageAreas,
      };
    case "reservations":
      return {
        view: permissions.canManageReservations || permissions.canApproveReservations,
        create:
          permissions.canManageReservations ||
          permissions.canApproveReservations ||
          permissions.canBookReservationsForCondo,
        delete: permissions.canApproveReservations,
      };
    case "announcements":
      return {
        view: permissions.canManageAnnouncements || permissions.canSendAnnouncements,
        create: permissions.canManageAnnouncements || permissions.canSendAnnouncements,
        delete: permissions.canManageAnnouncements,
      };
    case "correspondence":
      return {
        view: permissions.canManageCorrespondence,
        create: permissions.canManageCorrespondence,
        delete: permissions.canManageCorrespondence,
      };
    case "water_meters":
      return {
        view: permissions.canManageWaterMeters || permissions.canViewWaterMeters,
        create: permissions.canManageWaterMeters,
        delete: permissions.canManageWaterMeters,
      };
    case "notifications":
      return {
        view: permissions.canSendUnitNotifications || permissions.canViewUnitNotifications,
        create: permissions.canSendUnitNotifications,
        delete: permissions.canSendUnitNotifications,
      };
    case "visitors":
      return {
        view:
          permissions.canViewVisitorAuthorizations ||
          permissions.canConsultVisitorAuthorizations,
        create:
          permissions.canManageVisitorAuthorizations ||
          permissions.canRegisterVisitorAuthorizations,
        delete:
          permissions.canManageVisitorAuthorizations ||
          permissions.canApproveVisitorAuthorizations,
      };
    case "members":
      return {
        view: permissions.canManageMembers,
        create: permissions.canManageMembers,
        delete: permissions.canManageMembers,
      };
    case "access_devices":
      return {
        view: permissions.canManageAccessDevices,
        create: permissions.canManageAccessDevices,
        delete: permissions.canManageAccessDevices,
      };
    case "condo_settings":
      return {
        view: permissions.canManageCondo,
        create: permissions.canManageCondo,
        delete: permissions.canManageCondo,
      };
    default:
      return emptyCrud();
  }
}

export function buildDefaultPermissionMatrix(): RolePermissionMatrix {
  const matrix = {} as RolePermissionMatrix;

  for (const role of CONFIGURABLE_ROLES) {
    matrix[role] = {} as Record<PermissionCategoryId, CategoryCrud>;
    for (const category of PERMISSION_CATEGORY_IDS) {
      matrix[role][category] = deriveCategoryCrud(role, category);
    }
  }

  return matrix;
}

export function getCategoryCrudForRole(
  role: Role,
  matrix: RolePermissionMatrix | null | undefined,
  category: PermissionCategoryId,
): CategoryCrud {
  if (role === ROLES.SUPER_ADMIN) {
    return { view: true, create: true, delete: true };
  }

  const configurableRole = role as ConfigurableRole;
  const fromMatrix = matrix?.[configurableRole]?.[category];
  if (fromMatrix) {
    return fromMatrix;
  }

  return deriveCategoryCrud(role, category);
}

export function getAllCategoryCrudForRole(
  role: Role,
  matrix: RolePermissionMatrix | null | undefined,
): Record<PermissionCategoryId, CategoryCrud> {
  const result = {} as Record<PermissionCategoryId, CategoryCrud>;

  for (const category of PERMISSION_CATEGORY_IDS) {
    result[category] = getCategoryCrudForRole(role, matrix, category);
  }

  return result;
}

function applyCategoryToPermissions(
  role: Role,
  category: PermissionCategoryId,
  cells: CategoryCrud,
  base: RolePermissions,
): Partial<RolePermissions> {
  switch (category) {
    case "registration_requests":
      return {
        canManageRegistrationRequests: cells.view || cells.create || cells.delete,
      };
    case "structure":
      return {
        canManageStructure: cells.view || cells.create || cells.delete,
      };
    case "residents":
      return {
        canConsultResidents: cells.view,
        canRegisterResidentsWithApproval:
          cells.create && base.canRegisterResidentsWithApproval,
        canManageResidents:
          cells.delete || (cells.create && base.canManageResidents),
      };
    case "vehicles":
      return {
        canConsultVehicles: cells.view || base.canConsultVehicles,
        canViewUnitVehicles: cells.view || base.canViewUnitVehicles,
        canRegisterUnitVehicles:
          cells.create && base.canRegisterUnitVehicles,
        canRegisterVehiclesWithApproval:
          cells.create && base.canRegisterVehiclesWithApproval,
        canManageVehicles:
          cells.delete || (cells.create && base.canManageVehicles),
      };
    case "areas":
      return {
        canManageAreas: cells.view || cells.create || cells.delete,
      };
    case "reservations":
      return {
        canManageReservations: cells.view || cells.create,
        canApproveReservations: cells.delete || cells.create,
        canBookReservationsForCondo:
          cells.create && base.canBookReservationsForCondo,
      };
    case "announcements":
      return {
        canManageAnnouncements: cells.create || cells.delete,
        canSendAnnouncements: cells.view || cells.create,
      };
    case "correspondence":
      return {
        canManageCorrespondence: cells.view || cells.create || cells.delete,
      };
    case "water_meters":
      return {
        canViewWaterMeters: cells.view,
        canManageWaterMeters: cells.create || cells.delete,
      };
    case "notifications":
      return {
        canViewUnitNotifications: cells.view,
        canSendUnitNotifications: cells.create || cells.delete,
      };
    case "visitors":
      return {
        canViewVisitorAuthorizations: cells.view,
        canConsultVisitorAuthorizations: cells.view && base.canConsultVisitorAuthorizations,
        canRegisterVisitorAuthorizations:
          cells.create && base.canRegisterVisitorAuthorizations,
        canApproveVisitorAuthorizations:
          cells.delete && base.canApproveVisitorAuthorizations,
        canManageVisitorAuthorizations:
          cells.create || cells.delete,
      };
    case "members":
      return {
        canManageMembers: cells.view || cells.create || cells.delete,
      };
    case "access_devices":
      return {
        canManageAccessDevices: cells.view || cells.create || cells.delete,
      };
    case "condo_settings":
      return {
        canManageCondo: cells.view || cells.create || cells.delete,
      };
    default:
      return {};
  }
}

export function applyPermissionMatrix(
  role: Role,
  matrix: RolePermissionMatrix | null | undefined,
): RolePermissions {
  if (role === ROLES.SUPER_ADMIN) {
    return ROLE_PERMISSIONS.super_admin;
  }

  const base = ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.admin;
  let permissions: RolePermissions = { ...base };

  for (const category of PERMISSION_CATEGORY_IDS) {
    const cells = getCategoryCrudForRole(role, matrix, category);
    permissions = {
      ...permissions,
      ...applyCategoryToPermissions(role, category, cells, base),
    };
  }

  return permissions;
}

export function canCreateInCategory(
  access: { categoryCrud: Record<PermissionCategoryId, CategoryCrud> },
  category: PermissionCategoryId,
): boolean {
  return access.categoryCrud[category]?.create ?? false;
}

export function canDeleteInCategory(
  access: { categoryCrud: Record<PermissionCategoryId, CategoryCrud> },
  category: PermissionCategoryId,
): boolean {
  return access.categoryCrud[category]?.delete ?? false;
}

export function canViewInCategory(
  access: { categoryCrud: Record<PermissionCategoryId, CategoryCrud> },
  category: PermissionCategoryId,
): boolean {
  const cells = access.categoryCrud[category];
  return Boolean(cells?.view || cells?.create || cells?.delete);
}

export function parsePermissionMatrix(raw: unknown): RolePermissionMatrix {
  const defaults = buildDefaultPermissionMatrix();

  if (!raw || typeof raw !== "object") {
    return defaults;
  }

  const input = raw as Partial<RolePermissionMatrix>;

  for (const role of CONFIGURABLE_ROLES) {
    for (const category of PERMISSION_CATEGORY_IDS) {
      const cell = input[role]?.[category];
      if (!cell) {
        continue;
      }

      defaults[role][category] = {
        view: Boolean(cell.view),
        create: Boolean(cell.create),
        delete: Boolean(cell.delete),
      };
    }
  }

  return defaults;
}

export function matrixFieldName(
  role: ConfigurableRole,
  category: PermissionCategoryId,
  action: keyof CategoryCrud,
): string {
  return `matrix_${role}_${category}_${action}`;
}
