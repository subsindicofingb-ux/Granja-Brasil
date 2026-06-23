import { VEHICLE_STATUS, type VehicleStatus } from "@/lib/constants";

export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  [VEHICLE_STATUS.PENDING]: "Aguardando aprovação",
  [VEHICLE_STATUS.APPROVED]: "Aprovado",
  [VEHICLE_STATUS.REJECTED]: "Recusado",
};

export function getVehicleStatusBadgeClass(status: VehicleStatus): string {
  switch (status) {
    case VEHICLE_STATUS.APPROVED:
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case VEHICLE_STATUS.REJECTED:
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-amber-200 bg-amber-50 text-amber-800";
  }
}

export function formatLicensePlate(plate: string): string {
  return plate.trim().toUpperCase();
}

export function formatVehicleSummary(input: {
  brand: string;
  model: string;
  license_plate: string;
}): string {
  return `${input.brand} ${input.model} · ${formatLicensePlate(input.license_plate)}`;
}
