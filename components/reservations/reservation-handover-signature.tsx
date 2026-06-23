"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { collectReservationHandoverAction } from "@/lib/actions/reservations";
import { RESERVATION_HANDOVER_ACCEPTANCE_TEXT } from "@/lib/reservations/handover";
import { FormAlert } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface HandoverSignerOption {
  id: string;
  full_name: string;
}

interface ReservationHandoverSignatureProps {
  condoSlug: string;
  reservationId: string;
  signers: HandoverSignerOption[];
  defaultSignerId?: string | null;
}

export function ReservationHandoverSignature({
  condoSlug,
  reservationId,
  signers,
  defaultSignerId,
}: ReservationHandoverSignatureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [signatureData, setSignatureData] = useState("");
  const [selectedSignerId, setSelectedSignerId] = useState(defaultSignerId ?? signers[0]?.id ?? "");
  const [state, formAction, pending] = useActionState(collectReservationHandoverAction, {});

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#111827";
    context.lineWidth = 2;
    context.lineCap = "round";
    context.lineJoin = "round";
  }, []);

  function getCanvasPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  function startDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    drawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);
    const point = getCanvasPoint(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const point = getCanvasPoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function finishDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || !drawingRef.current) return;

    drawingRef.current = false;
    canvas.releasePointerCapture(event.pointerId);
    setSignatureData(canvas.toDataURL("image/png"));
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    setSignatureData("");
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="condo_slug" value={condoSlug} />
      <input type="hidden" name="reservation_id" value={reservationId} />
      <input type="hidden" name="signature_data" value={signatureData} />

      <FormAlert error={state.error} success={state.success} />

      <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
        {RESERVATION_HANDOVER_ACCEPTANCE_TEXT}
      </p>

      <div className="space-y-2">
        <Label htmlFor="resident_profile_id">Morador responsável</Label>
        <select
          id="resident_profile_id"
          name="resident_profile_id"
          required
          value={selectedSignerId}
          onChange={(event) => setSelectedSignerId(event.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        >
          {signers.map((signer) => (
            <option key={signer.id} value={signer.id}>
              {signer.full_name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label>Assinatura do morador</Label>
        <canvas
          ref={canvasRef}
          width={640}
          height={180}
          className="h-44 w-full touch-none rounded-md border bg-white"
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={finishDrawing}
          onPointerLeave={finishDrawing}
        />
        <p className="text-xs text-muted-foreground">
          Peça ao morador assinar com o dedo ou caneta stylus na tela.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={clearSignature}>
          Limpar assinatura
        </Button>
      </div>

      <Button type="submit" disabled={pending || !signatureData || !selectedSignerId}>
        {pending ? "Salvando..." : "Registrar aceite do morador"}
      </Button>
    </form>
  );
}
