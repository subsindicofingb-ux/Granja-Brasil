"use client";

import { useActionState } from "react";
import { submitReservationReceiptAction } from "@/lib/actions/reservations";
import { FormAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ReservationReceiptUploadProps {
  condoSlug: string;
  reservationId: string;
}

export function ReservationReceiptUpload({
  condoSlug,
  reservationId,
}: ReservationReceiptUploadProps) {
  const [state, formAction, pending] = useActionState(submitReservationReceiptAction, {});

  return (
    <form action={formAction} className="space-y-4" encType="multipart/form-data">
      <input type="hidden" name="condo_slug" value={condoSlug} />
      <input type="hidden" name="reservation_id" value={reservationId} />
      <FormAlert error={state.error} success={state.success} />

      <div className="space-y-2">
        <Label htmlFor="receipt">Recibo de pagamento</Label>
        <Input
          id="receipt"
          name="receipt"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          required
        />
        <p className="text-xs text-muted-foreground">
          Envie foto ou PDF do comprovante (máx. 5 MB). Após o envio, a reserva ficará pendente de
          autorização do administrador da Granja.
        </p>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Enviando..." : "Enviar recibo"}
      </Button>
    </form>
  );
}
