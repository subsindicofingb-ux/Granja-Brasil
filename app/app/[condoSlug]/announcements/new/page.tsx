import { requireCondoPermission } from "@/lib/auth/access";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { listCondominiums } from "@/lib/services/condominiums-admin";
import { listResidentsWithProfileForAnnouncement } from "@/lib/services/residents";
import { listTowersByCondominium } from "@/lib/services/towers";
import { createDefaultAnnouncementForm } from "@/lib/announcements/defaults";
import { toDatetimeLocalValue } from "@/lib/reservations/timezone";
import { PageHeader } from "@/components/shared/page-shell";
import { AnnouncementForm } from "@/components/announcements/announcement-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface NewAnnouncementPageProps {
  params: Promise<{ condoSlug: string }>;
}

export default async function NewAnnouncementPage({ params }: NewAnnouncementPageProps) {
  const { condoSlug } = await params;

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageAnnouncements,
    { redirectTo: `/app/${condoSlug}/announcements` },
  );

  const isGranjaSource = isGeneralCondominium(condoSlug);

  const [towersResult, condominiumsResult, residentsResult] = await Promise.all([
    listTowersByCondominium(access.condominium.id),
    isGranjaSource ? listCondominiums() : Promise.resolve(null),
    listResidentsWithProfileForAnnouncement(
      isGranjaSource
        ? {
            includeAllSubCondominiums: true,
            excludeCondominiumId: access.condominium.id,
          }
        : { condominiumId: access.condominium.id },
    ),
  ]);

  const towers = towersResult.ok ? towersResult.data : [];
  const condominiums = (condominiumsResult?.ok ? condominiumsResult.data : []).filter(
    (condominium) => condominium.id !== access.condominium.id,
  );
  const residents = residentsResult.ok ? residentsResult.data : [];

  const defaultValues = createDefaultAnnouncementForm(
    toDatetimeLocalValue(new Date().toISOString()),
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Novo aviso"
        description="Publique um comunicado para todo o condomínio, para um bloco específico ou para um morador."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conteúdo do aviso</CardTitle>
        </CardHeader>
        <CardContent>
          <AnnouncementForm
            condoSlug={condoSlug}
            mode="create"
            isGranjaSource={isGranjaSource}
            towers={towers.map((tower) => ({ id: tower.id, name: tower.name }))}
            condominiums={condominiums.map((condominium) => ({
              id: condominium.id,
              name: condominium.name,
            }))}
            residents={residents}
            defaultValues={defaultValues}
          />
        </CardContent>
      </Card>
    </div>
  );
}
