import Link from "next/link";
import { Plus } from "lucide-react";
import { Suspense } from "react";
import { requireCondoPermission } from "@/lib/auth/access";
import { canManageInCategory } from "@/lib/auth/permission-matrix";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { loadGeneralCondoPanelData } from "@/lib/condominiums/general-condo-data";
import { resolveDoormanOperationalPanel } from "@/lib/condominiums/doorman-panel";
import { getCondominiumBySlug } from "@/lib/services/condominiums-admin";
import { listTowersByCondominium } from "@/lib/services/towers";
import { listUnitsByCondominium } from "@/lib/services/units";
import { listResidentsByCondominium } from "@/lib/services/residents";
import { getResidentTypeLabel, formatUnitOptionLabel } from "@/lib/residents/labels";
import { isValidUuid } from "@/lib/utils";
import { ErrorAlert } from "@/components/shared/feedback";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState, PageHeader } from "@/components/shared/page-shell";
import { ResidentFilters } from "@/components/residents/resident-filters";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ResidentsPageProps {
  params: Promise<{ condoSlug: string }>;
  searchParams: Promise<{ tower?: string; unit?: string; condominium?: string }>;
}

async function ResidentsHeader({ condoSlug }: { condoSlug: string }) {
  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageResidents || ctx.permissions.canConsultResidents,
    { redirectTo: `/app/${condoSlug}` },
  );

  return (
    <PageHeader
      title="Moradores"
      description={
        access.permissions.canConsultResidents && !access.permissions.canManageResidents
          ? "Consulta de moradores cadastrados nas unidades."
          : "Proprietários, inquilinos, moradores e responsáveis."
      }
      action={
        access.permissions.canManageResidents ? (
          <Button asChild>
            <Link href={`/app/${condoSlug}/residents/new`}>
              <Plus className="h-4 w-4" />
              Novo morador
            </Link>
          </Button>
        ) : access.permissions.canRegisterResidentsWithApproval ? (
          <Button asChild>
            <Link href={`/app/${condoSlug}/residents/registration-request`}>
              Solicitar cadastro
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
  selectedCondominiumSlug,
}: {
  condoSlug: string;
  towerId?: string;
  unitId?: string;
  selectedCondominiumSlug?: string;
}) {
  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageResidents || ctx.permissions.canConsultResidents,
    { redirectTo: `/app/${condoSlug}` },
  );
  const isGeneralCondoPage = isGeneralCondominium(condoSlug);

  if (isGeneralCondoPage) {
    const panelResult = await loadGeneralCondoPanelData({
      condominiumSlug: selectedCondominiumSlug,
    });

    if (!panelResult.ok) {
      return <ErrorAlert message={panelResult.error} title="Erro ao carregar moradores" />;
    }

    const { condominiums, units, condominiumNamesById } = panelResult.data;
    const filteredCondominium = selectedCondominiumSlug
      ? condominiums.find((condominium) => condominium.slug === selectedCondominiumSlug)
      : undefined;

    const residentsResult = await listResidentsByCondominium({
      condominiumId: filteredCondominium?.id,
      unitId,
    });

    if (!residentsResult.ok) {
      return <ErrorAlert message={residentsResult.error} title="Erro ao carregar moradores" />;
    }

    const residents = residentsResult.data;

    return (
      <div className="space-y-4">
        <ResidentFilters
          condoSlug={condoSlug}
          units={units}
          condominiums={condominiums}
          condominiumNamesById={condominiumNamesById}
          selectedCondominiumSlug={selectedCondominiumSlug}
          selectedUnitId={unitId}
        />

        {residents.length === 0 ? (
          units.length === 0 &&
          (canManageInCategory(access, "structure") ||
            access.permissions.canManageResidents ||
            access.permissions.canRegisterResidentsWithApproval) ? (
            <EmptyState
              title="Cadastre unidades primeiro"
              description="É necessário ter unidades antes de registrar moradores."
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
            <EmptyState
              title={
                unitId || selectedCondominiumSlug
                  ? "Nenhum morador neste filtro"
                  : "Nenhum morador cadastrado"
              }
              description={
                unitId || selectedCondominiumSlug
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
                          : filteredCondominium
                            ? `/app/${condoSlug}/residents/new?condominium=${filteredCondominium.slug}`
                            : `/app/${condoSlug}/residents/new`
                      }
                    >
                      Novo morador
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          )
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
                      {formatUnitOptionLabel(resident.unit, condominiumNamesById)}
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

  const panelResult = await resolveDoormanOperationalPanel(condoSlug);
  if (panelResult.ok && panelResult.data.mode === "block") {
    const { panel } = panelResult.data;
    const filteredCondominium = selectedCondominiumSlug
      ? panel.condominiums.find((condominium) => condominium.slug === selectedCondominiumSlug)
      : undefined;

    const residentsResult = await listResidentsByCondominium({
      condominiumId: filteredCondominium?.id,
      unitId,
    });

    if (!residentsResult.ok) {
      return <ErrorAlert message={residentsResult.error} title="Erro ao carregar moradores" />;
    }

    const residents = residentsResult.data;

    return (
      <div className="space-y-4">
        <ResidentFilters
          condoSlug={condoSlug}
          units={panel.units}
          condominiums={panel.condominiums}
          condominiumNamesById={panel.condominiumNamesById}
          selectedCondominiumSlug={selectedCondominiumSlug}
          selectedUnitId={unitId}
        />

        {panel.units.length === 0 ? (
          <EmptyState
            title="Nenhuma unidade cadastrada"
            description="Não há unidades nos condomínios deste bloco."
          />
        ) : residents.length === 0 ? (
          <EmptyState
            title={
              unitId || selectedCondominiumSlug
                ? "Nenhum morador neste filtro"
                : "Nenhum morador cadastrado"
            }
            description={
              unitId || selectedCondominiumSlug
                ? "Não há moradores para os filtros selecionados."
                : "Não há moradores cadastrados neste bloco."
            }
            action={
              access.permissions.canRegisterResidentsWithApproval ? (
                <Button asChild>
                  <Link href={`/app/${condoSlug}/residents/registration-request`}>
                    Solicitar cadastro
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
                      {formatUnitOptionLabel(resident.unit, panel.condominiumNamesById)}
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

  const [towersResult, allUnitsResult, residentsResult] = await Promise.all([
    listTowersByCondominium(access.condominium.id),
    listUnitsByCondominium(access.condominium.id),
    listResidentsByCondominium({
      condominiumId: access.condominium.id,
      unitId,
    }),
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
  const filteredResidents = towerId
    ? residents.filter((resident) => resident.unit.tower_id === towerId)
    : residents;

  return (
    <div className="space-y-4">
      <ResidentFilters
        condoSlug={condoSlug}
        towers={towers.map((tower) => ({ id: tower.id, name: tower.name }))}
        units={units}
        selectedTowerId={towerId}
        selectedUnitId={unitId}
      />

      {filteredResidents.length === 0 ? (
        units.length === 0 &&
        (canManageInCategory(access, "structure") ||
          access.permissions.canManageResidents ||
          access.permissions.canRegisterResidentsWithApproval) ? (
          <EmptyState
            title="Cadastre unidades primeiro"
            description="É necessário ter unidades antes de registrar moradores."
            action={
              canManageInCategory(access, "structure") ? (
                <Button asChild>
                  <Link href={`/app/${condoSlug}/units/new`}>Nova unidade</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
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
        )
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
              {filteredResidents.map((resident) => (
                <tr key={resident.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{resident.full_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatUnitOptionLabel(resident.unit)}
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
  const { tower, unit, condominium } = await searchParams;
  const towerId = isValidUuid(tower) ? tower : undefined;
  const unitId = isValidUuid(unit) ? unit : undefined;
  const selectedCondominiumSlug = condominium?.trim().toLowerCase() || undefined;

  if (selectedCondominiumSlug) {
    if (isGeneralCondominium(condoSlug)) {
      const condominiumResult = await getCondominiumBySlug(selectedCondominiumSlug);
      if (!condominiumResult.ok) {
        return (
          <div className="space-y-6">
            <Suspense fallback={<div className="h-16 animate-pulse rounded-lg bg-muted" />}>
              <ResidentsHeader condoSlug={condoSlug} />
            </Suspense>
            <ErrorAlert message="Condomínio inválido para filtro." title="Filtro inválido" />
          </div>
        );
      }
    } else {
      const panelResult = await resolveDoormanOperationalPanel(condoSlug);
      if (panelResult.ok && panelResult.data.mode === "block") {
        const validSlugs = panelResult.data.panel.condominiums.map((condominium) => condominium.slug);
        if (!validSlugs.includes(selectedCondominiumSlug)) {
          return (
            <div className="space-y-6">
              <Suspense fallback={<div className="h-16 animate-pulse rounded-lg bg-muted" />}>
                <ResidentsHeader condoSlug={condoSlug} />
              </Suspense>
              <ErrorAlert message="Condomínio inválido para filtro." title="Filtro inválido" />
            </div>
          );
        }
      }
    }
  }

  return (
    <div className="space-y-6">
      <Suspense fallback={<div className="h-16 animate-pulse rounded-lg bg-muted" />}>
        <ResidentsHeader condoSlug={condoSlug} />
      </Suspense>

      <Suspense fallback={<TableSkeleton rows={5} cols={5} />}>
        <ResidentsContent
          condoSlug={condoSlug}
          towerId={towerId}
          unitId={unitId}
          selectedCondominiumSlug={selectedCondominiumSlug}
        />
      </Suspense>
    </div>
  );
}
