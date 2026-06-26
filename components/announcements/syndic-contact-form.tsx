"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createStaffToGranjaAnnouncementAction } from "@/lib/actions/announcements";
import { FormAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SyndicContactFormProps {
  condoSlug: string;
}

export function SyndicContactForm({ condoSlug }: SyndicContactFormProps) {
  const [state, formAction, pending] = useActionState(createStaffToGranjaAnnouncementAction, {});

  return (
    <form action={formAction} className="space-y-4" encType="multipart/form-data">
      <input type="hidden" name="condo_slug" value={condoSlug} />

      <FormAlert error={state.error} success={state.success} />

      <div className="rounded-lg border border-violet-200 bg-violet-50/80 px-3 py-2 text-sm text-violet-950">
        Sua mensagem será enviada à administração Granja Brasil. Você poderá acompanhar a
        conversa em Avisos.
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Assunto</Label>
        <Input
          id="title"
          name="title"
          placeholder="Ex: Dúvida sobre assembleia geral"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="body">Mensagem</Label>
        <textarea
          id="body"
          name="body"
          rows={6}
          placeholder="Descreva sua solicitação ou dúvida..."
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
          {pending ? "Enviando..." : "Enviar mensagem"}
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/app/${condoSlug}/announcements`}>Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
