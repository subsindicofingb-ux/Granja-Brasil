import Link from "next/link";
import { Plus } from "lucide-react";
import { Suspense } from "react";
import { requireCondoAccess } from "@/lib/auth/access";
import { getDashboardData } from "@/lib/services/dashboard";
import { RESERVATION_STATUS } from "@/lib/constants";
import { getReservationStatusLabel } from "@/lib/reservations/labels";
import {
  getAnnouncementPriorityBadgeClass,
  getAnnouncementPriorityLabel,
} from "@/lib/announcements/labels";
import { PermissionGate } from "@/components/auth/permission-gate";
import { DashboardReservationItem } from "@/components/dashboard/dashboard-reservation-item";
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

  return (
    <PageHeader
      title="Dashboard"
      description={`Visão geral do condomínio · ${access.permissions.label}`}
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
  const result = await getDashboardData(access.condominium.id);

  if (!result.ok) {
    return <ErrorAlert message={result.error} title="Erro ao carregar o dashboard" />;
  }

  const { metrics, upcomingReservations, recentReservations, recentAnnouncements } = result.data;
  const pendingCount = metrics.reservationsByStatus[RESERVATION_STATUS.PENDING];

  const quickActions = [
    {
      label: "Cadastrar torre",
      href: `${base}/towers/new`,
      allowed: access.permissions.canManageStructure,
    },
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
  ].filter((action) => action.allowed);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Torres" value={metrics.towers} />
        <StatCard label="Unidades" value={metrics.units} />
        <StatCard label="Moradores" value={metrics.residents} hint="Cadastrados no condomínio" />
        <StatCard
          label="Espaços comuns"
          value={metrics.activeCommonAreas}
          hint="Ativos para reserva"
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
            {recentAnnouncements.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum aviso publicado.</p>
            ) : (
              recentAnnouncements.map((announcement) => (
                <div key={announcement.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{announcement.title}</p>
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
                </div>
              ))
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
