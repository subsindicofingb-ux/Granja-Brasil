import Link from "next/link";
import { requireCondoPermission } from "@/lib/auth/access";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { loadGeneralCondoPanelData } from "@/lib/condominiums/general-condo-data";
import { listUnitsByCondominium } from "@/lib/services/units";
import { ErrorAlert } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/page-shell";
import { ResidentForm } from "@/components/residents/resident-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isValidUuid } from "@/lib/utils";

interface NewResidentPageProps {
  params: Promise<{ condoSlug: string }>;
  searchParams: Promise<{ unit?: string; condominium?: string }>;
}

export default async function NewResidentPage({ params, searchParams }: NewResidentPageProps) {
  const { condoSlug } = await params;
  const { unit: preselectedUnit, condominium: preselectedCondominiumSlug } = await searchParams;
  const preselectedUnitId = isValidUuid(preselectedUnit) ? preselectedUnit : undefined;
  const isGeneralCondo = isGeneralCondominium(condoSlug);

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageResidents,
    { redirectTo: `/app/${condoSlug}/residents` },
  );

  if (isGeneralCondo) {
    const panelResult = await loadGeneralCondoPanelData({
      condominiumSlug: preselectedCondominiumSlug?.trim().toLowerCase(),
    });

    if (!panelResult.ok) {
      return (
        <div className="mx-auto max-w-lg space-y-4">
          <ErrorAlert message={panelResult.error} />
          <Button variant="outline" asChild>
            <Link href={`/app/${condoSlug}/residents`}>Voltar</Link>
          </Button>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-lg space-y-6">
        <PageHeader
          title="Novo morador"
          description="Cadastre um morador vinculado a uma unidade."
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados do morador</CardTitle>
          </CardHeader>
          <CardContent>
            <ResidentForm
              condoSlug={condoSlug}
              units={panelResult.data.units}
              condominiumNamesById={panelResult.data.condominiumNamesById}
              mode="create"
              defaultValues={{ unitId: preselectedUnitId }}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const unitsResult = await listUnitsByCondominium(access.condominium.id);

  if (!unitsResult.ok) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <ErrorAlert message={unitsResult.error} />
        <Button variant="outline" asChild>
          <Link href={`/app/${condoSlug}/residents`}>Voltar</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader
        title="Novo morador"
        description="Cadastre um morador vinculado a uma unidade."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do morador</CardTitle>
        </CardHeader>
        <CardContent>
          <ResidentForm
            condoSlug={condoSlug}
            units={unitsResult.data}
            mode="create"
            defaultValues={{ unitId: preselectedUnitId }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
