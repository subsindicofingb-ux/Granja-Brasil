"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import type { MembershipWithCondo } from "@/lib/auth/types";

interface CondoSidebarProviderProps {
  condoSlug: string;
  condoName: string;
  memberships: MembershipWithCondo[];
  children: React.ReactNode;
}

export function CondoSidebarProvider({
  condoSlug,
  condoName,
  memberships,
  children,
}: CondoSidebarProviderProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <AppSidebar
        condoSlug={condoSlug}
        condoName={condoName}
        currentPath={pathname}
        memberships={memberships}
      />
      {children}
    </div>
  );
}
