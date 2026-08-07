import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCondoPermission } from "@/lib/auth/access";
import { isEmployeeLimitedConsult } from "@/lib/auth/employee-consult";
import {
  getOperationalCondominiumIds,
  resolveDoormanOperationalPanel,
} from "@/lib/condominiums/doorman-panel";
import {
  getOccurrenceCategoryLabel,
  getOccurrenceStatusBadgeClass,
  getOccurrenceStatusLabel,
} from "@/lib/occurrences/labels";
import { formatUnitWithTower } from "@/lib/residents/labels";
import { getOccurrenceById } from "@/lib/services/occurrences";
import { OccurrenceStatusForm } from "@/components/occurrences/occurrence-status-form";
import { ErrorAlert, SuccessAlert } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

interface OccurrenceDetailPageProps {
  params: Promise<{ condoSlug: string; occurrenceId: string }>;
  searchParams: Promise<{ registrado?: string }>;
}

export default async function OccurrenceDetailPage({
  params,
  searchParams,
}: OccurrenceDetailPageProps) {
  const { condoSlug, occurrenceId } = await params;
  const { registrado } = await searchParams;

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canViewOccurrences || ctx.permissions.canRegisterOccurrences,
    { redirectTo: `/app/${condoSlug}/occurrences` },
  );

  const useAdmin = isEmployeeLimitedConsult(access.role);
  const panelResult = await resolveDoormanOperationalPanel(condoSlug);
  const operationalIds = panelResult.ok
    ? getOperationalCondominiumIds(panelResult.data, access.condominium.id)
    : [access.condominium.id];

  const result = await getOccurrenceById(occurrenceId, {
    useAdmin,
    condominiumIds: operationalIds.length > 1 ? operationalIds : undefined,
  });

  if (!result.ok) {
    if (result.error.includes("não encontrada")) {
      notFound();
    }
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <ErrorAlert message={result.error} />
        <Button variant="outline" asChild>
          <Link href={`/app/${condoSlug}/occurrences`}>Voltar</Link>
        </Button>
      </div>
    );
  }

  const occurrence = result.data;
  const canManage = access.permissions.canManageOccurrences;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={occurrence.title}
        description={`${getOccurrenceCategoryLabel(occurrence.category)} · registro oficial`}
        action={
          <Badge className={getOccurrenceStatusBadgeClass(occurrence.status)}>
            {getOccurrenceStatusLabel(occurrence.status)}
          </Badge>
        }
      />

      {registrado && <SuccessAlert message="Ocorrência registrada com sucesso." />}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalhes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
            <span className="text-muted-foreground">Quando</span>
            <span className="font-medium">{formatDateTime(occurrence.occurred_at)}</span>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
            <span className="text-muted-foreground">Registrado por</span>
            <span className="font-medium">{occurrence.author?.full_name ?? "—"}</span>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
            <span className="text-muted-foreground">Registrado em</span>
            <span className="font-medium">{formatDateTime(occurrence.created_at)}</span>
          </div>
          {occurrence.location_text && (
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
              <span className="text-muted-foreground">Local</span>
              <span className="font-medium">{occurrence.location_text}</span>
            </div>
          )}
          {occurrence.unit && (
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
              <span className="text-muted-foreground">Unidade</span>
              <span className="font-medium">{formatUnitWithTower(occurrence.unit)}</span>
            </div>
          )}
          <div className="space-y-1 border-t pt-3">
            <span className="text-muted-foreground">Descrição</span>
            <p className="whitespace-pre-wrap font-medium">{occurrence.description}</p>
          </div>
          {occurrence.closed_at && (
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between border-t pt-3">
              <span className="text-muted-foreground">Encerrada em</span>
              <span className="font-medium">
                {formatDateTime(occurrence.closed_at)}
                {occurrence.closed_by_profile
                  ? ` · ${occurrence.closed_by_profile.full_name}`
                  : ""}
              </span>
            </div>
          )}
          {canManage && occurrence.internal_notes && (
            <div className="space-y-1 border-t pt-3">
              <span className="text-muted-foreground">Observações internas</span>
              <p className="whitespace-pre-wrap font-medium">{occurrence.internal_notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Atualizar status</CardTitle>
          </CardHeader>
          <CardContent>
            <OccurrenceStatusForm
              condoSlug={condoSlug}
              occurrenceId={occurrence.id}
              currentStatus={occurrence.status}
              currentNotes={occurrence.internal_notes}
            />
          </CardContent>
        </Card>
      )}

      <Button variant="outline" asChild>
        <Link href={`/app/${condoSlug}/occurrences`}>Voltar</Link>
      </Button>
    </div>
  );
}
