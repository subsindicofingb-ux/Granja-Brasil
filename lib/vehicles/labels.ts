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
