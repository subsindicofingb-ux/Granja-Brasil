import { requireCondoPermission } from "@/lib/auth/access";
import {
  getOperationalCondominiumIds,
  resolveDoormanOperationalPanel,
} from "@/lib/condominiums/doorman-panel";
import { formatUnitOptionLabel } from "@/lib/residents/labels";
import { listUnitsByCondominium } from "@/lib/services/units";
import { OccurrenceForm } from "@/components/occurrences/occurrence-form";
import { ErrorAlert } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface NewOccurrencePageProps {
  params: Promise<{ condoSlug: string }>;
}

function toDatetimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default async function NewOccurrencePage({ params }: NewOccurrencePageProps) {
  const { condoSlug } = await params;
  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canRegisterOccurrences,
    { redirectTo: `/app/${condoSlug}/occurrences` },
  );

  const panelResult = await resolveDoormanOperationalPanel(condoSlug);
  const operationalIds = panelResult.ok
    ? getOperationalCondominiumIds(panelResult.data, access.condominium.id)
    : [access.condominium.id];

  const unitsResult =
    panelResult.ok && panelResult.data.mode === "block"
      ? {
          ok: true as const,
          data: panelResult.data.panel.units,
          condominiumNamesById: panelResult.data.panel.condominiumNamesById,
        }
      : await listUnitsByCondominium(access.condominium.id).then((result) =>
          result.ok
            ? {
                ok: true as const,
                data: result.data,
                condominiumNamesById: {} as Record<string, string>,
              }
            : { ok: false as const, error: result.error },
        );

  if (!unitsResult.ok) {
    return <ErrorAlert message={unitsResult.error} title="Erro ao carregar unidades" />;
  }

  const units = unitsResult.data
    .filter((unit) =>
      operationalIds.length > 1 ? operationalIds.includes(unit.tower.condominium_id) : true,
    )
    .map((unit) => ({
      id: unit.id,
      label: formatUnitOptionLabel(unit, unitsResult.condominiumNamesById),
    }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Nova ocorrência"
        description="Registro oficial para relatos, reclamações e eventos da portaria."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados da ocorrência</CardTitle>
        </CardHeader>
        <CardContent>
          <OccurrenceForm
            condoSlug={condoSlug}
            units={units}
            defaultOccurredAt={toDatetimeLocalValue(new Date())}
          />
        </CardContent>
      </Card>
    </div>
  );
}
