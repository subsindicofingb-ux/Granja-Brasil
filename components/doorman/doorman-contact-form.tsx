"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  createDoormanToResidentAnnouncementAction,
  createStaffToGranjaAnnouncementAction,
} from "@/lib/actions/announcements";
import { formatAnnouncementResidentLabel } from "@/lib/announcements/resident-labels";
import type { AnnouncementResidentTarget } from "@/lib/services/residents";
import { FormAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DoormanContactFormProps {
  condoSlug: string;
  residents: AnnouncementResidentTarget[];
}

export function DoormanContactForm({ condoSlug, residents }: DoormanContactFormProps) {
  const [destination, setDestination] = useState<"granja" | "resident">("granja");
  const [granjaState, granjaAction, granjaPending] = useActionState(
    createStaffToGranjaAnnouncementAction,
    {},
  );
  const [residentState, residentAction, residentPending] = useActionState(
    createDoormanToResidentAnnouncementAction,
    {},
  );

  const pending = destination === "granja" ? granjaPending : residentPending;
  const state = destination === "granja" ? granjaState : residentState;

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setDestination("granja")}
          className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
            destination === "granja"
              ? "border-violet-300 bg-violet-50 text-violet-950"
              : "hover:bg-muted/40"
          }`}
        >
          <span className="block font-medium">Granja Brasil</span>
          <span className="mt-1 block text-xs text-muted-foreground">
            Mensagem à administração geral
          </span>
        </button>
        <button
          type="button"
          onClick={() => setDestination("resident")}
          className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
            destination === "resident"
              ? "border-sky-300 bg-sky-50 text-sky-950"
              : "hover:bg-muted/40"
          }`}
        >
          <span className="block font-medium">Morador</span>
          <span className="mt-1 block text-xs text-muted-foreground">
            Mensagem individual a um morador
          </span>
        </button>
      </div>

      <form
        action={destination === "granja" ? granjaAction : residentAction}
        className="space-y-4"
        encType="multipart/form-data"
      >
        <input type="hidden" name="condo_slug" value={condoSlug} />

        <FormAlert error={state.error} success={state.success} />

        {destination === "resident" && (
          <div className="space-y-2">
            <Label htmlFor="target_profile_id">Morador</Label>
            <select
              id="target_profile_id"
              name="target_profile_id"
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
              required
            >
              <option value="">Selecione o morador</option>
              {residents.map((resident) =>
                resident.profile_id ? (
                  <option key={resident.profile_id} value={resident.profile_id}>
                    {formatAnnouncementResidentLabel(resident)}
                  </option>
                ) : null,
              )}
            </select>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="doorman_contact_title">Assunto</Label>
          <Input id="doorman_contact_title" name="title" required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="doorman_contact_body">Mensagem</Label>
          <textarea
            id="doorman_contact_body"
            name="body"
            rows={6}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="doorman_contact_attachment">Anexo (opcional)</Label>
          <Input
            id="doorman_contact_attachment"
            name="attachment"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
          />
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
    </div>
  );
}
