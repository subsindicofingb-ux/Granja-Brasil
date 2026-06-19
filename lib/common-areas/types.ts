export const ALLOWED_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export type AllowedDay = (typeof ALLOWED_DAYS)[number];

export type OperatingHours = {
  start: string;
  end: string;
};

export type MaintenanceBlock = {
  title: string;
  start_at: string;
  end_at: string;
  reason?: string | null;
};

export type CommonAreaRules = {
  operating_hours: OperatingHours;
  allowed_days: AllowedDay[];
  maintenance_blocks: MaintenanceBlock[];
};

export type CommonAreaRecord = {
  id: string;
  condominium_id: string;
  name: string;
  capacity: number;
  description: string | null;
  is_active: boolean;
  requires_approval: boolean;
  min_advance_days: number;
  max_advance_days: number | null;
  max_reservations_per_unit: number | null;
  reservation_period_days: number;
  buffer_days: number;
  operating_hours: OperatingHours;
  allowed_days: AllowedDay[];
  maintenance_blocks: MaintenanceBlock[];
  rules: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CommonAreaFormInput = {
  name: string;
  description: string | null;
  capacity: number;
  is_active: boolean;
  requires_approval: boolean;
  min_advance_days: number;
  max_advance_days: number | null;
  max_reservations_per_unit: number | null;
  reservation_period_days: number;
  buffer_days: number;
  operating_hours: OperatingHours;
  allowed_days: AllowedDay[];
  maintenance_blocks: MaintenanceBlock[];
};
