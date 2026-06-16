import type { CondoAccess } from "@/lib/auth/types";

interface PermissionGateProps {
  access: CondoAccess;
  allow: (access: CondoAccess) => boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGate({ access, allow, children, fallback = null }: PermissionGateProps) {
  if (!allow(access)) {
    return fallback;
  }
  return children;
}

interface RoleBadgeProps {
  access: CondoAccess;
}

export function RoleBadge({ access }: RoleBadgeProps) {
  return (
    <span className="inline-flex items-center rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      {access.permissions.label}
    </span>
  );
}
