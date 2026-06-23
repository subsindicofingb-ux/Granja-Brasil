import Link from "next/link";
import { Plus } from "lucide-react";
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
import { ROLES, RESERVATION_STATUS } from "@/lib/constants";
import { getReservationStatusLabel } from "@/lib/reservations/labels";
import {
  countAllPendingRegistrationRequests,
  countPendingRegistrationRequests,
  listAllPendingRegistrationRequests,
  listRegistrationRequestsByCondominium,
} from "@/lib/services/registration-requests";
import {
  getAnnouncementPriorityBadgeClass,
  getAnnouncementPriorityLabel,
} from "@/lib/announcements/labels";
import { PermissionGate } from "@/components/auth/permission-gate";
import { DashboardReservationItem } from "@/components/dashboard/dashboard-reservation-item";
import { DashboardRegistrationRequests } from "@/components/dashboard/dashboard-registration-requests";
import { ResidentDashboard } from "@/components/dashboard/resident-dashboard";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { ErrorAlert } from "@/components/shared/feedback";
import { PageHeader, StatCard } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

interface DashboardPageProps {
  params: Promise<{ condoSlug: string }>;
}

function DashboardContentSkeleton() {
  return <DashboardSkeleton />;
}

async function DashboardHeader({ condoSlug }: { condoSlug: string }) {
  const access = await requireCondoAccess(condoSlug);
  const base = `/app/${condoSlug}`;

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
      title="Dashboard"
      description={
        access.permissions.canManageStructure
          ? `Visão geral do condomínio · ${access.permissions.label}`
          : `Visão da sua unidade · ${access.permissions.label}`
      }
      action={
        access.permissions.canManageReservations ? (
          <Button asChild>
            <Link href={`${base}/reservations/new`}>
              <Plus className="h-4 w-4" />
              Nova reserva
            </Link>
          </Button>
        ) : undefined
      }
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

  const { metrics, upcomingReservations, recentReservations, recentAnnouncements, unreadAnnouncementIds, isUnitScoped } =
    result.data;

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

  const unreadAnnouncementSet = new Set(unreadAnnouncementIds);
  const unreadAnnouncementCount = unreadAnnouncementIds.length;
  const pendingCount = metrics.reservationsByStatus[RESERVATION_STATUS.PENDING];

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
  ].filter((action) => action.allowed);

  return (
    <>
      {isGeneralCondoDashboard && generalOverview && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatCard
            label="Condomínios"
            value={generalOverview.residentialCondominiums}
            hint="Residenciais no sistema"
          />
          <StatCard
            label="Condomínios comerciais"
            value={generalOverview.commercialCondominiums}
            hint="Marcados como comerciais"
          />
          <StatCard
            label="Casas"
            value={generalOverview.houses}
            hint="Unidades tipo casa"
          />
          <StatCard
            label="Unidades residenciais"
            value={generalOverview.residentialUnits}
            hint="Em condomínios residenciais"
          />
          <StatCard
            label="Unidades comerciais"
            value={generalOverview.commercialUnits}
            hint="Em condomínios comerciais"
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {!isGeneralCondoDashboard && (
          <StatCard
            label={isUnitScoped ? "Minhas unidades" : "Unidades"}
            value={metrics.units}
          />
        )}
        <StatCard
          label={isUnitScoped ? "Moradores da unidade" : "Moradores"}
          value={
            isGeneralCondoDashboard && generalOverview
              ? generalOverview.totalResidents
              : metrics.residents
          }
          hint={
            isUnitScoped
              ? "Na sua unidade"
              : isGeneralCondoDashboard
                ? "Cadastrados em todos os condomínios"
                : "Cadastrados no condomínio"
          }
        />
        <StatCard
          label="Espaços comuns"
          value={metrics.activeCommonAreas}
          hint="Ativos para reserva"
        />
        <StatCard
          label="Reservas pendentes"
          value={metrics.reservationsByStatus[RESERVATION_STATUS.PENDING]}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pendentes"
          value={metrics.reservationsByStatus[RESERVATION_STATUS.PENDING]}
        />
        <StatCard
          label="Aprovadas"
          value={metrics.reservationsByStatus[RESERVATION_STATUS.APPROVED]}
        />
        <StatCard
          label="Rejeitadas"
          value={metrics.reservationsByStatus[RESERVATION_STATUS.REJECTED]}
        />
        <StatCard
          label="Canceladas"
          value={metrics.reservationsByStatus[RESERVATION_STATUS.CANCELLED]}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Próximas reservas</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`${base}/reservations`}>Ver todas</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingReservations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma reserva futura pendente ou aprovada.
              </p>
            ) : (
              upcomingReservations.map((reservation) => (
                <DashboardReservationItem
                  key={reservation.id}
                  condoSlug={condoSlug}
                  reservation={reservation}
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Reservas recentes</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`${base}/reservations`}>Ver todas</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentReservations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma reserva cadastrada.</p>
            ) : (
              recentReservations.map((reservation) => (
                <DashboardReservationItem
                  key={reservation.id}
                  condoSlug={condoSlug}
                  reservation={reservation}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PermissionGate
          access={access}
          allow={() => quickActions.length > 0}
          fallback={
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ações rápidas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Seu papel ({access.permissions.label}) possui acesso somente leitura nesta
                  área.
                </p>
              </CardContent>
            </Card>
          }
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ações rápidas</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {quickActions.map((action) => (
                <Button key={action.href} variant="outline" className="justify-start" asChild>
                  <Link href={action.href}>{action.label}</Link>
                </Button>
              ))}
            </CardContent>
          </Card>
        </PermissionGate>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Avisos recentes</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`${base}/announcements`}>Ver todos</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {unreadAnnouncementCount > 0 && (
              <div className="rounded-lg border border-sky-200 bg-sky-50/80 px-3 py-2 text-sm text-sky-950">
                <span className="font-medium">
                  {unreadAnnouncementCount} nova(s) mensagem(ns)
                </span>{" "}
                aguardando leitura.
              </div>
            )}
            {recentAnnouncements.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum aviso publicado.</p>
            ) : (
              recentAnnouncements.map((announcement) => {
                const isUnread = unreadAnnouncementSet.has(announcement.id);

                return (
                  <Link
                    key={announcement.id}
                    href={`${base}/announcements/${announcement.id}`}
                    className={`block rounded-lg border p-3 transition-colors hover:bg-muted/40 ${
                      isUnread ? "border-sky-300 bg-sky-50/50" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{announcement.title}</p>
                          {isUnread && (
                            <Badge className="bg-sky-600 text-white hover:bg-sky-600">Nova</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDateTime(announcement.published_at)}
                        </p>
                      </div>
                      <Badge className={getAnnouncementPriorityBadgeClass(announcement.priority)}>
                        {getAnnouncementPriorityLabel(announcement.priority)}
                      </Badge>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {announcement.body}
                    </p>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {access.permissions.canApproveReservations && pendingCount > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">
              <span className="font-medium">{pendingCount} reserva(s)</span>{" "}
              aguardando aprovação ({getReservationStatusLabel(RESERVATION_STATUS.PENDING)}).
            </p>
            <Button size="sm" variant="outline" asChild>
              <Link href={`${base}/reservations?status=${RESERVATION_STATUS.PENDING}`}>
                Revisar
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {access.permissions.canManageRegistrationRequests && pendingRegistrationCount > 0 && (
        <DashboardRegistrationRequests
          condoSlug={condoSlug}
          requests={pendingRegistrationRequests}
          showCondominium={isGlobalRegistrationView}
          viewAllHref={`${base}/settings/registration-requests`}
        />
      )}
    </>
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
