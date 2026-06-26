import { redirect } from "next/navigation";
import { requireCondoAccess } from "@/lib/auth/access";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { listResidentsWithProfileForAnnouncement } from "@/lib/services/residents";
import { DoormanContactForm } from "@/components/doorman/doorman-contact-form";
import { PageHeader } from "@/components/shared/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DoormanContactPageProps {
  params: Promise<{ condoSlug: string }>;
}

export default async function DoormanContactPage({ params }: DoormanContactPageProps) {
  const { condoSlug } = await params;
  const access = await requireCondoAccess(condoSlug);

  if (!access.permissions.canSendAnnouncements || isGeneralCondominium(condoSlug)) {
    redirect(`/app/${condoSlug}/announcements`);
  }

  const residentsResult = await listResidentsWithProfileForAnnouncement({
    condominiumId: access.condominium.id,
  });
  const residents = residentsResult.ok ? residentsResult.data : [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Fale com o condomínio"
        description="Envie mensagem à Granja Brasil ou diretamente a um morador do condomínio."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nova mensagem</CardTitle>
        </CardHeader>
        <CardContent>
          <DoormanContactForm condoSlug={condoSlug} residents={residents} />
        </CardContent>
      </Card>
    </div>
  );
}
