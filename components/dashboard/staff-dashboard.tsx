import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Car,
  ClipboardList,
  Home,
  Inbox,
  Megaphone,
  Plus,
  Users,
} from "lucide-react";
import type { AnnouncementWithDetails } from "@/lib/announcements/types";
import {
  getAnnouncementPriorityBadgeClass,
  getAnnouncementPriorityLabel,
} from "@/lib/announcements/labels";
import type { getRolePermissions } from "@/lib/auth/roles";
import { RESERVATION_STATUS, type ReservationStatus } from "@/lib/constants";
import type { RegistrationRequestRecord } from "@/lib/registrations/types";
import type { GeneralCondominiumOverviewMetrics } from "@/lib/services/dashboard";
import type { ReservationWithDetails } from "@/lib/reservations/types";
import { DashboardRegistrationRequests } from "@/components/dashboard/dashboard-registration-requests";
import { DashboardReservationItem } from "@/components/dashboard/dashboard-reservation-item";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

type StaffPermissions = ReturnType<typeof getRolePermissions>;

export type StaffDashboardProps = {
  condoSlug: string;
  condominiumName: string;
  roleLabel: string;
  isGeneralCondo: boolean;
  permissions: StaffPermissions;
  generalOverview: GeneralCondominiumOverviewMetrics | null;
  upcomingReservations: ReservationWithDetails[];
  recentAnnouncements: AnnouncementWithDetails[];
  unreadAnnouncementIds: string[];
  unreadReplyThreadIds: string[];
  reservationsByStatus: Record<ReservationStatus, number>;
  pendingRegistrationCount: number;
  pendingRegistrationRequests: RegistrationRequestRecord[];
  isGlobalRegistrationView: boolean;
  quickActions: Array<{ label: string; href: string }>;
};

type QuickActionTile = {
  title: string;
  description: string;
  href: string;
  icon: typeof CalendarDays;
  accent: string;
};

type GranjaOverviewCard = {
  label: string;
  value: number;
  description: string;
  href: string;
  icon: typeof Building2;
  accent: string;
};

