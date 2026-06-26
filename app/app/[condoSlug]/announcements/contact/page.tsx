import { redirect } from "next/navigation";
import { requireCondoAccess } from "@/lib/auth/access";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { SyndicContactForm } from "@/components/announcements/syndic-contact-form";
import { PageHeader } from "@/components/shared/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SyndicContactPageProps {
  params: Promise<{ condoSlug: string }>;
}

export default async function SyndicContactPage({ params }: SyndicContactPageProps) {
  const { condoSlug } = await params;
  const access = await requireCondoAccess(condoSlug);

  if (!access.permissions.canManageAnnouncements || isGeneralCondominium(condoSlug)) {
    redirect(`/app/${condoSlug}/announcements`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Fale com o condomínio"
        description="Envie uma mensagem à administração Granja Brasil e acompanhe a conversa em Avisos."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sua mensagem</CardTitle>
        </CardHeader>
        <CardContent>
          <SyndicContactForm condoSlug={condoSlug} />
        </CardContent>
      </Card>
    </div>
  );
}
