import type { Role } from "@/lib/constants";
import type { CategoryCrud, PermissionCategoryId } from "@/lib/auth/permission-matrix";
import type { getRolePermissions } from "@/lib/auth/roles";

export type NavVisibleContext = {
  permissions: ReturnType<typeof getRolePermissions>;
  role: Role;
  categoryCrud: Record<PermissionCategoryId, CategoryCrud>;
};
