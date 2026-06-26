"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { BrandLogo } from "@/components/brand/brand-logo";
import type { CondoAccess } from "@/lib/auth/types";
import { getVisibleNavItems } from "@/lib/navigation";
import {
  Building2,
  CalendarDays,
  Car,
  Home,
  LayoutDashboard,
  Megaphone,
  Bell,
  Settings,
  Trees,
  UserCheck,
  Inbox,
  Users,
} from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
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
  Bell,
  UserCheck,
  Inbox,
  Settings,
} as const;

interface MobileCondoNavProps {
  condoSlug: string;
  access: CondoAccess;
}

export function MobileCondoNav({ condoSlug, access }: MobileCondoNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const basePath = `/app/${condoSlug}`;
  const navItems = getVisibleNavItems(access);

  return (
    <header className="sticky top-0 z-40 border-b bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
      <div className="flex items-center justify-between gap-3">
        <BrandLogo href="/app" size="xs" />
        <div className="min-w-0 flex-1 text-right">
          <p className="truncate text-sm font-medium">{access.condominium.name}</p>
          <p className="truncate text-xs text-muted-foreground">{access.profile.fullName}</p>
        </div>
        <button
          type="button"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-background"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <nav className="mt-3 space-y-1 rounded-xl border bg-background p-2 shadow-sm">
          {navItems.map((item) => {
            const href = item.href ? `${basePath}/${item.href}` : basePath;
            const isActive =
              item.href === "" ? pathname === basePath : pathname.startsWith(href);
            const Icon = iconMap[item.icon];

            return (
              <Link
                key={item.label}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-muted",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
          <Link
            href="/app"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            Todos os condomínios
          </Link>
          <div className="border-t pt-2">
            <SignOutButton variant="menu" />
          </div>
        </nav>
      )}
    </header>
  );
}
