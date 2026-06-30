import Link from "next/link";
import { requireCondoPermission } from "@/lib/auth/access";
import { formatCondominiumDisplayName, isGeneralCondominium } from "@/lib/condominiums/display";
import { resolveDoormanOperationalPanel } from "@/lib/condominiums/doorman-panel";
import { getWaterMeterDashboardSummary } from "@/lib/services/water-meters";
import { formatWaterMeterReadingValue } from "@/lib/water-meters/format";
import { WaterMeterReadingEditForm } from "@/components/doorman/water-meter-reading-edit-form";
import { WaterMeterReadingForm } from "@/components/doorman/water-meter-reading-form";
import { ErrorAlert, SuccessAlert } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/utils";

interface WaterMetersPageProps {
  params: Promise<{ condoSlug: string }>;
  searchParams: Promise<{ registrado?: string; alerta?: string; condominium?: string }>;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatConsumption(value: number | null | undefined): string {
  return value == null ? "—" : `${formatWaterMeterReadingValue(value)} m³`;
}

export default async function WaterMetersPage({
  params,
  searchParams,
}: WaterMetersPageProps) {
  const { condoSlug } = await params;
  const { registrado, alerta, condominium: selectedCondominiumSlug } = await searchParams;

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageWaterMeters || ctx.permissions.canViewWaterMeters,
  );

  const canManageWaterMeters = access.permissions.canManageWaterMeters;

  if (isGeneralCondominium(condoSlug)) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <ErrorAlert message="Leituras de hidrômetro são registradas nos condomínios filhos." />
        <Button variant="outline" asChild>
          <Link href={`/app/${condoSlug}`}>Voltar</Link>
        </Button>
      </div>
    );
  }

  const panelResult = await resolveDoormanOperationalPanel(condoSlug);
  if (!panelResult.ok) {
    return <ErrorAlert message={panelResult.error} title="Erro ao carregar hidrômetros" />;
  }

  const blockPanel = panelResult.data.mode === "block" ? panelResult.data.panel : null;
  const selectedCondominium =
    blockPanel
      ? blockPanel.condominiums.find(
          (condominium) => condominium.slug === selectedCondominiumSlug?.trim().toLowerCase(),
        ) ?? blockPanel.condominiums[0]
      : null;
  const targetCondominiumId = selectedCondominium?.id ?? access.condominium.id;

  const summaryResult = await getWaterMeterDashboardSummary(targetCondominiumId);

  if (!summaryResult.ok) {
    return <ErrorAlert message={summaryResult.error} title="Erro ao carregar hidrômetros" />;
  }

  const summary = summaryResult.data;
  const pageDescription = blockPanel
    ? `Bloco ${blockPanel.block.label} · ${formatCondominiumDisplayName(
        selectedCondominium!.name,
        selectedCondominium!.slug,
      )}`
    : canManageWaterMeters
      ? "Leitura diária acumulada, consumo do dia e alertas de gasto anormal."
      : "Consulte as leituras registradas pela portaria, consumo diário e alertas.";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {registrado === "1" && (
        <SuccessAlert message="Leitura registrada com sucesso." />
      )}
      {alerta === "1" && summary.activeAlert && (
        <ErrorAlert
          title="Consumo acima da média"
          message={`Consumo de ${formatWaterMeterReadingValue(summary.activeAlert.daily_consumption)} m³ está ${summary.activeAlert.excess_percent.toFixed(1)}% acima da média (${formatWaterMeterReadingValue(summary.activeAlert.average_consumption)} m³/dia). Portaria e síndico foram alertados.`}
        />
      )}

      <PageHeader
        title="Hidrômetros"
        description={pageDescription}
      />

      {blockPanel && (
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="condominium">Condomínio</Label>
            <select
              id="condominium"
              name="condominium"
              defaultValue={selectedCondominium?.slug ?? ""}
              className="flex h-9 min-w-[220px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              {blockPanel.condominiums.map((condominium) => (
                <option key={condominium.id} value={condominium.slug}>
                  {formatCondominiumDisplayName(condominium.name, condominium.slug)}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="outline">
            Filtrar
          </Button>
        </form>
      )}

      <Card className={summary.activeAlert ? "border-red-300 bg-red-50/30" : undefined}>
        <CardHeader>
          <CardTitle className="text-base">Resumo</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3 text-sm">
          <div>
            <p className="text-muted-foreground">Última leitura</p>
            <p className="font-medium">{formatConsumption(summary.latestReading?.reading_value)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Consumo do dia</p>
            <p className="font-medium">
              {formatConsumption(summary.latestReading?.daily_consumption)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Média recente</p>
            <p className="font-medium">
              {summary.averageConsumption != null
                ? `${formatWaterMeterReadingValue(summary.averageConsumption)} m³/dia`
                : "—"}
            </p>
          </div>
        </CardContent>
      </Card>

      {canManageWaterMeters && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registrar leitura</CardTitle>
          </CardHeader>
          <CardContent>
            <WaterMeterReadingForm
              condoSlug={condoSlug}
              defaultDate={todayIsoDate()}
              isBlockSource={panelResult.data.mode === "block"}
              condominiums={blockPanel?.condominiums}
            />
          </CardContent>
        </Card>
      )}

      {summary.recentReadings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico recente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.recentReadings.map((reading) => (
              <div key={reading.id} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{reading.reading_date}</p>
                  <p>{formatWaterMeterReadingValue(reading.reading_value)} m³</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Consumo do dia: {formatConsumption(reading.daily_consumption)}
                  {reading.author && ` · ${reading.author.full_name}`}
                  {` · ${formatDateTime(reading.created_at)}`}
                </p>
                {canManageWaterMeters && (
                  <WaterMeterReadingEditForm
                    condoSlug={condoSlug}
                    readingId={reading.id}
                    readingValue={reading.reading_value}
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Button variant="outline" asChild>
        <Link href={`/app/${condoSlug}`}>Voltar ao painel</Link>
      </Button>
    </div>
  );
}
