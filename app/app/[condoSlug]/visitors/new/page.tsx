import { redirect } from "next/navigation";
import { requireCondoAccess } from "@/lib/auth/access";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { loadGeneralCondoPanelData } from "@/lib/condominiums/general-condo-data";
import { listUnitsByCondominium } from "@/lib/services/units";
import {
  listActiveAccessDevicesForCondominium,
  loadActiveAccessDevicesByCondominiumIds,
} from "@/lib/services/resident-access-grants";
import { listUnitIdsForVisitorRegistration } from "@/lib/services/visitor-access-grants";
import { serviceOk } from "@/lib/services/types";
import { DEFAULT_VISITOR_AUTHORIZATION_FORM } from "@/lib/visitor-authorizations/defaults";
import { ErrorAlert } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/page-shell";
import { VisitorAuthorizationForm } from "@/components/visitors/visitor-authorization-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface NewVisitorPageProps {
  params: Promise<{ condoSlug: string }>;
}

export default async function NewVisitorPage({ params }: NewVisitorPageProps) {
  const { condoSlug } = await params;
  const access = await requireCondoAccess(condoSlug);

  if (!access.permissions.canRegisterVisitorAuthorizations) {
    redirect(`/app/${condoSlug}/visitors`);
  }

  const isStaff = access.permissions.canManageVisitorAuthorizations;
  const isGeneralCondo = isGeneralCondominium(condoSlug);

  if (isGeneralCondo && isStaff) {
    const panelResult = await loadGeneralCondoPanelData();

    if (!panelResult.ok) {
      return (
        <div className="mx-auto max-w-lg space-y-4">
          <ErrorAlert message={panelResult.error} />
          <Button variant="outline" asChild>
            <Link href={`/app/${condoSlug}/visitors`}>Voltar</Link>
          </Button>
        </div>
      );
    }

    const condominiumIds = [
      ...new Set(panelResult.data.units.map((unit) => unit.tower.condominium_id)),
    ];
    const devicesResult = await loadActiveAccessDevicesByCondominiumIds(condominiumIds);
    const accessDevices = devicesResult.ok
      ? Object.values(devicesResult.data).flat()
      : [];

    return (
      <div className="mx-auto max-w-lg space-y-6">
        <PageHeader
          title="Nova autorização"
          description="Registro imediato como aprovado (staff)."
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados do visitante / prestador</CardTitle>
          </CardHeader>
          <CardContent>
            <VisitorAuthorizationForm
              condoSlug={condoSlug}
              mode="create"
              units={panelResult.data.units}
              condominiumNamesById={panelResult.data.condominiumNamesById}
              accessDevices={accessDevices}
              defaultValues={DEFAULT_VISITOR_AUTHORIZATION_FORM}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const [unitsResult, ownedUnitsResult, devicesResult] = await Promise.all([
    listUnitsByCondominium(access.condominium.id),
    isStaff
      ? Promise.resolve(serviceOk([] as string[]))
      : listUnitIdsForVisitorRegistration(access.profile.id, access.condominium.id),
    listActiveAccessDevicesForCondominium(access.condominium.id),
  ]);

  let units = unitsResult.ok ? unitsResult.data : [];

  if (!isStaff && ownedUnitsResult.ok) {
    const owned = new Set(ownedUnitsResult.data);
    units = units.filter((unit) => owned.has(unit.id));
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader
        title="Nova autorização"
        description={
          isStaff
            ? "Registro imediato como aprovado (staff)."
            : "Solicitação enviada para aprovação do síndico."
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do visitante / prestador</CardTitle>
        </CardHeader>
        <CardContent>
          <VisitorAuthorizationForm
            condoSlug={condoSlug}
            mode="create"
            units={units}
            accessDevices={devicesResult.ok ? devicesResult.data : []}
            defaultValues={DEFAULT_VISITOR_AUTHORIZATION_FORM}
          />
        </CardContent>
      </Card>
    </div>
  );
}
