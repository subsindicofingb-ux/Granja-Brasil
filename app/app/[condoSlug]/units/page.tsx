import { isValidUuid } from "@/lib/utils";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Suspense } from "react";
import { requireCondoAccess } from "@/lib/auth/access";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { listTowersByCondominium } from "@/lib/services/towers";
import { listUnitsByCondominium } from "@/lib/services/units";
import { ErrorAlert } from "@/components/shared/feedback";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState, PageHeader } from "@/components/shared/page-shell";
import { TowerFilter } from "@/components/units/tower-filter";
import { Button } from "@/components/ui/button";

interface UnitsPageProps {
  params: Promise<{ condoSlug: string }>;
  searchParams: Promise<{ tower?: string }>;
}

async function UnitsHeader({ condoSlug }: { condoSlug: string }) {
  const access = await requireCondoAccess(condoSlug);

  return (
    <PageHeader
      title="Unidades"
      description="Apartamentos e salas vinculados às torres."
      action={
        access.permissions.canManageStructure ? (
          <Button asChild>
            <Link href={`/app/${condoSlug}/units/new`}>
              <Plus className="h-4 w-4" />
              Nova unidade
            </Link>
          </Button>
        ) : undefined
      }
    />
  );
}

async function UnitsContent({
  condoSlug,
  towerId,
}: {
  condoSlug: string;
  towerId?: string;
}) {
  const access = await requireCondoAccess(condoSlug);

  const [towersResult, unitsResult] = await Promise.all([
    listTowersByCondominium(access.condominium.id),
    listUnitsByCondominium(access.condominium.id, { towerId }),
  ]);

  if (!towersResult.ok) {
    return <ErrorAlert message={towersResult.error} title="Erro ao carregar torres" />;
  }

  if (!unitsResult.ok) {
    return <ErrorAlert message={unitsResult.error} title="Erro ao carregar unidades" />;
  }

  const towers = towersResult.data;
  const units = unitsResult.data;
  const requiresTowers = isGeneralCondominium(condoSlug);
  const showTowerFilter = requiresTowers;

  return (
    <div className="space-y-4">
      {showTowerFilter && (
        <TowerFilter
          condoSlug={condoSlug}
          towers={towers.map((tower) => ({ id: tower.id, name: tower.name }))}
          selectedTowerId={towerId}
        />
      )}

      {towers.length === 0 && requiresTowers ? (
        <EmptyState
          title="Cadastre torres primeiro"
          description="É necessário ter ao menos uma torre antes de registrar unidades."
          action={
            access.permissions.canManageStructure ? (
              <Button asChild>
                <Link href={`/app/${condoSlug}/towers/new`}>Nova torre</Link>
              </Button>
            ) : undefined
          }
        />
      ) : units.length === 0 ? (
        <EmptyState
          title={towerId ? "Nenhuma unidade nesta torre" : "Nenhuma unidade cadastrada"}
          description={
            towerId
              ? "Não há unidades para a torre selecionada."
              : "Cadastre a primeira unidade do condomínio."
          }
          action={
            access.permissions.canManageStructure ? (
              <Button asChild>
                <Link
                  href={
                    towerId
                      ? `/app/${condoSlug}/units/new?tower=${towerId}`
                      : `/app/${condoSlug}/units/new`
                  }
                >
                  Nova unidade
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
                <th className="px-4 py-3 text-left font-medium">Número</th>
                <th className="px-4 py-3 text-left font-medium">Torre</th>
                <th className="px-4 py-3 text-left font-medium">Bloco</th>
                <th className="px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => (
                <tr key={unit.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{unit.number}</td>
                  <td className="px-4 py-3 text-muted-foreground">{unit.tower.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{unit.block ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/app/${condoSlug}/units/${unit.id}`}>
                        {access.permissions.canManageStructure ? "Editar" : "Detalhes"}
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

export default async function UnitsPage({ params, searchParams }: UnitsPageProps) {
  const { condoSlug } = await params;
  const { tower } = await searchParams;
  const towerId = isValidUuid(tower) ? tower : undefined;

  return (
    <div className="space-y-6">
      <Suspense fallback={<div className="h-16 animate-pulse rounded-lg bg-muted" />}>
        <UnitsHeader condoSlug={condoSlug} />
      </Suspense>

      <Suspense fallback={<TableSkeleton rows={5} cols={4} />}>
        <UnitsContent condoSlug={condoSlug} towerId={towerId} />
      </Suspense>
    </div>
  );
}
