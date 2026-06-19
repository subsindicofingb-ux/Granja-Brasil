import type { AnnouncementPriority } from "@/lib/constants";
import type { AnnouncementPublicationStatus } from "@/lib/constants";

export type AnnouncementAudienceScope = "all" | "condominium" | "resident";

export type AnnouncementRecord = {
  id: string;
  condominium_id: string;
  tower_id: string | null;
  target_condominium_id: string | null;
  target_profile_id: string | null;
  parent_id: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  staff_only: boolean;
  title: string;
  body: string;
  priority: AnnouncementPriority;
  publication_status: AnnouncementPublicationStatus;
  published_at: string;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AnnouncementDisplayStatus = "draft" | "scheduled" | "published" | "expired";

export type AnnouncementWithDetails = AnnouncementRecord & {
  tower: {
    id: string;
    name: string;
  } | null;
  author: {
    id: string;
    full_name: string;
  } | null;
};

export type AnnouncementResidentOption = {
  profile_id: string;
  full_name: string;
  condominium_name?: string;
};

export type ResidentAnnouncementDestination = "condominium" | "granja";

export type AnnouncementFormInput = {
  title: string;
  body: string;
  priority: AnnouncementPriority;
  tower_id: string | null;
  target_condominium_id: string | null;
  target_profile_id: string | null;
  publication_status: AnnouncementPublicationStatus;
  published_at: string;
  expires_at: string | null;
};

export type ResidentAnnouncementFormInput = {
  title: string;
  body: string;
  destination: ResidentAnnouncementDestination;
};
