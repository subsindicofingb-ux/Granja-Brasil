import { requireCondoPermission } from "@/lib/auth/access";
import {
  formatCondominiumDisplayName,
  isGeneralCondominium,
} from "@/lib/condominiums/display";
import { ROLES } from "@/lib/constants";
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

  const isGranjaContext = isGeneralCondominium(condoSlug);
  if (
    isGranjaContext &&
    access.role !== ROLES.SUPER_ADMIN &&
    access.role !== ROLES.ADMIN
  ) {
    return (
      <ErrorAlert
        message="Somente Super Admin e Administrador registram ocorrências na Granja Brasil."
        title="Acesso restrito"
      />
    );
  }

  const unitsResult = await listUnitsByCondominium(access.condominium.id);
  if (!unitsResult.ok) {
    return <ErrorAlert message={unitsResult.error} title="Erro ao carregar unidades" />;
  }

  const units = unitsResult.data.map((unit) => ({
    id: unit.id,
    label: formatUnitOptionLabel(unit),
  }));

  const buildingLabel = formatCondominiumDisplayName(
    access.condominium.name,
    access.condominium.slug,
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Nova ocorrência"
        description="Escolha o destino: seu prédio (síndico) ou Granja Brasil (administração geral)."
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
            showGranjaDestination={!isGranjaContext}
            buildingLabel={buildingLabel}
          />
        </CardContent>
      </Card>
    </div>
  );
}
