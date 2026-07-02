import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Suspense } from "react";
import { requireCondoAccess } from "@/lib/auth/access";
import { canManageInCategory } from "@/lib/auth/permission-matrix";
import { formatCondominiumDisplayName, isGeneralCondominium } from "@/lib/condominiums/display";
import { ROLES, DEMO_CONDO_SLUG } from "@/lib/constants";
import {
  getCondominiumBySlug,
  listCondominiums,
} from "@/lib/services/condominiums-admin";
import { listTowersByCondominium } from "@/lib/services/towers";
import { listUnitsByCondominium } from "@/lib/services/units";
import { ErrorAlert } from "@/components/shared/feedback";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState, PageHeader } from "@/components/shared/page-shell";
import { UnitsListControls } from "@/components/units/units-list-controls";
import { Button } from "@/components/ui/button";
import { parseUnitSort, sortUnits } from "@/lib/units/sort";

interface UnitsPageProps {
  params: Promise<{ condoSlug: string }>;
  searchParams: Promise<{ condominium?: string; sort?: string }>;
}

async function UnitsHeader({ condoSlug }: { condoSlug: string }) {
  const access = await requireCondoAccess(condoSlug);
  const canManageStructure = canManageInCategory(access, "structure");
  const canCreateCondominium =
    isGeneralCondominium(condoSlug) && access.role === ROLES.SUPER_ADMIN;

  return (
    <PageHeader
      title="Unidades"
      description="Apartamentos e salas vinculados às torres."
      action={
        canManageStructure || canCreateCondominium ? (
          <div className="flex flex-wrap gap-2">
            {canCreateCondominium && (
              <Button variant="outline" asChild>
                <Link href={`/app/${condoSlug}/units/condominiums/new`}>
                  <Plus className="h-4 w-4" />
                  Novo condomínio
                </Link>
              </Button>
            )}
            {canManageStructure && (
              <Button asChild>
                <Link href={`/app/${condoSlug}/units/new`}>
                  <Plus className="h-4 w-4" />
                  Nova unidade
                </Link>
              </Button>
            )}
          </div>
        ) : undefined
      }
    />
  );
}

