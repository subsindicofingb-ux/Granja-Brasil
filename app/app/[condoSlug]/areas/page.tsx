import Link from "next/link";
import { Plus } from "lucide-react";
import { Suspense } from "react";
import { requireCondoAccess } from "@/lib/auth/access";
import { listReservableCommonAreasForContext } from "@/lib/services/common-areas";
import { formatAllowedDays, formatMinutes } from "@/lib/common-areas/labels";
import { ErrorAlert } from "@/components/shared/feedback";
import { EmptyState, PageHeader } from "@/components/shared/page-shell";
import { AreaStatusFilter } from "@/components/common-areas/area-status-filter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface AreasPageProps {
  params: Promise<{ condoSlug: string }>;
  searchParams: Promise<{ status?: string }>;
}

function parseStatusFilter(status?: string): boolean | undefined {
  if (status === "active") return true;
  if (status === "inactive") return false;
  return undefined;
}

async function AreasHeader({ condoSlug }: { condoSlug: string }) {
  const access = await requireCondoAccess(condoSlug);

  return (
    <PageHeader
      title="Espaços comuns"
      description="Cadastro e regras dos espaços disponíveis para reserva."
      action={
        access.permissions.canManageAreas ? (
          <Button asChild>
            <Link href={`/app/${condoSlug}/areas/new`}>
              <Plus className="h-4 w-4" />
              Novo espaço
            </Link>
          </Button>
        ) : undefined
      }
    />
  );
}

async function AreasContent({
  condoSlug,
  statusFilter,
}: {
  condoSlug: string;
  statusFilter?: boolean;
}) {
  const access = await requireCondoAccess(condoSlug);
  const result = await listReservableCommonAreasForContext(
    {
      condominiumId: access.condominium.id,
      condominiumSlug: access.condominium.slug,
    },
    { isActive: statusFilter },
  );

  if (!result.ok) {
    return <ErrorAlert message={result.error} />;
  }

  const areas = result.data;
  const statusKey =
    statusFilter === true ? "active" : statusFilter === false ? "inactive" : "all";

  return (
    <div className="space-y-4">
      <AreaStatusFilter condoSlug={condoSlug} selected={statusKey} />

      {areas.length === 0 ? (
        <EmptyState
          title="Nenhum espaço encontrado"
          description={
            statusFilter !== undefined
              ? "Não há espaços com o filtro selecionado."
              : "Cadastre o primeiro espaço comum do condomínio."
          }
          action={
            access.permissions.canManageAreas ? (
              <Button asChild>
                <Link href={`/app/${condoSlug}/areas/new`}>Novo espaço</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {areas.map((area) => (
            <Card key={area.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{area.name}</CardTitle>
                  <Badge
                    className={
                      area.is_active
                        ? "border-green-200 bg-green-50 text-green-700"
                        : "border bg-muted text-muted-foreground"
                    }
                  >
                    {area.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <CardDescription>Capacidade: {area.capacity} pessoas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {area.description ?? "Sem descrição."}
                </p>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{area.operating_hours.start}–{area.operating_hours.end}</span>
                  <span>·</span>
                  <span>{formatAllowedDays(area.allowed_days)}</span>
                  {area.max_duration_minutes && (
                    <>
                      <span>·</span>
                      <span>Máx. {formatMinutes(area.max_duration_minutes)}</span>
                    </>
                  )}
                </div>
                {area.requires_approval && (
                  <Badge className="border-amber-200 bg-amber-50 text-amber-700">
                    Exige aprovação
                  </Badge>
                )}
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/app/${condoSlug}/areas/${area.id}`}>
                    {access.permissions.canManageAreas &&
                    area.condominium_id === access.condominium.id
                      ? "Editar regras"
                      : "Ver detalhes"}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AreasGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="h-48 animate-pulse rounded-xl border bg-muted/40" />
      ))}
    </div>
  );
}

export default async function AreasPage({ params, searchParams }: AreasPageProps) {
  const { condoSlug } = await params;
  const { status } = await searchParams;
  const statusFilter = parseStatusFilter(status);

  return (
    <div className="space-y-6">
      <Suspense fallback={<div className="h-16 animate-pulse rounded-lg bg-muted" />}>
        <AreasHeader condoSlug={condoSlug} />
      </Suspense>

      <Suspense fallback={<AreasGridSkeleton />}>
        <AreasContent condoSlug={condoSlug} statusFilter={statusFilter} />
      </Suspense>
    </div>
  );
}
