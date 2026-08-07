import Link from "next/link";
import { Plus } from "lucide-react";
import { requireCondoPermission } from "@/lib/auth/access";
import { isEmployeeLimitedConsult } from "@/lib/auth/employee-consult";
import {
  getOperationalCondominiumIds,
  resolveDoormanOperationalPanel,
} from "@/lib/condominiums/doorman-panel";
import { OCCURRENCE_STATUS } from "@/lib/constants";
import type { OccurrenceStatus } from "@/lib/occurrences/types";
import {
  getOccurrenceCategoryLabel,
  getOccurrenceStatusBadgeClass,
  getOccurrenceStatusLabel,
} from "@/lib/occurrences/labels";
import { formatUnitWithTower } from "@/lib/residents/labels";
import { listOccurrences } from "@/lib/services/occurrences";
import { ErrorAlert, SuccessAlert } from "@/components/shared/feedback";
import { EmptyState, PageHeader } from "@/components/shared/page-shell";
import {
  MobileRecordCard,
  MobileRecordRow,
  ResponsiveRecords,
} from "@/components/shared/responsive-records";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";

interface OccurrencesPageProps {
  params: Promise<{ condoSlug: string }>;
  searchParams: Promise<{ registrado?: string; status?: string }>;
}

function parseStatus(value?: string): OccurrenceStatus | "all" {
  const values = Object.values(OCCURRENCE_STATUS);
  if (value && values.includes(value as OccurrenceStatus)) {
    return value as OccurrenceStatus;
  }
  return "all";
}

export default async function OccurrencesPage({
  params,
  searchParams,
}: OccurrencesPageProps) {
  const { condoSlug } = await params;
  const { registrado, status } = await searchParams;
  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canViewOccurrences || ctx.permissions.canRegisterOccurrences,
    { redirectTo: `/app/${condoSlug}` },
  );

  const selectedStatus = parseStatus(status);
  const useAdmin = isEmployeeLimitedConsult(access.role);
  const panelResult = await resolveDoormanOperationalPanel(condoSlug);
  const operationalIds = panelResult.ok
    ? getOperationalCondominiumIds(panelResult.data, access.condominium.id)
    : [access.condominium.id];

  const result = await listOccurrences({
    condominiumId: access.condominium.id,
    condominiumIds: operationalIds.length > 1 ? operationalIds : undefined,
    status: selectedStatus,
    useAdmin,
  });

  if (!result.ok) {
    return <ErrorAlert message={result.error} title="Erro ao carregar ocorrências" />;
  }

  const occurrences = result.data;
  const canRegister = access.permissions.canRegisterOccurrences;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ocorrências"
        description="Livro de registros oficiais da portaria e relatos dos moradores."
        action={
          canRegister ? (
            <Button asChild>
              <Link href={`/app/${condoSlug}/occurrences/new`}>
                <Plus className="h-4 w-4" />
                Nova ocorrência
              </Link>
            </Button>
          ) : undefined
        }
      />

      {registrado && <SuccessAlert message="Ocorrência registrada com sucesso." />}

      <div className="flex flex-wrap gap-2">
        {[
          { value: "all", label: "Todas" },
          { value: OCCURRENCE_STATUS.OPEN, label: "Abertas" },
          { value: OCCURRENCE_STATUS.IN_PROGRESS, label: "Em andamento" },
          { value: OCCURRENCE_STATUS.CLOSED, label: "Encerradas" },
        ].map((item) => {
          const href =
            item.value === "all"
              ? `/app/${condoSlug}/occurrences`
              : `/app/${condoSlug}/occurrences?status=${item.value}`;
          const active = selectedStatus === item.value;
          return (
            <Button key={item.value} variant={active ? "default" : "outline"} size="sm" asChild>
              <Link href={href}>{item.label}</Link>
            </Button>
          );
        })}
      </div>

      {occurrences.length === 0 ? (
        <EmptyState
          title="Nenhuma ocorrência"
          description="Registre relatos, reclamações ou eventos operacionais da portaria."
          action={
            canRegister ? (
              <Button asChild>
                <Link href={`/app/${condoSlug}/occurrences/new`}>Nova ocorrência</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ResponsiveRecords
          mobile={occurrences.map((occurrence) => (
            <MobileRecordCard key={occurrence.id}>
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-base font-semibold leading-snug">{occurrence.title}</p>
                <Badge className={getOccurrenceStatusBadgeClass(occurrence.status)}>
                  {getOccurrenceStatusLabel(occurrence.status)}
                </Badge>
              </div>
              <MobileRecordRow label="Tipo">
                {getOccurrenceCategoryLabel(occurrence.category)}
              </MobileRecordRow>
              <MobileRecordRow label="Quando">{formatDateTime(occurrence.occurred_at)}</MobileRecordRow>
              {occurrence.unit && (
                <MobileRecordRow label="Unidade">
                  {formatUnitWithTower(occurrence.unit)}
                </MobileRecordRow>
              )}
              <Button className="mt-1 w-full min-h-11" variant="outline" asChild>
                <Link href={`/app/${condoSlug}/occurrences/${occurrence.id}`}>Ver</Link>
              </Button>
            </MobileRecordCard>
          ))}
          desktop={
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Título</th>
                    <th className="px-4 py-3 text-left font-medium">Tipo</th>
                    <th className="px-4 py-3 text-left font-medium">Quando</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {occurrences.map((occurrence) => (
                    <tr key={occurrence.id} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium">{occurrence.title}</div>
                        {occurrence.unit && (
                          <div className="text-xs text-muted-foreground">
                            {formatUnitWithTower(occurrence.unit)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {getOccurrenceCategoryLabel(occurrence.category)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateTime(occurrence.occurred_at)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={getOccurrenceStatusBadgeClass(occurrence.status)}>
                          {getOccurrenceStatusLabel(occurrence.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/app/${condoSlug}/occurrences/${occurrence.id}`}>Ver</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          }
        />
      )}
    </div>
  );
}
