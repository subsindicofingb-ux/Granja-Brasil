import Link from "next/link";
import { Plus } from "lucide-react";
import { RESIDENT_TYPES } from "@/lib/constants";
import type { RolePermissions } from "@/lib/auth/roles";
import { getResidentTypeLabel } from "@/lib/residents/labels";
import { listResidentsByCondominium } from "@/lib/services/residents";
import { listVehiclesByCondominium } from "@/lib/services/vehicles";
import { listVisitorAuthorizationsByUnit } from "@/lib/services/visitor-authorizations";
import { getGuestTypeLabel } from "@/lib/visitor-authorizations/labels";
import {
  formatLicensePlate,
  formatVehicleSummary,
  getVehicleStatusBadgeClass,
  VEHICLE_STATUS_LABELS,
} from "@/lib/vehicles/labels";
import type { UnitWithTower } from "@/lib/services/units";
import type { ResidentType } from "@/lib/constants";
import { VisitorDisplayStatusBadge } from "@/components/visitors/visitor-display-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/page-shell";
import { formatDateTime } from "@/lib/utils";

const RESIDENT_SECTION_ORDER: ResidentType[] = [
  RESIDENT_TYPES.OWNER,
  RESIDENT_TYPES.TENANT,
  RESIDENT_TYPES.DEPENDENT,
  RESIDENT_TYPES.RESPONSIBLE,
];

interface UnitLinkedContentsProps {
  condoSlug: string;
  unit: UnitWithTower;
  permissions: RolePermissions;
}

export async function UnitLinkedContents({
  condoSlug,
  unit,
  permissions,
}: UnitLinkedContentsProps) {
  const unitCondominiumId = unit.tower.condominium_id;
  const canViewResidents =
    permissions.canManageResidents || permissions.canConsultResidents;
  const canViewVisitors = permissions.canViewVisitorAuthorizations;
  const canViewVehicles =
    permissions.canManageVehicles ||
    permissions.canViewUnitVehicles ||
    permissions.canConsultVehicles;

  const [residentsResult, visitorsResult, vehiclesResult] = await Promise.all([
    canViewResidents ? listResidentsByCondominium({ unitId: unit.id }) : Promise.resolve(null),
    canViewVisitors
      ? listVisitorAuthorizationsByUnit(unit.id, unitCondominiumId)
      : Promise.resolve(null),
    canViewVehicles
      ? listVehiclesByCondominium(unitCondominiumId, { unitId: unit.id })
      : Promise.resolve(null),
  ]);

  const residents = residentsResult?.ok ? residentsResult.data : [];
  const visitors = visitorsResult?.ok ? visitorsResult.data : [];
  const vehicles = vehiclesResult?.ok ? vehiclesResult.data : [];

  return (
    <div className="space-y-6">
      {canViewResidents && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle className="text-base">Moradores e proprietários</CardTitle>
            {permissions.canManageResidents && (
              <Button size="sm" asChild>
                <Link href={`/app/${condoSlug}/residents/new?unit=${unit.id}`}>
                  <Plus className="h-4 w-4" />
                  Novo
                </Link>
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-5">
            {residents.length === 0 ? (
              <EmptyState
                title="Nenhum morador nesta unidade"
                description="Cadastre proprietários, inquilinos ou moradores vinculados a esta unidade."
                action={
                  permissions.canManageResidents ? (
                    <Button asChild>
                      <Link href={`/app/${condoSlug}/residents/new?unit=${unit.id}`}>
                        Novo morador
                      </Link>
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Nome</th>
                      <th className="px-3 py-2 text-left font-medium">Tipo</th>
                      <th className="px-3 py-2 text-left font-medium">Contato</th>
                      <th className="px-3 py-2 text-right font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {residents
                      .slice()
                      .sort(
                        (left, right) =>
                          RESIDENT_SECTION_ORDER.indexOf(left.type) -
                          RESIDENT_SECTION_ORDER.indexOf(right.type),
                      )
                      .map((resident) => (
                        <tr key={resident.id} className="border-b last:border-0">
                          <td className="px-3 py-2 font-medium">{resident.full_name}</td>
                          <td className="px-3 py-2">
                            <Badge className="border bg-background">
                              {getResidentTypeLabel(resident.type)}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {resident.email ?? resident.phone ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/app/${condoSlug}/residents/${resident.id}`}>
                                {permissions.canManageResidents ? "Editar" : "Detalhes"}
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {canViewVisitors && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle className="text-base">Visitantes e prestadores</CardTitle>
            {permissions.canRegisterVisitorAuthorizations && (
              <Button size="sm" asChild>
                <Link href={`/app/${condoSlug}/visitors/new?unit=${unit.id}`}>
                  <Plus className="h-4 w-4" />
                  Nova autorização
                </Link>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {visitors.length === 0 ? (
              <EmptyState
                title="Nenhuma autorização nesta unidade"
                description="Registre visitantes ou prestadores de serviço para esta unidade."
                action={
                  permissions.canRegisterVisitorAuthorizations ? (
                    <Button asChild>
                      <Link href={`/app/${condoSlug}/visitors/new?unit=${unit.id}`}>
                        Nova autorização
                      </Link>
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Nome</th>
                      <th className="px-3 py-2 text-left font-medium">Período</th>
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                      <th className="px-3 py-2 text-right font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visitors.map((authorization) => (
                      <tr key={authorization.id} className="border-b last:border-0">
                        <td className="px-3 py-2">
                          <div className="font-medium">{authorization.full_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {getGuestTypeLabel(authorization.guest_type)}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          <div>{formatDateTime(authorization.access_starts_at)}</div>
                          <div className="text-xs">
                            até {formatDateTime(authorization.access_ends_at)}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <VisitorDisplayStatusBadge record={authorization} />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/app/${condoSlug}/visitors/${authorization.id}`}>
                              {permissions.canManageVisitorAuthorizations ? "Editar" : "Ver"}
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {canViewVehicles && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle className="text-base">Veículos</CardTitle>
            {(permissions.canManageVehicles || permissions.canRegisterUnitVehicles) && (
              <Button size="sm" asChild>
                <Link href={`/app/${condoSlug}/vehicles/new?unit=${unit.id}`}>
                  <Plus className="h-4 w-4" />
                  Novo veículo
                </Link>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {vehicles.length === 0 ? (
              <EmptyState
                title="Nenhum veículo nesta unidade"
                description="Cadastre veículos vinculados a esta unidade."
                action={
                  permissions.canManageVehicles || permissions.canRegisterUnitVehicles ? (
                    <Button asChild>
                      <Link href={`/app/${condoSlug}/vehicles/new?unit=${unit.id}`}>
                        Novo veículo
                      </Link>
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Veículo</th>
                      <th className="px-3 py-2 text-left font-medium">Placa</th>
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                      <th className="px-3 py-2 text-right font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicles.map((vehicle) => (
                      <tr key={vehicle.id} className="border-b last:border-0">
                        <td className="px-3 py-2 font-medium">
                          {formatVehicleSummary(vehicle)}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {formatLicensePlate(vehicle.license_plate)}
                        </td>
                        <td className="px-3 py-2">
                          <Badge className={getVehicleStatusBadgeClass(vehicle.status)}>
                            {VEHICLE_STATUS_LABELS[vehicle.status]}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/app/${condoSlug}/vehicles/${vehicle.id}`}>
                              {permissions.canManageVehicles ? "Editar" : "Detalhes"}
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
