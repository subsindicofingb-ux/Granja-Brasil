import type { CondoAccess } from "@/lib/auth/types";
import { RoleBadge } from "@/components/auth/permission-gate";
import { UserMenu } from "@/components/layout/user-menu";

interface AppHeaderProps {
  access: CondoAccess;
}

export function AppHeader({ access }: AppHeaderProps) {
  return (
    <header className="hidden h-16 items-center justify-between border-b bg-card px-6 lg:flex">
      <div className="flex items-center gap-3">
        <p className="text-sm font-medium text-muted-foreground">{access.condominium.name}</p>
        <RoleBadge access={access} />
      </div>
      <UserMenu access={access} />
    </header>
  );
}
