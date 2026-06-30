export const ACCESS_DEVICE_TYPES = {
  FACIAL_PEDESTRIAN: "facial_pedestrian",
  FACIAL_VEHICLE: "facial_vehicle",
  TAG_VEHICLE: "tag_vehicle",
  VISITOR_TEMP: "visitor_temp",
  STAFF_MAINTENANCE: "staff_maintenance",
} as const;

export type AccessDeviceType = (typeof ACCESS_DEVICE_TYPES)[keyof typeof ACCESS_DEVICE_TYPES];

export const ACCESS_DEVICE_DIRECTIONS = {
  ENTRY: "entry",
  EXIT: "exit",
  BOTH: "both",
} as const;

export type AccessDeviceDirection =
  (typeof ACCESS_DEVICE_DIRECTIONS)[keyof typeof ACCESS_DEVICE_DIRECTIONS];

export const ACCESS_DEVICE_ENTRY_KINDS = {
  PEDESTRIAN: "pedestrian",
  VEHICLE: "vehicle",
} as const;

export type AccessDeviceEntryKind =
  (typeof ACCESS_DEVICE_ENTRY_KINDS)[keyof typeof ACCESS_DEVICE_ENTRY_KINDS];

export const ACCESS_DEVICE_TYPE_LABELS: Record<AccessDeviceType, string> = {
  facial_pedestrian: "Face · Pedestre",
  facial_vehicle: "Face · Veículo",
  tag_vehicle: "TAG 125 kHz",
  visitor_temp: "Visitante temporário",
  staff_maintenance: "Manutenção / staff",
};

export const ACCESS_DEVICE_DIRECTION_LABELS: Record<AccessDeviceDirection, string> = {
  entry: "Entrada",
  exit: "Saída",
  both: "Entrada e saída",
};

export const ACCESS_DEVICE_ENTRY_KIND_LABELS: Record<AccessDeviceEntryKind, string> = {
  pedestrian: "Pedestre",
  vehicle: "Veículo",
};

export const ACCESS_DEVICE_TYPE_OPTIONS = Object.values(ACCESS_DEVICE_TYPES).map((value) => ({
  value,
  label: ACCESS_DEVICE_TYPE_LABELS[value],
}));

export const ACCESS_DEVICE_DIRECTION_OPTIONS = Object.values(ACCESS_DEVICE_DIRECTIONS).map(
  (value) => ({
    value,
    label: ACCESS_DEVICE_DIRECTION_LABELS[value],
  }),
);

export const ACCESS_DEVICE_ENTRY_KIND_OPTIONS = Object.values(ACCESS_DEVICE_ENTRY_KINDS).map(
  (value) => ({
    value,
    label: ACCESS_DEVICE_ENTRY_KIND_LABELS[value],
  }),
);
