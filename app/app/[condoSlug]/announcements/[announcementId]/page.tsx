import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { requireCondoAccess } from "@/lib/auth/access";
import { notifyAnnouncementRead } from "@/lib/email/announcement-notifications";
import { isAnnouncementVisibleInContext } from "@/lib/announcements/context-visibility";
import { isGeneralCondominium } from "@/lib/condominiums/display";
import { getGranjaCondominiumId } from "@/lib/condominiums/granja-shared-areas";
import {
  getAnnouncementById,
  listAnnouncementReadReceipts,
  listAnnouncementReplies,
  markAnnouncementAsRead,
  type AnnouncementReadReceipt,
} from "@/lib/services/announcements";
import { listCondominiums } from "@/lib/services/condominiums-admin";
import { listResidentsWithProfileForAnnouncement } from "@/lib/services/residents";
import { listTowersByCondominium } from "@/lib/services/towers";
import { toAnnouncementFormInput } from "@/lib/announcements/mappers";
import { getAnnouncementDisplayStatus } from "@/lib/announcements/status";
import { formatAnnouncementAudienceLabel } from "@/lib/announcements/targeting";
import { formatAnnouncementResidentLabel } from "@/lib/announcements/resident-labels";
import {
  getAnnouncementPriorityBadgeClass,
  getAnnouncementPriorityLabel,
} from "@/lib/announcements/labels";
import { AnnouncementAttachmentLink } from "@/components/announcements/announcement-attachment-link";
import { AnnouncementDisplayStatusBadge } from "@/components/announcements/announcement-display-status-badge";
import { AnnouncementForm } from "@/components/announcements/announcement-form";
import { AnnouncementReadReceipts } from "@/components/announcements/announcement-read-receipts";
import { AnnouncementReadTracker } from "@/components/announcements/announcement-read-tracker";
import { AnnouncementReplyForm } from "@/components/announcements/announcement-reply-form";
import { ErrorAlert, SuccessAlert } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

interface AnnouncementDetailPageProps {
  params: Promise<{ condoSlug: string; announcementId: string }>;
  searchParams: Promise<{ enviado?: string }>;
}

