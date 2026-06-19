import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCondoAccess } from "@/lib/auth/access";
import { isAnnouncementVisibleInContext } from "@/lib/announcements/context-visibility";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { getGranjaCondominiumId } from "@/lib/condominiums/granja-shared-areas";
import {
  getAnnouncementById,
  listAnnouncementReadReceipts,
  markAnnouncementAsRead,
  type AnnouncementReadReceipt,
} from "@/lib/services/announcements";
import { listCondominiums } from "@/lib/services/condominiums-admin";
import { listResidentsWithProfileForAnnouncement } from "@/lib/services/residents";
import { listTowersByCondominium } from "@/lib/services/towers";
import { toAnnouncementFormInput } from "@/lib/announcements/mappers";
import { getAnnouncementDisplayStatus } from "@/lib/announcements/status";
import { formatAnnouncementAudienceLabel } from "@/lib/announcements/targeting";
import {
  getAnnouncementPriorityBadgeClass,
  getAnnouncementPriorityLabel,
} from "@/lib/announcements/labels";
import { AnnouncementDisplayStatusBadge } from "@/components/announcements/announcement-display-status-badge";
import { AnnouncementForm } from "@/components/announcements/announcement-form";
import { AnnouncementReadReceipts } from "@/components/announcements/announcement-read-receipts";
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
  const isGranjaSource = isGeneralCondominium(condoSlug);

  const [announcementResult, towersResult, condominiumsResult, residentsResult] =
    await Promise.all([
      getAnnouncementById(announcementId, access.condominium.id),
      listTowersByCondominium(access.condominium.id),
      isGranjaSource ? listCondominiums() : Promise.resolve(null),
      listResidentsWithProfileForAnnouncement(
        isGranjaSource
          ? {
              includeAllSubCondominiums: true,
              excludeCondominiumId: access.condominium.id,
            }
          : { condominiumId: access.condominium.id },
      ),
    ]);

  if (!announcementResult.ok) {
    if (announcementResult.error?.includes("não encontrado")) {
      notFound();
    }
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <ErrorAlert message={announcementResult.error ?? "Aviso não encontrado neste condomínio."} />
        <Button variant="outline" asChild>
          <Link href={`/app/${condoSlug}/announcements`}>Voltar</Link>
        </Button>
      </div>
    );
  }

  const announcement = announcementResult.data;

  const granjaCondominiumId = await getGranjaCondominiumId();
  const viewContext = {
    condominiumId: access.condominium.id,
    profileId: access.profile.id,
    isStaff: access.permissions.canManageAnnouncements,
  };

  if (!isAnnouncementVisibleInContext(announcement, viewContext, granjaCondominiumId)) {
    notFound();
  }

  const canManage = access.permissions.canManageAnnouncements;
  const isSender = canManage && announcement.condominium_id === access.condominium.id;
  const displayStatus = getAnnouncementDisplayStatus(announcement);
  const towers = towersResult.ok ? towersResult.data : [];
  const condominiums = (
    condominiumsResult?.ok ? condominiumsResult.data : []
  ).filter((condominium) => condominium.id !== access.condominium.id);
  const residents = residentsResult.ok ? residentsResult.data : [];

  const targetCondominiumName = announcement.target_condominium_id
    ? condominiums.find((condominium) => condominium.id === announcement.target_condominium_id)
        ?.name
    : null;
  const targetProfileName = announcement.target_profile_id
    ? residents.find((resident) => resident.profile_id === announcement.target_profile_id)
        ?.full_name
    : null;
  const audienceLabel = formatAnnouncementAudienceLabel({
    announcement,
    targetCondominiumName,
    targetProfileName,
    isGranjaSource: isGranjaSource || announcement.condominium_id !== access.condominium.id,
  });

  let readAt: string | null = null;
  let readReceipts: AnnouncementReadReceipt[] = [];

  if (!isSender) {
    const readResult = await markAnnouncementAsRead({
      announcementId,
      profileId: access.profile.id,
    });
    readAt = readResult.ok ? readResult.data.read_at : null;
  } else {
    const receiptsResult = await listAnnouncementReadReceipts(announcementId);
    readReceipts = receiptsResult.ok ? receiptsResult.data : [];
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={announcement.title}
        description={
          isSender
            ? "Edite o comunicado ou revise as confirmações de leitura."
            : "Comunicado do condomínio."
        }
      />

      {!isSender && (
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
            <p className="text-muted-foreground">Destino: {audienceLabel}</p>
            {announcement.expires_at && (
              <p className="text-muted-foreground">
                Expira em {formatDateTime(announcement.expires_at)}
              </p>
            )}
            {readAt && (
              <p className="text-muted-foreground">
                Leitura confirmada em {formatDateTime(readAt)}
              </p>
            )}
            <p className="whitespace-pre-wrap">{announcement.body}</p>
          </CardContent>
        </Card>
      )}

      {isSender && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Editar aviso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <AnnouncementReadReceipts receipts={readReceipts} />
            <AnnouncementForm
              condoSlug={condoSlug}
              mode="edit"
              isGranjaSource={isGranjaSource}
              towers={towers.map((tower) => ({ id: tower.id, name: tower.name }))}
              condominiums={condominiums.map((condominium) => ({
                id: condominium.id,
                name: condominium.name,
              }))}
              residents={residents}
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
