export const WATER_METER_ALERT_THRESHOLD = 1.1;
export const WATER_METER_AVERAGE_WINDOW = 30;

export type WaterMeterReadingPoint = {
  reading_date: string;
  daily_consumption: number | null;
};

export function computeDailyConsumption(
  currentValue: number,
  previousValue: number | null | undefined,
): number | null {
  if (previousValue === null || previousValue === undefined) {
    return null;
  }

  const consumption = currentValue - previousValue;
  return consumption >= 0 ? consumption : null;
}

export function computeAverageDailyConsumption(
  readings: WaterMeterReadingPoint[],
  options?: { window?: number; excludeDate?: string },
): number | null {
  const window = options?.window ?? WATER_METER_AVERAGE_WINDOW;
  const consumptions = readings
    .filter(
      (reading) =>
        reading.daily_consumption !== null &&
        reading.daily_consumption !== undefined &&
        reading.reading_date !== options?.excludeDate,
    )
    .slice(0, window)
    .map((reading) => reading.daily_consumption as number);

  if (consumptions.length === 0) {
    return null;
  }

  const total = consumptions.reduce((sum, value) => sum + value, 0);
  return total / consumptions.length;
}

export function shouldAlertAbnormalConsumption(input: {
  dailyConsumption: number | null;
  averageConsumption: number | null;
}): boolean {
  if (
    input.dailyConsumption === null ||
    input.averageConsumption === null ||
    input.averageConsumption <= 0
  ) {
    return false;
  }

  return input.dailyConsumption > input.averageConsumption * WATER_METER_ALERT_THRESHOLD;
}

export function computeExcessPercent(
  dailyConsumption: number,
  averageConsumption: number,
): number {
  if (averageConsumption <= 0) {
    return 0;
  }

  return ((dailyConsumption - averageConsumption) / averageConsumption) * 100;
}
