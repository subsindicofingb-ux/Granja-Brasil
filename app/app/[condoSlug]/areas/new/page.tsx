import { requireCondoPermission } from "@/lib/auth/access";
import { DEFAULT_COMMON_AREA_FORM } from "@/lib/common-areas/defaults";
import { PageHeader } from "@/components/shared/page-shell";
import { CommonAreaForm } from "@/components/common-areas/common-area-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface NewAreaPageProps {
  params: Promise<{ condoSlug: string }>;
}

export default async function NewAreaPage({ params }: NewAreaPageProps) {
  const { condoSlug } = await params;

  await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageAreas,
    { redirectTo: `/app/${condoSlug}/areas` },
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Novo espaço comum"
        description="Cadastre o espaço e configure as regras para reservas futuras."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados e regras</CardTitle>
        </CardHeader>
        <CardContent>
          <CommonAreaForm
            condoSlug={condoSlug}
            mode="create"
            defaultValues={DEFAULT_COMMON_AREA_FORM}
          />
        </CardContent>
      </Card>
    </div>
  );
}
