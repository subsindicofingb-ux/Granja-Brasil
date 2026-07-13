"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { AnnouncementFormInput, AnnouncementResidentOption } from "@/lib/announcements/types";
import {
  GRANJA_AUDIENCE_OPTIONS,
  resolveGranjaAudienceFromForm,
  type GranjaAnnouncementAudience,
} from "@/lib/announcements/granja-audience";
import { formatAnnouncementResidentLabel } from "@/lib/announcements/resident-labels";
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
  const initialGranjaAudience = isGranjaSource
    ? resolveGranjaAudienceFromForm(defaultValues)
    : "all_blocks";
  const [granjaAudience, setGranjaAudience] =
    useState<GranjaAnnouncementAudience>(initialGranjaAudience);

  const selectedGranjaAudience = GRANJA_AUDIENCE_OPTIONS.find(
    (option) => option.value === granjaAudience,
  );
  const showGranjaBlockSelect =
    granjaAudience === "block_residents" || granjaAudience === "block_syndic";
  const showGranjaResidents = granjaAudience === "specific_residents";

  return (
    <form action={formAction} className="space-y-4" encType="multipart/form-data">
      <input type="hidden" name="condo_slug" value={condoSlug} />
      <input type="hidden" name="is_granja_source" value={isGranjaSource ? "1" : "0"} />
      {isGranjaSource && (
        <input type="hidden" name="granja_audience" value={granjaAudience} />
      )}
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

      {isGranjaSource ? (
        <>
          <fieldset className="space-y-3 rounded-lg border p-4">
            <legend className="px-1 text-sm font-medium">Quem deve receber este aviso?</legend>
            <div className="space-y-3">
              {GRANJA_AUDIENCE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-start gap-3 rounded-md border p-3"
                >
                  <input
                    type="radio"
                    name="granja_audience_choice"
                    value={option.value}
                    checked={granjaAudience === option.value}
                    onChange={() => setGranjaAudience(option.value)}
                    className="mt-1"
                  />
                  <span className="space-y-1">
                    <span className="block text-sm font-medium">{option.label}</span>
                    <span className="block text-xs text-muted-foreground">{option.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {showGranjaBlockSelect && (
            <fieldset className="space-y-3 rounded-lg border p-4">
              <legend className="px-1 text-sm font-medium">Bloco</legend>
              <div className="space-y-2">
                <Label htmlFor="granja_block_condominium_id">Selecione o bloco</Label>
                <select
                  id="granja_block_condominium_id"
                  name="granja_block_condominium_id"
                  defaultValue={defaultValues.granja_block_condominium_id ?? ""}
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="" disabled>
                    Escolha o bloco
                  </option>
                  {condominiums.map((condominium) => (
                    <option key={condominium.id} value={condominium.id}>
                      {condominium.name}
                    </option>
                  ))}
                </select>
              </div>
            </fieldset>
          )}

          {showGranjaResidents && (
            <fieldset className="space-y-3 rounded-lg border p-4">
              <legend className="px-1 text-sm font-medium">Moradores</legend>
              <div className="space-y-2">
                <Label>Selecione um ou mais moradores</Label>
                <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-3">
                  {residents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum morador disponível.</p>
                  ) : (
                    residents.map((resident) => {
                      const checked = defaultValues.target_profile_ids.includes(resident.profile_id);

                      return (
                        <label
                          key={resident.profile_id}
                          className="flex cursor-pointer items-start gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            name="target_profile_ids"
                            value={resident.profile_id}
                            defaultChecked={checked}
                            className="mt-0.5 rounded border"
                          />
                          <span>{formatAnnouncementResidentLabel(resident)}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </fieldset>
          )}

          {selectedGranjaAudience && (
            <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950">
              <strong>Resumo:</strong> {selectedGranjaAudience.description}
            </p>
          )}
        </>
      ) : (
        <>
          <fieldset className="space-y-3 rounded-lg border p-4">
            <legend className="px-1 text-sm font-medium">Alcance no condomínio</legend>
            <div className="space-y-2">
              <Label htmlFor="tower_id">Quem deve ver este aviso?</Label>
              <select
                id="tower_id"
                name="tower_id"
                defaultValue={defaultValues.tower_id ?? ""}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="">Todo o condomínio (todos os moradores e síndicos)</option>
                {towers.map((tower) => (
                  <option key={tower.id} value={tower.id}>
                    Somente moradores da torre: {tower.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Aviso para todo o condomínio chega a todos os moradores e também fica visível para
                a administração local.
              </p>
            </div>
          </fieldset>

          <fieldset className="space-y-3 rounded-lg border p-4">
            <legend className="px-1 text-sm font-medium">Moradores específicos (opcional)</legend>
            <div className="space-y-2">
              <Label>Substituir o alcance acima por pessoas selecionadas</Label>
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-3">
                {residents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum morador disponível.</p>
                ) : (
                  residents.map((resident) => {
                    const checked = defaultValues.target_profile_ids.includes(resident.profile_id);

                    return (
                      <label
                        key={resident.profile_id}
                        className="flex cursor-pointer items-start gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          name="target_profile_ids"
                          value={resident.profile_id}
                          defaultChecked={checked}
                          className="mt-0.5 rounded border"
                        />
                        <span>{formatAnnouncementResidentLabel(resident)}</span>
                      </label>
                    );
                  })
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Se marcar moradores aqui, o aviso deixa de ir para todo o condomínio ou torre e passa
                a ser exclusivo para as pessoas selecionadas.
              </p>
            </div>
          </fieldset>
        </>
      )}

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
