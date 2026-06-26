import { requireCondoPermission } from "@/lib/auth/access";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { loadGeneralCondoPanelData } from "@/lib/condominiums/general-condo-data";
import { listResidentsByCondominium } from "@/lib/services/residents";
import { listUnitsByCondominium } from "@/lib/services/units";
import { CorrespondenceForm } from "@/components/doorman/correspondence-form";
import { ErrorAlert } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface NewCorrespondencePageProps {
  params: Promise<{ condoSlug: string }>;
}

export default async function NewCorrespondencePage({ params }: NewCorrespondencePageProps) {
  const { condoSlug } = await params;
  const isGranjaSource = isGeneralCondominium(condoSlug);

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageCorrespondence,
  );

  if (isGranjaSource) {
    const panelResult = await loadGeneralCondoPanelData();
    const residentsResult = await listResidentsByCondominium();

    if (!panelResult.ok) {
      return <ErrorAlert message={panelResult.error} title="Erro ao carregar condomínios" />;
    }

    const unitResidents = (residentsResult.ok ? residentsResult.data : [])
      .filter((resident) => resident.profile_id)
      .map((resident) => ({
        id: resident.id,
        unit_id: resident.unit_id,
        full_name: resident.full_name,
        profile_id: resident.profile_id,
      }));

    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader
          title="Nova correspondência"
          description="Registre encomenda ou carta informando condomínio, unidade e destinatário."
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados da correspondência</CardTitle>
          </CardHeader>
          <CardContent>
            <CorrespondenceForm
              condoSlug={condoSlug}
              isGranjaSource
              condominiums={panelResult.data.condominiums}
              units={panelResult.data.units}
              unitResidents={unitResidents}
              condominiumNamesById={panelResult.data.condominiumNamesById}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const [unitsResult, residentsResult] = await Promise.all([
    listUnitsByCondominium(access.condominium.id),
    listResidentsByCondominium({ condominiumId: access.condominium.id }),
  ]);

  const units = unitsResult.ok ? unitsResult.data : [];
  const unitResidents = (residentsResult.ok ? residentsResult.data : [])
    .filter((resident) => resident.profile_id)
    .map((resident) => ({
      id: resident.id,
      unit_id: resident.unit_id,
      full_name: resident.full_name,
      profile_id: resident.profile_id,
    }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Nova correspondência"
        description="Registre encomenda ou carta e avise o destinatário ou o morador responsável."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados da correspondência</CardTitle>
        </CardHeader>
        <CardContent>
          <CorrespondenceForm
            condoSlug={condoSlug}
            units={units}
            unitResidents={unitResidents}
          />
        </CardContent>
      </Card>
    </div>
  );
}