export function StaffDashboard({
  condoSlug,
  condominiumName,
  roleLabel,
  isGeneralCondo,
  permissions,
  generalOverview,
  upcomingReservations,
  recentAnnouncements,
  unreadAnnouncementIds,
  unreadReplyThreadIds,
  reservationsByStatus,
  pendingRegistrationCount,
  pendingRegistrationRequests,
  isGlobalRegistrationView,
  quickActions,
}: StaffDashboardProps) {
  const base = `/app/${condoSlug}`;
  const unreadIncomingSet = new Set(unreadAnnouncementIds);
  const unreadReplySet = new Set(unreadReplyThreadIds);
  const pendingReservations = reservationsByStatus[RESERVATION_STATUS.PENDING];
  const awaitingReceipt = reservationsByStatus[RESERVATION_STATUS.AWAITING_RECEIPT];
  const approvedUpcoming = upcomingReservations.filter(
    (reservation) => reservation.status === RESERVATION_STATUS.APPROVED,
  ).length;

  const actionTiles: QuickActionTile[] = [];

  if (permissions.canManageReservations) {
    actionTiles.push({
      title: "Nova reserva",
      description: "Agendar espaço comum",
      href: `${base}/reservations/new`,
      icon: Plus,
      accent: "border-sky-200 bg-sky-50 text-sky-900 hover:border-sky-300 hover:bg-sky-100/80",
    });
  }

  if (permissions.canApproveReservations && pendingReservations > 0) {
    actionTiles.push({
      title: "Aprovar reservas",
      description: `${pendingReservations} aguardando análise`,
      href: `${base}/reservations?status=${RESERVATION_STATUS.PENDING}`,
      icon: ClipboardList,
      accent: "border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-300 hover:bg-amber-100/80",
    });
  }

  if (permissions.canManageAnnouncements || permissions.canSendAnnouncements) {
    actionTiles.push({
      title: permissions.canManageAnnouncements ? "Novo aviso" : "Nova mensagem",
      description: "Comunicado para moradores",
      href: `${base}/announcements/new`,
      icon: Megaphone,
      accent: "border-indigo-200 bg-indigo-50 text-indigo-900 hover:border-indigo-300 hover:bg-indigo-100/80",
    });
  }

  if (permissions.canManageRegistrationRequests && pendingRegistrationCount > 0) {
    actionTiles.push({
      title: "Solicitações",
      description: `${pendingRegistrationCount} cadastro(s) pendente(s)`,
      href: `${base}/settings/registration-requests`,
      icon: Inbox,
      accent: "border-violet-200 bg-violet-50 text-violet-900 hover:border-violet-300 hover:bg-violet-100/80",
    });
  }

  if (isGeneralCondo && permissions.canManageCondo) {
    actionTiles.push({
      title: "Condomínios",
      description: "Gerenciar cadastros",
      href: `${base}/admin/condominiums`,
      icon: Building2,
      accent: "border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-300 hover:bg-emerald-100/80",
    });
  }

  if (permissions.canManageResidents) {
    actionTiles.push({
      title: "Moradores",
      description: "Cadastro de moradores",
      href: `${base}/residents/new`,
      icon: Users,
      accent: "border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300 hover:bg-slate-100/80",
    });
  }

  const attentionItems: Array<{
    message: string;
    href: string;
    cta: string;
    tone: string;
  }> = [];

  if (permissions.canApproveReservations && pendingReservations > 0) {
    attentionItems.push({
      message: `${pendingReservations} reserva(s) aguardando aprovação.`,
      href: `${base}/reservations?status=${RESERVATION_STATUS.PENDING}`,
      cta: "Revisar reservas",
      tone: "border-amber-200 bg-amber-50 text-amber-950",
    });
  }

  if (permissions.canApproveReservations && awaitingReceipt > 0) {
    attentionItems.push({
      message: `${awaitingReceipt} reserva(s) aguardando recibo de pagamento.`,
      href: `${base}/reservations?status=${RESERVATION_STATUS.AWAITING_RECEIPT}`,
      cta: "Ver reservas",
      tone: "border-blue-200 bg-blue-50 text-blue-950",
    });
  }

  if (unreadAnnouncementIds.length > 0) {
    attentionItems.push({
      message: `${unreadAnnouncementIds.length} aviso(s) ou mensagem(ns) não lida(s).`,
      href: `${base}/announcements`,
      cta: "Ler avisos",
      tone: "border-sky-200 bg-sky-50 text-sky-950",
    });
  }

  if (unreadReplyThreadIds.length > 0) {
    attentionItems.push({
      message: `${unreadReplyThreadIds.length} conversa(s) com nova resposta aguardando retorno.`,
      href: `${base}/announcements/${unreadReplyThreadIds[0]}`,
      cta: "Responder",
      tone: "border-purple-200 bg-purple-50 text-purple-950",
    });
  }

  if (permissions.canManageRegistrationRequests && pendingRegistrationCount > 0) {
    attentionItems.push({
      message: `${pendingRegistrationCount} solicitação(ões) de cadastro pendente(s).`,
      href: `${base}/settings/registration-requests`,
      cta: "Analisar",
      tone: "border-violet-200 bg-violet-50 text-violet-950",
    });
  }

  const granjaOverviewCards: GranjaOverviewCard[] =
    isGeneralCondo && generalOverview
      ? [
          {
            label: "Unidades residenciais",
            value: generalOverview.residentialUnits,
            description: `${generalOverview.residentialUnits - generalOverview.houses} em condomínios + ${generalOverview.houses} casas`,
            href: `${base}/admin/condominiums`,
            icon: Home,
            accent:
              "border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-300 hover:bg-emerald-100/80",
          },
          {
            label: "Moradores no sistema",
            value: generalOverview.totalResidents,
            description: "Cadastro geral de moradores",
            href: `${base}/residents`,
            icon: Users,
            accent:
              "border-indigo-200 bg-indigo-50 text-indigo-900 hover:border-indigo-300 hover:bg-indigo-100/80",
          },
          {
            label: "Veículos cadastrados",
            value: generalOverview.totalVehicles,
            description: "Buscar responsável pela placa",
            href: `${base}/vehicles/consult`,
            icon: Car,
            accent:
              "border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-300 hover:bg-amber-100/80",
          },
        ]
      : [];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-gradient-to-br from-slate-50 via-white to-sky-50 p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-600">{roleLabel}</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
          {isGeneralCondo ? "Administração Granja Brasil" : condominiumName}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          {isGeneralCondo
            ? "Acompanhe mensagens dos condomínios, reservas compartilhadas e cadastros pendentes."
            : "Resumo do que precisa de atenção hoje no condomínio."}
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {permissions.canApproveReservations && (
            <div className="rounded-xl border border-white/80 bg-white/70 px-4 py-3 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground">Reservas pendentes</p>
              <p className="mt-1 text-2xl font-bold">{pendingReservations}</p>
            </div>
          )}
          <div className="rounded-xl border border-white/80 bg-white/70 px-4 py-3 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">Mensagens não lidas</p>
            <p className="mt-1 text-2xl font-bold">{unreadAnnouncementIds.length}</p>
          </div>
          <div className="rounded-xl border border-white/80 bg-white/70 px-4 py-3 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">Respostas aguardando</p>
            <p className="mt-1 text-2xl font-bold">{unreadReplyThreadIds.length}</p>
          </div>
          <div className="rounded-xl border border-white/80 bg-white/70 px-4 py-3 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">Próximas reservas</p>
            <p className="mt-1 text-2xl font-bold">{approvedUpcoming}</p>
          </div>
        </div>
      </section>

      {granjaOverviewCards.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Visão geral Granja</h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {granjaOverviewCards.map((card) => {
              const Icon = card.icon;

              return (
                <Link
                  key={card.href}
                  href={card.href}
                  className={`group flex items-start gap-3 rounded-xl border p-4 transition-colors ${card.accent}`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/80 shadow-sm">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium opacity-80">{card.label}</span>
                    <span className="mt-1 block text-2xl font-bold">{card.value}</span>
                    <span className="mt-1 flex items-center gap-2 text-sm opacity-80">
                      {card.description}
                      <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {attentionItems.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Precisa de atenção</h3>
          {attentionItems.map((item) => (
            <div
              key={item.message}
              className={`flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${item.tone}`}
            >
              <p className="text-sm font-medium">{item.message}</p>
              <Button size="sm" variant="outline" className="shrink-0 bg-white/80" asChild>
                <Link href={item.href}>{item.cta}</Link>
              </Button>
            </div>
          ))}
        </section>
      )}

      {actionTiles.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Ações rápidas</h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {actionTiles.map((action) => {
              const Icon = action.icon;

              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className={`group flex items-start gap-3 rounded-xl border p-4 transition-colors ${action.accent}`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/80 shadow-sm">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-semibold">
                      {action.title}
                      <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                    </span>
                    <span className="mt-1 block text-sm opacity-80">{action.description}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {quickActions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cadastros</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {quickActions.map((action) => (
              <Button key={action.href} variant="outline" className="justify-start" asChild>
                <Link href={action.href}>{action.label}</Link>
              </Button>
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
            <CardTitle className="text-base">
              {isGeneralCondo ? "Mensagens recentes" : "Avisos recentes"}
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`${base}/announcements`}>Ver todos</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentAnnouncements.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum aviso publicado.</p>
            ) : (
              recentAnnouncements.map((announcement) => {
                const isUnreadIncoming = unreadIncomingSet.has(announcement.id);
                const hasUnreadReply = unreadReplySet.has(announcement.id);

                return (
                  <Link
                    key={announcement.id}
                    href={`${base}/announcements/${announcement.id}`}
                    className={`block rounded-lg border p-3 transition-colors hover:bg-muted/40 ${
                      isUnreadIncoming || hasUnreadReply
                        ? "border-sky-300 bg-sky-50/50"
                        : ""
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
                          {announcement.author && ` · ${announcement.author.full_name}`}
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

      {permissions.canManageRegistrationRequests && pendingRegistrationCount > 0 && (
        <DashboardRegistrationRequests
          condoSlug={condoSlug}
          requests={pendingRegistrationRequests}
          showCondominium={isGlobalRegistrationView}
          viewAllHref={`${base}/settings/registration-requests`}
        />
      )}
    </div>
  );
}
