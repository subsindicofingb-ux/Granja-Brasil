import type { CondoAccess } from "@/lib/auth/types";
import type { Role } from "@/lib/constants";
import { ROLES } from "@/lib/constants";

export const RESERVATION_HANDOVER_ACCEPTANCE_TEXT =
  "Declaro que conferi o espaço, móveis e utensílios e que tudo está correto para iniciar a festa.";

const HANDOVER_COLLECTOR_ROLES: Role[] = [
  ROLES.SYNDIC,
  ROLES.SUB_SYNDIC,
  ROLES.ADMIN,
  ROLES.DOORMAN,
  ROLES.STAFF,
  ROLES.SUPER_ADMIN,
];

export function canCollectReservationHandover(access: CondoAccess): boolean {
  return HANDOVER_COLLECTOR_ROLES.includes(access.role);
}

export function canShowReservationHandoverCollection(
  status: string,
  access: CondoAccess,
): boolean {
  return status === "approved" && canCollectReservationHandover(access);
}
