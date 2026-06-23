import { Suspense } from "react";
import { requireCondoAccess } from "@/lib/auth/access";
import {
  getAssignableMemberRoles,
  getMemberRoleLabel,
  isGranjaOnlyMemberRole,
} from "@/lib/auth/member-roles";
import { getUnitListFilterForAccess } from "@/lib/auth/unit-scope";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { getDashboardData, getGeneralCondominiumOverviewMetrics } from "@/lib/services/dashboard";
import { countVehicles } from "@/lib/services/vehicles";
import { ROLES, VEHICLE_STATUS } from "@/lib/constants";
import {
  countAllPendingRegistrationRequests,
  countPendingRegistrationRequests,
  listAllPendingRegistrationRequests,
  listRegistrationRequestsByCondominium,
} from "@/lib/services/registration-requests";
import { ResidentDashboard } from "@/components/dashboard/resident-dashboard";
import { StaffDashboard } from "@/components/dashboard/staff-dashboard";
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
  const pendingRegistrationResult = access.permissions.canManageRegistrationRequests
    ? isGlobalRegistrationView
      ? await countAllPendingRegistrationRequests()
      : await countPendingRegistrationRequests(access.condominium.id)
    : null;
  const pendingRegistrationCount =
    pendingRegistrationResult?.ok ? (pendingRegistrationResult.data ?? 0) : 0;
  const pendingRegistrationListResult = access.permissions.canManageRegistrationRequests
    ? isGlobalRegistrationView
      ? await listAllPendingRegistrationRequests()
      : await listRegistrationRequestsByCondominium(access.condominium.id, "pending")
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
      allowed: access.permissions.canManageAreas,
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
