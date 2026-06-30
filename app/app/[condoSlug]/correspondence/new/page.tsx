import { requireCondoPermission } from "@/lib/auth/access";
import { resolveDoormanOperationalPanel } from "@/lib/condominiums/doorman-panel";
import { listResidentsByCondominium, type ResidentWithUnit } from "@/lib/services/residents";
import { listUnitsByCondominium } from "@/lib/services/units";
import { CorrespondenceForm } from "@/components/doorman/correspondence-form";
import { ErrorAlert } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface NewCorrespondencePageProps {
  params: Promise<{ condoSlug: string }>;
}

function mapUnitResidents(residents: ResidentWithUnit[]) {
  return residents
    .filter((resident) => resident.profile_id)
    .map((resident) => ({
      id: resident.id,
      unit_id: resident.unit_id,
      full_name: resident.full_name,
      profile_id: resident.profile_id,
    }));
}

export default async function NewCorrespondencePage({ params }: NewCorrespondencePageProps) {
  const { condoSlug } = await params;

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageCorrespondence,
  );

  const panelResult = await resolveDoormanOperationalPanel(condoSlug);
  if (!panelResult.ok) {
    return <ErrorAlert message={panelResult.error} title="Erro ao carregar condomínios" />;
  }

  if (panelResult.data.mode === "granja") {
    const { panel } = panelResult.data;
    const residentsResult = await listResidentsByCondominium();

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
              condominiums={panel.condominiums}
              units={panel.units}
              unitResidents={mapUnitResidents(residentsResult.ok ? residentsResult.data : [])}
              condominiumNamesById={panel.condominiumNamesById}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (panelResult.data.mode === "block") {
    const { panel } = panelResult.data;
    const blockCondominiumIds = panel.condominiums.map((condominium) => condominium.id);
    const residentsResult = await listResidentsByCondominium();
    const residents = (residentsResult.ok ? residentsResult.data : []).filter((resident) =>
      blockCondominiumIds.includes(resident.unit.tower.condominium_id),
    );

    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader
          title="Nova correspondência"
          description={`Registre encomendas no bloco ${panel.block.label}.`}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados da correspondência</CardTitle>
          </CardHeader>
          <CardContent>
            <CorrespondenceForm
              condoSlug={condoSlug}
              isBlockSource
              condominiums={panel.condominiums}
              units={panel.units}
              unitResidents={mapUnitResidents(residents)}
              condominiumNamesById={panel.condominiumNamesById}
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
            units={unitsResult.ok ? unitsResult.data : []}
            unitResidents={mapUnitResidents(residentsResult.ok ? residentsResult.data : [])}
          />
        </CardContent>
      </Card>
    </div>
  );
}
