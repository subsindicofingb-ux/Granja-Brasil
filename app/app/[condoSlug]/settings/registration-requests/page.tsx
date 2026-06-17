import { requireCondoPermission } from "@/lib/auth/access";
import { ROLES } from "@/lib/constants";
import {
  listAllPendingRegistrationRequests,
  listRegistrationRequestsByCondominium,
} from "@/lib/services/registration-requests";
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

  const isGlobalView = access.role === ROLES.SUPER_ADMIN;
  const requestsResult = isGlobalView
    ? await listAllPendingRegistrationRequests()
    : await listRegistrationRequestsByCondominium(access.condominium.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Solicitações de cadastro"
        description={
          isGlobalView
            ? "Novos moradores de todos os condomínios aguardando liberação da administração geral."
            : "Novos moradores que se cadastraram e aguardam aprovação do síndico."
        }
      />

      {!requestsResult.ok && (
        <ErrorAlert message={requestsResult.error ?? "Erro ao carregar solicitações."} />
      )}

      {requestsResult.ok && (
        <RegistrationRequestList
          condoSlug={condoSlug}
          requests={requestsResult.data ?? []}
          showCondominium={isGlobalView}
        />
      )}
    </div>
  );
}
