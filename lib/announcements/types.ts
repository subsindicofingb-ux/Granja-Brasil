import type { AnnouncementPriority } from "@/lib/constants";
import type { AnnouncementPublicationStatus } from "@/lib/constants";

export type AnnouncementRecord = {
  id: string;
  condominium_id: string;
  tower_id: string | null;
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

export type AnnouncementFormInput = {
  title: string;
  body: string;
  priority: AnnouncementPriority;
  tower_id: string | null;
  publication_status: AnnouncementPublicationStatus;
  published_at: string;
  expires_at: string | null;
};
