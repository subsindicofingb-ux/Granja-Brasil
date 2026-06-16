import Link from "next/link";
import { requireCondoPermission } from "@/lib/auth/access";
import { listRegistrationRequestsByCondominium } from "@/lib/services/registration-requests";
import { listUnitsByCondominium } from "@/lib/services/units";
import { RegistrationRequestList } from "@/components/registrations/registration-request-list";
import { ErrorAlert } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/page-shell";

interface RegistrationRequestsPageProps {
  params: Promise<{ condoSlug: string }>;
}

export default async function RegistrationRequestsPage({ params }: RegistrationRequestsPageProps) {
  const { condoSlug } = await params;

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageRegistrationRequests,
    { redirectTo: `/app/${condoSlug}/settings` },
  );

  const [requestsResult, unitsResult] = await Promise.all([
    listRegistrationRequestsByCondominium(access.condominium.id),
    listUnitsByCondominium(access.condominium.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Solicitações de cadastro"
        description="Novos moradores que se cadastraram e aguardam aprovação do síndico."
      />

      {!requestsResult.ok && (
        <ErrorAlert message={requestsResult.error ?? "Erro ao carregar solicitações."} />
      )}

      {requestsResult.ok && (
        <RegistrationRequestList
          condoSlug={condoSlug}
          requests={requestsResult.data ?? []}
          units={unitsResult.ok ? (unitsResult.data ?? []) : []}
        />
      )}
    </div>
  );
}
