import { requireCondoAccess } from "@/lib/auth/access";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { ROLES } from "@/lib/constants";
import { EmployeeAdminMessageForm } from "@/components/announcements/employee-admin-message-form";
import { PageHeader } from "@/components/shared/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { redirect } from "next/navigation";

interface EmployeeNotificationsPageProps {
  params: Promise<{ condoSlug: string }>;
}

export default async function EmployeeNotificationsPage({
  params,
}: EmployeeNotificationsPageProps) {
  const { condoSlug } = await params;
  const access = await requireCondoAccess(condoSlug);

  if (access.role !== ROLES.STAFF || !access.permissions.canSendAnnouncements) {
    redirect(`/app/${condoSlug}/notifications`);
  }

  const isGranja = isGeneralCondominium(condoSlug);
  const audienceLabel = isGranja
    ? "Super Admin e Administradores da Granja Brasil"
    : "o síndico deste condomínio";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Notificações"
        description={`Envie uma notificação para ${audienceLabel}. Moradores não recebem este aviso.`}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nova notificação</CardTitle>
        </CardHeader>
        <CardContent>
          <EmployeeAdminMessageForm condoSlug={condoSlug} audienceLabel={audienceLabel} />
        </CardContent>
      </Card>
    </div>
  );
}
