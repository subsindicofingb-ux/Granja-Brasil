import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { requireCondoPermission } from "@/lib/auth/access";
import { getUnitListFilterForAccess, unitFilterToQueryOptions } from "@/lib/auth/unit-scope";
import {
  formatCondominiumDisplayName,
  isGeneralCondominium,
} from "@/lib/condominiums/display";
import { getGranjaChildCondominiumIds } from "@/lib/condominiums/granja-scope";
import { resolveDoormanOperationalPanel, getOperationalCondominiumIds } from "@/lib/condominiums/doorman-panel";
import { formatUnitWithTower } from "@/lib/residents/labels";
import { searchVehiclesForConsult, listPendingVehiclesForConsult } from "@/lib/services/vehicles";
import { formatLicensePlate, getVehicleStatusBadgeClass, VEHICLE_STATUS_LABELS } from "@/lib/vehicles/labels";
import { VEHICLE_STATUS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { VehiclePlateSearch } from "@/components/vehicles/vehicle-plate-search";
import { ErrorAlert } from "@/components/shared/feedback";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState, PageHeader } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";

interface VehiclesConsultPageProps {
  params: Promise<{ condoSlug: string }>;
  searchParams: Promise<{ plate?: string; status?: string }>;
}

async function ConsultContent({
  condoSlug,
  plate,
  status,
}: {
  condoSlug: string;
  plate?: string;
  status?: string;
}) {
  const access = await requireCondoPermission(
    condoSlug,
    (ctx) =>
      ctx.permissions.canManageVehicles ||
      ctx.permissions.canViewUnitVehicles ||
      ctx.permissions.canConsultVehicles,
  );
  const isGeneralCondoPage = isGeneralCondominium(condoSlug);
  const panelResult = !isGeneralCondoPage ? await resolveDoormanOperationalPanel(condoSlug) : null;
  const isBlockSource = panelResult?.ok && panelResult.data.mode === "block";
  const blockCondominiumIds =
    isBlockSource && panelResult?.ok
      ? getOperationalCondominiumIds(panelResult.data, access.condominium.id)
      : null;
  const granjaChildIdsResult = isGeneralCondoPage ? await getGranjaChildCondominiumIds() : null;
  const searchCondominiumIds =
    blockCondominiumIds ?? (granjaChildIdsResult?.ok ? granjaChildIdsResult.data : undefined);
  const includeUnapproved =
    isGeneralCondoPage &&
    (access.permissions.canManageVehicles || access.permissions.canConsultVehicles);
  const isPendingView =
    includeUnapproved && status === VEHICLE_STATUS.PENDING;
  const unitQuery = unitFilterToQueryOptions(await getUnitListFilterForAccess(access));
  const normalizedPlate = plate?.trim() ?? "";

  if (unitQuery === "none" && !access.permissions.canManageVehicles && !access.permissions.canConsultVehicles) {
    return (
      <EmptyState
        title="Unidade não vinculada"
        description="Seu cadastro ainda não está vinculado a uma unidade neste condomínio."
      />
    );
  }

  const vehiclesResult = normalizedPlate
    ? await searchVehiclesForConsult({
        condominiumId:
          isGeneralCondoPage || blockCondominiumIds
            ? undefined
            : access.condominium.id,
        condominiumIds: searchCondominiumIds,
        plate: normalizedPlate,
        includeUnapproved,
        ...(unitQuery === "none"
          ? {}
          : unitQuery.unitId
            ? { unitId: unitQuery.unitId }
            : unitQuery.unitIds
              ? { unitIds: unitQuery.unitIds }
              : {}),
      })
    : isPendingView
      ? await listPendingVehiclesForConsult()
      : { ok: true as const, data: [] };

  if (!vehiclesResult.ok) {
    return <ErrorAlert message={vehiclesResult.error} title="Erro na consulta" />;
  }

  const vehicles = vehiclesResult.data;
  const showPendingList = isPendingView && !normalizedPlate;

  return (
    <div className="space-y-4">
      {includeUnapproved && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {showPendingList
            ? "Veículos aguardando aprovação do síndico, com condomínio e unidade de origem."
            : "A consulta da Granja inclui veículos pendentes de aprovação do síndico."}
        </p>
      )}

      <VehiclePlateSearch plate={normalizedPlate} status={showPendingList ? status : undefined} />

      {showPendingList && vehicles.length === 0 ? (
        <EmptyState
          title="Nenhum veículo aguardando aprovação"
          description="Não há solicitações pendentes nos condomínios no momento."
        />
      ) : showPendingList ? (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Placa</th>
                <th className="px-4 py-3 text-left font-medium">Veículo</th>
                <th className="px-4 py-3 text-left font-medium">Condomínio</th>
                <th className="px-4 py-3 text-left font-medium">Unidade</th>
                <th className="px-4 py-3 text-left font-medium">Responsável</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle) => (
                <tr key={vehicle.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">
                    {formatLicensePlate(vehicle.license_plate)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {vehicle.photo_url ? (
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border bg-muted">
                          <Image
                            src={vehicle.photo_url}
                            alt={`${vehicle.brand} ${vehicle.model}`}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      ) : null}
                      <div>
                        <div className="font-medium">
                          {vehicle.brand} {vehicle.model}
                        </div>
                        {vehicle.tag_number && (
                          <div className="text-xs text-muted-foreground">
                            TAG: {vehicle.tag_number}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatCondominiumDisplayName(
                      vehicle.condominium.name,
                      vehicle.condominium.slug,
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatUnitWithTower(vehicle.unit)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {vehicle.resident?.full_name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      className={getVehicleStatusBadgeClass(
                        vehicle.status ?? VEHICLE_STATUS.APPROVED,
                      )}
                    >
                      {VEHICLE_STATUS_LABELS[vehicle.status ?? VEHICLE_STATUS.APPROVED]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/app/${condoSlug}/vehicles/${vehicle.id}`}>
                        Ver cadastro
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !normalizedPlate ? (
        <EmptyState
          title="Informe a placa do veículo"
          description="Digite a placa para localizar rapidamente a unidade e o responsável cadastrado."
        />
      ) : vehicles.length === 0 ? (
        <EmptyState
          title="Nenhum veículo encontrado"
          description={`Não há cadastro com a placa "${formatLicensePlate(normalizedPlate)}".`}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Placa</th>
                <th className="px-4 py-3 text-left font-medium">Veículo</th>
                <th className="px-4 py-3 text-left font-medium">Unidade</th>
                <th className="px-4 py-3 text-left font-medium">Responsável</th>
                {includeUnapproved && (
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                )}
                {isGeneralCondoPage || isBlockSource ? (
                  <th className="px-4 py-3 text-left font-medium">Condomínio</th>
                ) : null}
                <th className="px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle) => (
                <tr key={vehicle.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">
                    {formatLicensePlate(vehicle.license_plate)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {vehicle.photo_url ? (
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border bg-muted">
                          <Image
                            src={vehicle.photo_url}
                            alt={`${vehicle.brand} ${vehicle.model}`}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      ) : null}
                      <div>
                        <div className="font-medium">
                          {vehicle.brand} {vehicle.model}
                        </div>
                        {vehicle.tag_number && (
                          <div className="text-xs text-muted-foreground">
                            TAG: {vehicle.tag_number}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatUnitWithTower(vehicle.unit)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {vehicle.resident?.full_name ?? "—"}
                  </td>
                  {includeUnapproved && (
                    <td className="px-4 py-3">
                      <Badge
                        className={getVehicleStatusBadgeClass(
                          vehicle.status ?? VEHICLE_STATUS.APPROVED,
                        )}
                      >
                        {VEHICLE_STATUS_LABELS[vehicle.status ?? VEHICLE_STATUS.APPROVED]}
                      </Badge>
                    </td>
                  )}
                  {isGeneralCondoPage || isBlockSource ? (
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatCondominiumDisplayName(
                        vehicle.condominium.name,
                        vehicle.condominium.slug,
                      )}
                    </td>
                  ) : null}
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/app/${condoSlug}/vehicles/${vehicle.id}`}>
                        {access.permissions.canManageVehicles ? "Ver cadastro" : "Detalhes"}
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default async function VehiclesConsultPage({
  params,
  searchParams,
}: VehiclesConsultPageProps) {
  const { condoSlug } = await params;
  const { plate, status } = await searchParams;
  const isPendingView = status === VEHICLE_STATUS.PENDING;

  return (
    <div className="space-y-6">
      <PageHeader
        title={isPendingView ? "Veículos aguardando aprovação" : "Consulta por placa"}
        description={
          isPendingView
            ? "Pendências de cadastro por condomínio e unidade."
            : "Localize rapidamente o responsável pelo veículo cadastrado."
        }
        action={
          <Button variant="outline" asChild>
            <Link href={`/app/${condoSlug}/vehicles`}>Lista de veículos</Link>
          </Button>
        }
      />

      <Suspense fallback={<TableSkeleton rows={4} cols={5} />}>
        <ConsultContent
          condoSlug={condoSlug}
          plate={plate?.trim() || undefined}
          status={status}
        />
      </Suspense>
    </div>
  );
}
