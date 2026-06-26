import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCondoPermission } from "@/lib/auth/access";
import { formatCondominiumDisplayName } from "@/lib/condominiums/display";
import { formatUnitWithTower } from "@/lib/residents/labels";
import {
  getUnitNotificationById,
  markUnitNotificationAsRead,
} from "@/lib/services/notifications";
import { AnnouncementAttachmentLink } from "@/components/announcements/announcement-attachment-link";
import { ErrorAlert, SuccessAlert } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

interface NotificationDetailPageProps {
  params: Promise<{ condoSlug: string; notificationId: string }>;
  searchParams: Promise<{ enviado?: string }>;
}

export default async function NotificationDetailPage({
  params,
  searchParams,
}: NotificationDetailPageProps) {
  const { condoSlug, notificationId } = await params;
  const { enviado } = await searchParams;

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canSendUnitNotifications || ctx.permissions.canViewUnitNotifications,
    { redirectTo: `/app/${condoSlug}/notifications` },
  );

  const notificationResult = await getUnitNotificationById(notificationId, access.profile.id);

  if (!notificationResult.ok) {
    if (notificationResult.error.includes("não encontrada")) {
      notFound();
    }

    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <ErrorAlert message={notificationResult.error} />
        <Button variant="outline" asChild>
          <Link href={`/app/${condoSlug}/notifications`}>Voltar</Link>
        </Button>
      </div>
    );
  }

  const notification = notificationResult.data;
  const isRecipient = notification.target_profile_id === access.profile.id;

  if (isRecipient && !notification.read_at) {
    await markUnitNotificationAsRead({
      notificationId,
      profileId: access.profile.id,
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {enviado === "1" && (
        <SuccessAlert message="Notificação enviada ao morador responsável da unidade." />
      )}

      <PageHeader
        title={notification.title}
        description="Notificação formal com registro de entrega à unidade."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalhes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground">Enviada em</p>
              <p className="font-medium">{formatDateTime(notification.created_at)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Remetente</p>
              <p className="font-medium">
                {notification.author?.full_name ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Origem</p>
              <p className="font-medium">
                {formatCondominiumDisplayName(
                  notification.source_condominium.name,
                  notification.source_condominium.slug,
                )}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Condomínio destino</p>
              <p className="font-medium">
                {formatCondominiumDisplayName(
                  notification.target_condominium.name,
                  notification.target_condominium.slug,
                )}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Unidade</p>
              <p className="font-medium">{formatUnitWithTower(notification.target_unit)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Morador responsável</p>
              <p className="font-medium">{notification.target_resident?.full_name ?? "—"}</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="whitespace-pre-wrap">{notification.body}</p>
            {notification.attachment_url && (
              <div className="mt-3">
                <AnnouncementAttachmentLink
                  url={notification.attachment_url}
                  name={notification.attachment_name}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Button variant="outline" asChild>
        <Link href={`/app/${condoSlug}/notifications`}>Voltar</Link>
      </Button>
    </div>
  );
}
