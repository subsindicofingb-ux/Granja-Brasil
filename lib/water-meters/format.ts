const WATER_METER_DECIMALS = 3;

export function parseWaterMeterReadingValue(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed.replace(",", ".");

  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }

  return Math.round(value * 10 ** WATER_METER_DECIMALS) / 10 ** WATER_METER_DECIMALS;
}

export function formatWaterMeterReadingValue(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: WATER_METER_DECIMALS,
    maximumFractionDigits: WATER_METER_DECIMALS,
  });
}
