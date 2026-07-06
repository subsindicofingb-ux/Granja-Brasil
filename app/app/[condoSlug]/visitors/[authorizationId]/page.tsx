import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCondoAccess } from "@/lib/auth/access";
import { ROLES } from "@/lib/constants";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { loadGeneralCondoPanelData } from "@/lib/condominiums/general-condo-data";
import { listUnitIdsForProfile } from "@/lib/services/reservations";
import { listUnitIdsForVisitorRegistration } from "@/lib/services/visitor-access-grants";
import {
  getVisitorAuthorizationAccessDeviceIds,
  listVisitorAccessGrants,
} from "@/lib/services/visitor-access-grants";
import { listActiveAccessDevicesForCondominium } from "@/lib/services/resident-access-grants";
import { getVisitorAuthorizationById } from "@/lib/services/visitor-authorizations";
import { listUnitsByCondominium } from "@/lib/services/units";
import { formatUnitWithTower } from "@/lib/residents/labels";
import { toVisitorAuthorizationFormInput } from "@/lib/visitor-authorizations/mappers";
import { getGuestTypeLabel } from "@/lib/visitor-authorizations/labels";
import { VISITOR_AUTHORIZATION_STATUS } from "@/lib/constants";
import { VisitorAuthorizationActions } from "@/components/visitors/visitor-authorization-actions";
import { VisitorAuthorizationForm } from "@/components/visitors/visitor-authorization-form";
import { VisitorAccessControl } from "@/components/visitors/visitor-access-control";
import { ResidentAccessDeviceSummary } from "@/components/access-devices/resident-access-device-fields";
import { VisitorDisplayStatusBadge } from "@/components/visitors/visitor-display-status-badge";
import { DoormanNotesForm } from "@/components/visitors/doorman-notes-form";
import { ErrorAlert } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

interface VisitorDetailPageProps {
  params: Promise<{ condoSlug: string; authorizationId: string }>;
}

