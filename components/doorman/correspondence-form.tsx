"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useActionState } from "react";
import { createCorrespondenceNoticeAction } from "@/lib/actions/correspondence";
import { formatCondominiumDisplayName } from "@/lib/condominiums/display";
import { formatUnitOptionLabel, formatUnitWithTower } from "@/lib/residents/labels";
import type { UnitWithTower } from "@/lib/services/units";
import { CORRESPONDENCE_RECIPIENT_OTHER } from "@/lib/validations/doorman.schema";
import { FormAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type UnitResidentOption = {
  id: string;
  unit_id: string;
  full_name: string;
  profile_id: string | null;
};

interface CorrespondenceFormProps {
  condoSlug: string;
  isGranjaSource?: boolean;
  isBlockSource?: boolean;
  condominiums?: Array<{ id: string; name: string; slug: string }>;
  units: UnitWithTower[];
  unitResidents: UnitResidentOption[];
  condominiumNamesById?: Record<string, string>;
}

export function CorrespondenceForm({
  condoSlug,
  isGranjaSource = false,
  isBlockSource = false,
  condominiums = [],
  units,
  unitResidents,
  condominiumNamesById = {},
}: CorrespondenceFormProps) {
  const isMultiCondoSource = isGranjaSource || isBlockSource;
  const [state, formAction, pending] = useActionState(createCorrespondenceNoticeAction, {});
  const [selectedCondominiumId, setSelectedCondominiumId] = useState(
    isMultiCondoSource ? (condominiums[0]?.id ?? "") : "",
  );
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [recipientSelection, setRecipientSelection] = useState("");
  const [manualRecipientName, setManualRecipientName] = useState("");

  const filteredUnits = useMemo(() => {
    if (!isMultiCondoSource) {
      return units;
    }

    if (!selectedCondominiumId) {
      return [];
    }

    return units.filter((unit) => unit.tower.condominium_id === selectedCondominiumId);
  }, [isMultiCondoSource, selectedCondominiumId, units]);

  const residentsForUnit = useMemo(
    () => unitResidents.filter((resident) => resident.profile_id && resident.unit_id === selectedUnitId),
    [selectedUnitId, unitResidents],
  );

  const isOtherRecipient = recipientSelection === CORRESPONDENCE_RECIPIENT_OTHER;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="condo_slug" value={condoSlug} />

      <FormAlert error={state.error} success={state.success} />

      {isMultiCondoSource && (
        <div className="space-y-2">
          <Label htmlFor="target_condominium_id">Condomínio</Label>
          <select
            id="target_condominium_id"
            name="target_condominium_id"
            value={selectedCondominiumId}
            onChange={(event) => {
              setSelectedCondominiumId(event.target.value);
              setSelectedUnitId("");
              setRecipientSelection("");
              setManualRecipientName("");
            }}
            className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
            required
          >
            <option value="">Selecione o condomínio</option>
            {condominiums
              .filter((condominium) => isBlockSource || condominium.slug !== condoSlug)
              .map((condominium) => (
                <option key={condominium.id} value={condominium.id}>
                  {formatCondominiumDisplayName(condominium.name, condominium.slug)}
                </option>
              ))}
          </select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="unit_id">Unidade destino</Label>
        <select
          id="unit_id"
          name="unit_id"
          value={selectedUnitId}
          onChange={(event) => {
            setSelectedUnitId(event.target.value);
            setRecipientSelection("");
            setManualRecipientName("");
          }}
          className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
          required
          disabled={isMultiCondoSource && !selectedCondominiumId}
        >
          <option value="">Selecione a unidade</option>
          {filteredUnits.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {isMultiCondoSource
                ? formatUnitOptionLabel(unit, condominiumNamesById)
                : formatUnitWithTower(unit)}
            </option>
          ))}
        </select>
      </div>

      {selectedUnitId && (
        <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
          <div className="space-y-2">
            <Label htmlFor="recipient_resident_id">Destinatário</Label>
            <select
              id="recipient_resident_id"
              name="recipient_resident_id"
              value={recipientSelection}
              onChange={(event) => {
                setRecipientSelection(event.target.value);
                if (event.target.value !== CORRESPONDENCE_RECIPIENT_OTHER) {
                  setManualRecipientName("");
                }
              }}
              className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm"
              required
            >
              <option value="">Selecione o destinatário</option>
              {residentsForUnit.map((resident) => (
                <option key={resident.id} value={resident.id}>
                  {resident.full_name}
                </option>
              ))}
              <option value={CORRESPONDENCE_RECIPIENT_OTHER}>Outros (informar nome manualmente)</option>
            </select>
          </div>

          {isOtherRecipient && (
            <div className="space-y-2">
              <Label htmlFor="recipient_name">Nome do destinatário</Label>
              <Input
                id="recipient_name"
                name="recipient_name"
                value={manualRecipientName}
                onChange={(event) => setManualRecipientName(event.target.value)}
                placeholder="Nome conforme consta na encomenda"
                required
              />
              <p className="text-xs text-muted-foreground">
                Se o nome não constar na unidade, o aviso será encaminhado ao morador responsável.
              </p>
            </div>
          )}

          {recipientSelection && !isOtherRecipient && (
            <p className="text-xs text-muted-foreground">
              O morador selecionado receberá o aviso por e-mail e no painel.
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="description">Descrição da correspondência</Label>
        <Input
          id="description"
          name="description"
          placeholder="Ex: Encomenda Amazon, carta registrada..."
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="carrier">Remetente / transportadora (opcional)</Label>
        <Input id="carrier" name="carrier" placeholder="Ex: Correios, Mercado Livre" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Observações (opcional)</Label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Registrando..." : "Registrar correspondência"}
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/app/${condoSlug}/correspondence`}>Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
