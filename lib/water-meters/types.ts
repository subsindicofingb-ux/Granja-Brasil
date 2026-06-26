export type WaterMeterReading = {
  id: string;
  condominium_id: string;
  reading_date: string;
  reading_value: number;
  daily_consumption: number | null;
  created_by: string;
  created_at: string;
  author?: {
    id: string;
    full_name: string;
  } | null;
};

export type WaterMeterAlert = {
  id: string;
  condominium_id: string;
  reading_id: string;
  daily_consumption: number;
  average_consumption: number;
  excess_percent: number;
  created_at: string;
  reading?: WaterMeterReading;
};

export type WaterMeterDashboardSummary = {
  latestReading: WaterMeterReading | null;
  previousReading: WaterMeterReading | null;
  averageConsumption: number | null;
  activeAlert: WaterMeterAlert | null;
  recentReadings: WaterMeterReading[];
};
