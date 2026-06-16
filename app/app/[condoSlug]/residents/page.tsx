import Link from "next/link";
import { Plus } from "lucide-react";
import { Suspense } from "react";
import { requireCondoAccess } from "@/lib/auth/access";
import { listTowersByCondominium } from "@/lib/services/towers";
import { listUnitsByCondominium } from "@/lib/services/units";
import { listResidentsByCondominium } from "@/lib/services/residents";
import { getResidentTypeLabel, formatUnitWithTower } from "@/lib/residents/labels";
import { isValidUuid } from "@/lib/utils";
import { ErrorAlert } from "@/components/shared/feedback";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState, PageHeader } from "@/components/shared/page-shell";
import { ResidentFilters } from "@/components/residents/resident-filters";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ResidentsPageProps {
  params: Promise<{ condoSlug: string }>;
  searchParams: Promise<{ tower?: string; unit?: string }>;
}

async function ResidentsHeader({ condoSlug }: { condoSlug: string }) {
  const access = await requireCondoAccess(condoSlug);

  return (
    <PageHeader
      title="Moradores"
      description="Proprietários, inquilinos, dependentes e responsáveis."
      action={
        access.permissions.canManageResidents ? (
          <Button asChild>
            <Link href={`/app/${condoSlug}/residents/new`}>
              <Plus className="h-4 w-4" />
              Novo morador
            </Link>
          </Button>
        ) : undefined
      }
    />
  );
}

async function ResidentsContent({
  condoSlug,
  towerId,
  unitId,
}: {
  condoSlug: string;
  towerId?: string;
  unitId?: string;
}) {
  const access = await requireCondoAccess(condoSlug);

  const [towersResult, allUnitsResult, residentsResult] = await Promise.all([
    listTowersByCondominium(access.condominium.id),
    listUnitsByCondominium(access.condominium.id),
    listResidentsByCondominium(access.condominium.id, { towerId, unitId }),
  ]);

  if (!towersResult.ok) {
    return <ErrorAlert message={towersResult.error} title="Erro ao carregar torres" />;
  }

  if (!allUnitsResult.ok) {
    return <ErrorAlert message={allUnitsResult.error} title="Erro ao carregar unidades" />;
  }

  if (!residentsResult.ok) {
    return <ErrorAlert message={residentsResult.error} title="Erro ao carregar moradores" />;
  }

  const towers = towersResult.data;
  const units = allUnitsResult.data;
  const residents = residentsResult.data;

  return (
    <div className="space-y-4">
      <ResidentFilters
        condoSlug={condoSlug}
        towers={towers.map((tower) => ({ id: tower.id, name: tower.name }))}
        units={units}
        selectedTowerId={towerId}
        selectedUnitId={unitId}
      />

      {units.length === 0 ? (
        <EmptyState
          title="Cadastre unidades primeiro"
          description="É necessário ter unidades antes de registrar moradores."
          action={
            access.permissions.canManageStructure ? (
              <Button asChild>
                <Link href={`/app/${condoSlug}/units/new`}>Nova unidade</Link>
              </Button>
            ) : undefined
          }
        />
      ) : residents.length === 0 ? (
        <EmptyState
          title={
            unitId || towerId ? "Nenhum morador neste filtro" : "Nenhum morador cadastrado"
          }
          description={
            unitId || towerId
              ? "Não há moradores para os filtros selecionados."
              : "Cadastre o primeiro morador do condomínio."
          }
          action={
            access.permissions.canManageResidents ? (
              <Button asChild>
                <Link
                  href={
                    unitId
                      ? `/app/${condoSlug}/residents/new?unit=${unitId}`
                      : `/app/${condoSlug}/residents/new`
                  }
                >
                  Novo morador
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Nome</th>
                <th className="px-4 py-3 text-left font-medium">Unidade</th>
                <th className="px-4 py-3 text-left font-medium">Tipo</th>
                <th className="px-4 py-3 text-left font-medium">Contato</th>
                <th className="px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {residents.map((resident) => (
                <tr key={resident.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{resident.full_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatUnitWithTower(resident.unit)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className="border bg-background">
                      {getResidentTypeLabel(resident.type)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {resident.email ?? resident.phone ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/app/${condoSlug}/residents/${resident.id}`}>
                        {access.permissions.canManageResidents ? "Editar" : "Detalhes"}
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default async function ResidentsPage({ params, searchParams }: ResidentsPageProps) {
  const { condoSlug } = await params;
  const { tower, unit } = await searchParams;
  const towerId = isValidUuid(tower) ? tower : undefined;
  const unitId = isValidUuid(unit) ? unit : undefined;

  return (
    <div className="space-y-6">
      <Suspense fallback={<div className="h-16 animate-pulse rounded-lg bg-muted" />}>
        <ResidentsHeader condoSlug={condoSlug} />
      </Suspense>

      <Suspense fallback={<TableSkeleton rows={5} cols={5} />}>
        <ResidentsContent condoSlug={condoSlug} towerId={towerId} unitId={unitId} />
      </Suspense>
    </div>
  );
}
