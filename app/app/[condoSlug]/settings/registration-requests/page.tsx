import { requireCondoPermission } from "@/lib/auth/access";
import { ROLES } from "@/lib/constants";
import {
  listAllPendingRegistrationRequests,
  listRegistrationRequestsForCondominiums,
} from "@/lib/services/registration-requests";
import { getRegistrationScopeCondominiumIds } from "@/lib/registrations/scope";
import {
  loadActiveAccessDevicesByCondominiumIds,
  loadRegistrationRequestAccessDeviceIdsByRequestIds,
} from "@/lib/services/resident-access-grants";
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
  const scopeCondominiumIds = isGlobalView
    ? []
    : await getRegistrationScopeCondominiumIds({
        condoSlug,
        condominiumId: access.condominium.id,
      });
  const requestsResult = isGlobalView
    ? await listAllPendingRegistrationRequests()
    : await listRegistrationRequestsForCondominiums(scopeCondominiumIds, "pending");

  const requests = requestsResult.ok ? (requestsResult.data ?? []) : [];
  const condominiumIds = Array.from(new Set(requests.map((request) => request.condominium_id)));
  const requestIds = requests.map((request) => request.id);
  const [accessDevicesResult, requestAccessDevicesResult] = requestsResult.ok
    ? await Promise.all([
        loadActiveAccessDevicesByCondominiumIds(condominiumIds),
        loadRegistrationRequestAccessDeviceIdsByRequestIds(requestIds),
      ])
    : [{ ok: false as const, error: "" }, { ok: false as const, error: "" }];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Solicitações de cadastro"
        description={
          isGlobalView
            ? "Novos moradores de todos os condomínios aguardando liberação da administração geral."
            : scopeCondominiumIds.length > 1
              ? "Pré-cadastros pendentes dos condomínios deste bloco aguardando aprovação do síndico."
              : "Novos moradores que se cadastraram e aguardam aprovação do síndico."
        }
      />

      {!requestsResult.ok && (
        <ErrorAlert message={requestsResult.error ?? "Erro ao carregar solicitações."} />
      )}

      {requestsResult.ok && (
        <RegistrationRequestList
          condoSlug={condoSlug}
          requests={requests}
          showCondominium={isGlobalView || scopeCondominiumIds.length > 1}
          accessDevicesByCondominiumId={
            accessDevicesResult.ok ? accessDevicesResult.data : {}
          }
          requestAccessDeviceIdsByRequestId={
            requestAccessDevicesResult.ok ? requestAccessDevicesResult.data : {}
          }
        />
      )}
    </div>
  );
}
