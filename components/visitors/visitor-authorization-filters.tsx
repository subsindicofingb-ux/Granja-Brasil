"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  GUEST_TYPE,
  VISITOR_AUTHORIZATION_STATUS,
  type GuestType,
  type VisitorAuthorizationStatus,
} from "@/lib/constants";
import { GUEST_TYPE_LABELS, VISITOR_AUTHORIZATION_STATUS_LABELS } from "@/lib/visitor-authorizations/labels";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface VisitorAuthorizationFiltersProps {
  condoSlug: string;
  basePath?: string;
  selectedStatus: VisitorAuthorizationStatus | "all";
  selectedGuestType: GuestType | "all";
  search?: string;
  showConsultWindow?: boolean;
  consultWindowOnly?: boolean;
}

export function VisitorAuthorizationFilters({
  condoSlug,
  basePath = "visitors",
  selectedStatus,
  selectedGuestType,
  search = "",
  showConsultWindow = false,
  consultWindowOnly = false,
}: VisitorAuthorizationFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "" || value === "all") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    const query = params.toString();
    router.push(`/app/${condoSlug}/${basePath}${query ? `?${query}` : ""}`);
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            value={selectedStatus}
            onChange={(event) => updateParams({ status: event.target.value })}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="all">Todos</option>
            {Object.values(VISITOR_AUTHORIZATION_STATUS).map((value) => (
              <option key={value} value={value}>
                {VISITOR_AUTHORIZATION_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="guest_type">Tipo</Label>
          <select
            id="guest_type"
            value={selectedGuestType}
            onChange={(event) => updateParams({ guest_type: event.target.value })}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="all">Todos</option>
            {Object.values(GUEST_TYPE).map((value) => (
              <option key={value} value={value}>
                {GUEST_TYPE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="search">Buscar</Label>
          <Input
            id="search"
            defaultValue={search}
            placeholder="Nome, documento, placa, unidade..."
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                updateParams({ q: (event.target as HTMLInputElement).value });
              }
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            const input = document.getElementById("search") as HTMLInputElement | null;
            updateParams({ q: input?.value ?? null });
          }}
        >
          Aplicar busca
        </Button>

        {showConsultWindow && (
          <Button
            type="button"
            size="sm"
            variant={consultWindowOnly ? "default" : "outline"}
            onClick={() =>
              updateParams({ window: consultWindowOnly ? "0" : null })
            }
          >
            {consultWindowOnly ? "Janela hoje ±1 dia (ativo)" : "Mostrar janela hoje ±1 dia"}
          </Button>
        )}

        {(selectedStatus !== "all" ||
          selectedGuestType !== "all" ||
          search ||
          consultWindowOnly) && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => router.push(`/app/${condoSlug}/${basePath}`)}
          >
            Limpar filtros
          </Button>
        )}
      </div>
    </div>
  );
}
