"use client";

import type {
  AllowedDay,
  BookingMode,
  ClassSession,
  CommonAreaFormInput,
  MaintenanceBlock,
} from "@/lib/common-areas/types";
import { ALLOWED_DAY_OPTIONS } from "@/lib/common-areas/labels";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AllowedDaysFieldProps {
  value: AllowedDay[];
  onChange: (days: AllowedDay[]) => void;
}

export function AllowedDaysField({ value, onChange }: AllowedDaysFieldProps) {
  function toggle(day: AllowedDay) {
    if (value.includes(day)) {
      onChange(value.filter((item) => item !== day));
    } else {
      onChange([...value, day]);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {ALLOWED_DAY_OPTIONS.map((option) => {
        const checked = value.includes(option.value);
        return (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm",
              checked ? "border-primary bg-primary/5" : "border-input",
            )}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(option.value)}
              className="rounded border-input"
            />
            {option.label}
          </label>
        );
      })}
    </div>
  );
}

interface MaintenanceBlocksFieldProps {
  value: MaintenanceBlock[];
  onChange: (blocks: MaintenanceBlock[]) => void;
}

function toLocalInputValue(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 16);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function fromLocalInputValue(value: string): string {
  if (!value) return "";
  return new Date(value).toISOString();
}

export function MaintenanceBlocksField({ value, onChange }: MaintenanceBlocksFieldProps) {
  function updateBlock(index: number, patch: Partial<MaintenanceBlock>) {
    onChange(value.map((block, i) => (i === index ? { ...block, ...patch } : block)));
  }

  function addBlock() {
    onChange([
      ...value,
      {
        title: "",
        start_at: "",
        end_at: "",
        reason: null,
      },
    ]);
  }

  function removeBlock(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum bloqueio ou manutenção programada.</p>
      ) : (
        value.map((block, index) => (
          <div key={index} className="space-y-3 rounded-lg border p-4">
            <div className="space-y-2">
              <Label htmlFor={`block-title-${index}`}>Título</Label>
              <Input
                id={`block-title-${index}`}
                value={block.title}
                onChange={(event) => updateBlock(index, { title: event.target.value })}
                placeholder="Ex: Manutenção elétrica"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`block-start-${index}`}>Início</Label>
                <Input
                  id={`block-start-${index}`}
                  type="datetime-local"
                  value={toLocalInputValue(block.start_at)}
                  onChange={(event) =>
                    updateBlock(index, { start_at: fromLocalInputValue(event.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`block-end-${index}`}>Fim</Label>
                <Input
                  id={`block-end-${index}`}
                  type="datetime-local"
                  value={toLocalInputValue(block.end_at)}
                  onChange={(event) =>
                    updateBlock(index, { end_at: fromLocalInputValue(event.target.value) })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`block-reason-${index}`}>Motivo (opcional)</Label>
              <Input
                id={`block-reason-${index}`}
                value={block.reason ?? ""}
                onChange={(event) =>
                  updateBlock(index, { reason: event.target.value || null })
                }
              />
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => removeBlock(index)}>
              Remover bloqueio
            </Button>
          </div>
        ))
      )}
      <Button type="button" variant="outline" size="sm" onClick={addBlock}>
        Adicionar bloqueio
      </Button>
    </div>
  );
}

interface ClassSessionsFieldProps {
  value: ClassSession[];
  onChange: (sessions: ClassSession[]) => void;
}

export function ClassSessionsField({ value, onChange }: ClassSessionsFieldProps) {
  function updateSession(index: number, patch: Partial<ClassSession>) {
    onChange(value.map((session, i) => (i === index ? { ...session, ...patch } : session)));
  }

  function addSession() {
    onChange([...value, { day: "mon", start: "08:00", end: "09:00" }]);
  }

  function removeSession(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum horário de aula cadastrado.</p>
      ) : (
        value.map((session, index) => (
          <div key={index} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor={`session-day-${index}`}>Dia</Label>
              <select
                id={`session-day-${index}`}
                value={session.day}
                onChange={(event) =>
                  updateSession(index, { day: event.target.value as AllowedDay })
                }
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                {ALLOWED_DAY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`session-start-${index}`}>Início</Label>
              <Input
                id={`session-start-${index}`}
                type="time"
                value={session.start}
                onChange={(event) => updateSession(index, { start: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`session-end-${index}`}>Fim</Label>
              <Input
                id={`session-end-${index}`}
                type="time"
                value={session.end}
                onChange={(event) => updateSession(index, { end: event.target.value })}
              />
            </div>
            <div className="flex items-end">
              <Button type="button" variant="ghost" size="sm" onClick={() => removeSession(index)}>
                Remover
              </Button>
            </div>
          </div>
        ))
      )}
      <Button type="button" variant="outline" size="sm" onClick={addSession}>
        Adicionar horário
      </Button>
    </div>
  );
}

