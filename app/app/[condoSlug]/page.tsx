import { Suspense } from "react";
import { requireCondoAccess } from "@/lib/auth/access";
import {
  getAssignableMemberRoles,
  getMemberRoleLabel,
  isGranjaOnlyMemberRole,
} from "@/lib/auth/member-roles";
import { canCreateInCategory } from "@/lib/auth/permission-matrix";
import { getUnitListFilterForAccess, unitFilterToQueryOptions } from "@/lib/auth/unit-scope";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { getDashboardData, getGeneralCondominiumOverviewMetrics } from "@/lib/services/dashboard";
import { countNotificationDashboardAlerts } from "@/lib/services/notifications";
import { countVehicles, listVehiclesByCondominium } from "@/lib/services/vehicles";
import { ROLES, VEHICLE_STATUS } from "@/lib/constants";
import {
  countAllPendingRegistrationRequests,
  countPendingRegistrationRequestsForCondominiums,
  listAllPendingRegistrationRequests,
  listRegistrationRequestsForCondominiums,
} from "@/lib/services/registration-requests";
import { getRegistrationScopeCondominiumIds } from "@/lib/registrations/scope";
import {
  ResidentDashboard,
  type ResidentVehicleRequest,
} from "@/components/dashboard/resident-dashboard";
import { DoormanDashboard } from "@/components/dashboard/doorman-dashboard";
import { StaffDashboard } from "@/components/dashboard/staff-dashboard";
import type { CorrespondenceNotice } from "@/lib/correspondence/types";
import { countPendingCorrespondenceNotices, listPendingCorrespondenceForProfile } from "@/lib/services/correspondence";
import { resolveDoormanOperationalPanel, getOperationalCondominiumIds } from "@/lib/condominiums/doorman-panel";
import { getWaterMeterDashboardSummary } from "@/lib/services/water-meters";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { ErrorAlert } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/page-shell";

interface DashboardPageProps {
  params: Promise<{ condoSlug: string }>;
}

function DashboardContentSkeleton() {
  return <DashboardSkeleton />;
}

async function DashboardHeader({ condoSlug }: { condoSlug: string }) {
  const access = await requireCondoAccess(condoSlug);

  if (access.role === ROLES.RESIDENT) {
    return (
      <PageHeader
        title="Início"
        description={`Seu painel no ${access.condominium.name}`}
      />
    );
  }

  if (access.role === ROLES.DOORMAN && !isGeneralCondominium(condoSlug)) {
    return (
      <PageHeader
        title="Portaria"
        description={`Operações diárias · ${access.condominium.name}`}
      />
    );
  }

  if (access.role === ROLES.DOORMAN && isGeneralCondominium(condoSlug)) {
    return (
      <PageHeader
        title="Portaria Granja"
        description="Correspondências e operações nos condomínios filhos"
      />
    );
  }

  return (
    <PageHeader
      title={isGeneralCondominium(condoSlug) ? "Painel Granja" : "Painel"}
      description={`Gestão · ${access.permissions.label}`}
    />
  );
}

