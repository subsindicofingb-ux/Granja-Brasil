import Link from "next/link";
import { requireCondoPermission } from "@/lib/auth/access";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { listUnitsByCondominium } from "@/lib/services/units";
import { CorrespondenceForm } from "@/components/doorman/correspondence-form";
import { ErrorAlert } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface NewCorrespondencePageProps {
  params: Promise<{ condoSlug: string }>;
}

export default async function NewCorrespondencePage({ params }: NewCorrespondencePageProps) {
  const { condoSlug } = await params;

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageCorrespondence,
  );

  if (isGeneralCondominium(condoSlug)) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <ErrorAlert message="Correspondências são registradas nos condomínios filhos." />
        <Button variant="outline" asChild>
          <Link href={`/app/${condoSlug}`}>Voltar</Link>
        </Button>
      </div>
    );
  }

  const unitsResult = await listUnitsByCondominium(access.condominium.id);
  const units = unitsResult.ok ? unitsResult.data : [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Nova correspondência"
        description="Registre encomenda ou carta e avise o morador responsável da unidade por e-mail."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados da correspondência</CardTitle>
        </CardHeader>
        <CardContent>
          <CorrespondenceForm condoSlug={condoSlug} units={units} />
        </CardContent>
      </Card>
    </div>
  );
}
