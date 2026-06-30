import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCondoAccess } from "@/lib/auth/access";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { ROLES } from "@/lib/constants";
import { loadGeneralCondoPanelData } from "@/lib/condominiums/general-condo-data";
import { getResidentById } from "@/lib/services/residents";
import { listUnitsByCondominium } from "@/lib/services/units";
import {
  getResidentAccessDeviceIds,
  listActiveAccessDevicesForCondominium,
  listResidentAccessGrants,
} from "@/lib/services/resident-access-grants";
import { getResidentTypeLabel, formatUnitOptionLabel } from "@/lib/residents/labels";
import { ErrorAlert } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/page-shell";
import { ResidentForm } from "@/components/residents/resident-form";
import { ResidentDeleteButton } from "@/components/residents/resident-delete-button";
import { ResidentAccessDeviceSummary } from "@/components/access-devices/resident-access-device-fields";
import { ResidentAccessSyncButton } from "@/components/access-devices/resident-access-sync-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ResidentDetailPageProps {
  params: Promise<{ condoSlug: string; residentId: string }>;
}

export default async function ResidentDetailPage({ params }: ResidentDetailPageProps) {
  const { condoSlug, residentId } = await params;
  const access = await requireCondoAccess(condoSlug);
  const isGeneralCondo = isGeneralCondominium(condoSlug);
  const scopeCondominiumId = isGeneralCondo ? undefined : access.condominium.id;

  const residentResult = await getResidentById(residentId, {
    condominiumId: scopeCondominiumId,
  });

  if (!residentResult.ok) {
    if (residentResult.error.includes("não encontrado")) {
      notFound();
    }
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <ErrorAlert message={residentResult.error} />
        <Button variant="outline" asChild>
          <Link href={`/app/${condoSlug}/residents`}>Voltar</Link>
        </Button>
      </div>
    );
  }

  const unitsResult = isGeneralCondo
    ? await loadGeneralCondoPanelData()
    : await listUnitsByCondominium(access.condominium.id).then((result) =>
        result.ok
          ? {
              ok: true as const,
              data: {
                units: result.data,
                condominiumNamesById: {} as Record<string, string>,
              },
            }
          : result,
      );

  if (!unitsResult.ok) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <ErrorAlert message={unitsResult.error} title="Erro ao carregar unidades" />
        <Button variant="outline" asChild>
          <Link href={`/app/${condoSlug}/residents`}>Voltar</Link>
        </Button>
      </div>
    );
  }

  const resident = residentResult.data;
  const residentCondominiumId = resident.unit.tower.condominium_id;
  const [accessDevicesResult, accessGrantsResult, residentAccessDeviceIdsResult] = await Promise.all([
    listActiveAccessDevicesForCondominium(residentCondominiumId),
    listResidentAccessGrants(resident.id),
    getResidentAccessDeviceIds(resident.id),
  ]);
  const accessDevices = accessDevicesResult.ok ? accessDevicesResult.data : [];
  const accessGrants = accessGrantsResult.ok ? accessGrantsResult.data : [];
  const defaultAccessDeviceIds = residentAccessDeviceIdsResult.ok
    ? residentAccessDeviceIdsResult.data
    : [];
  const canEdit = access.permissions.canManageResidents;
  const canDelete =
    canEdit && (access.role === ROLES.SYNDIC || access.role === ROLES.SUPER_ADMIN);
  const units = "units" in unitsResult.data ? unitsResult.data.units : [];
  const condominiumNamesById =
    "condominiumNamesById" in unitsResult.data ? unitsResult.data.condominiumNamesById : {};

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader
        title={resident.full_name}
        description={canEdit ? "Edite os dados do morador." : "Detalhes do morador."}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {canEdit ? "Editar morador" : "Informações"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {canEdit ? (
            <div className="space-y-6">
              <ResidentForm
                condoSlug={condoSlug}
                units={units}
                condominiumNamesById={condominiumNamesById}
                mode="edit"
                accessDevices={accessDevices}
                defaultAccessDeviceIds={defaultAccessDeviceIds}
                defaultValues={{
                  residentId: resident.id,
                  unitId: resident.unit_id,
                  fullName: resident.full_name,
                  email: resident.email,
                  phone: resident.phone,
                  photoUrl: resident.photo_url,
                  type: resident.type,
                }}
              />
              {canDelete && (
                <ResidentDeleteButton
                  condoSlug={condoSlug}
                  residentId={resident.id}
                  residentName={resident.full_name}
                />
              )}

              {accessGrants.length > 0 && (
                <div className="space-y-3 border-t pt-4">
                  <div>
                    <p className="text-sm font-medium">Locais vinculados</p>
                    <p className="text-xs text-muted-foreground">
                      Status da sincronização com os equipamentos ControlID.
                    </p>
                  </div>
                  <ResidentAccessDeviceSummary grants={accessGrants} />
                  <ResidentAccessSyncButton
                    condoSlug={condoSlug}
                    residentId={resident.id}
                    hasAccessGrants={accessGrants.length > 0}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Unidade</span>
                <span className="text-right font-medium">
                  {formatUnitOptionLabel(resident.unit, condominiumNamesById)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipo</span>
                <Badge className="border bg-background">
                  {getResidentTypeLabel(resident.type)}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">E-mail</span>
                <span className="font-medium">{resident.email ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Telefone</span>
                <span className="font-medium">{resident.phone ?? "—"}</span>
              </div>
              {resident.profile_id && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Conta vinculada</span>
                  <span className="font-medium text-green-700">Sim</span>
                </div>
              )}
              <div className="border-t pt-3">
                <p className="mb-2 text-muted-foreground">Locais de acesso</p>
                <ResidentAccessDeviceSummary grants={accessGrants} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Button variant="outline" asChild>
        <Link href={`/app/${condoSlug}/residents`}>Voltar</Link>
      </Button>
    </div>
  );
}
