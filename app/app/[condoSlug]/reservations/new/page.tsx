import { redirect } from "next/navigation";
import { requireCondoAccess } from "@/lib/auth/access";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { loadGeneralCondoPanelData } from "@/lib/condominiums/general-condo-data";
import { listReservableCommonAreasForContext } from "@/lib/services/common-areas";
import { listUnitsByCondominium } from "@/lib/services/units";
import { listUnitIdsForProfile } from "@/lib/services/reservations";
import { buildReservationAreaOptions } from "@/lib/reservations/form-areas";
import { serviceOk } from "@/lib/services/types";
import { ErrorAlert } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/page-shell";
import { ReservationForm } from "@/components/reservations/reservation-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface NewReservationPageProps {
  params: Promise<{ condoSlug: string }>;
}

export default async function NewReservationPage({ params }: NewReservationPageProps) {
  const { condoSlug } = await params;
  const access = await requireCondoAccess(condoSlug);

  if (!access.permissions.canManageReservations) {
    redirect(`/app/${condoSlug}/reservations`);
  }

  const isStaff = access.permissions.canApproveReservations;
  const isGeneralCondo = isGeneralCondominium(condoSlug);

  const bookingContext = {
    condominiumId: access.condominium.id,
    condominiumSlug: access.condominium.slug,
  };

  if (isGeneralCondo && isStaff) {
    const [areasResult, panelResult] = await Promise.all([
      listReservableCommonAreasForContext(bookingContext, { isActive: true }),
      loadGeneralCondoPanelData(),
    ]);

    if (!panelResult.ok) {
      return (
        <div className="mx-auto max-w-lg space-y-4">
          <ErrorAlert message={panelResult.error} />
          <Button variant="outline" asChild>
            <Link href={`/app/${condoSlug}/reservations`}>Voltar</Link>
          </Button>
        </div>
      );
    }

    const areas = areasResult.ok ? areasResult.data : [];
    const areaOptions = await buildReservationAreaOptions(areas);

    return (
      <div className="mx-auto max-w-lg space-y-6">
        <PageHeader
          title="Nova reserva"
          description="Agende um espaço comum respeitando as regras configuradas."
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados da reserva</CardTitle>
          </CardHeader>
          <CardContent>
            <ReservationForm
              condoSlug={condoSlug}
              mode="staff"
              areas={areaOptions}
              units={panelResult.data.units}
              condominiumNamesById={panelResult.data.condominiumNamesById}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const [areasResult, unitsResult, ownedUnitsResult] = await Promise.all([
    listReservableCommonAreasForContext(bookingContext, { isActive: true }),
    listUnitsByCondominium(access.condominium.id),
    isStaff
      ? Promise.resolve(serviceOk([] as string[]))
      : listUnitIdsForProfile(access.profile.id, access.condominium.id),
  ]);

  const areas = areasResult.ok ? areasResult.data : [];
  const areaOptions = await buildReservationAreaOptions(areas);
  let units = unitsResult.ok ? unitsResult.data : [];

  if (!isStaff && ownedUnitsResult.ok) {
    const owned = new Set(ownedUnitsResult.data);
    units = units.filter((unit) => owned.has(unit.id));
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader
        title="Nova reserva"
        description="Agende um espaço comum respeitando as regras configuradas."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados da reserva</CardTitle>
        </CardHeader>
        <CardContent>
          <ReservationForm
            condoSlug={condoSlug}
            mode={isStaff ? "staff" : "resident"}
            areas={areaOptions}
            units={units}
          />
        </CardContent>
      </Card>
    </div>
  );
}
