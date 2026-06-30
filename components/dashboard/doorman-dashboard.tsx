import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Car,
  Droplets,
  Megaphone,
  MessageSquarePlus,
  Package,
  Users,
} from "lucide-react";
import type { AnnouncementWithDetails } from "@/lib/announcements/types";
import type { getRolePermissions } from "@/lib/auth/roles";
import type { ReservationWithDetails } from "@/lib/reservations/types";
import type { WaterMeterDashboardSummary } from "@/lib/water-meters/types";
import { formatWaterMeterReadingValue } from "@/lib/water-meters/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

type DoormanPermissions = ReturnType<typeof getRolePermissions>;

export type DoormanDashboardProps = {
  condoSlug: string;
  condominiumName: string;
  blockLabel?: string;
  permissions: DoormanPermissions;
  upcomingReservations: ReservationWithDetails[];
  recentAnnouncements: AnnouncementWithDetails[];
  unreadAnnouncementIds: string[];
  pendingCorrespondenceCount: number;
  waterMeterSummary: WaterMeterDashboardSummary;
  isGranjaSource?: boolean;
};

type QuickAction = {
  title: string;
  description: string;
  href: string;
  icon: typeof CalendarDays;
  accent: string;
};

export function DoormanDashboard({
  condoSlug,
  condominiumName,
  blockLabel,
  permissions,
  upcomingReservations,
  recentAnnouncements,
  unreadAnnouncementIds,
  pendingCorrespondenceCount,
  waterMeterSummary,
  isGranjaSource = false,
}: DoormanDashboardProps) {
  const base = `/app/${condoSlug}`;
  const unreadAnnouncementCount = unreadAnnouncementIds.length;
  const { latestReading, previousReading, averageConsumption, activeAlert } = waterMeterSummary;

  const quickActions: QuickAction[] = [];

  if (permissions.canManageReservations) {
    quickActions.push({
      title: "Nova reserva",
      description: "Agendar espaço comum do condomínio",
      href: `${base}/reservations/new`,
      icon: CalendarDays,
      accent: "border-sky-200 bg-sky-50 text-sky-900 hover:border-sky-300 hover:bg-sky-100/80",
    });
  }

  if (permissions.canManageAnnouncements) {
    quickActions.push({
      title: "Novo aviso",
      description: "Comunicado para moradores do condomínio",
      href: `${base}/announcements/new`,
      icon: Megaphone,
      accent: "border-indigo-200 bg-indigo-50 text-indigo-900 hover:border-indigo-300 hover:bg-indigo-100/80",
    });
  }

  if (permissions.canSendAnnouncements) {
    quickActions.push({
      title: "Fale com o condomínio",
      description: "Granja Brasil ou morador individual",
      href: `${base}/announcements/doorman-contact`,
      icon: MessageSquarePlus,
      accent: "border-violet-200 bg-violet-50 text-violet-900 hover:border-violet-300 hover:bg-violet-100/80",
    });
  }

  if (permissions.canManageCorrespondence) {
    quickActions.push({
      title: "Correspondência",
      description:
        pendingCorrespondenceCount > 0
          ? `${pendingCorrespondenceCount} aguardando retirada`
          : "Avisar morador sobre encomendas",
      href: `${base}/correspondence/new`,
      icon: Package,
      accent:
        pendingCorrespondenceCount > 0
          ? "border-amber-300 bg-amber-50 text-amber-950 hover:border-amber-400 hover:bg-amber-100/80"
          : "border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-300 hover:bg-amber-100/80",
    });
  }

  if (permissions.canConsultResidents) {
    quickActions.push({
      title: "Consultar moradores",
      description: "Ver moradores cadastrados nas unidades",
      href: `${base}/residents`,
      icon: Users,
      accent: "border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-300 hover:bg-emerald-100/80",
    });
  }

  if (permissions.canRegisterResidentsWithApproval) {
    quickActions.push({
      title: "Cadastrar morador",
      description: "Cadastro com foto e liberação ControlID nos locais selecionados",
      href: `${base}/residents/registration-request`,
      icon: Users,
      accent: "border-teal-200 bg-teal-50 text-teal-900 hover:border-teal-300 hover:bg-teal-100/80",
    });
  }

  if (permissions.canConsultVehicles) {
    quickActions.push({
      title: "Consultar veículos",
      description: "Buscar placa e responsável na portaria",
      href: `${base}/vehicles/consult`,
      icon: Car,
      accent: "border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300 hover:bg-slate-100/80",
    });
  }

  if (permissions.canRegisterVehiclesWithApproval) {
    quickActions.push({
      title: "Cadastrar veículo",
      description: "Cadastro com foto e liberação ControlID",
      href: `${base}/vehicles/new`,
      icon: Car,
      accent: "border-blue-200 bg-blue-50 text-blue-900 hover:border-blue-300 hover:bg-blue-100/80",
    });
  }

  if (permissions.canManageWaterMeters) {
    quickActions.push({
      title: "Hidrômetros",
      description: activeAlert
        ? "Consumo acima da média — verificar"
        : "Registrar leitura diária",
      href: `${base}/water-meters`,
      icon: Droplets,
      accent: activeAlert
        ? "border-red-300 bg-red-50 text-red-950 hover:border-red-400 hover:bg-red-100/80"
        : "border-cyan-200 bg-cyan-50 text-cyan-900 hover:border-cyan-300 hover:bg-cyan-100/80",
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-gradient-to-br from-slate-50 via-white to-cyan-50 p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-600">Portaria</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{condominiumName}</h2>
        {blockLabel && (
          <p className="mt-1 text-sm font-medium text-cyan-800">Bloco: {blockLabel}</p>
        )}
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          {isGranjaSource
            ? "Registre correspondências nos condomínios filhos e acompanhe hidrômetros da Granja."
            : blockLabel
              ? `Portaria compartilhada do bloco ${blockLabel}. Selecione o condomínio ao registrar correspondências, hidrômetros e cadastros.`
              : "Operações diárias: reservas, avisos, correspondências e leitura de hidrômetros."}
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
          <div
            className={`rounded-xl border px-4 py-3 shadow-sm ${
              activeAlert ? "border-red-300 bg-red-50 text-red-950" : "border-white/80 bg-white/70"
            }`}
          >
            <p className="text-xs font-medium text-muted-foreground">Consumo de água hoje</p>
            <p className="mt-1 text-2xl font-bold">
              {latestReading?.daily_consumption != null
                ? `${formatWaterMeterReadingValue(latestReading.daily_consumption)} m³`
                : "—"}
            </p>
          </div>
        </div>
      </section>

      {activeAlert && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-950">
          <p className="font-medium">Alerta de consumo de água</p>
          <p className="mt-1">
            Consumo de {formatWaterMeterReadingValue(activeAlert.daily_consumption)} m³ está{" "}
            {activeAlert.excess_percent.toFixed(1)}% acima da média recente (
            {formatWaterMeterReadingValue(activeAlert.average_consumption)} m³/dia).
          </p>
        </div>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Operações rápidas</h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {quickActions.map((action) => {
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
                  <span className="block font-medium">{action.title}</span>
                  <span className="mt-1 block text-sm opacity-80">{action.description}</span>
                  <ArrowRight className="mt-2 h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {permissions.canManageWaterMeters && (
        <Card className={activeAlert ? "border-red-300" : undefined}>
          <CardHeader>
            <CardTitle className="text-base">Medição de hidrômetros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-muted-foreground">Última leitura</p>
                <p className="font-medium">
                  {latestReading
                    ? `${formatWaterMeterReadingValue(latestReading.reading_value)} m³ · ${latestReading.reading_date}`
                    : "Nenhuma registrada"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Consumo do dia</p>
                <p className="font-medium">
                  {latestReading?.daily_consumption != null
                    ? `${formatWaterMeterReadingValue(latestReading.daily_consumption)} m³`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Média recente</p>
                <p className="font-medium">
                  {averageConsumption != null
                    ? `${formatWaterMeterReadingValue(averageConsumption)} m³/dia`
                    : "—"}
                </p>
              </div>
            </div>
            {previousReading && latestReading?.daily_consumption != null && (
              <p className="text-xs text-muted-foreground">
                Diferença em relação à leitura anterior ({previousReading.reading_date}):{" "}
                {formatWaterMeterReadingValue(latestReading.daily_consumption)} m³
              </p>
            )}
            <Link href={`${base}/water-meters`} className="inline-flex text-sm font-medium text-primary hover:underline">
              Registrar ou consultar leituras
            </Link>
          </CardContent>
        </Card>
      )}

      {recentAnnouncements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Avisos recentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentAnnouncements.slice(0, 5).map((announcement) => {
              const isUnread = unreadAnnouncementIds.includes(announcement.id);

              return (
                <Link
                  key={announcement.id}
                  href={`${base}/announcements/${announcement.id}`}
                  className="block rounded-lg border p-3 transition-colors hover:bg-muted/20"
                >
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{announcement.title}</p>
                    {isUnread && <Badge className="bg-sky-600 hover:bg-sky-600">Novo</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(announcement.published_at ?? announcement.created_at)}
                  </p>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
