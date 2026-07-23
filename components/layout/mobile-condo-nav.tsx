"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { MobileBottomNav, isPrimaryMobileNavHref } from "@/components/layout/mobile-bottom-nav";
import { selectCondominiumAction } from "@/lib/auth/actions";
import type { CondoAccess, MembershipWithCondo } from "@/lib/auth/types";
import { getRolePermissions } from "@/lib/auth/roles";
import { ROLES } from "@/lib/constants";
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
  Package,
  Droplets,
  DoorOpen,
} from "lucide-react";
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
  Package,
  Droplets,
  DoorOpen,
} as const;

interface MobileCondoNavProps {
  condoSlug: string;
  access: CondoAccess;
  memberships: MembershipWithCondo[];
}

export function MobileCondoNav({ condoSlug, access, memberships }: MobileCondoNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const basePath = `/app/${condoSlug}`;
  const navItems = getVisibleNavItems(access);
  const isResident = access.role === ROLES.RESIDENT;
  const sheetItems = isResident
    ? navItems.filter((item) => !isPrimaryMobileNavHref(item.href))
    : navItems;

  useEffect(() => {
    if (!open) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <BrandLogo href="/app" size="xs" />
          <div className="min-w-0 flex-1 text-right">
            <p className="truncate text-base font-semibold">{access.condominium.name}</p>
            <p className="truncate text-sm text-muted-foreground">{access.profile.fullName}</p>
          </div>
          <button
            type="button"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border bg-background"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background lg:hidden">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="min-w-0">
              <p className="text-lg font-semibold">Menu</p>
              <p className="truncate text-sm text-muted-foreground">{access.condominium.name}</p>
            </div>
            <button
              type="button"
              aria-label="Fechar menu"
              className="inline-flex h-12 w-12 items-center justify-center rounded-xl border"
              onClick={() => setOpen(false)}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {sheetItems.map((item) => {
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
                    "flex min-h-14 items-center gap-4 rounded-2xl px-4 py-3 text-lg font-medium",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="h-6 w-6 shrink-0" />
                  {item.label}
                </Link>
              );
            })}

            {memberships.length > 1 && (
              <div className="mt-4 space-y-2 rounded-2xl border p-3">
                <p className="px-1 text-base font-semibold">Trocar condomínio</p>
                {memberships.map((membership) => (
                  <button
                    key={membership.id}
                    type="button"
                    disabled={pending || membership.condominium.slug === condoSlug}
                    className="flex min-h-14 w-full flex-col items-start justify-center rounded-xl px-3 py-2 text-left hover:bg-muted disabled:opacity-50"
                    onClick={() => {
                      startTransition(async () => {
                        await selectCondominiumAction(membership.condominium.slug);
                        setOpen(false);
                      });
                    }}
                  >
                    <span className="text-base font-medium">{membership.condominium.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {getRolePermissions(membership.role).label}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <Link
              href="/app"
              onClick={() => setOpen(false)}
              className="flex min-h-14 items-center gap-4 rounded-2xl px-4 py-3 text-lg font-medium text-muted-foreground hover:bg-muted"
            >
              Todos os condomínios
            </Link>
          </nav>

          <div className="border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <SignOutButton variant="menu" />
          </div>
        </div>
      )}

      {isResident && (
        <MobileBottomNav
          condoSlug={condoSlug}
          access={access}
          onOpenMore={() => setOpen(true)}
        />
      )}
    </>
  );
}
