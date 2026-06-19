import type {
  Announcement,
  CommonArea,
  Condominium,
  Reservation,
  Resident,
  Tower,
  Unit,
} from "@/types";
import { getResidentTypeLabel as getResidentTypeLabelFromLib } from "@/lib/residents/labels";
import { SEED_IDS } from "@/lib/db/seed-ids";

const TS = "2025-01-01T00:00:00Z";

const mockCommonAreaDefaults = {
  is_active: true,
  requires_approval: false,
  max_duration_minutes: null as number | null,
  min_advance_minutes: 0,
  max_advance_days: null as number | null,
  max_reservations_per_unit: null as number | null,
  reservation_period_days: 30,
  buffer_minutes: 0,
  operating_hours: { start: "08:00", end: "22:00" },
  allowed_days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
  maintenance_blocks: [] as { title: string; start_at: string; end_at: string; reason?: string | null }[],
  rules: {},
};

export const mockCondominium: Condominium = {
  id: SEED_IDS.condominium,
  name: "Granja Brasil",
  slug: "residencial-exemplo",
  is_commercial: false,
  created_at: TS,
  updated_at: TS,
};

export const mockTowers: Tower[] = [
  {
    id: SEED_IDS.towers.a,
    condominium_id: SEED_IDS.condominium,
    name: "Torre A",
    floors: 12,
    created_at: TS,
    updated_at: TS,
  },
  {
    id: SEED_IDS.towers.b,
    condominium_id: SEED_IDS.condominium,
    name: "Torre B",
    floors: 10,
    created_at: TS,
    updated_at: TS,
  },
];

export const mockUnits: Unit[] = [
  {
    id: SEED_IDS.units.u101,
    tower_id: SEED_IDS.towers.a,
    number: "101",
    block: "A",
    created_at: TS,
    updated_at: TS,
  },
  {
    id: SEED_IDS.units.u102,
    tower_id: SEED_IDS.towers.a,
    number: "102",
    block: "A",
    created_at: TS,
    updated_at: TS,
  },
  {
    id: SEED_IDS.units.u201,
    tower_id: SEED_IDS.towers.b,
    number: "201",
    block: "B",
    created_at: TS,
    updated_at: TS,
  },
];

export const mockResidents: Resident[] = [
  {
    id: SEED_IDS.residents.maria,
    unit_id: SEED_IDS.units.u101,
    profile_id: null,
    full_name: "Maria Silva",
    email: "maria@email.com",
    phone: "(11) 99999-0001",
    photo_url: null,
    type: "owner",
    created_at: TS,
    updated_at: TS,
  },
  {
    id: SEED_IDS.residents.joao,
    unit_id: SEED_IDS.units.u101,
    profile_id: null,
    full_name: "João Silva",
    email: "joao@email.com",
    phone: "(11) 99999-0002",
    photo_url: null,
    type: "dependent",
    created_at: TS,
    updated_at: TS,
  },
  {
    id: SEED_IDS.residents.ana,
    unit_id: SEED_IDS.units.u201,
    profile_id: null,
    full_name: "Ana Costa",
    email: "ana@email.com",
    phone: "(11) 99999-0003",
    photo_url: null,
    type: "tenant",
    created_at: TS,
    updated_at: TS,
  },
];

export const mockCommonAreas: CommonArea[] = [
  {
    id: SEED_IDS.commonAreas.salao,
    condominium_id: SEED_IDS.condominium,
    name: "Salão de festas",
    capacity: 50,
    description: "Espaço coberto com cozinha e som ambiente.",
    ...mockCommonAreaDefaults,
    requires_approval: true,
    max_duration_minutes: 360,
    min_advance_minutes: 120,
    max_advance_days: 90,
    max_reservations_per_unit: 2,
    operating_hours: { start: "09:00", end: "23:00" },
    allowed_days: ["fri", "sat", "sun"],
    created_at: TS,
    updated_at: TS,
  },
  {
    id: SEED_IDS.commonAreas.churrasqueira,
    condominium_id: SEED_IDS.condominium,
    name: "Churrasqueira",
    capacity: 20,
    description: "Área externa com churrasqueira e mesas.",
    ...mockCommonAreaDefaults,
    max_duration_minutes: 480,
    min_advance_minutes: 60,
    max_advance_days: 60,
    max_reservations_per_unit: 3,
    buffer_minutes: 60,
    created_at: TS,
    updated_at: TS,
  },
  {
    id: SEED_IDS.commonAreas.academia,
    condominium_id: SEED_IDS.condominium,
    name: "Academia",
    capacity: 15,
    description: "Academia com equipamentos básicos.",
    ...mockCommonAreaDefaults,
    max_reservations_per_unit: 1,
    reservation_period_days: 7,
    operating_hours: { start: "06:00", end: "22:00" },
    maintenance_blocks: [
      {
        title: "Manutenção preventiva",
        start_at: "2026-07-01T08:00:00Z",
        end_at: "2026-07-01T18:00:00Z",
        reason: "Revisão dos equipamentos",
      },
    ],
    created_at: TS,
    updated_at: TS,
  },
];

