import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Car,
  DoorOpen,
  Megaphone,
  MessageSquarePlus,
  Bell,
  Package,
  UserCheck,
} from "lucide-react";
import type { AnnouncementWithDetails } from "@/lib/announcements/types";
import type { CorrespondenceNotice } from "@/lib/correspondence/types";
import {
  getAnnouncementPriorityBadgeClass,
  getAnnouncementPriorityLabel,
} from "@/lib/announcements/labels";
import { RESERVATION_STATUS, VEHICLE_STATUS, type ReservationStatus, type VehicleStatus } from "@/lib/constants";
import type { getRolePermissions } from "@/lib/auth/roles";
import type { ReservationWithDetails } from "@/lib/reservations/types";
import { DashboardReservationItem } from "@/components/dashboard/dashboard-reservation-item";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { formatUnitWithTower } from "@/lib/residents/labels";
import {
  formatVehicleSummary,
  getVehicleStatusBadgeClass,
  VEHICLE_STATUS_LABELS,
} from "@/lib/vehicles/labels";

type ResidentPermissions = ReturnType<typeof getRolePermissions>;

export type ResidentVehicleRequest = {
  id: string;
  brand: string;
  model: string;
  license_plate: string;
  status: VehicleStatus;
  review_notes: string | null;
};

export type ResidentDashboardProps = {
  condoSlug: string;
  condominiumName: string;
  residentName: string;
  hasLinkedUnit: boolean;
  permissions: ResidentPermissions;
  upcomingReservations: ReservationWithDetails[];
  recentAnnouncements: AnnouncementWithDetails[];
  unreadAnnouncementIds: string[];
  unreadReplyThreadIds: string[];
  reservationsByStatus: Record<ReservationStatus, number>;
  vehicleRequests: ResidentVehicleRequest[];
  notificationAlertCount?: number;
  pendingCorrespondence?: CorrespondenceNotice[];
};

function getFirstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "Morador";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

type QuickAction = {
  title: string;
  description: string;
  href: string;
  icon: typeof CalendarDays;
  accent: string;
};

