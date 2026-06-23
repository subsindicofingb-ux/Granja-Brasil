"use client";

import Image from "next/image";
import { Label } from "@/components/ui/label";

interface PhotoFieldProps {
  label?: string;
  currentPhotoUrl?: string | null;
  inputName?: string;
  enableCamera?: boolean;
}

export function PhotoField({
  label = "Foto",
  currentPhotoUrl,
  inputName = "photo",
  enableCamera = false,
}: PhotoFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={inputName}>{label}</Label>

      {currentPhotoUrl ? (
        <div className="flex items-start gap-4">
          <div className="relative h-24 w-24 overflow-hidden rounded-lg border bg-muted">
            <Image
              src={currentPhotoUrl}
              alt={label}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" name="remove_photo" value="1" className="rounded border" />
            Remover foto atual
          </label>
        </div>
      ) : null}

      <input
        id={inputName}
        name={inputName}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture={enableCamera ? "environment" : undefined}
        className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium"
      />
      <p className="text-xs text-muted-foreground">
        {enableCamera
          ? "Use a câmera ou escolha um arquivo · JPG, PNG ou WebP · até 5 MB"
          : "JPG, PNG ou WebP · até 5 MB"}
      </p>
    </div>
  );
}
