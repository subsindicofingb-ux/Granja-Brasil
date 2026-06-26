export type CorrespondenceNotice = {
  id: string;
  condominium_id: string;
  unit_id: string;
  target_profile_id: string;
  description: string;
  carrier: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  picked_up_at: string | null;
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
