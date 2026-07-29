import { ROLES, type Role } from "@/lib/constants";
import type { RolePermissions } from "@/lib/auth/roles";

/** Funcionário só consulta e colhe assinatura; demais papéis seguem as flags de criar/agendar. */
export function canCreateReservations(input: {
  role: Role;
  permissions: Pick<
    RolePermissions,
    "canManageReservations" | "canApproveReservations" | "canBookReservationsForCondo"
  >;
}): boolean {
  if (input.role === ROLES.STAFF) {
    return false;
  }

  if (input.role === ROLES.RESIDENT) {
    return input.permissions.canManageReservations;
  }

  return (
    input.permissions.canApproveReservations ||
    input.permissions.canBookReservationsForCondo ||
    input.permissions.canManageReservations
  );
}
