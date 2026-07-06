import { redirect } from "next/navigation";
import { requireCondoAccess } from "@/lib/auth/access";
import { ROLES } from "@/lib/constants";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { ResidentAnnouncementForm } from "@/components/announcements/resident-announcement-form";
import { PageHeader } from "@/components/shared/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ResidentContactPageProps {
  params: Promise<{ condoSlug: string }>;
}

export default async function ResidentContactPage({ params }: ResidentContactPageProps) {
  const { condoSlug } = await params;
  const access = await requireCondoAccess(condoSlug);

  if (access.role !== ROLES.RESIDENT || !access.permissions.canSendAnnouncements) {
    redirect(`/app/${condoSlug}/announcements`);
  }

  if (isGeneralCondominium(condoSlug)) {
    redirect(`/app/${condoSlug}/announcements`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Fale com o condomínio"
        description="Envie uma mensagem para o síndico do seu condomínio ou para a Granja Brasil (administrador / super admin)."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enviar mensagem</CardTitle>
        </CardHeader>
        <CardContent>
          <ResidentAnnouncementForm condoSlug={condoSlug} />
        </CardContent>
      </Card>
    </div>
  );
}
