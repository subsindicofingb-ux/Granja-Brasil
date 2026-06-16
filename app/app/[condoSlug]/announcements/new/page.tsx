import { requireCondoPermission } from "@/lib/auth/access";
import { listTowersByCondominium } from "@/lib/services/towers";
import { createDefaultAnnouncementForm } from "@/lib/announcements/defaults";
import { toDatetimeLocalValue } from "@/lib/reservations/timezone";
import { PageHeader } from "@/components/shared/page-shell";
import { AnnouncementForm } from "@/components/announcements/announcement-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface NewAnnouncementPageProps {
  params: Promise<{ condoSlug: string }>;
}

export default async function NewAnnouncementPage({ params }: NewAnnouncementPageProps) {
  const { condoSlug } = await params;

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canManageAnnouncements,
    { redirectTo: `/app/${condoSlug}/announcements` },
  );

  const towersResult = await listTowersByCondominium(access.condominium.id);
  const towers = towersResult.data ?? [];

  const defaultValues = createDefaultAnnouncementForm(
    toDatetimeLocalValue(new Date().toISOString()),
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Novo aviso"
        description="Publique um comunicado para o condomínio ou para uma torre específica."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conteúdo do aviso</CardTitle>
        </CardHeader>
        <CardContent>
          <AnnouncementForm
            condoSlug={condoSlug}
            mode="create"
            towers={towers.map((tower) => ({ id: tower.id, name: tower.name }))}
            defaultValues={defaultValues}
          />
        </CardContent>
      </Card>
    </div>
  );
}
