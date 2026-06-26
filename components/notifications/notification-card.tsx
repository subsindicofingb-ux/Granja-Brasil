import Link from "next/link";
import { formatCondominiumDisplayName } from "@/lib/condominiums/display";
import { formatUnitWithTower } from "@/lib/residents/labels";
import type { UnitNotificationWithDetails } from "@/lib/notifications/types";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

interface NotificationCardProps {
  condoSlug: string;
  notification: UnitNotificationWithDetails;
  showSource?: boolean;
  showUnreadBadge?: boolean;
  showSentStatus?: boolean;
}

export function NotificationCard({
  condoSlug,
  notification,
  showSource = false,
  showUnreadBadge = false,
  showSentStatus = false,
}: NotificationCardProps) {
  const isUnread = showUnreadBadge && !showSentStatus && !notification.read_at;
  const hasActivity = notification.has_unread_activity;

  return (
    <Link
      href={`/app/${condoSlug}/notifications/${notification.id}`}
      className={`block rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/20 ${
        hasActivity ? "border-red-300 bg-red-50/40" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{notification.title}</h3>
            {isUnread && <Badge className="bg-red-600 hover:bg-red-600">Nova</Badge>}
            {!isUnread && hasActivity && (
              <Badge className="bg-red-600 hover:bg-red-600">Pendente</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {formatDateTime(notification.created_at)}
            {notification.author && ` · ${notification.author.full_name}`}
          </p>
        </div>
        {showSentStatus && (
          <div className="text-right text-xs">
            {notification.recipient_read_at ? (
              <span className="text-muted-foreground">
                Lida em {formatDateTime(notification.recipient_read_at)}
              </span>
            ) : (
              <Badge className="border-muted-foreground/30 bg-transparent text-muted-foreground">
                Aguardando leitura
              </Badge>
            )}
          </div>
        )}
      </div>

      <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{notification.body}</p>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {showSource && (
          <span>
            De:{" "}
            {formatCondominiumDisplayName(
              notification.source_condominium.name,
              notification.source_condominium.slug,
            )}
          </span>
        )}
        <span>
          Para:{" "}
          {formatCondominiumDisplayName(
            notification.target_condominium.name,
            notification.target_condominium.slug,
          )}
        </span>
        <span>Unidade: {formatUnitWithTower(notification.target_unit)}</span>
        {notification.attachment_url && <span>Com anexo</span>}
        {notification.reply_count > 0 && (
          <span>
            {notification.reply_count} resposta(s)
          </span>
        )}
      </div>
    </Link>
  );
}