export function ResidentDashboard({
  condoSlug,
  condominiumName,
  residentName,
  hasLinkedUnit,
  permissions,
  upcomingReservations,
  recentAnnouncements,
  unreadAnnouncementIds,
  unreadReplyThreadIds,
  reservationsByStatus,
  vehicleRequests,
  notificationAlertCount = 0,
  pendingCorrespondence = [],
}: ResidentDashboardProps) {
  const base = `/app/${condoSlug}`;
  const firstName = getFirstName(residentName);
  const unreadIncomingSet = new Set(unreadAnnouncementIds);
  const unreadReplySet = new Set(unreadReplyThreadIds);
  const unreadAnnouncementCount = unreadAnnouncementIds.length;
  const unreadReplyCount = unreadReplyThreadIds.length;
  const awaitingReceiptCount =
    reservationsByStatus[RESERVATION_STATUS.AWAITING_RECEIPT];
  const pendingCount = reservationsByStatus[RESERVATION_STATUS.PENDING];

  const pendingVehicleCount = vehicleRequests.filter(
    (vehicle) => vehicle.status === VEHICLE_STATUS.PENDING,
  ).length;
  const rejectedVehicleCount = vehicleRequests.filter(
    (vehicle) => vehicle.status === VEHICLE_STATUS.REJECTED,
  ).length;

  const quickActions: QuickAction[] = [];

  if (permissions.canManageReservations) {
    quickActions.push({
      title: "Reservar espaço",
      description: "Salão, churrasqueira e áreas comuns",
      href: `${base}/reservations/new`,
      icon: CalendarDays,
      accent: "border-sky-200 bg-sky-50 text-sky-900 hover:border-sky-300 hover:bg-sky-100/80",
    });
  }

  quickActions.push({
    title: "Abrir acesso",
    description: "Liberar porta para visita ou emergência",
    href: `${base}/access-open`,
    icon: DoorOpen,
    accent: "border-teal-200 bg-teal-50 text-teal-950 hover:border-teal-300 hover:bg-teal-100/80",
  });

  quickActions.push({
    title: "Avisos",
    description:
      unreadAnnouncementCount > 0
        ? `${unreadAnnouncementCount} nova(s) mensagem(ns)`
        : "Comunicados do condomínio",
    href: `${base}/announcements`,
    icon: Megaphone,
    accent: "border-indigo-200 bg-indigo-50 text-indigo-900 hover:border-indigo-300 hover:bg-indigo-100/80",
  });

  if (permissions.canRegisterVisitorAuthorizations) {
    quickActions.push({
      title: "Autorizar visitante",
      description: "Cadastre entrada de visitantes",
      href: `${base}/visitors/new`,
      icon: UserCheck,
      accent: "border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-300 hover:bg-emerald-100/80",
    });
  }

  if (permissions.canSendAnnouncements) {
    quickActions.push({
      title: "Fale com o condomínio",
      description: "Mensagem ao síndico ou Granja Brasil",
      href: `${base}/announcements/resident-contact`,
      icon: MessageSquarePlus,
      accent: "border-violet-200 bg-violet-50 text-violet-900 hover:border-violet-300 hover:bg-violet-100/80",
    });
  }

  if (permissions.canViewUnitNotifications) {
    quickActions.push({
      title: "Notificações",
      description:
        notificationAlertCount > 0
          ? `${notificationAlertCount} notificação(ões) aguardando sua atenção`
          : "Notificações formais da unidade",
      href: `${base}/notifications`,
      icon: Bell,
      accent: "border-red-300 bg-red-50 text-red-950 hover:border-red-400 hover:bg-red-100/80",
    });
  }

  if (permissions.canViewUnitVehicles) {
    quickActions.push({
      title: "Meus veículos",
      description: "Consulte ou cadastre veículos",
      href: `${base}/vehicles`,
      icon: Car,
      accent: "border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300 hover:bg-slate-100/80",
    });
  }

  const attentionItems: Array<{
    message: string;
    href: string;
    cta: string;
    tone: string;
  }> = [];

  if (!hasLinkedUnit) {
    attentionItems.push({
      message: "Seu cadastro ainda não está vinculado a uma unidade.",
      href: `${base}/settings`,
      cta: "Ver configurações",
      tone: "border-amber-200 bg-amber-50 text-amber-950",
    });
  }

  if (unreadReplyCount > 0) {
    attentionItems.push({
      message: `${unreadReplyCount} mensagem(ns) sua(s) recebeu(ram) resposta.`,
      href: `${base}/announcements/${unreadReplyThreadIds[0]}`,
      cta: "Ver resposta",
      tone: "border-purple-200 bg-purple-50 text-purple-950",
    });
  }

  if (permissions.canViewUnitNotifications && notificationAlertCount > 0) {
    attentionItems.push({
      message: `${notificationAlertCount} notificação(ões) formal(is) aguardando leitura ou resposta.`,
      href: `${base}/notifications`,
      cta: "Ver notificações",
      tone: "border-red-300 bg-red-50 text-red-950",
    });
  }

  if (unreadAnnouncementCount > 0) {
    attentionItems.push({
      message: `${unreadAnnouncementCount} aviso(s) aguardando leitura.`,
      href: `${base}/announcements`,
      cta: "Ler avisos",
      tone: "border-sky-200 bg-sky-50 text-sky-950",
    });
  }

  if (pendingVehicleCount > 0) {
    attentionItems.push({
      message: `${pendingVehicleCount} cadastro(s) de veículo aguardando aprovação.`,
      href: `${base}/vehicles`,
      cta: "Acompanhar",
      tone: "border-amber-200 bg-amber-50 text-amber-950",
    });
  }

  if (rejectedVehicleCount > 0) {
    attentionItems.push({
      message: `${rejectedVehicleCount} cadastro(s) de veículo recusado(s).`,
      href: `${base}/vehicles`,
      cta: "Ver detalhes",
      tone: "border-red-200 bg-red-50 text-red-950",
    });
  }

  if (awaitingReceiptCount > 0) {
    attentionItems.push({
      message: `${awaitingReceiptCount} reserva(s) aguardando envio de recibo.`,
      href: `${base}/reservations?status=${RESERVATION_STATUS.AWAITING_RECEIPT}`,
      cta: "Enviar recibo",
      tone: "border-blue-200 bg-blue-50 text-blue-950",
    });
  }

  if (pendingCount > 0) {
    attentionItems.push({
      message: `${pendingCount} reserva(s) aguardando aprovação.`,
      href: `${base}/reservations?status=${RESERVATION_STATUS.PENDING}`,
      cta: "Acompanhar",
      tone: "border-amber-200 bg-amber-50 text-amber-950",
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-6 shadow-sm">
        <p className="text-base font-medium text-sky-800">Bem-vindo(a)</p>
        <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
          Olá, {firstName}
        </h2>
        <p className="mt-2 max-w-2xl text-base text-slate-600">
          Aqui você acompanha avisos, reservas e visitas do{" "}
          <span className="font-medium text-slate-800">{condominiumName}</span>.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/80 bg-white/70 px-4 py-3 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">Próximas reservas</p>
            <p className="mt-1 text-2xl font-bold">{upcomingReservations.length}</p>
          </div>
          <div className="rounded-xl border border-white/80 bg-white/70 px-4 py-3 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">Avisos não lidos</p>
            <p className="mt-1 text-2xl font-bold">{unreadAnnouncementCount}</p>
          </div>
          <div className="rounded-xl border border-white/80 bg-white/70 px-4 py-3 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">Respostas novas</p>
            <p className="mt-1 text-2xl font-bold">{unreadReplyCount}</p>
          </div>
        </div>
      </section>

      {attentionItems.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-base font-semibold text-slate-900">Precisa da sua atenção</h3>
          {attentionItems.map((item) => (
            <div
              key={item.message}
              className={`flex flex-col gap-3 rounded-xl border px-4 py-4 sm:flex-row sm:items-center sm:justify-between ${item.tone}`}
            >
              <p className="text-base font-medium">{item.message}</p>
              <Button size="lg" variant="outline" className="min-h-12 shrink-0 bg-white/80 text-base" asChild>
                <Link href={item.href}>{item.cta}</Link>
              </Button>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-900">O que você precisa?</h3>
          <Link
            href={`${base}/reservations`}
            className="text-sm font-medium text-primary hover:underline"
          >
            Ver minhas reservas
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {quickActions.map((action) => {
            const Icon = action.icon;

            return (
              <Link
                key={action.href}
                href={action.href}
                className={`group flex min-h-[5.5rem] items-start gap-4 rounded-2xl border p-5 transition-colors ${action.accent}`}
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/80 shadow-sm">
                  <Icon className="h-6 w-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-lg font-semibold">
                    {action.title}
                    <ArrowRight className="h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100" />
                  </span>
                  <span className="mt-1 block text-base opacity-80">{action.description}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {vehicleRequests.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Meus pedidos</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`${base}/vehicles`}>Ver veículos</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {vehicleRequests.map((vehicle) => (
              <Link
                key={vehicle.id}
                href={`${base}/vehicles`}
                className="block rounded-lg border p-3 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {formatVehicleSummary({
                        brand: vehicle.brand,
                        model: vehicle.model,
                        license_plate: vehicle.license_plate,
                      })}
                    </p>
                    {vehicle.status === VEHICLE_STATUS.REJECTED && vehicle.review_notes && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Motivo: {vehicle.review_notes}
                      </p>
                    )}
                  </div>
                  <Badge className={getVehicleStatusBadgeClass(vehicle.status)}>
                    {VEHICLE_STATUS_LABELS[vehicle.status]}
                  </Badge>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

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
              <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center">
                <p className="text-sm font-medium">Nenhuma reserva futura</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Reserve um espaço comum quando precisar.
                </p>
                {permissions.canManageReservations && (
                  <Button className="mt-4" size="sm" asChild>
                    <Link href={`${base}/reservations/new`}>Nova reserva</Link>
                  </Button>
                )}
              </div>
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
            <CardTitle className="text-base">Avisos recentes</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`${base}/announcements`}>Ver todos</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingCorrespondence.map((notice) => (
              <div
                key={notice.id}
                className="rounded-lg border border-amber-300 bg-amber-50/70 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Package className="h-4 w-4 text-amber-700" />
                      <p className="font-medium">{notice.description}</p>
                      <Badge className="bg-amber-600 text-white hover:bg-amber-600">
                        Aguardando retirada
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDateTime(notice.created_at)}
                      {notice.unit && ` · ${formatUnitWithTower(notice.unit)}`}
                      {notice.recipient_name && ` · Dest.: ${notice.recipient_name}`}
                    </p>
                    {notice.carrier && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Remetente: {notice.carrier}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {recentAnnouncements.length === 0 && pendingCorrespondence.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center">
                <p className="text-sm font-medium">Nenhum aviso publicado</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Os comunicados do condomínio aparecerão aqui.
                </p>
              </div>
            ) : (
              recentAnnouncements.map((announcement) => {
                const isUnreadIncoming = unreadIncomingSet.has(announcement.id);
                const hasUnreadReply = unreadReplySet.has(announcement.id);

                return (
                  <Link
                    key={announcement.id}
                    href={`${base}/announcements/${announcement.id}`}
                    className={`block rounded-lg border p-3 transition-colors hover:bg-muted/40 ${
                      isUnreadIncoming || hasUnreadReply ? "border-sky-300 bg-sky-50/50" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{announcement.title}</p>
                          {hasUnreadReply && (
                            <Badge className="bg-purple-600 text-white hover:bg-purple-600">
                              Nova resposta
                            </Badge>
                          )}
                          {isUnreadIncoming && !hasUnreadReply && (
                            <Badge className="bg-sky-600 text-white hover:bg-sky-600">
                              Nova
                            </Badge>
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
    </div>
  );
}
