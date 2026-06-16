import Link from "next/link";
import { Suspense } from "react";
import { requireCondoAccess } from "@/lib/auth/access";
import { redirect } from "next/navigation";
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

interface ConsultPageProps {
  params: Promise<{ condoSlug: string }>;
  searchParams: Promise<{ status?: string; guest_type?: string; q?: string; window?: string }>;
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

async function ConsultContent({
  condoSlug,
  status,
  guestType,
  search,
  consultWindowOnly,
}: {
  condoSlug: string;
  status: VisitorAuthorizationStatus | "all";
  guestType: GuestType | "all";
  search?: string;
  consultWindowOnly: boolean;
}) {
  const access = await requireCondoAccess(condoSlug);

  if (!access.permissions.canConsultVisitorAuthorizations) {
    redirect(`/app/${condoSlug}/visitors`);
  }

  const result = await listVisitorAuthorizationsByCondominium(access.condominium.id, {
    status,
    guestType,
    search,
    consultWindowOnly,
  });

  if (result.error) {
    return <ErrorAlert message={result.error} title="Erro na consulta" />;
  }

  const authorizations = result.data;

  return (
    <div className="space-y-4">
      <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
        {consultWindowOnly
          ? "Exibindo autorizações com janela de acesso intersectando hoje ±1 dia."
          : "Exibindo todas as autorizações (filtro de janela desativado)."}
      </p>

      <VisitorAuthorizationFilters
        condoSlug={condoSlug}
        basePath="visitors/consult"
        selectedStatus={status}
        selectedGuestType={guestType}
        search={search}
        showConsultWindow
        consultWindowOnly={consultWindowOnly}
      />

      {authorizations.length === 0 ? (
        <EmptyState
          title="Nenhuma autorização na janela"
          description="Ajuste os filtros ou verifique se há visitas previstas para hoje."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Nome</th>
                <th className="px-4 py-3 text-left font-medium">Documento</th>
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
                    <div className="text-xs text-muted-foreground">
                      {getGuestTypeLabel(authorization.guest_type)}
                      {authorization.company_name && ` · ${authorization.company_name}`}
                    </div>
                    {authorization.vehicle_plate && (
                      <div className="text-xs text-muted-foreground">
                        Placa: {authorization.vehicle_plate}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {authorization.document_number ?? "—"}
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

export default async function VisitorsConsultPage({ params, searchParams }: ConsultPageProps) {
  const { condoSlug } = await params;
  const { status, guest_type, q, window } = await searchParams;

  const consultWindowOnly = window !== "0";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Consulta — portaria"
        description="Painel operacional para verificar autorizações vigentes e próximas."
        action={
          <Button variant="outline" asChild>
            <Link href={`/app/${condoSlug}/visitors`}>Histórico completo</Link>
          </Button>
        }
      />

      <Suspense fallback={<TableSkeleton rows={5} cols={6} />}>
        <ConsultContent
          condoSlug={condoSlug}
          status={parseStatus(status)}
          guestType={parseGuestType(guest_type)}
          search={q?.trim() || undefined}
          consultWindowOnly={consultWindowOnly}
        />
      </Suspense>
    </div>
  );
}
