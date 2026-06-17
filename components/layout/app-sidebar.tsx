import Link from "next/link";
import {
  Building2,
  CalendarDays,
  Car,
  ChevronRight,
  Home,
  LayoutDashboard,
  Megaphone,
  Settings,
  Trees,
  UserCheck,
  Users,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { CondoSwitcher } from "@/components/layout/condo-switcher";
import type { CondoAccess } from "@/lib/auth/types";
import { getVisibleNavItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const iconMap = {
  LayoutDashboard,
  Building2,
  Home,
  Users,
  Car,
  Trees,
  CalendarDays,
  Megaphone,
  UserCheck,
  Settings,
} as const;

interface AppSidebarProps {
  condoSlug: string;
  condoName: string;
  currentPath: string;
  access: CondoAccess;
  memberships: import("@/lib/auth/types").MembershipWithCondo[];
}

export function AppSidebar({
  condoSlug,
  condoName,
  currentPath,
  access,
  memberships,
}: AppSidebarProps) {
  const basePath = `/app/${condoSlug}`;
  const navItems = getVisibleNavItems(access);

  return (
    <aside className="flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border px-5 py-5">
        <BrandLogo href="/app" size="sm" className="items-start text-left" />
        <p className="mt-3 truncate text-xs text-sidebar-foreground/70">{condoName}</p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => {
          const href = item.href ? `${basePath}/${item.href}` : basePath;
          const isActive =
            item.href === ""
              ? currentPath === basePath
              : currentPath.startsWith(href);
          const Icon = iconMap[item.icon];

          return (
            <Link
              key={item.label}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <CondoSwitcher memberships={memberships} activeSlug={condoSlug} />
        <Link
          href="/app"
          className="mb-2 mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent/60"
        >
          <ChevronRight className="h-3 w-3 rotate-180" />
          Todos os condomínios
        </Link>
        <SignOutButton />
      </div>
    </aside>
  );
}
