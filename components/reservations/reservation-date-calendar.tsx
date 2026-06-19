"use client";

import { useEffect, useState } from "react";
import { getReservationCalendarAction } from "@/lib/actions/reservation-calendar";
import type { ReservationCalendarDay } from "@/lib/reservations/calendar-availability";
import {
  getCurrentMonthKey,
  shiftMonthKey,
} from "@/lib/reservations/calendar-availability";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ReservationDateCalendarProps {
  condoSlug: string;
  areaId: string;
  value: string;
  onChange: (dateKey: string) => void;
}

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(year, month - 1, 1));
}

function getLeadingEmptyCells(monthKey: string): number {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).getDay();
}

export function ReservationDateCalendar({
  condoSlug,
  areaId,
  value,
  onChange,
}: ReservationDateCalendarProps) {
  const [month, setMonth] = useState(getCurrentMonthKey());
  const [days, setDays] = useState<ReservationCalendarDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!areaId) {
      setDays([]);
      return;
    }

    let cancelled = false;

    async function loadCalendar() {
      setLoading(true);
      setError(null);

      const result = await getReservationCalendarAction(condoSlug, areaId, month);

      if (cancelled) return;

      if (!result.ok) {
        setError(result.error);
        setDays([]);
      } else {
        setDays(result.days);
      }

      setLoading(false);
    }

    void loadCalendar();

    return () => {
      cancelled = true;
    };
  }, [areaId, condoSlug, month]);

  const leadingCells = getLeadingEmptyCells(month);

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setMonth((current) => shiftMonthKey(current, -1))}
        >
          Anterior
        </Button>
        <p className="text-sm font-medium capitalize">{formatMonthLabel(month)}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setMonth((current) => shiftMonthKey(current, 1))}
        >
          Próximo
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Carregando calendário...</p>
      ) : error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: leadingCells }).map((_, index) => (
            <div key={`empty-${index}`} />
          ))}
          {days.map((day) => {
            const dayNumber = day.date.slice(-2);
            const isSelected = value === day.date;

            return (
              <button
                key={day.date}
                type="button"
                disabled={!day.selectable}
                onClick={() => onChange(day.date)}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center rounded-md border px-1 py-2 text-xs transition-colors",
                  !day.selectable && "cursor-not-allowed border-dashed bg-muted/40 text-muted-foreground",
                  day.selectable && "hover:border-primary hover:bg-primary/5",
                  isSelected && "border-primary bg-primary/10 font-semibold text-primary",
                  day.status === "confirmed" &&
                    day.selectable &&
                    !isSelected &&
                    "border-amber-200 bg-amber-50 text-amber-900",
                  day.status === "prereserva" &&
                    "border-blue-200 bg-blue-50 text-blue-900",
                  day.status === "maintenance" && "border-red-200 bg-red-50 text-red-700",
                )}
              >
                <span>{dayNumber}</span>
                {day.label && (
                  <span className="mt-1 text-[10px] font-medium leading-tight">{day.label}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>Disponível</span>
        <span className="text-amber-800">Confirmado — reserva já existente no dia</span>
        <span className="text-blue-800">Pré-reserva — aguardando aprovação ou recibo</span>
        <span className="text-red-700">Manutenção — bloqueio da administração</span>
      </div>
    </div>
  );
}
