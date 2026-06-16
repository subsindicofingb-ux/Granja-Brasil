import { redirect } from "next/navigation";
import { requireCondoAccess } from "@/lib/auth/access";
import { listCommonAreasByCondominium } from "@/lib/services/common-areas";
import { listUnitsByCondominium } from "@/lib/services/units";
import { listUnitIdsForProfile } from "@/lib/services/reservations";
import { serviceOk } from "@/lib/services/types";
import { PageHeader } from "@/components/shared/page-shell";
import { ReservationForm } from "@/components/reservations/reservation-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

  const [areasResult, unitsResult, ownedUnitsResult] = await Promise.all([
    listCommonAreasByCondominium(access.condominium.id, { isActive: true }),
    listUnitsByCondominium(access.condominium.id),
    isStaff
      ? Promise.resolve(serviceOk([] as string[]))
      : listUnitIdsForProfile(access.profile.id, access.condominium.id),
  ]);

  const areas = areasResult.ok ? areasResult.data : [];
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
          <ReservationForm condoSlug={condoSlug} areas={areas} units={units} />
        </CardContent>
      </Card>
    </div>
  );
}
