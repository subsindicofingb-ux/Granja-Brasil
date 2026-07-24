"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Car,
  DoorOpen,
  Home,
  Inbox,
  LayoutDashboard,
  Megaphone,
  MoreHorizontal,
  Package,
  UserCheck,
} from "lucide-react";
import type { CondoAccess } from "@/lib/auth/types";
import { ROLES, type NavIcon, type Role } from "@/lib/constants";
import { getVisibleNavItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const iconMap = {
  LayoutDashboard,
  Home,
  CalendarDays,
  Megaphone,
  UserCheck,
  DoorOpen,
  Car,
  Inbox,
  Package,
} as const;

function getPrimaryHrefs(role: Role): readonly string[] {
  if (role === ROLES.RESIDENT) {
    return ["", "reservations", "announcements", "access-open", "visitors"];
  }

  if (role === ROLES.DOORMAN) {
    return ["", "visitors", "vehicles", "correspondence", "announcements"];
  }

  return ["", "reservations", "vehicles", "visitors", "announcements"];
}

type MobileBottomNavProps = {
  condoSlug: string;
  access: CondoAccess;
  onOpenMore: () => void;
};

export function MobileBottomNav({ condoSlug, access, onOpenMore }: MobileBottomNavProps) {
  const pathname = usePathname();
  const basePath = `/app/${condoSlug}`;
  const visible = getVisibleNavItems(access);
  const primaryHrefs = getPrimaryHrefs(access.role);
  const primaryItems = primaryHrefs
    .map((href) => visible.find((item) => item.href === href))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 4);

  if (primaryItems.length === 0) {
    return null;
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-sky-200/80 bg-sky-50/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      aria-label="Menu principal"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-between gap-1 px-1 pt-1">
        {primaryItems.map((item) => {
          const href = item.href ? `${basePath}/${item.href}` : basePath;
          const isActive =
            item.href === "" ? pathname === basePath : pathname.startsWith(href);
          const Icon = iconMap[item.icon as keyof typeof iconMap] ?? LayoutDashboard;
          const label = item.href === "" ? "Início" : item.label;

          return (
            <Link
              key={item.href || "home"}
              href={href}
              className={cn(
                "flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2 text-center",
                isActive ? "bg-sky-100 text-sky-900" : "text-slate-700",
              )}
            >
              <Icon className="h-6 w-6 shrink-0" aria-hidden />
              <span className="max-w-full truncate text-[11px] font-semibold leading-tight">
                {label}
              </span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onOpenMore}
          className="flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2 text-center text-slate-700"
        >
          <MoreHorizontal className="h-6 w-6 shrink-0" aria-hidden />
          <span className="text-[11px] font-semibold leading-tight">Mais</span>
        </button>
      </div>
    </nav>
  );
}

export function isPrimaryMobileNavHref(href: string, role: Role): boolean {
  return getPrimaryHrefs(role).includes(href);
}

export type { NavIcon };
