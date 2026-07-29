import { ROLES, type Role } from "@/lib/constants";

/** Funcionário: consulta só para conferir cadastro — sem dados sensíveis. */
export function isEmployeeLimitedConsult(role: Role): boolean {
  return role === ROLES.STAFF;
}
