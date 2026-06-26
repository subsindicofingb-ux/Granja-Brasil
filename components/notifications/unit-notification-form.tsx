"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useActionState } from "react";
import { createUnitNotificationAction } from "@/lib/actions/notifications";
import { formatCondominiumDisplayName } from "@/lib/condominiums/display";
import { formatUnitOptionLabel } from "@/lib/residents/labels";
import type { UnitWithTower } from "@/lib/services/units";
import { FormAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface UnitNotificationFormProps {
  condoSlug: string;
  isGranjaSource: boolean;
  condominiums: Array<{ id: string; name: string; slug: string }>;
  units: UnitWithTower[];
  condominiumNamesById: Record<string, string>;
}

export function UnitNotificationForm({
  condoSlug,
  isGranjaSource,
  condominiums,
  units,
  condominiumNamesById,
}: UnitNotificationFormProps) {
  const [state, formAction, pending] = useActionState(createUnitNotificationAction, {});
  const [selectedCondominiumId, setSelectedCondominiumId] = useState(
    isGranjaSource ? (condominiums[0]?.id ?? "") : "",
  );

  const filteredUnits = useMemo(() => {
    if (!isGranjaSource) {
      return units;
    }

    if (!selectedCondominiumId) {
      return [];
    }

    return units.filter((unit) => unit.tower.condominium_id === selectedCondominiumId);
  }, [isGranjaSource, selectedCondominiumId, units]);

  return (
    <form action={formAction} className="space-y-4" encType="multipart/form-data">
      <input type="hidden" name="condo_slug" value={condoSlug} />

      <FormAlert error={state.error} success={state.success} />

      <div className="rounded-lg border border-sky-200 bg-sky-50/80 px-3 py-2 text-sm text-sky-950">
        A notificação será entregue ao morador responsável da unidade selecionada. Anexe um
        comprovante quando necessário.
      </div>

      {isGranjaSource && (
        <div className="space-y-2">
          <Label htmlFor="target_condominium_id">Condomínio</Label>
          <select
            id="target_condominium_id"
            name="target_condominium_id"
            value={selectedCondominiumId}
            onChange={(event) => setSelectedCondominiumId(event.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            required
          >
            <option value="">Selecione o condomínio</option>
            {condominiums.map((condominium) => (
              <option key={condominium.id} value={condominium.id}>
                {formatCondominiumDisplayName(condominium.name, condominium.slug)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="target_unit_id">Unidade</Label>
        <select
          id="target_unit_id"
          name="target_unit_id"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          required
          disabled={isGranjaSource && !selectedCondominiumId}
        >
          <option value="">Selecione a unidade</option>
          {filteredUnits.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {formatUnitOptionLabel(unit, condominiumNamesById)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Assunto</Label>
        <Input id="title" name="title" placeholder="Ex.: Multa por barulho" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="body">Mensagem</Label>
        <textarea
          id="body"
          name="body"
          rows={6}
          placeholder="Descreva a notificação formal..."
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="attachment">Anexo comprobatório (opcional)</Label>
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
          <Link href={`/app/${condoSlug}/notifications`}>Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
