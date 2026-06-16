import { getAccessibleCondominiums, requireCondoAccess } from "@/lib/auth/access";
import { CondoAccessProvider } from "@/components/auth/condo-access-provider";
import { AppHeader } from "@/components/layout/app-header";
import { CondoSidebarProvider } from "@/components/layout/condo-sidebar-provider";

interface CondoLayoutProps {
  children: React.ReactNode;
  params: Promise<{ condoSlug: string }>;
}

export default async function CondoLayout({ children, params }: CondoLayoutProps) {
  const { condoSlug } = await params;
  const access = await requireCondoAccess(condoSlug);
  const memberships = await getAccessibleCondominiums();

  return (
    <CondoAccessProvider access={access}>
      <div className="flex h-screen overflow-hidden">
        <CondoSidebarProvider
          condoSlug={condoSlug}
          condoName={access.condominium.name}
          memberships={memberships}
        >
          <div className="flex flex-1 flex-col overflow-hidden">
            <AppHeader access={access} />
            <main className="flex-1 overflow-y-auto p-6">{children}</main>
          </div>
        </CondoSidebarProvider>
      </div>
    </CondoAccessProvider>
  );
}