async function UnitsContent({
  condoSlug,
  selectedCondominiumSlug,
  selectedSort,
}: {
  condoSlug: string;
  selectedCondominiumSlug?: string;
  selectedSort: ReturnType<typeof parseUnitSort>;
}) {
  const access = await requireCondoAccess(condoSlug);
  const isGeneralCondoPage = isGeneralCondominium(condoSlug);

  if (isGeneralCondoPage) {
    const condominiumsResult = await listCondominiums();
    if (!condominiumsResult.ok) {
      return (
        <ErrorAlert
          message={condominiumsResult.error}
          title="Erro ao carregar condomínios"
        />
      );
    }

    const condominiums = condominiumsResult.data;
    const filteredCondominium = selectedCondominiumSlug
      ? condominiums.find((condominium) => condominium.slug === selectedCondominiumSlug)
      : undefined;

    if (selectedCondominiumSlug && !filteredCondominium) {
      return <ErrorAlert message="Condomínio inválido para filtro." title="Filtro inválido" />;
    }

    const unitsResult = await listUnitsByCondominium(filteredCondominium?.id);
    if (!unitsResult.ok) {
      return <ErrorAlert message={unitsResult.error} title="Erro ao carregar unidades" />;
    }

    const units = sortUnits(
      unitsResult.data,
      selectedSort,
      (unit) => {
        const unitCondominium = condominiums.find(
          (condominium) => condominium.id === unit.tower.condominium_id,
        );
        return unitCondominium
          ? formatCondominiumDisplayName(unitCondominium.name, unitCondominium.slug)
          : "";
      },
    );
    const requiresTowersForView = filteredCondominium?.slug === DEMO_CONDO_SLUG;
    const towersResult = requiresTowersForView
      ? await listTowersByCondominium(filteredCondominium!.id)
      : null;
    const towers = towersResult?.ok ? towersResult.data : [];

    return (
      <div className="space-y-4">
        <UnitsListControls
          condoSlug={condoSlug}
          condominiums={condominiums}
          selectedCondominiumSlug={selectedCondominiumSlug}
          selectedSort={selectedSort}
          showCondominiumSort
        />

        {requiresTowersForView && towers.length === 0 ? (
          <EmptyState
            title="Cadastre torres primeiro"
            description="É necessário ter ao menos uma torre antes de registrar unidades."
            action={
              canManageInCategory(access, "structure") ? (
                <Button asChild>
                  <Link href={`/app/${condoSlug}/towers/new`}>Nova torre</Link>
                </Button>
              ) : undefined
            }
          />
        ) : units.length === 0 ? (
          <EmptyState
            title={
              filteredCondominium
                ? `Nenhuma unidade em ${formatCondominiumDisplayName(
                    filteredCondominium.name,
                    filteredCondominium.slug,
                  )}`
                : "Nenhuma unidade cadastrada"
            }
            description={
              filteredCondominium
                ? "Não há unidades para o condomínio selecionado."
                : "Cadastre a primeira unidade do condomínio."
            }
            action={
              canManageInCategory(access, "structure") ? (
                <Button asChild>
                  <Link
                    href={
                      filteredCondominium
                        ? `/app/${condoSlug}/units/new?condominium=${filteredCondominium.slug}`
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
                {units.map((unit) => {
                  const unitCondominium = condominiums.find(
                    (condominium) => condominium.id === unit.tower.condominium_id,
                  );

                  return (
                    <tr key={unit.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{unit.number}</td>
                      <td className="px-4 py-3 text-muted-foreground">{unit.tower.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{unit.block ?? "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link
                            href={`/app/${
                              unitCondominium?.slug ?? condoSlug
                            }/units/${unit.id}`}
                          >
                            {canManageInCategory(access, "structure") ? "Editar" : "Detalhes"}
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  const [towersResult, unitsResult] = await Promise.all([
    listTowersByCondominium(access.condominium.id),
    listUnitsByCondominium(access.condominium.id),
  ]);

  if (!towersResult.ok) {
    return <ErrorAlert message={towersResult.error} title="Erro ao carregar torres" />;
  }

  if (!unitsResult.ok) {
    return <ErrorAlert message={unitsResult.error} title="Erro ao carregar unidades" />;
  }

  const units = sortUnits(unitsResult.data, selectedSort);

  return (
    <div className="space-y-4">
      <UnitsListControls condoSlug={condoSlug} selectedSort={selectedSort} />

      {units.length === 0 ? (
        <EmptyState
          title="Nenhuma unidade cadastrada"
          description="Cadastre a primeira unidade do condomínio."
          action={
            canManageInCategory(access, "structure") ? (
              <Button asChild>
                <Link href={`/app/${condoSlug}/units/new`}>Nova unidade</Link>
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
                        {canManageInCategory(access, "structure") ? "Editar" : "Detalhes"}
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
  const { condominium: selectedCondominiumSlug, sort } = await searchParams;
  const normalizedCondominiumSlug = selectedCondominiumSlug?.trim().toLowerCase() || undefined;
  const selectedSort = parseUnitSort(sort?.trim().toLowerCase());

  if (normalizedCondominiumSlug) {
    const condominiumResult = await getCondominiumBySlug(normalizedCondominiumSlug);
    if (!condominiumResult.ok) {
      return (
        <div className="space-y-6">
          <Suspense fallback={<div className="h-16 animate-pulse rounded-lg bg-muted" />}>
            <UnitsHeader condoSlug={condoSlug} />
          </Suspense>
          <ErrorAlert message="Condomínio inválido para filtro." title="Filtro inválido" />
        </div>
      );
    }
  }

  return (
    <div className="space-y-6">
      <Suspense fallback={<div className="h-16 animate-pulse rounded-lg bg-muted" />}>
        <UnitsHeader condoSlug={condoSlug} />
      </Suspense>

      <Suspense fallback={<TableSkeleton rows={5} cols={4} />}>
        <UnitsContent
          condoSlug={condoSlug}
          selectedCondominiumSlug={normalizedCondominiumSlug}
          selectedSort={selectedSort}
        />
      </Suspense>
    </div>
  );
}
