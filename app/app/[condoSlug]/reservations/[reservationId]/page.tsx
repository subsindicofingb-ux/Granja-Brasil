import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCondoAccess } from "@/lib/auth/access";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { getGranjaCondominiumId } from "@/lib/condominiums/granja-shared-areas";
import {
  requiresGranjaPaymentReceipt,
} from "@/lib/reservations/area-rules";
import { canCancelReservation, canApproveReservation } from "@/lib/reservations/validate-booking";
import { getReservationByIdForContext, listUnitIdsForProfile } from "@/lib/services/reservations";
import { formatUnitWithTower } from "@/lib/residents/labels";
import { ErrorAlert } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/page-shell";
import { ReservationActions } from "@/components/reservations/reservation-actions";
import { ReservationReceiptUpload } from "@/components/reservations/reservation-receipt-upload";
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
  const result = await getReservationByIdForContext(reservationId, {
    condominiumId: access.condominium.id,
    condominiumSlug: access.condominium.slug,
  });

  if (!result.ok) {
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
  const granjaCondominiumId = await getGranjaCondominiumId();
  const paymentReceiptRequired = requiresGranjaPaymentReceipt({
    areaName: reservation.common_area.name,
    areaCondominiumId: reservation.common_area.condominium_id,
    granjaCondominiumId,
  });
  const isGranjaArea =
    Boolean(granjaCondominiumId) &&
    reservation.common_area.condominium_id === granjaCondominiumId;

  let canCancel = isStaff;
  let canUploadReceipt = false;

  if (!isStaff && access.permissions.canManageReservations) {
    const unitsResult = await listUnitIdsForProfile(
      access.profile.id,
      access.condominium.id,
    );
    const ownsReservation =
      unitsResult.ok && unitsResult.data.includes(reservation.unit_id);

    canCancel =
      ownsReservation && canCancelReservation(reservation.status);

    canUploadReceipt =
      ownsReservation &&
      reservation.status === "awaiting_receipt" &&
      paymentReceiptRequired;
  }

  const canApproveAsStaff =
    isStaff &&
    canApproveReservation(reservation.status) &&
    (!isGranjaArea || isGeneralCondominium(condoSlug)) &&
    (!paymentReceiptRequired || Boolean(reservation.payment_receipt_url));

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
          {reservation.guest_count != null && (
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
              <span className="text-muted-foreground">Convidados</span>
              <span className="font-medium">{reservation.guest_count}</span>
            </div>
          )}
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
          {reservation.payment_receipt_url && (
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
              <span className="text-muted-foreground">Recibo</span>
              <a
                href={reservation.payment_receipt_url}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary hover:underline"
              >
                Ver comprovante
              </a>
            </div>
          )}
          {reservation.status === "awaiting_receipt" && paymentReceiptRequired && (
            <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-blue-900">
              Pré-cadastro realizado. Envie o recibo de pagamento para que o administrador da
              Granja possa autorizar o uso da churrasqueira.
            </p>
          )}
          {reservation.status === "pending" && paymentReceiptRequired && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
              Recibo recebido. Aguardando autorização do administrador da Granja.
            </p>
          )}
          {reservation.common_area.requires_approval &&
            reservation.status === "pending" &&
            !paymentReceiptRequired && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
              Esta reserva aguarda aprovação do síndico ou administrador.
            </p>
          )}
        </CardContent>
      </Card>

      {canUploadReceipt && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Enviar recibo de pagamento</CardTitle>
          </CardHeader>
          <CardContent>
            <ReservationReceiptUpload condoSlug={condoSlug} reservationId={reservation.id} />
          </CardContent>
        </Card>
      )}

      <ReservationActions
        condoSlug={condoSlug}
        reservation={reservation}
        canApprove={canApproveAsStaff}
        canCancel={canCancel}
      />
    </div>
  );
}