async function DashboardContent({ condoSlug }: { condoSlug: string }) {
  const access = await requireCondoAccess(condoSlug);
  const base = `/app/${condoSlug}`;
  const unitFilter = await getUnitListFilterForAccess(access);
  const scope = access.permissions.canManageStructure ? null : unitFilter;
  const isGeneralCondoDashboard = isGeneralCondominium(condoSlug);
  const [result, generalOverviewResult] = await Promise.all([
    getDashboardData(access.condominium.id, scope, {
      condominiumId: access.condominium.id,
      profileId: access.profile.id,
      isStaff: access.permissions.canManageAnnouncements,
    }),
    isGeneralCondoDashboard ? getGeneralCondominiumOverviewMetrics() : Promise.resolve(null),
  ]);
  const isGlobalRegistrationView = access.role === ROLES.SUPER_ADMIN;
  const registrationScopeIds = isGlobalRegistrationView
    ? []
    : await getRegistrationScopeCondominiumIds({
        condoSlug,
        condominiumId: access.condominium.id,
      });
  const pendingRegistrationResult = access.permissions.canManageRegistrationRequests
    ? isGlobalRegistrationView
      ? await countAllPendingRegistrationRequests()
      : await countPendingRegistrationRequestsForCondominiums(registrationScopeIds)
    : null;
  const pendingRegistrationCount =
    pendingRegistrationResult?.ok ? (pendingRegistrationResult.data ?? 0) : 0;
  const pendingRegistrationListResult = access.permissions.canManageRegistrationRequests
    ? isGlobalRegistrationView
      ? await listAllPendingRegistrationRequests()
      : await listRegistrationRequestsForCondominiums(registrationScopeIds, "pending")
    : null;
  const pendingRegistrationRequests = pendingRegistrationListResult?.ok
    ? (pendingRegistrationListResult.data ?? [])
    : [];

  if (!result.ok) {
    return <ErrorAlert message={result.error} title="Erro ao carregar o dashboard" />;
  }

  const {
    metrics,
    upcomingReservations,
    recentAnnouncements,
    unreadAnnouncementIds,
    unreadReplyThreadIds,
  } = result.data;

  if (access.role === ROLES.RESIDENT) {
    let vehicleRequests: ResidentVehicleRequest[] = [];
    let notificationAlertCount = 0;
    let pendingCorrespondence: CorrespondenceNotice[] = [];

    const pendingCorrespondenceResult = await listPendingCorrespondenceForProfile(
      access.profile.id,
      { condominiumId: access.condominium.id },
    );
    pendingCorrespondence = pendingCorrespondenceResult.ok
      ? (pendingCorrespondenceResult.data ?? [])
      : [];

    if (access.permissions.canViewUnitNotifications) {
      const alertsResult = await countNotificationDashboardAlerts(access.profile.id);
      notificationAlertCount = alertsResult.ok ? (alertsResult.data ?? 0) : 0;
    }

    if (access.permissions.canViewUnitVehicles && unitFilter !== "none") {
      const unitQuery = unitFilterToQueryOptions(unitFilter);
      if (unitQuery !== "none") {
        const vehiclesResult = await listVehiclesByCondominium(access.condominium.id, unitQuery);
        if (vehiclesResult.ok) {
          vehicleRequests = vehiclesResult.data
            .filter(
              (vehicle) =>
                vehicle.status === VEHICLE_STATUS.PENDING ||
                vehicle.status === VEHICLE_STATUS.REJECTED,
            )
            .map((vehicle) => ({
              id: vehicle.id,
              brand: vehicle.brand,
              model: vehicle.model,
              license_plate: vehicle.license_plate,
              status: vehicle.status,
              review_notes: vehicle.review_notes,
            }));
        }
      }
    }

    return (
      <ResidentDashboard
        condoSlug={condoSlug}
        condominiumName={access.condominium.name}
        residentName={access.profile.fullName}
        hasLinkedUnit={unitFilter !== "none"}
        permissions={access.permissions}
        upcomingReservations={upcomingReservations}
        recentAnnouncements={recentAnnouncements}
        unreadAnnouncementIds={unreadAnnouncementIds}
        unreadReplyThreadIds={unreadReplyThreadIds}
        reservationsByStatus={metrics.reservationsByStatus}
        vehicleRequests={vehicleRequests}
        notificationAlertCount={notificationAlertCount}
        pendingCorrespondence={pendingCorrespondence}
      />
    );
  }

  if (access.role === ROLES.DOORMAN && isGeneralCondoDashboard) {
    const [pendingCorrespondenceResult, waterMeterSummaryResult] = await Promise.all([
      countPendingCorrespondenceNotices(),
      getWaterMeterDashboardSummary(access.condominium.id),
    ]);

    return (
      <DoormanDashboard
        condoSlug={condoSlug}
        condominiumName={access.condominium.name}
        permissions={access.permissions}
        upcomingReservations={upcomingReservations}
        recentAnnouncements={recentAnnouncements}
        unreadAnnouncementIds={unreadAnnouncementIds}
        pendingCorrespondenceCount={
          pendingCorrespondenceResult.ok ? (pendingCorrespondenceResult.data ?? 0) : 0
        }
        waterMeterSummary={
          waterMeterSummaryResult.ok
            ? waterMeterSummaryResult.data
            : {
                latestReading: null,
                previousReading: null,
                averageConsumption: null,
                activeAlert: null,
                recentReadings: [],
              }
        }
        isGranjaSource
      />
    );
  }

  if (access.role === ROLES.DOORMAN && !isGeneralCondoDashboard) {
    const panelResult = await resolveDoormanOperationalPanel(condoSlug);
    const blockLabel =
      panelResult.ok && panelResult.data.mode === "block"
        ? panelResult.data.panel.block.label
        : undefined;
    const operationalCondoIds =
      panelResult.ok && panelResult.data.mode !== "single"
        ? getOperationalCondominiumIds(panelResult.data, access.condominium.id)
        : [access.condominium.id];

    const [pendingCorrespondenceResult, waterMeterSummaryResult] = await Promise.all([
      operationalCondoIds.length > 1
        ? countPendingCorrespondenceNotices(undefined, operationalCondoIds)
        : countPendingCorrespondenceNotices(access.condominium.id),
      getWaterMeterDashboardSummary(access.condominium.id),
    ]);

    return (
      <DoormanDashboard
        condoSlug={condoSlug}
        condominiumName={access.condominium.name}
        blockLabel={blockLabel}
        permissions={access.permissions}
        upcomingReservations={upcomingReservations}
        recentAnnouncements={recentAnnouncements}
        unreadAnnouncementIds={unreadAnnouncementIds}
        pendingCorrespondenceCount={
          pendingCorrespondenceResult.ok ? (pendingCorrespondenceResult.data ?? 0) : 0
        }
        waterMeterSummary={
          waterMeterSummaryResult.ok
            ? waterMeterSummaryResult.data
            : {
                latestReading: null,
                previousReading: null,
                averageConsumption: null,
                activeAlert: null,
                recentReadings: [],
              }
        }
      />
    );
  }

  if (isGeneralCondoDashboard && generalOverviewResult && !generalOverviewResult.ok) {
    return (
      <ErrorAlert
        message={generalOverviewResult.error}
        title="Erro ao carregar visão geral"
      />
    );
  }

  const generalOverview = generalOverviewResult?.ok ? generalOverviewResult.data : null;

  let notificationAlertCount = 0;
  if (access.permissions.canSendUnitNotifications || access.permissions.canViewUnitNotifications) {
    const alertsResult = await countNotificationDashboardAlerts(access.profile.id, {
      sourceCondominiumId: access.permissions.canSendUnitNotifications
        ? access.condominium.id
        : undefined,
    });
    notificationAlertCount = alertsResult.ok ? (alertsResult.data ?? 0) : 0;
  }

  const [totalVehicleCount, pendingVehicleCount] =
    !isGeneralCondoDashboard && access.permissions.canManageVehicles
      ? await Promise.all([
          countVehicles({ condominiumId: access.condominium.id }),
          countVehicles({
            condominiumId: access.condominium.id,
            status: VEHICLE_STATUS.PENDING,
          }),
        ]).then(([totalResult, pendingResult]) => [
          totalResult.ok ? (totalResult.data ?? 0) : 0,
          pendingResult.ok ? (pendingResult.data ?? 0) : 0,
        ])
      : [0, 0];

  const quickActions = [
    {
      label: "Cadastrar unidade",
      href: `${base}/units/new`,
      allowed: access.permissions.canManageStructure,
    },
    {
      label: "Cadastrar morador",
      href: `${base}/residents/new`,
      allowed: access.permissions.canManageResidents,
    },
    {
      label: "Cadastrar espaço comum",
      href: `${base}/areas/new`,
      allowed: canCreateInCategory(access, "areas"),
    },
    ...getAssignableMemberRoles(access.role)
      .filter((role) => !isGranjaOnlyMemberRole(role) && role !== ROLES.RESIDENT)
      .map((role) => ({
        label: `Cadastrar ${getMemberRoleLabel(role).toLowerCase()}`,
        href: `${base}/settings/members?role=${role}`,
        allowed: access.permissions.canManageMembers,
      })),
    ...getAssignableMemberRoles(access.role)
      .filter((role) => isGranjaOnlyMemberRole(role))
      .map((role) => ({
        label: `Cadastrar ${getMemberRoleLabel(role).toLowerCase()}`,
        href: `${base}/settings/members?role=${role}`,
        allowed: access.permissions.canManageMembers && access.role === ROLES.SUPER_ADMIN,
      })),
  ]
    .filter((action) => action.allowed)
    .map(({ label, href }) => ({ label, href }));

  return (
    <StaffDashboard
      condoSlug={condoSlug}
      condominiumName={access.condominium.name}
      roleLabel={access.permissions.label}
      isGeneralCondo={isGeneralCondoDashboard}
      permissions={access.permissions}
      generalOverview={generalOverview}
      upcomingReservations={upcomingReservations}
      recentAnnouncements={recentAnnouncements}
      unreadAnnouncementIds={unreadAnnouncementIds}
      unreadReplyThreadIds={unreadReplyThreadIds}
      reservationsByStatus={metrics.reservationsByStatus}
      pendingRegistrationCount={pendingRegistrationCount}
      pendingRegistrationRequests={pendingRegistrationRequests}
      totalVehicleCount={totalVehicleCount}
      pendingVehicleCount={pendingVehicleCount}
      isGlobalRegistrationView={isGlobalRegistrationView}
      quickActions={quickActions}
      notificationAlertCount={notificationAlertCount}
    />
  );
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { condoSlug } = await params;

  return (
    <div className="space-y-8">
      <Suspense fallback={<div className="h-16 animate-pulse rounded-lg bg-muted" />}>
        <DashboardHeader condoSlug={condoSlug} />
      </Suspense>

      <Suspense fallback={<DashboardContentSkeleton />}>
        <DashboardContent condoSlug={condoSlug} />
      </Suspense>
    </div>
  );
}
