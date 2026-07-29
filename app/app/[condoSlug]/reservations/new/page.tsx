import { redirect } from "next/navigation";
import { requireCondoAccess } from "@/lib/auth/access";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { loadGeneralCondoPanelData } from "@/lib/condominiums/general-condo-data";
import { listCommonAreasByCondominium, listReservableCommonAreasForContext } from "@/lib/services/common-areas";
import { ROLES } from "@/lib/constants";
import { canCreateReservations } from "@/lib/reservations/create-permission";
import { listUnitsByCondominium } from "@/lib/services/units";
import {
  getReservationByIdForContext,
  listUnitIdsForProfile,
  profileOwnsReservationForReceipt,
} from "@/lib/services/reservations";
import { buildReservationAreaOptions } from "@/lib/reservations/form-areas";
import { canCancelReservation } from "@/lib/reservations/validate-booking";
import { getLocalDateKey, toDatetimeLocalValue } from "@/lib/reservations/timezone";
import { serviceOk } from "@/lib/services/types";
import { ErrorAlert } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/page-shell";
import { ReservationForm } from "@/components/reservations/reservation-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface NewReservationPageProps {
  params: Promise<{ condoSlug: string }>;
  searchParams: Promise<{ reagendar?: string }>;
}

export default async function NewReservationPage({ params, searchParams }: NewReservationPageProps) {
  const { condoSlug } = await params;
  const { reagendar: rescheduleFromId } = await searchParams;
  const access = await requireCondoAccess(condoSlug);

  if (!canCreateReservations(access)) {
    redirect(`/app/${condoSlug}/reservations`);
  }

  const isResidentRole = access.role === ROLES.RESIDENT;
  const isStaff =
    !isResidentRole &&
    (access.permissions.canApproveReservations ||
      access.permissions.canBookReservationsForCondo);
  const isGeneralCondo = isGeneralCondominium(condoSlug);
  const isDoorman = access.role === ROLES.DOORMAN;

  const bookingContext = {
    condominiumId: access.condominium.id,
    condominiumSlug: access.condominium.slug,
  };

  let rescheduleDefaults:
    | {
        reservationId: string;
        commonAreaId: string;
        unitId: string;
        reservationDate: string;
        startAtLocal: string;
        endAtLocal: string;
        guestCount: number | null;
        notes: string | null;
        previousStatus: string;
      }
    | undefined;

  if (rescheduleFromId) {
    const current = await getReservationByIdForContext(rescheduleFromId, bookingContext);

    if (!current.ok) {
      return (
        <div className="mx-auto max-w-lg space-y-4">
          <ErrorAlert message={current.error} />
          <Button variant="outline" asChild>
            <Link href={`/app/${condoSlug}/reservations`}>Voltar</Link>
          </Button>
        </div>
      );
    }

    if (!canCancelReservation(current.data.status)) {
      return (
        <div className="mx-auto max-w-lg space-y-4">
          <ErrorAlert message="Esta reserva não pode ser reagendada." />
          <Button variant="outline" asChild>
            <Link href={`/app/${condoSlug}/reservations/${rescheduleFromId}`}>Voltar</Link>
          </Button>
        </div>
      );
    }

    if (isResidentRole) {
      const ownership = await profileOwnsReservationForReceipt({
        profileId: access.profile.id,
        unitId: current.data.unit_id,
        requestedBy: current.data.requested_by,
      });

      if (!ownership.ok || !ownership.data) {
        return (
          <div className="mx-auto max-w-lg space-y-4">
            <ErrorAlert message="Você só pode reagendar as suas reservas." />
            <Button variant="outline" asChild>
              <Link href={`/app/${condoSlug}/reservations`}>Voltar</Link>
            </Button>
          </div>
        );
      }
    }

    rescheduleDefaults = {
      reservationId: current.data.id,
      commonAreaId: current.data.common_area_id,
      unitId: current.data.unit_id,
      reservationDate: getLocalDateKey(new Date(current.data.start_at)),
      startAtLocal: toDatetimeLocalValue(current.data.start_at),
      endAtLocal: toDatetimeLocalValue(current.data.end_at),
      guestCount: current.data.guest_count,
      notes: current.data.notes,
      previousStatus: current.data.status,
    };
  }

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
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader
          title={rescheduleDefaults ? "Reagendar reserva" : "Nova reserva"}
          description={
            rescheduleDefaults
              ? rescheduleDefaults.previousStatus === "approved"
                ? "Altere a data sem precisar enviar comprovante ou pedir nova autorização."
                : "Escolha a nova data. O andamento atual da reserva será mantido."
              : "Agende um espaço comum respeitando as regras configuradas."
          }
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
              reschedule={rescheduleDefaults}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const [areasResult, unitsResult, ownedUnitsResult] = await Promise.all([
    isDoorman
      ? listCommonAreasByCondominium(access.condominium.id, { isActive: true })
      : listReservableCommonAreasForContext(bookingContext, { isActive: true }),
    listUnitsByCondominium(access.condominium.id),
    isResidentRole
      ? listUnitIdsForProfile(access.profile.id, access.condominium.id)
      : Promise.resolve(serviceOk([] as string[])),
  ]);

  const areas = areasResult.ok ? areasResult.data : [];
  const areaOptions = await buildReservationAreaOptions(areas);
  let units = unitsResult.ok ? unitsResult.data : [];

  if (isResidentRole) {
    if (!ownedUnitsResult.ok) {
      return (
        <div className="mx-auto max-w-lg space-y-4">
          <ErrorAlert message={ownedUnitsResult.error} />
          <Button variant="outline" asChild>
            <Link href={`/app/${condoSlug}/reservations`}>Voltar</Link>
          </Button>
        </div>
      );
    }

    const owned = new Set(ownedUnitsResult.data);
    units = units.filter((unit) => owned.has(unit.id));

    if (units.length === 0) {
      return (
        <div className="mx-auto max-w-lg space-y-4">
          <ErrorAlert message="Nenhuma unidade vinculada ao seu cadastro neste condomínio." />
          <Button variant="outline" asChild>
            <Link href={`/app/${condoSlug}/reservations`}>Voltar</Link>
          </Button>
        </div>
      );
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={rescheduleDefaults ? "Reagendar reserva" : "Nova reserva"}
        description={
          rescheduleDefaults
            ? rescheduleDefaults.previousStatus === "approved"
              ? "Altere a data sem precisar enviar comprovante ou pedir nova autorização."
              : "Escolha a nova data. O andamento atual da reserva será mantido."
            : "Agende um espaço comum respeitando as regras configuradas."
        }
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
            reschedule={rescheduleDefaults}
          />
        </CardContent>
      </Card>
    </div>
  );
}
