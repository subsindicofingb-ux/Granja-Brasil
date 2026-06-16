import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCondoAccess } from "@/lib/auth/access";
import { getCommonAreaById } from "@/lib/services/common-areas";
import { toCommonAreaFormInput } from "@/lib/common-areas/mappers";
import { ErrorAlert } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/page-shell";
import { CommonAreaForm } from "@/components/common-areas/common-area-form";
import { CommonAreaSummary } from "@/components/common-areas/common-area-summary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AreaDetailPageProps {
  params: Promise<{ condoSlug: string; areaId: string }>;
}

export default async function AreaDetailPage({ params }: AreaDetailPageProps) {
  const { condoSlug, areaId } = await params;
  const access = await requireCondoAccess(condoSlug);
  const result = await getCommonAreaById(areaId, access.condominium.id);

  if (result.error) {
    if (result.error.includes("não encontrado")) {
      notFound();
    }
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <ErrorAlert message={result.error} />
        <Button variant="outline" asChild>
          <Link href={`/app/${condoSlug}/areas`}>Voltar</Link>
        </Button>
      </div>
    );
  }

  const area = result.data;
  const canEdit = access.permissions.canManageAreas;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={area.name}
        description={
          canEdit
            ? "Edite o cadastro e as regras do espaço comum."
            : "Regras e disponibilidade do espaço."
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {canEdit ? "Editar espaço e regras" : "Resumo do espaço"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {canEdit ? (
            <CommonAreaForm
              condoSlug={condoSlug}
              mode="edit"
              defaultValues={{
                ...toCommonAreaFormInput(area),
                areaId: area.id,
              }}
            />
          ) : (
            <CommonAreaSummary area={area} />
          )}
        </CardContent>
      </Card>

      <Button variant="outline" asChild>
        <Link href={`/app/${condoSlug}/areas`}>Voltar</Link>
      </Button>
    </div>
  );
}