export default async function AnnouncementDetailPage({
  params,
  searchParams,
}: AnnouncementDetailPageProps) {
  const { condoSlug, announcementId } = await params;
  const { enviado } = await searchParams;
  const access = await requireCondoAccess(condoSlug);
  const isGranjaSource = isGeneralCondominium(condoSlug);

  const [announcementResult, repliesResult, towersResult, condominiumsResult, residentsResult] =
    await Promise.all([
      getAnnouncementById(announcementId, access.condominium.id),
      listAnnouncementReplies(announcementId),
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

  const isAuthor = announcement.created_by === access.profile.id;
  const isResidentView = !access.permissions.canManageAnnouncements;
  const showEditForm =
    access.permissions.canManageAnnouncements &&
    !announcement.staff_only &&
    !announcement.parent_id &&
    announcement.condominium_id === access.condominium.id;
  const displayStatus = getAnnouncementDisplayStatus(announcement);
  const towers = towersResult.ok ? towersResult.data : [];
  const condominiums = (
    condominiumsResult?.ok ? condominiumsResult.data : []
  ).filter((condominium) => condominium.id !== access.condominium.id);
  const residents = residentsResult.ok ? residentsResult.data : [];
  const replies = repliesResult.ok ? repliesResult.data : [];

  const targetCondominiumName = announcement.target_condominium_id
    ? condominiums.find((condominium) => condominium.id === announcement.target_condominium_id)
        ?.name
    : null;
  const targetResident = announcement.target_profile_id
    ? residents.find((resident) => resident.profile_id === announcement.target_profile_id)
    : null;
  const targetProfileName = targetResident
    ? formatAnnouncementResidentLabel(targetResident)
    : null;
  const audienceLabel = formatAnnouncementAudienceLabel({
    announcement,
    targetCondominiumName,
    targetProfileName,
    isGranjaSource: isGranjaSource || announcement.condominium_id !== access.condominium.id,
  });

  let readAt: string | null = null;
  let readError: string | null = null;
  let readReceipts: AnnouncementReadReceipt[] = [];
  const hasReplyFromOthers = replies.some(
    (reply) => reply.created_by !== access.profile.id,
  );
  const shouldTrackRead = !isAuthor || hasReplyFromOthers;
  const showReplyForm =
    !announcement.parent_id &&
    (access.permissions.canManageAnnouncements ||
      (access.permissions.canSendAnnouncements && announcement.staff_only));

  if (!isAuthor) {
    const readResult = await markAnnouncementAsRead({
      announcementId,
      profileId: access.profile.id,
    });
    if (readResult.ok) {
      readAt = readResult.data.read_at;
      if (
        readResult.data.is_new_read &&
        announcement.created_by &&
        announcement.created_by !== access.profile.id
      ) {
        after(async () => {
          try {
            await notifyAnnouncementRead({
              announcement,
              readerProfileId: access.profile.id,
              readerName: access.profile.fullName,
            });
          } catch (error) {
            console.error("[email:announcement-read]", error);
          }
        });
      }
    } else {
      readError = readResult.error;
    }
  } else {
    if (hasReplyFromOthers) {
      const readResult = await markAnnouncementAsRead({
        announcementId,
        profileId: access.profile.id,
      });

      if (readResult.ok) {
        readAt = readResult.data.read_at;
      } else {
        readError = readResult.error;
      }
    }

    const receiptsResult = await listAnnouncementReadReceipts(announcementId);
    readReceipts = receiptsResult.ok ? receiptsResult.data : [];
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {enviado === "1" && (
        <SuccessAlert message="Mensagem enviada com sucesso. Acompanhe a conversa abaixo." />
      )}
      {shouldTrackRead && (
        <AnnouncementReadTracker condoSlug={condoSlug} announcementId={announcementId} />
      )}
      <PageHeader
        title={announcement.title}
        description={
          showEditForm
            ? "Edite o comunicado ou revise as confirmações de leitura."
            : "Comunicado do condomínio."
        }
      />

      {!showEditForm && (
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
            {announcement.expires_at && !isResidentView && (
              <p className="text-muted-foreground">
                Expira em {formatDateTime(announcement.expires_at)}
              </p>
            )}
            {!isAuthor && readAt && (
              <p className="text-muted-foreground">
                Leitura confirmada em {formatDateTime(readAt)}
              </p>
            )}
            {isAuthor && readAt && (
              <p className="text-muted-foreground">
                Resposta visualizada em {formatDateTime(readAt)}
              </p>
            )}
            {isAuthor && readError && (
              <p className="text-amber-700">
                Não foi possível registrar a visualização da resposta. Tente abrir novamente.
              </p>
            )}
            {!isAuthor && readError && (
              <p className="text-amber-700">
                Não foi possível registrar a confirmação de leitura. Tente abrir novamente.
              </p>
            )}
            <p className="whitespace-pre-wrap">{announcement.body}</p>
            {announcement.attachment_url && (
              <AnnouncementAttachmentLink
                url={announcement.attachment_url}
                name={announcement.attachment_name}
              />
            )}
          </CardContent>
        </Card>
      )}

      {isAuthor && (
        <AnnouncementReadReceipts receipts={readReceipts} />
      )}

      {replies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Respostas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {replies.map((reply) => (
              <div key={reply.id} className="rounded-lg border p-3 text-sm">
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(reply.created_at)}
                  {reply.author && ` · ${reply.author.full_name}`}
                </p>
                <p className="mt-2 whitespace-pre-wrap">{reply.body}</p>
                {reply.attachment_url && (
                  <div className="mt-2">
                    <AnnouncementAttachmentLink
                      url={reply.attachment_url}
                      name={reply.attachment_name}
                    />
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!announcement.parent_id && showReplyForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Responder</CardTitle>
          </CardHeader>
          <CardContent>
            <AnnouncementReplyForm condoSlug={condoSlug} parentAnnouncementId={announcementId} />
          </CardContent>
        </Card>
      )}

      {showEditForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Editar aviso</CardTitle>
          </CardHeader>
          <CardContent>
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
