import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Suspense } from "react";
import { requireCondoAccess } from "@/lib/auth/access";
import {
  GUEST_TYPE,
  VISITOR_AUTHORIZATION_STATUS,
  type GuestType,
  type VisitorAuthorizationStatus,
} from "@/lib/constants";
import { formatUnitWithTower } from "@/lib/residents/labels";
import { listVisitorAuthorizationsByCondominium } from "@/lib/services/visitor-authorizations";
import { getGuestTypeLabel } from "@/lib/visitor-authorizations/labels";
import { ErrorAlert } from "@/components/shared/feedback";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState, PageHeader } from "@/components/shared/page-shell";
import { VisitorAuthorizationFilters } from "@/components/visitors/visitor-authorization-filters";
import { VisitorDisplayStatusBadge } from "@/components/visitors/visitor-display-status-badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";

interface VisitorsPageProps {
  params: Promise<{ condoSlug: string }>;
  searchParams: Promise<{ status?: string; guest_type?: string; q?: string }>;
}

function parseStatus(value?: string): VisitorAuthorizationStatus | "all" {
  const values = Object.values(VISITOR_AUTHORIZATION_STATUS);
  if (value && values.includes(value as VisitorAuthorizationStatus)) {
    return value as VisitorAuthorizationStatus;
  }
  return "all";
}

function parseGuestType(value?: string): GuestType | "all" {
  const values = Object.values(GUEST_TYPE);
  if (value && values.includes(value as GuestType)) {
    return value as GuestType;
  }
  return "all";
}

async function VisitorsHeader({ condoSlug }: { condoSlug: string }) {
  const access = await requireCondoAccess(condoSlug);

  if (!access.permissions.canViewVisitorAuthorizations) {
    return null;
  }

  return (
    <PageHeader
      title="Visitantes e prestadores"
      description="Autorizações de acesso por unidade. Histórico completo do condomínio."
      action={
        <div className="flex flex-wrap gap-2">
          {access.permissions.canConsultVisitorAuthorizations && (
            <Button variant="outline" asChild>
              <Link href={`/app/${condoSlug}/visitors/consult`}>
                <Search className="h-4 w-4" />
                Consulta portaria
              </Link>
            </Button>
          )}
          {access.permissions.canRegisterVisitorAuthorizations && (
            <Button asChild>
              <Link href={`/app/${condoSlug}/visitors/new`}>
                <Plus className="h-4 w-4" />
                Nova autorização
              </Link>
            </Button>
          )}
        </div>
      }
    />
  );
}

async function VisitorsContent({
  condoSlug,
  status,
  guestType,
  search,
}: {
  condoSlug: string;
  status: VisitorAuthorizationStatus | "all";
  guestType: GuestType | "all";
  search?: string;
}) {
  const access = await requireCondoAccess(condoSlug);

  if (!access.permissions.canViewVisitorAuthorizations) {
    return <ErrorAlert message="Sem permissão para visualizar autorizações." />;
  }

  const result = await listVisitorAuthorizationsByCondominium(access.condominium.id, {
    status,
    guestType,
    search,
  });

  if (result.error) {
    return (
      <ErrorAlert message={result.error} title="Erro ao carregar autorizações" />
    );
  }

  const authorizations = result.data;

  return (
    <div className="space-y-4">
      <VisitorAuthorizationFilters
        condoSlug={condoSlug}
        selectedStatus={status}
        selectedGuestType={guestType}
        search={search}
      />

      {authorizations.length === 0 ? (
        <EmptyState
          title="Nenhuma autorização encontrada"
          description={
            status !== "all" || guestType !== "all" || search
              ? "Não há registros com os filtros selecionados."
              : "Registre a primeira autorização de visitante ou prestador."
          }
          action={
            access.permissions.canRegisterVisitorAuthorizations ? (
              <Button asChild>
                <Link href={`/app/${condoSlug}/visitors/new`}>Nova autorização</Link>
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
                <th className="px-4 py-3 text-left font-medium">Tipo</th>
                <th className="px-4 py-3 text-left font-medium">Unidade</th>
                <th className="px-4 py-3 text-left font-medium">Período</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {authorizations.map((authorization) => (
                <tr key={authorization.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{authorization.full_name}</div>
                    {authorization.vehicle_plate && (
                      <div className="text-xs text-muted-foreground">
                        Placa: {authorization.vehicle_plate}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {getGuestTypeLabel(authorization.guest_type)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatUnitWithTower(authorization.unit)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div>{formatDateTime(authorization.access_starts_at)}</div>
                    <div className="text-xs">até {formatDateTime(authorization.access_ends_at)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <VisitorDisplayStatusBadge record={authorization} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/app/${condoSlug}/visitors/${authorization.id}`}>Ver</Link>
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

export default async function VisitorsPage({ params, searchParams }: VisitorsPageProps) {
  const { condoSlug } = await params;
  const { status, guest_type, q } = await searchParams;

  return (
    <div className="space-y-6">
      <Suspense fallback={<div className="h-16 animate-pulse rounded-lg bg-muted" />}>
        <VisitorsHeader condoSlug={condoSlug} />
      </Suspense>

      <Suspense fallback={<TableSkeleton rows={5} cols={6} />}>
        <VisitorsContent
          condoSlug={condoSlug}
          status={parseStatus(status)}
          guestType={parseGuestType(guest_type)}
          search={q?.trim() || undefined}
        />
      </Suspense>
    </div>
  );
}
