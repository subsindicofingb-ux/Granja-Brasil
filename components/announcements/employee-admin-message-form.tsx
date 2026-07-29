"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createEmployeeAdminMessageAction } from "@/lib/actions/announcements";
import { FormAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EmployeeAdminMessageFormProps {
  condoSlug: string;
  audienceLabel: string;
}

export function EmployeeAdminMessageForm({
  condoSlug,
  audienceLabel,
}: EmployeeAdminMessageFormProps) {
  const [state, formAction, pending] = useActionState(createEmployeeAdminMessageAction, {});

  return (
    <form action={formAction} className="space-y-4" encType="multipart/form-data">
      <input type="hidden" name="condo_slug" value={condoSlug} />

      <FormAlert error={state.error} success={state.success} />

      <div className="rounded-lg border border-sky-200 bg-sky-50/80 px-3 py-2 text-sm text-sky-950">
        Sua notificação será enviada para {audienceLabel}. Não é enviada a moradores.
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Assunto</Label>
        <Input
          id="title"
          name="title"
          placeholder="Ex: Solicitação de material / ocorrência"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="body">Mensagem</Label>
        <textarea
          id="body"
          name="body"
          rows={6}
          placeholder="Descreva a solicitação ou ocorrência..."
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="attachment">Anexo (opcional)</Label>
        <Input
          id="attachment"
          name="attachment"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
        />
        <p className="text-xs text-muted-foreground">JPG, PNG, WebP ou PDF (máx. 5 MB).</p>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Enviando..." : "Enviar notificação"}
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/app/${condoSlug}`}>Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
