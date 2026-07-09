"use client";

import { useEffect, useMemo, useState } from "react";
import { getReservationTimeSlotsAction } from "@/lib/actions/reservation-time-slots";
import { formatMinutes } from "@/lib/common-areas/labels";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ReservationTimeSlotPickerProps {
  condoSlug: string;
  areaId: string;
  dateKey: string;
  startTime: string;
  durationMinutes: number;
  onStartTimeChange: (value: string) => void;
  onDurationChange: (value: number) => void;
}

export function ReservationTimeSlotPicker({
  condoSlug,
  areaId,
  dateKey,
  startTime,
  durationMinutes,
  onStartTimeChange,
  onDurationChange,
}: ReservationTimeSlotPickerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [durationOptions, setDurationOptions] = useState<number[]>([]);
  const [slotsByDuration, setSlotsByDuration] = useState<
    Record<number, { startTime: string; label: string }[]>
  >({});

  useEffect(() => {
    if (!areaId || !dateKey) {
      setDurationOptions([]);
      setSlotsByDuration({});
      return;
    }

    let cancelled = false;

    async function loadSlots() {
      setLoading(true);
      setError(null);

      const result = await getReservationTimeSlotsAction(condoSlug, areaId, dateKey);

      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setError(result.error);
        setDurationOptions([]);
        setSlotsByDuration({});
      } else {
        setDurationOptions(result.durationOptions);
        setSlotsByDuration(
          Object.fromEntries(
            Object.entries(result.slotsByDuration).map(([duration, slots]) => [
              Number(duration),
              slots.map((slot) => ({ startTime: slot.startTime, label: slot.label })),
            ]),
          ),
        );

        if (!result.durationOptions.includes(durationMinutes)) {
          onDurationChange(result.durationOptions[0] ?? 60);
        }
      }

      setLoading(false);
    }

    void loadSlots();

    return () => {
      cancelled = true;
    };
  }, [areaId, condoSlug, dateKey, durationMinutes, onDurationChange]);

  const availableSlots = useMemo(
    () => slotsByDuration[durationMinutes] ?? [],
    [durationMinutes, slotsByDuration],
  );

  useEffect(() => {
    if (
      availableSlots.length > 0 &&
      !availableSlots.some((slot) => slot.startTime === startTime)
    ) {
      onStartTimeChange(availableSlots[0].startTime);
    }
  }, [availableSlots, onStartTimeChange, startTime]);

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">Carregando horários disponíveis...</p>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (durationOptions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum horário disponível para a data selecionada.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {durationOptions.length > 1 && (
        <div className="space-y-2">
          <Label>Duração da reserva</Label>
          <div className="flex flex-wrap gap-2">
            {durationOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onDurationChange(option)}
                className={cn(
                  "rounded-md border px-3 py-2 text-sm",
                  durationMinutes === option
                    ? "border-primary bg-primary/5 font-medium"
                    : "border-input",
                )}
              >
                {formatMinutes(option)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Horário de início</Label>
        {availableSlots.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum turno livre com {formatMinutes(durationMinutes)} nesta data.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {availableSlots.map((slot) => (
              <button
                key={slot.startTime}
                type="button"
                onClick={() => onStartTimeChange(slot.startTime)}
                className={cn(
                  "rounded-md border px-3 py-2 text-left text-sm",
                  startTime === slot.startTime
                    ? "border-primary bg-primary/5 font-medium"
                    : "border-input",
                )}
              >
                {slot.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
