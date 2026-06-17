import type { Role } from "@/lib/constants";
import type { getRolePermissions } from "@/lib/auth/roles";

export type NavVisibleContext = {
  permissions: ReturnType<typeof getRolePermissions>;
  role: Role;
};
