import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { requireCondoAccess } from "@/lib/auth/access";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { loadGeneralCondoPanelData } from "@/lib/condominiums/general-condo-data";
import { getVehicleById } from "@/lib/services/vehicles";
import { listResidentsByCondominium } from "@/lib/services/residents";
import { listUnitsByCondominium } from "@/lib/services/units";
import { formatUnitOptionLabel } from "@/lib/residents/labels";
import {
  formatLicensePlate,
  getVehicleStatusBadgeClass,
  VEHICLE_STATUS_LABELS,
} from "@/lib/vehicles/labels";
import { VEHICLE_STATUS } from "@/lib/constants";
import { VehicleReviewActions } from "@/components/vehicles/vehicle-review-actions";
import { Badge } from "@/components/ui/badge";
import { ErrorAlert } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/page-shell";
import { VehicleForm } from "@/components/vehicles/vehicle-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface VehicleDetailPageProps {
  params: Promise<{ condoSlug: string; vehicleId: string }>;
  searchParams: Promise<{ submitted?: string }>;
}

export default async function VehicleDetailPage({ params, searchParams }: VehicleDetailPageProps) {
  const { condoSlug, vehicleId } = await params;
  const { submitted } = await searchParams;
  const access = await requireCondoAccess(condoSlug);
  const isGeneralCondo = isGeneralCondominium(condoSlug);
  const scopeCondominiumId = isGeneralCondo ? undefined : access.condominium.id;

  const vehicleResult = await getVehicleById(vehicleId, {
    condominiumId: scopeCondominiumId,
  });

  if (!vehicleResult.ok) {
    if (vehicleResult.error.includes("não encontrado")) {
      notFound();
    }
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <ErrorAlert message={vehicleResult.error} />
        <Button variant="outline" asChild>
          <Link href={`/app/${condoSlug}/vehicles`}>Voltar</Link>
        </Button>
      </div>
    );
  }

  const [unitsResult, residentsResult] = await Promise.all([
    isGeneralCondo
      ? loadGeneralCondoPanelData()
      : listUnitsByCondominium(access.condominium.id).then((result) =>
          result.ok
            ? {
                ok: true as const,
                data: {
                  units: result.data,
                  condominiumNamesById: {} as Record<string, string>,
                },
              }
            : result,
        ),
    isGeneralCondo
      ? listResidentsByCondominium()
      : listResidentsByCondominium({ condominiumId: access.condominium.id }),
  ]);

  if (!unitsResult.ok || !residentsResult.ok) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <ErrorAlert message="Erro ao carregar dados auxiliares." />
        <Button variant="outline" asChild>
          <Link href={`/app/${condoSlug}/vehicles`}>Voltar</Link>
        </Button>
      </div>
    );
  }

  const vehicle = vehicleResult.data;
  const canEdit = access.permissions.canManageVehicles;
  const units = "units" in unitsResult.data ? unitsResult.data.units : [];
  const condominiumNamesById =
    "condominiumNamesById" in unitsResult.data ? unitsResult.data.condominiumNamesById : {};

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader
        title={`${vehicle.brand} ${vehicle.model}`}
        description={canEdit ? "Edite os dados do veículo." : "Detalhes do veículo."}
      />

      {submitted === "1" && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Veículo enviado para aprovação do síndico. Você será avisado quando for validado.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {canEdit ? "Editar veículo" : "Informações"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {canEdit ? (
            <VehicleForm
              condoSlug={condoSlug}
              units={units}
              residents={residentsResult.data}
              condominiumNamesById={condominiumNamesById}
              mode="edit"
              defaultValues={{
                vehicleId: vehicle.id,
                unitId: vehicle.unit_id,
                residentId: vehicle.resident_id,
                brand: vehicle.brand,
                model: vehicle.model,
                color: vehicle.color,
                licensePlate: vehicle.license_plate,
                tagNumber: vehicle.tag_number,
                photoUrl: vehicle.photo_url,
              }}
            />
          ) : (
            <div className="space-y-4 text-sm">
              {vehicle.photo_url ? (
                <div className="relative h-40 w-full overflow-hidden rounded-lg border bg-muted">
                  <Image
                    src={vehicle.photo_url}
                    alt={`${vehicle.brand} ${vehicle.model}`}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ) : null}
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Status</span>
                <Badge
                  className={getVehicleStatusBadgeClass(
                    vehicle.status ?? VEHICLE_STATUS.APPROVED,
                  )}
                >
                  {VEHICLE_STATUS_LABELS[vehicle.status ?? VEHICLE_STATUS.APPROVED]}
                </Badge>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Placa</span>
                <span className="font-medium">{formatLicensePlate(vehicle.license_plate)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">TAG</span>
                <span className="font-medium">{vehicle.tag_number ?? "—"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Unidade</span>
                <span className="text-right font-medium">
                  {formatUnitOptionLabel(vehicle.unit, condominiumNamesById)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Morador</span>
                <span className="font-medium">{vehicle.resident?.full_name ?? "—"}</span>
              </div>
            </div>
          )}

          {canEdit && <VehicleReviewActions condoSlug={condoSlug} vehicle={vehicle} />}
        </CardContent>
      </Card>

      <Button variant="outline" asChild>
        <Link href={`/app/${condoSlug}/vehicles`}>Voltar</Link>
      </Button>
    </div>
  );
}