export default async function VisitorDetailPage({ params }: VisitorDetailPageProps) {
  const { condoSlug, authorizationId } = await params;
  const access = await requireCondoAccess(condoSlug);

  if (!access.permissions.canViewVisitorAuthorizations) {
    notFound();
  }

  const result = await getVisitorAuthorizationById(authorizationId, access.condominium.id);

  if (!result.ok) {
    if (result.error.includes("não encontrada")) {
      notFound();
    }
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <ErrorAlert message={result.error} />
        <Button variant="outline" asChild>
          <Link href={`/app/${condoSlug}/visitors`}>Voltar</Link>
        </Button>
      </div>
    );
  }

  const authorization = result.data;
  const isStaff = access.permissions.canManageVisitorAuthorizations;
  const canApprove = access.permissions.canApproveVisitorAuthorizations;
  const canConsult = access.permissions.canConsultVisitorAuthorizations;
  const isResident = access.role === ROLES.RESIDENT;

  let canCancel = isStaff;

  if (!isStaff && access.permissions.canRegisterVisitorAuthorizations) {
    const unitsResult = isResident
      ? await listUnitIdsForVisitorRegistration(access.profile.id, access.condominium.id)
      : await listUnitIdsForProfile(access.profile.id, access.condominium.id);
    canCancel =
      unitsResult.ok &&
      unitsResult.data.includes(authorization.unit_id) &&
      (authorization.status === VISITOR_AUTHORIZATION_STATUS.PENDING ||
        authorization.status === VISITOR_AUTHORIZATION_STATUS.APPROVED);
  }

  const canEdit =
    isStaff && authorization.status === VISITOR_AUTHORIZATION_STATUS.PENDING;

  const isGeneralCondo = isGeneralCondominium(condoSlug);

  const editPanelResult = canEdit
    ? isGeneralCondo
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
        )
    : null;

  const editUnits = editPanelResult?.ok ? editPanelResult.data.units : [];
  const condominiumNamesById = editPanelResult?.ok
    ? editPanelResult.data.condominiumNamesById
    : {};

  const [accessDevicesResult, deviceIdsResult, grantsResult] = await Promise.all([
    listActiveAccessDevicesForCondominium(access.condominium.id),
    getVisitorAuthorizationAccessDeviceIds(authorization.id),
    listVisitorAccessGrants(authorization.id),
  ]);

  const residentUnitsResult = isResident
    ? await listUnitIdsForVisitorRegistration(access.profile.id, access.condominium.id)
    : { ok: true as const, data: [] as string[] };

  const canManageOwnUnitVisitors =
    isResident &&
    access.permissions.canRegisterVisitorAuthorizations &&
    residentUnitsResult.ok &&
    residentUnitsResult.data.includes(authorization.unit_id);

  const canManageAccess = isStaff || canConsult || canManageOwnUnitVisitors;

  const showDoormanNotes =
    canConsult &&
    (authorization.status === VISITOR_AUTHORIZATION_STATUS.PENDING ||
      authorization.status === VISITOR_AUTHORIZATION_STATUS.APPROVED);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={authorization.full_name}
        description={`${getGuestTypeLabel(authorization.guest_type)} · ${formatUnitWithTower(authorization.unit)}`}
        action={<VisitorDisplayStatusBadge record={authorization} />}
      />

      {!canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
              <span className="text-muted-foreground">Unidade</span>
              <span className="font-medium">{formatUnitWithTower(authorization.unit)}</span>
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
              <span className="text-muted-foreground">Tipo</span>
              <span className="font-medium">{getGuestTypeLabel(authorization.guest_type)}</span>
            </div>
            {authorization.company_name && (
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                <span className="text-muted-foreground">Empresa</span>
                <span className="font-medium">{authorization.company_name}</span>
              </div>
            )}
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
              <span className="text-muted-foreground">Documento</span>
              <span className="font-medium">
                {authorization.document_type && authorization.document_number
                  ? `${authorization.document_type} ${authorization.document_number}`
                  : authorization.document_number ?? "—"}
              </span>
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
              <span className="text-muted-foreground">Placa</span>
              <span className="font-medium">{authorization.vehicle_plate ?? "—"}</span>
            </div>
            {authorization.photo_url && (
              <div className="space-y-2">
                <span className="text-muted-foreground">Foto</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={authorization.photo_url}
                  alt={authorization.full_name}
                  className="h-28 w-28 rounded-md border object-cover"
                />
              </div>
            )}
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
              <span className="text-muted-foreground">Início</span>
              <span className="font-medium">{formatDateTime(authorization.access_starts_at)}</span>
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
              <span className="text-muted-foreground">Fim</span>
              <span className="font-medium">{formatDateTime(authorization.access_ends_at)}</span>
            </div>
            {authorization.requester && (
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                <span className="text-muted-foreground">Solicitante</span>
                <span className="font-medium">{authorization.requester.full_name}</span>
              </div>
            )}
            {authorization.reviewer && (
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                <span className="text-muted-foreground">Revisado por</span>
                <span className="font-medium">
                  {authorization.reviewer.full_name}
                  {authorization.reviewed_at &&
                    ` · ${formatDateTime(authorization.reviewed_at)}`}
                </span>
              </div>
            )}
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
              <span className="text-muted-foreground">Observações</span>
              <span className="font-medium">{authorization.notes ?? "—"}</span>
            </div>
            {authorization.doorman_notes && (
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                <span className="text-muted-foreground">Notas da portaria</span>
                <span className="font-medium whitespace-pre-wrap">
                  {authorization.doorman_notes}
                </span>
              </div>
            )}
            {authorization.status === VISITOR_AUTHORIZATION_STATUS.PENDING && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                Esta autorização aguarda aprovação do síndico ou administrador.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {canEdit && editPanelResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Editar autorização pendente</CardTitle>
          </CardHeader>
          <CardContent>
            <VisitorAuthorizationForm
              condoSlug={condoSlug}
              mode="edit"
              units={editUnits}
              condominiumNamesById={condominiumNamesById}
              accessDevices={accessDevicesResult.ok ? accessDevicesResult.data : []}
              defaultAccessDeviceIds={deviceIdsResult.ok ? deviceIdsResult.data : []}
              defaultValues={{
                ...toVisitorAuthorizationFormInput(authorization),
                authorizationId: authorization.id,
                photoUrl: authorization.photo_url,
                syncControlId: authorization.sync_controlid,
              }}
            />
          </CardContent>
        </Card>
      )}

      {showDoormanNotes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registro da portaria</CardTitle>
          </CardHeader>
          <CardContent>
            <DoormanNotesForm
              condoSlug={condoSlug}
              authorizationId={authorization.id}
              defaultNotes={authorization.doorman_notes}
            />
          </CardContent>
        </Card>
      )}

      {authorization.sync_controlid && grantsResult.ok && grantsResult.data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Locais ControlID</CardTitle>
          </CardHeader>
          <CardContent>
            <ResidentAccessDeviceSummary
              grants={grantsResult.data.map((grant) => ({
                access_device: grant.access_device
                  ? {
                      display_name: grant.access_device.display_name,
                      access_type: grant.access_device.access_type,
                      is_pilot: grant.access_device.is_pilot,
                    }
                  : undefined,
                sync_status: grant.sync_status,
                sync_error: grant.sync_error,
              }))}
            />
          </CardContent>
        </Card>
      )}

      <VisitorAccessControl
        condoSlug={condoSlug}
        authorization={authorization}
        canManage={canManageAccess}
      />

      <VisitorAuthorizationActions
        condoSlug={condoSlug}
        authorization={authorization}
        canApprove={canApprove}
        canCancel={canCancel}
      />
    </div>
  );
}
