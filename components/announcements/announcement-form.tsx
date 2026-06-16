"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { AnnouncementFormInput } from "@/lib/announcements/types";
import {
  createAnnouncementAction,
  updateAnnouncementAction,
} from "@/lib/actions/announcements";
import {
  ANNOUNCEMENT_PRIORITY_OPTIONS,
  ANNOUNCEMENT_PUBLICATION_STATUS_OPTIONS,
} from "@/lib/announcements/labels";
import { FormAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AnnouncementFormProps {
  condoSlug: string;
  mode: "create" | "edit";
  towers: { id: string; name: string }[];
  defaultValues: AnnouncementFormInput & { announcementId?: string };
}

export function AnnouncementForm({
  condoSlug,
  mode,
  towers,
  defaultValues,
}: AnnouncementFormProps) {
  const action = mode === "create" ? createAnnouncementAction : updateAnnouncementAction;
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="condo_slug" value={condoSlug} />
      {mode === "edit" && defaultValues.announcementId && (
        <input type="hidden" name="announcement_id" value={defaultValues.announcementId} />
      )}

      <FormAlert error={state.error} success={state.success} />

      <div className="space-y-2">
        <Label htmlFor="title">Título</Label>
        <Input
          id="title"
          name="title"
          defaultValue={defaultValues.title}
          placeholder="Ex: Manutenção programada"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="priority">Prioridade</Label>
          <select
            id="priority"
            name="priority"
            defaultValue={defaultValues.priority}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            {ANNOUNCEMENT_PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="publication_status">Status de publicação</Label>
          <select
            id="publication_status"
            name="publication_status"
            defaultValue={defaultValues.publication_status}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            {ANNOUNCEMENT_PUBLICATION_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tower_id">Torre (opcional)</Label>
        <select
          id="tower_id"
          name="tower_id"
          defaultValue={defaultValues.tower_id ?? ""}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        >
          <option value="">Condomínio inteiro</option>
          {towers.map((tower) => (
            <option key={tower.id} value={tower.id}>
              {tower.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="published_at">Data de publicação</Label>
          <Input
            id="published_at"
            name="published_at"
            type="datetime-local"
            defaultValue={defaultValues.published_at}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expires_at">Expira em (opcional)</Label>
          <Input
            id="expires_at"
            name="expires_at"
            type="datetime-local"
            defaultValue={defaultValues.expires_at ?? ""}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="body">Conteúdo</Label>
        <textarea
          id="body"
          name="body"
          rows={6}
          defaultValue={defaultValues.body}
          placeholder="Descreva o aviso..."
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
          required
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Avisos publicados com data futura aparecem como agendados. Rascunhos ficam visíveis apenas
        para a administração.
      </p>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : mode === "create" ? "Publicar aviso" : "Salvar alterações"}
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/app/${condoSlug}/announcements`}>Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
