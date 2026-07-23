"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  DoorOpen,
  Home,
  LayoutDashboard,
  Megaphone,
  MoreHorizontal,
  UserCheck,
} from "lucide-react";
import type { CondoAccess } from "@/lib/auth/types";
import { ROLES, type NavIcon } from "@/lib/constants";
import { getVisibleNavItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const iconMap = {
  LayoutDashboard,
  Home,
  CalendarDays,
  Megaphone,
  UserCheck,
  DoorOpen,
} as const;

const PRIMARY_HREFS = ["", "reservations", "announcements", "access-open", "visitors"] as const;

type MobileBottomNavProps = {
  condoSlug: string;
  access: CondoAccess;
  onOpenMore: () => void;
};

export function MobileBottomNav({ condoSlug, access, onOpenMore }: MobileBottomNavProps) {
  const pathname = usePathname();
  const basePath = `/app/${condoSlug}`;
  const visible = getVisibleNavItems(access);
  const primaryItems = PRIMARY_HREFS.map((href) =>
    visible.find((item) => item.href === href),
  ).filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (access.role !== ROLES.RESIDENT || primaryItems.length === 0) {
    return null;
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      aria-label="Menu principal"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-between gap-1 px-1 pt-1">
        {primaryItems.slice(0, 4).map((item) => {
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
                isActive ? "bg-primary/10 text-primary" : "text-foreground",
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
          className="flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2 text-center text-foreground"
        >
          <MoreHorizontal className="h-6 w-6 shrink-0" aria-hidden />
          <span className="text-[11px] font-semibold leading-tight">Mais</span>
        </button>
      </div>
    </nav>
  );
}

export function isPrimaryMobileNavHref(href: string): boolean {
  return (PRIMARY_HREFS as readonly string[]).includes(href);
}

export type { NavIcon };
