import type { ReactNode } from "react";
import type { CommonAreaRecord } from "@/lib/common-areas/types";
import {
  formatAllowedDays,
  formatDays,
} from "@/lib/common-areas/labels";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface CommonAreaSummaryProps {
  area: CommonAreaRecord;
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium sm:text-right">{value}</span>
    </div>
  );
}

export function CommonAreaSummary({ area }: CommonAreaSummaryProps) {
  return (
    <div className="space-y-6 text-sm">
      <div className="flex flex-wrap gap-2">
        <Badge className={area.is_active ? "border-green-200 bg-green-50 text-green-700" : ""}>
          {area.is_active ? "Ativo" : "Inativo"}
        </Badge>
        {area.requires_approval && (
          <Badge className="border-amber-200 bg-amber-50 text-amber-700">
            Exige aprovação
          </Badge>
        )}
        {area.requires_payment && (
          <Badge className="border-purple-200 bg-purple-50 text-purple-700">
            Exige cobrança
          </Badge>
        )}
      </div>

      <div className="space-y-3">
        <Row label="Capacidade" value={`${area.capacity} pessoas`} />
        <Row label="Regras" value={area.description ?? "—"} />
      </div>

      <div className="space-y-3">
        <p className="font-medium">Regras de reserva</p>
        <Row
          label="Buffer entre reservas"
          value={formatDays(area.buffer_days, "0 dias")}
        />
        <Row
          label="Antecedência mínima"
          value={formatDays(area.min_advance_days, "0 dias")}
        />
        <Row label="Antecedência máxima" value={formatDays(area.max_advance_days)} />
        <Row
          label="Limite por unidade"
          value={
            area.max_reservations_per_unit
              ? `${area.max_reservations_per_unit} / ${area.reservation_period_days} dias`
              : "Sem limite"
          }
        />
        <Row
          label="Horário de funcionamento"
          value={`${area.operating_hours.start} – ${area.operating_hours.end}`}
        />
      </div>

      <div className="space-y-3">
        <p className="font-medium">Disponibilidade</p>
        <Row label="Dias permitidos" value={formatAllowedDays(area.allowed_days)} />
      </div>

      <div className="space-y-3">
        <p className="font-medium">Bloqueios / manutenção</p>
        {area.maintenance_blocks.length === 0 ? (
          <p className="text-muted-foreground">Nenhum bloqueio programado.</p>
        ) : (
          <ul className="space-y-2">
            {area.maintenance_blocks.map((block, index) => (
              <li key={index} className="rounded-md border p-3">
                <p className="font-medium">{block.title}</p>
                <p className="text-muted-foreground">
                  {formatDateTime(block.start_at)} — {formatDateTime(block.end_at)}
                </p>
                {block.reason && <p className="mt-1">{block.reason}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
