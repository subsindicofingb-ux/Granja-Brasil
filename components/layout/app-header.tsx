import { Bell, Search } from "lucide-react";
import type { CondoAccess } from "@/lib/auth/types";
import { getInitials } from "@/lib/auth/types";
import { RoleBadge } from "@/components/auth/permission-gate";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface AppHeaderProps {
  access: CondoAccess;
}

export function AppHeader({ access }: AppHeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      <div className="flex items-center gap-3">
        <p className="text-sm font-medium text-muted-foreground">{access.condominium.name}</p>
        <RoleBadge access={access} />
      </div>
      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar..." className="w-64 pl-9" disabled />
        </div>
        <Button variant="outline" size="icon" disabled>
          <Bell className="h-4 w-4" />
        </Button>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
          title={access.profile.fullName}
        >
          {getInitials(access.profile.fullName)}
        </div>
      </div>
    </header>
  );
}
