export type CorrespondenceNotice = {
  id: string;
  condominium_id: string;
  unit_id: string;
  target_profile_id: string;
  recipient_name: string | null;
  notified_via_responsible: boolean;
  description: string;
  carrier: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  picked_up_at: string | null;
  picked_up_by_name: string | null;
  condominium_name?: string;
  unit?: {
    id: string;
    number: string;
    block: string | null;
    tower: { id: string; name: string };
  };
  target_resident?: {
    id: string;
    full_name: string;
  } | null;
  author?: {
    id: string;
    full_name: string;
  } | null;
};
