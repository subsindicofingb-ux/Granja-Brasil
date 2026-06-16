import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCondoAccess } from "@/lib/auth/access";
import { getReservationById, listUnitIdsForProfile } from "@/lib/services/reservations";
import { formatUnitWithTower } from "@/lib/residents/labels";
import {
  canCancelReservation,
} from "@/lib/reservations/validate-booking";
import { ErrorAlert } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/page-shell";
import { ReservationActions } from "@/components/reservations/reservation-actions";
import { ReservationStatusBadge } from "@/components/reservations/reservation-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

interface ReservationDetailPageProps {
  params: Promise<{ condoSlug: string; reservationId: string }>;
}

export default async function ReservationDetailPage({ params }: ReservationDetailPageProps) {
  const { condoSlug, reservationId } = await params;
  const access = await requireCondoAccess(condoSlug);
  const result = await getReservationById(reservationId, access.condominium.id);

  if (result.error) {
    if (result.error.includes("não encontrada")) {
      notFound();
    }
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <ErrorAlert message={result.error} />
        <Button variant="outline" asChild>
          <Link href={`/app/${condoSlug}/reservations`}>Voltar</Link>
        </Button>
      </div>
    );
  }

  const reservation = result.data;
  const isStaff = access.permissions.canApproveReservations;

  let canCancel = isStaff;

  if (!isStaff && access.permissions.canManageReservations) {
    const unitsResult = await listUnitIdsForProfile(
      access.profile.id,
      access.condominium.id,
    );
    canCancel =
      !unitsResult.error &&
      unitsResult.data.includes(reservation.unit_id) &&
      canCancelReservation(reservation.status);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Detalhes da reserva"
        description={reservation.common_area.name}
        action={<ReservationStatusBadge status={reservation.status} />}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
            <span className="text-muted-foreground">Espaço</span>
            <span className="font-medium">{reservation.common_area.name}</span>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
            <span className="text-muted-foreground">Unidade</span>
            <span className="font-medium">{formatUnitWithTower(reservation.unit)}</span>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
            <span className="text-muted-foreground">Início</span>
            <span className="font-medium">{formatDateTime(reservation.start_at)}</span>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
            <span className="text-muted-foreground">Fim</span>
            <span className="font-medium">{formatDateTime(reservation.end_at)}</span>
          </div>
          {reservation.requester && (
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
              <span className="text-muted-foreground">Solicitante</span>
              <span className="font-medium">{reservation.requester.full_name}</span>
            </div>
          )}
          <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
            <span className="text-muted-foreground">Observações</span>
            <span className="font-medium">{reservation.notes ?? "—"}</span>
          </div>
          {reservation.common_area.requires_approval && reservation.status === "pending" && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
              Esta reserva aguarda aprovação do síndico ou administrador.
            </p>
          )}
        </CardContent>
      </Card>

      <ReservationActions
        condoSlug={condoSlug}
        reservation={reservation}
        canApprove={isStaff}
        canCancel={canCancel}
      />
    </div>
  );
}