interface CommonAreaFormFieldsProps {
  defaults: CommonAreaFormInput;
  allowedDays: AllowedDay[];
  setAllowedDays: (days: AllowedDay[]) => void;
  maintenanceBlocks: MaintenanceBlock[];
  setMaintenanceBlocks: (blocks: MaintenanceBlock[]) => void;
  bookingMode: BookingMode;
  setBookingMode: (mode: BookingMode) => void;
  classSessions: ClassSession[];
  setClassSessions: (sessions: ClassSession[]) => void;
}

export function CommonAreaFormFields({
  defaults,
  allowedDays,
  setAllowedDays,
  maintenanceBlocks,
  setMaintenanceBlocks,
  bookingMode,
  setBookingMode,
  classSessions,
  setClassSessions,
}: CommonAreaFormFieldsProps) {
  const isClass = bookingMode === "class";

  return (
    <>
      <input type="hidden" name="allowed_days_json" value={JSON.stringify(allowedDays)} readOnly />
      <input
        type="hidden"
        name="maintenance_blocks_json"
        value={JSON.stringify(maintenanceBlocks)}
        readOnly
      />
      <input type="hidden" name="booking_mode" value={bookingMode} readOnly />
      <input
        type="hidden"
        name="class_sessions_json"
        value={JSON.stringify(classSessions)}
        readOnly
      />

      <section className="space-y-4">
        <h3 className="text-sm font-semibold">Informações básicas</h3>
        <div className="space-y-2">
          <Label htmlFor="name">Nome</Label>
          <Input id="name" name="name" defaultValue={defaults.name} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Regras</Label>
          <textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={defaults.description ?? ""}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
            placeholder="Informe as regras de uso do espaço..."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="capacity">{isClass ? "Vagas por aula" : "Capacidade (pessoas)"}</Label>
          <Input
            id="capacity"
            name="capacity"
            type="number"
            min={1}
            defaultValue={defaults.capacity}
            required
          />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold">Tipo de reserva</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <label
            className={cn(
              "flex cursor-pointer flex-col gap-1 rounded-md border px-3 py-2 text-sm",
              !isClass ? "border-primary bg-primary/5" : "border-input",
            )}
          >
            <span className="flex items-center gap-2 font-medium">
              <input
                type="radio"
                name="booking_mode_choice"
                checked={!isClass}
                onChange={() => setBookingMode("exclusive")}
                className="rounded border-input"
              />
              Espaço exclusivo
            </span>
            <span className="text-xs text-muted-foreground">
              Salão, churrasqueira ou quadra: uma reserva ocupa o horário.
            </span>
          </label>
          <label
            className={cn(
              "flex cursor-pointer flex-col gap-1 rounded-md border px-3 py-2 text-sm",
              isClass ? "border-primary bg-primary/5" : "border-input",
            )}
          >
            <span className="flex items-center gap-2 font-medium">
              <input
                type="radio"
                name="booking_mode_choice"
                checked={isClass}
                onChange={() => setBookingMode("class")}
                className="rounded border-input"
              />
              Aula / lista de presença
            </span>
            <span className="text-xs text-muted-foreground">
              Várias pessoas na mesma aula, até o limite de vagas.
            </span>
          </label>
        </div>
      </section>

      {isClass ? (
        <section className="space-y-4">
          <h3 className="text-sm font-semibold">Horários das aulas</h3>
          <ClassSessionsField value={classSessions} onChange={setClassSessions} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="min_advance_hours">Abertura das reservas (horas)</Label>
              <Input
                id="min_advance_hours"
                name="min_advance_hours"
                type="number"
                min={1}
                defaultValue={
                  defaults.min_advance_hours > 0 ? defaults.min_advance_hours : 12
                }
              />
              <p className="text-xs text-muted-foreground">
                As reservas abrem neste prazo antes da aula. Com vaga, a confirmação pode ser
                feita até o início. Use 12 para abrir 12 horas antes e evitar reservas contínuas.
              </p>
            </div>
          </div>
          <input type="hidden" name="min_advance_days" value="0" />
          <input type="hidden" name="max_advance_days" value="" />
          <input type="hidden" name="reservation_period_days" value={defaults.reservation_period_days} />
          <input type="hidden" name="buffer_days" value="0" />
          <input type="hidden" name="buffer_minutes" value="0" />
          <input type="hidden" name="operating_hours_start" value={defaults.operating_hours.start} />
          <input type="hidden" name="operating_hours_end" value={defaults.operating_hours.end} />
        </section>
      ) : null}

      <section className="space-y-4">
        <h3 className="text-sm font-semibold">Status</h3>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="is_active"
            value="true"
            defaultChecked={defaults.is_active}
            className="rounded border-input"
          />
          Espaço ativo (disponível para reservas futuras)
        </label>
        {!isClass && (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="requires_approval"
                value="true"
                defaultChecked={defaults.requires_approval}
                className="rounded border-input"
              />
              Exige aprovação do síndico/administrador
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="requires_payment"
                value="true"
                defaultChecked={defaults.requires_payment}
                className="rounded border-input"
              />
              Exige cobrança (recibo antes da aprovação)
            </label>
          </>
        )}
      </section>

      {!isClass ? (
      <section className="space-y-4">
        <h3 className="text-sm font-semibold">Regras de reserva</h3>
        <p className="text-xs text-muted-foreground">
          Para salão e churrasqueira, deixe o tempo máximo em branco (reserva o dia inteiro). Para
          quadras, informe duração do turno e tempo máximo de uso.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="buffer_days">Descanso entre reservas (dias)</Label>
            <Input
              id="buffer_days"
              name="buffer_days"
              type="number"
              min={0}
              defaultValue={defaults.buffer_days}
            />
            <p className="text-xs text-muted-foreground">
              Dias livres obrigatórios entre reservas no mesmo espaço. Ideal para salão e festas
              (ex.: 7 dias).
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="slot_interval_minutes">Duração do turno (minutos)</Label>
            <Input
              id="slot_interval_minutes"
              name="slot_interval_minutes"
              type="number"
              min={15}
              step={15}
              placeholder="Ex: 60"
              defaultValue={defaults.slot_interval_minutes ?? ""}
            />
            <p className="text-xs text-muted-foreground">
              Tamanho de cada bloco reservável. Ex.: 60 = turnos de 1 hora.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="max_duration_minutes">Tempo máximo por reserva (minutos)</Label>
            <Input
              id="max_duration_minutes"
              name="max_duration_minutes"
              type="number"
              min={15}
              step={15}
              placeholder="Ex: 120"
              defaultValue={defaults.max_duration_minutes ?? ""}
            />
            <p className="text-xs text-muted-foreground">
              Limite de uso contínuo por reserva. Ex.: 120 = até 2 horas seguidas na quadra.
            </p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="buffer_minutes">Intervalo entre turnos (minutos)</Label>
            <Input
              id="buffer_minutes"
              name="buffer_minutes"
              type="number"
              min={0}
              step={5}
              defaultValue={defaults.buffer_minutes}
            />
            <p className="text-xs text-muted-foreground">
              Tempo mínimo entre o fim de uma reserva e o início da próxima no mesmo dia. Ex.: 15
              min para organizar a quadra.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="min_advance_days">Antecedência mínima (dias)</Label>
            <Input
              id="min_advance_days"
              name="min_advance_days"
              type="number"
              min={0}
              defaultValue={defaults.min_advance_days}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max_advance_days">Antecedência máxima (dias)</Label>
            <Input
              id="max_advance_days"
              name="max_advance_days"
              type="number"
              min={1}
              placeholder="Ex: 90"
              defaultValue={defaults.max_advance_days ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max_reservations_per_unit">Limite por unidade (no período)</Label>
            <Input
              id="max_reservations_per_unit"
              name="max_reservations_per_unit"
              type="number"
              min={1}
              placeholder="Ex: 2"
              defaultValue={defaults.max_reservations_per_unit ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reservation_period_days">Período do limite (dias)</Label>
            <Input
              id="reservation_period_days"
              name="reservation_period_days"
              type="number"
              min={1}
              defaultValue={defaults.reservation_period_days}
            />
          </div>
        </div>
      </section>
      ) : null}

      {!isClass ? (
      <>
      <section className="space-y-4">
        <h3 className="text-sm font-semibold">Horário de funcionamento</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="operating_hours_start">Abertura</Label>
            <Input
              id="operating_hours_start"
              name="operating_hours_start"
              type="time"
              defaultValue={defaults.operating_hours.start}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="operating_hours_end">Fechamento</Label>
            <Input
              id="operating_hours_end"
              name="operating_hours_end"
              type="time"
              defaultValue={defaults.operating_hours.end}
              required
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold">Dias permitidos</h3>
        <AllowedDaysField value={allowedDays} onChange={setAllowedDays} />
      </section>
      </>
      ) : null}

      <section className="space-y-4">
        <h3 className="text-sm font-semibold">Bloqueios / manutenção</h3>
        <MaintenanceBlocksField value={maintenanceBlocks} onChange={setMaintenanceBlocks} />
      </section>
    </>
  );
}
