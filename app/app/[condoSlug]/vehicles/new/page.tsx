import Link from "next/link";
import { requireCondoPermission } from "@/lib/auth/access";
import { getUnitListFilterForAccess, getScopedUnitIds } from "@/lib/auth/unit-scope";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { loadGeneralCondoPanelData } from "@/lib/condominiums/general-condo-data";
import { resolveDoormanOperationalPanel } from "@/lib/condominiums/doorman-panel";
import { listResidentsByCondominium } from "@/lib/services/residents";
import { listUnitsByCondominium } from "@/lib/services/units";
import { ErrorAlert } from "@/components/shared/feedback";
import { EmptyState, PageHeader } from "@/components/shared/page-shell";
import { VehicleForm } from "@/components/vehicles/vehicle-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isValidUuid } from "@/lib/utils";

function resolvePreselectedUnitId(units: { id: string }[], unitId?: string) {
  return unitId && units.some((unit) => unit.id === unitId) ? unitId : undefined;
}

interface NewVehiclePageProps {
  params: Promise<{ condoSlug: string }>;
  searchParams: Promise<{ unit?: string }>;
}

export default async function NewVehiclePage({ params, searchParams }: NewVehiclePageProps) {
  const { condoSlug } = await params;
  const { unit: preselectedUnitId } = await searchParams;
  const normalizedUnitId =
    preselectedUnitId && isValidUuid(preselectedUnitId) ? preselectedUnitId : undefined;
  const isGeneralCondo = isGeneralCondominium(condoSlug);

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) =>
      ctx.permissions.canManageVehicles ||
      ctx.permissions.canRegisterUnitVehicles ||
      ctx.permissions.canRegisterVehiclesWithApproval,
    { redirectTo: `/app/${condoSlug}/vehicles` },
  );

  const isResidentSubmission = access.permissions.canRegisterUnitVehicles;
  const isDoormanSubmission =
    access.permissions.canRegisterVehiclesWithApproval && !access.permissions.canManageVehicles;

  if (isResidentSubmission) {
    const unitFilter = await getUnitListFilterForAccess(access);
    const scopedUnitIds = getScopedUnitIds(unitFilter);

    if (scopedUnitIds.length === 0) {
      return (
        <div className="mx-auto max-w-lg space-y-6">
          <PageHeader
            title="Novo veículo"
            description="Cadastre o veículo da sua unidade para aprovação do síndico."
          />
          <EmptyState
            title="Unidade não vinculada"
            description="Seu cadastro precisa estar vinculado a uma unidade antes de registrar veículos."
          />
        </div>
      );
    }

    const unitsResult = await listUnitsByCondominium(access.condominium.id);
    const residentUnits =
      unitsResult.ok && unitsResult.data
        ? unitsResult.data.filter((unit) => scopedUnitIds.includes(unit.id))
        : [];

    if (residentUnits.length === 0) {
      return (
        <div className="mx-auto max-w-lg space-y-4">
          <ErrorAlert message="Não foi possível carregar a unidade vinculada." />
          <Button variant="outline" asChild>
            <Link href={`/app/${condoSlug}/vehicles`}>Voltar</Link>
          </Button>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-lg space-y-6">
        <PageHeader
          title="Novo veículo"
          description="Cadastre placa, TAG e foto. O síndico validará antes de liberar na portaria."
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados do veículo</CardTitle>
          </CardHeader>
          <CardContent>
            <VehicleForm
              condoSlug={condoSlug}
              units={residentUnits}
              residents={[]}
              mode="create"
              isResidentSubmission
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isDoormanSubmission) {
    const panelResult = await resolveDoormanOperationalPanel(condoSlug);
    if (!panelResult.ok) {
      return (
        <div className="mx-auto max-w-lg space-y-4">
          <ErrorAlert message={panelResult.error} />
          <Button variant="outline" asChild>
            <Link href={`/app/${condoSlug}/vehicles`}>Voltar</Link>
          </Button>
        </div>
      );
    }

    if (panelResult.data.mode === "granja") {
      return (
        <div className="mx-auto max-w-lg space-y-4">
          <ErrorAlert message="Cadastro de veículos é feito nos condomínios filhos." />
          <Button variant="outline" asChild>
            <Link href={`/app/${condoSlug}/vehicles`}>Voltar</Link>
          </Button>
        </div>
      );
    }

    if (panelResult.data.mode === "block") {
      const { panel } = panelResult.data;
      const residentsResult = await listResidentsByCondominium();
      const blockCondominiumIds = panel.condominiums.map((condominium) => condominium.id);
      const residents = (residentsResult.ok ? residentsResult.data : []).filter((resident) =>
        blockCondominiumIds.includes(resident.unit.tower.condominium_id),
      );

      return (
        <div className="mx-auto max-w-lg space-y-6">
          <PageHeader
            title="Novo veículo"
            description={`Cadastre placa e TAG para aprovação do síndico no bloco ${panel.block.label}.`}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados do veículo</CardTitle>
            </CardHeader>
            <CardContent>
              <VehicleForm
                condoSlug={condoSlug}
                units={panel.units}
                residents={residents}
                condominiumNamesById={panel.condominiumNamesById}
                mode="create"
                isPendingApproval
                defaultValues={{
                  unitId: resolvePreselectedUnitId(panel.units, normalizedUnitId),
                }}
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

    if (!unitsResult.ok) {
      return (
        <div className="mx-auto max-w-lg space-y-4">
          <ErrorAlert message={unitsResult.error} />
          <Button variant="outline" asChild>
            <Link href={`/app/${condoSlug}/vehicles`}>Voltar</Link>
          </Button>
        </div>
      );
    }

    if (!residentsResult.ok) {
      return (
        <div className="mx-auto max-w-lg space-y-4">
          <ErrorAlert message={residentsResult.error} />
          <Button variant="outline" asChild>
            <Link href={`/app/${condoSlug}/vehicles`}>Voltar</Link>
          </Button>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-lg space-y-6">
        <PageHeader
          title="Novo veículo"
          description="Cadastre placa e TAG para aprovação do síndico."
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados do veículo</CardTitle>
          </CardHeader>
          <CardContent>
            <VehicleForm
              condoSlug={condoSlug}
              units={unitsResult.data}
              residents={residentsResult.data}
              mode="create"
              isPendingApproval
              defaultValues={{
                unitId: resolvePreselectedUnitId(unitsResult.data, normalizedUnitId),
              }}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isGeneralCondo) {
    const [panelResult, residentsResult] = await Promise.all([
      loadGeneralCondoPanelData(),
      listResidentsByCondominium(),
    ]);

    if (!panelResult.ok) {
      return (
        <div className="mx-auto max-w-lg space-y-4">
          <ErrorAlert message={panelResult.error} />
          <Button variant="outline" asChild>
            <Link href={`/app/${condoSlug}/vehicles`}>Voltar</Link>
          </Button>
        </div>
      );
    }

    if (!residentsResult.ok) {
      return (
        <div className="mx-auto max-w-lg space-y-4">
          <ErrorAlert message={residentsResult.error} />
          <Button variant="outline" asChild>
            <Link href={`/app/${condoSlug}/vehicles`}>Voltar</Link>
          </Button>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-lg space-y-6">
        <PageHeader
          title="Novo veículo"
          description="Cadastre placa, TAG de acesso e foto do veículo."
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados do veículo</CardTitle>
          </CardHeader>
          <CardContent>
            <VehicleForm
              condoSlug={condoSlug}
              units={panelResult.data.units}
              residents={residentsResult.data}
              condominiumNamesById={panelResult.data.condominiumNamesById}
              mode="create"
              defaultValues={{
                unitId: resolvePreselectedUnitId(panelResult.data.units, normalizedUnitId),
              }}
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

  if (!unitsResult.ok) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <ErrorAlert message={unitsResult.error} />
        <Button variant="outline" asChild>
          <Link href={`/app/${condoSlug}/vehicles`}>Voltar</Link>
        </Button>
      </div>
    );
  }

  if (!residentsResult.ok) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <ErrorAlert message={residentsResult.error} />
        <Button variant="outline" asChild>
          <Link href={`/app/${condoSlug}/vehicles`}>Voltar</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader
        title="Novo veículo"
        description="Cadastre placa, TAG de acesso e foto do veículo."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do veículo</CardTitle>
        </CardHeader>
        <CardContent>
          <VehicleForm
            condoSlug={condoSlug}
            units={unitsResult.data}
            residents={residentsResult.data}
            mode="create"
            defaultValues={{
              unitId: resolvePreselectedUnitId(unitsResult.data, normalizedUnitId),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
