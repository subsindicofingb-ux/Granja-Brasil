"use client";

import Image from "next/image";
import { useActionState } from "react";
import { updateResidentPhotoAction } from "@/lib/actions/residents";
import { FormAlert } from "@/components/shared/feedback";
import { PhotoField } from "@/components/shared/photo-field";
import { Button } from "@/components/ui/button";

interface ResidentPhotoFormProps {
  condoSlug: string;
  residentId: string;
  currentPhotoUrl?: string | null;
  enableCamera?: boolean;
}

export function ResidentPhotoForm({
  condoSlug,
  residentId,
  currentPhotoUrl,
  enableCamera = false,
}: ResidentPhotoFormProps) {
  const [state, formAction, pending] = useActionState(updateResidentPhotoAction, {});

  return (
    <form action={formAction} encType="multipart/form-data" className="space-y-3">
      <input type="hidden" name="condo_slug" value={condoSlug} />
      <input type="hidden" name="resident_id" value={residentId} />
      <input type="hidden" name="existing_photo_url" value={currentPhotoUrl ?? ""} />

      <FormAlert error={state.error} success={state.success} />

      <PhotoField
        label={currentPhotoUrl ? "Substituir foto" : "Incluir foto"}
        currentPhotoUrl={currentPhotoUrl}
        enableCamera={enableCamera}
      />

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Salvando foto..." : currentPhotoUrl ? "Atualizar foto" : "Salvar foto"}
      </Button>
    </form>
  );
}

interface ResidentPhotoPreviewProps {
  fullName: string;
  photoUrl?: string | null;
}

export function ResidentPhotoPreview({ fullName, photoUrl }: ResidentPhotoPreviewProps) {
  if (!photoUrl) {
    return (
      <div className="flex h-28 w-28 items-center justify-center rounded-lg border border-dashed bg-muted/40 text-xs text-muted-foreground">
        Sem foto
      </div>
    );
  }

  return (
    <div className="relative h-28 w-28 overflow-hidden rounded-lg border bg-muted">
      <Image
        src={photoUrl}
        alt={`Foto de ${fullName}`}
        fill
        className="object-cover"
        unoptimized
      />
    </div>
  );
}
