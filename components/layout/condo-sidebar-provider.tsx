"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileCondoNav } from "@/components/layout/mobile-condo-nav";
import type { CondoAccess, MembershipWithCondo } from "@/lib/auth/types";
import { ROLES } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface CondoSidebarProviderProps {
  condoSlug: string;
  condoName: string;
  access: CondoAccess;
  memberships: MembershipWithCondo[];
  children: React.ReactNode;
}

export function CondoSidebarProvider({
  condoSlug,
  condoName,
  access,
  memberships,
  children,
}: CondoSidebarProviderProps) {
  const pathname = usePathname();
  const isResident = access.role === ROLES.RESIDENT;

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <div className="hidden lg:flex">
        <AppSidebar
          condoSlug={condoSlug}
          condoName={condoName}
          currentPath={pathname}
          access={access}
          memberships={memberships}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <MobileCondoNav condoSlug={condoSlug} access={access} memberships={memberships} />
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-hidden",
            isResident && "pb-[calc(4.25rem+env(safe-area-inset-bottom))] lg:pb-0",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
