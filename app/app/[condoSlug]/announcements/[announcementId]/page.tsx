import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCondoAccess } from "@/lib/auth/access";
import { getAnnouncementById } from "@/lib/services/announcements";
import { listTowersByCondominium } from "@/lib/services/towers";
import { toAnnouncementFormInput } from "@/lib/announcements/mappers";
import { getAnnouncementDisplayStatus } from "@/lib/announcements/status";
import {
  getAnnouncementPriorityBadgeClass,
  getAnnouncementPriorityLabel,
} from "@/lib/announcements/labels";
import { AnnouncementDisplayStatusBadge } from "@/components/announcements/announcement-display-status-badge";
import { AnnouncementForm } from "@/components/announcements/announcement-form";
import { ErrorAlert } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

interface AnnouncementDetailPageProps {
  params: Promise<{ condoSlug: string; announcementId: string }>;
}

export default async function AnnouncementDetailPage({ params }: AnnouncementDetailPageProps) {
  const { condoSlug, announcementId } = await params;
  const access = await requireCondoAccess(condoSlug);

  const [announcementResult, towersResult] = await Promise.all([
    getAnnouncementById(announcementId, access.condominium.id),
    listTowersByCondominium(access.condominium.id),
  ]);

  if (announcementResult.error) {
    if (announcementResult.error.includes("não encontrado")) {
      notFound();
    }
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <ErrorAlert message={announcementResult.error} />
        <Button variant="outline" asChild>
          <Link href={`/app/${condoSlug}/announcements`}>Voltar</Link>
        </Button>
      </div>
    );
  }

  const announcement = announcementResult.data;
  const canEdit = access.permissions.canManageAnnouncements;
  const displayStatus = getAnnouncementDisplayStatus(announcement);
  const towers = towersResult.data ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={announcement.title}
        description={
          canEdit ? "Edite o comunicado ou revise as informações de publicação." : "Comunicado do condomínio."
        }
      />

      {!canEdit && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div className="space-y-1">
              <CardTitle className="text-base">Detalhes</CardTitle>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(announcement.published_at)}
                {announcement.author && ` · ${announcement.author.full_name}`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className={getAnnouncementPriorityBadgeClass(announcement.priority)}>
                {getAnnouncementPriorityLabel(announcement.priority)}
              </Badge>
              <AnnouncementDisplayStatusBadge status={displayStatus} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {announcement.tower && (
              <p className="text-muted-foreground">Torre: {announcement.tower.name}</p>
            )}
            {announcement.expires_at && (
              <p className="text-muted-foreground">
                Expira em {formatDateTime(announcement.expires_at)}
              </p>
            )}
            <p className="whitespace-pre-wrap">{announcement.body}</p>
          </CardContent>
        </Card>
      )}

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Editar aviso</CardTitle>
          </CardHeader>
          <CardContent>
            <AnnouncementForm
              condoSlug={condoSlug}
              mode="edit"
              towers={towers.map((tower) => ({ id: tower.id, name: tower.name }))}
              defaultValues={{
                ...toAnnouncementFormInput(announcement),
                announcementId: announcement.id,
              }}
            />
          </CardContent>
        </Card>
      )}

      <Button variant="outline" asChild>
        <Link href={`/app/${condoSlug}/announcements`}>Voltar</Link>
      </Button>
    </div>
  );
}
