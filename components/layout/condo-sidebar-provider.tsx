"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileCondoNav } from "@/components/layout/mobile-condo-nav";
import type { CondoAccess, MembershipWithCondo } from "@/lib/auth/types";

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
        <MobileCondoNav condoSlug={condoSlug} access={access} />
        {children}
      </div>
    </div>
  );
}
