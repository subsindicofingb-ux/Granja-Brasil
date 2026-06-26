"use client";

import { useActionState } from "react";
import { replyUnitNotificationAction } from "@/lib/actions/notifications";
import { FormAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface NotificationReplyFormProps {
  condoSlug: string;
  notificationId: string;
}

export function NotificationReplyForm({
  condoSlug,
  notificationId,
}: NotificationReplyFormProps) {
  const [state, formAction, pending] = useActionState(replyUnitNotificationAction, {});

  return (
    <form action={formAction} className="space-y-4" encType="multipart/form-data">
      <input type="hidden" name="condo_slug" value={condoSlug} />
      <input type="hidden" name="notification_id" value={notificationId} />

      <FormAlert error={state.error} success={state.success} />

      <div className="space-y-2">
        <Label htmlFor="notification_reply_body">Resposta</Label>
        <textarea
          id="notification_reply_body"
          name="body"
          rows={4}
          placeholder="Escreva sua resposta..."
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notification_reply_attachment">Anexo (opcional)</Label>
        <Input
          id="notification_reply_attachment"
          name="attachment"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
        />
        <p className="text-xs text-muted-foreground">JPG, PNG, WebP ou PDF (máx. 5 MB).</p>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Enviando..." : "Enviar resposta"}
      </Button>
    </form>
  );
}
