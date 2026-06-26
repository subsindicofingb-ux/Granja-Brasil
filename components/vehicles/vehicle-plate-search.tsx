"use client";

import { Search } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface VehiclePlateSearchProps {
  plate?: string;
  status?: string;
}

export function VehiclePlateSearch({ plate = "", status }: VehiclePlateSearchProps) {
  return (
    <form method="get" className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-end">
      {status ? <input type="hidden" name="status" value={status} /> : null}
      <div className="min-w-0 flex-1 space-y-2">
        <Label htmlFor="plate">Buscar por placa</Label>
        <Input
          id="plate"
          name="plate"
          defaultValue={plate}
          placeholder="Ex.: ABC1D23"
          autoComplete="off"
          autoFocus
          className="uppercase"
        />
      </div>
      <Button type="submit" className="shrink-0">
        <Search className="h-4 w-4" />
        Buscar
      </Button>
    </form>
  );
}
