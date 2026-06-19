"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { AnnouncementFormInput, AnnouncementResidentOption } from "@/lib/announcements/types";
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
  isGranjaSource: boolean;
  towers: { id: string; name: string }[];
  condominiums: { id: string; name: string }[];
  residents: AnnouncementResidentOption[];
  defaultValues: AnnouncementFormInput & { announcementId?: string };
}

export function AnnouncementForm({
  condoSlug,
  mode,
  isGranjaSource,
  towers,
  condominiums,
  residents,
  defaultValues,
}: AnnouncementFormProps) {
  const action = mode === "create" ? createAnnouncementAction : updateAnnouncementAction;
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-4" encType="multipart/form-data">
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

      <fieldset className="space-y-3 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">Condomínio</legend>
        {isGranjaSource ? (
          <div className="space-y-2">
            <Label htmlFor="target_condominium_id">Destino do aviso</Label>
            <select
              id="target_condominium_id"
              name="target_condominium_id"
              defaultValue={defaultValues.target_condominium_id ?? ""}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="">Todo o condomínio (todos os blocos)</option>
              {condominiums.map((condominium) => (
                <option key={condominium.id} value={condominium.id}>
                  {condominium.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Avisos para um condomínio específico aparecem na caixa do síndico daquele bloco.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="tower_id">Alcance dentro do condomínio</Label>
            <select
              id="tower_id"
              name="tower_id"
              defaultValue={defaultValues.tower_id ?? ""}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="">Todo o condomínio</option>
              {towers.map((tower) => (
                <option key={tower.id} value={tower.id}>
                  {tower.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-3 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">Morador específico</legend>
        <div className="space-y-2">
          <Label htmlFor="target_profile_id">Enviar apenas para um morador (opcional)</Label>
          <select
            id="target_profile_id"
            name="target_profile_id"
            defaultValue={defaultValues.target_profile_id ?? ""}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="">Nenhum — usar destino do condomínio acima</option>
            {residents.map((resident) => (
              <option key={resident.profile_id} value={resident.profile_id}>
                {resident.condominium_name
                  ? `${resident.full_name} · ${resident.condominium_name}`
                  : resident.full_name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Quando selecionado, o aviso fica visível somente para esse morador (com confirmação de
            leitura automática).
          </p>
        </div>
      </fieldset>

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

      <p className="text-xs text-muted-foreground">
        Avisos publicados com data futura aparecem como agendados. Rascunhos ficam visíveis apenas
        para a administração. A leitura é confirmada automaticamente ao abrir o aviso.
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
