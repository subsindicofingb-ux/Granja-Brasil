import { redirect } from "next/navigation";
import { requireCondoAccess } from "@/lib/auth/access";
import { listUnitsByCondominium } from "@/lib/services/units";
import { listUnitIdsForProfile } from "@/lib/services/reservations";
import { DEFAULT_VISITOR_AUTHORIZATION_FORM } from "@/lib/visitor-authorizations/defaults";
import { PageHeader } from "@/components/shared/page-shell";
import { VisitorAuthorizationForm } from "@/components/visitors/visitor-authorization-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface NewVisitorPageProps {
  params: Promise<{ condoSlug: string }>;
}

export default async function NewVisitorPage({ params }: NewVisitorPageProps) {
  const { condoSlug } = await params;
  const access = await requireCondoAccess(condoSlug);

  if (!access.permissions.canRegisterVisitorAuthorizations) {
    redirect(`/app/${condoSlug}/visitors`);
  }

  const isStaff = access.permissions.canManageVisitorAuthorizations;

  const [unitsResult, ownedUnitsResult] = await Promise.all([
    listUnitsByCondominium(access.condominium.id),
    isStaff
      ? Promise.resolve({ data: null as string[] | null, error: null as string | null })
      : listUnitIdsForProfile(access.profile.id, access.condominium.id),
  ]);

  let units = unitsResult.data ?? [];

  if (!isStaff && ownedUnitsResult.data) {
    const owned = new Set(ownedUnitsResult.data);
    units = units.filter((unit) => owned.has(unit.id));
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader
        title="Nova autorização"
        description={
          isStaff
            ? "Registro imediato como aprovado (staff)."
            : "Solicitação enviada para aprovação do condomínio."
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do visitante / prestador</CardTitle>
        </CardHeader>
        <CardContent>
          <VisitorAuthorizationForm
            condoSlug={condoSlug}
            mode="create"
            units={units}
            defaultValues={DEFAULT_VISITOR_AUTHORIZATION_FORM}
          />
        </CardContent>
      </Card>
    </div>
  );
}