export const mockReservations: Reservation[] = [
  {
    id: SEED_IDS.reservations.res1,
    common_area_id: SEED_IDS.commonAreas.salao,
    unit_id: SEED_IDS.units.u101,
    requested_by: null,
    start_at: "2026-06-20T18:00:00Z",
    end_at: "2026-06-20T23:00:00Z",
    status: "approved",
    notes: "Aniversário familiar",
    guest_count: 25,
    payment_receipt_url: null,
    payment_receipt_submitted_at: null,
    created_at: "2025-06-01T00:00:00Z",
    updated_at: "2025-06-01T00:00:00Z",
  },
  {
    id: SEED_IDS.reservations.res2,
    common_area_id: SEED_IDS.commonAreas.churrasqueira,
    unit_id: SEED_IDS.units.u201,
    requested_by: null,
    start_at: "2026-06-22T12:00:00Z",
    end_at: "2026-06-22T18:00:00Z",
    status: "pending",
    notes: null,
    guest_count: null,
    payment_receipt_url: null,
    payment_receipt_submitted_at: null,
    created_at: "2025-06-10T00:00:00Z",
    updated_at: "2025-06-10T00:00:00Z",
  },
];

export const mockAnnouncements: Announcement[] = [
  {
    id: SEED_IDS.announcements.elevadores,
    condominium_id: SEED_IDS.condominium,
    tower_id: SEED_IDS.towers.a,
    target_condominium_id: null,
    target_profile_id: null,
    parent_id: null,
    attachment_url: null,
    attachment_name: null,
    staff_only: false,
    title: "Manutenção dos elevadores",
    body: "No dia 25/06 das 8h às 12h a Torre A passará por manutenção preventiva nos elevadores. Pedimos compreensão pelo transtorno.",
    priority: "important",
    publication_status: "published",
    published_at: "2025-06-15T09:00:00Z",
    expires_at: "2026-06-25T23:59:59Z",
    created_by: null,
    created_at: "2025-06-15T09:00:00Z",
    updated_at: "2025-06-15T09:00:00Z",
  },
  {
    id: SEED_IDS.announcements.piscina,
    condominium_id: SEED_IDS.condominium,
    tower_id: null,
    target_condominium_id: null,
    target_profile_id: null,
    parent_id: null,
    attachment_url: null,
    attachment_name: null,
    staff_only: false,
    title: "Horário da piscina no verão",
    body: "A partir de julho, a piscina funcionará das 7h às 22h. Respeitem as regras de uso e o limite de ocupação.",
    priority: "normal",
    publication_status: "published",
    published_at: "2025-06-01T10:00:00Z",
    expires_at: null,
    created_by: null,
    created_at: "2025-06-01T10:00:00Z",
    updated_at: "2025-06-01T10:00:00Z",
  },
  {
    id: SEED_IDS.announcements.garagem,
    condominium_id: SEED_IDS.condominium,
    tower_id: null,
    target_condominium_id: null,
    target_profile_id: null,
    parent_id: null,
    attachment_url: null,
    attachment_name: null,
    staff_only: false,
    title: "Vaga de garagem — visitante",
    body: "Unidade 201: favor não utilizar vaga de visitante por período prolongado. Infrações serão notificadas.",
    priority: "urgent",
    publication_status: "published",
    published_at: "2025-06-18T14:00:00Z",
    expires_at: "2025-07-18T14:00:00Z",
    created_by: null,
    created_at: "2025-06-18T14:00:00Z",
    updated_at: "2025-06-18T14:00:00Z",
  },
];

export function getTowerName(towerId: string): string {
  return mockTowers.find((t) => t.id === towerId)?.name ?? "—";
}

export function getUnitLabel(unitId: string): string {
  const unit = mockUnits.find((u) => u.id === unitId);
  if (!unit) return "—";
  return `${getTowerName(unit.tower_id)} · ${unit.number}`;
}

export function getAreaName(areaId: string): string {
  return mockCommonAreas.find((a) => a.id === areaId)?.name ?? "—";
}

export function getResidentTypeLabel(type: string): string {
  return getResidentTypeLabelFromLib(type);
}

export function getReservationStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "Pendente",
    approved: "Aprovada",
    rejected: "Rejeitada",
    cancelled: "Cancelada",
  };
  return labels[status] ?? status;
}

export function getAnnouncementPriorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    normal: "Normal",
    important: "Importante",
    urgent: "Urgente",
  };
  return labels[priority] ?? priority;
}
