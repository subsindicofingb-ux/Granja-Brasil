import { ANNOUNCEMENT_PRIORITY, ANNOUNCEMENT_PUBLICATION_STATUS } from "@/lib/constants";
import type { AnnouncementFormInput } from "@/lib/announcements/types";

export const DEFAULT_ANNOUNCEMENT_FORM: AnnouncementFormInput = {
  title: "",
  body: "",
  priority: ANNOUNCEMENT_PRIORITY.NORMAL,
  tower_id: null,
  target_condominium_id: null,
  target_profile_ids: [],
  publication_status: ANNOUNCEMENT_PUBLICATION_STATUS.PUBLISHED,
  published_at: "",
  expires_at: null,
};

export function createDefaultAnnouncementForm(publishedAtLocal: string): AnnouncementFormInput {
  return {
    ...DEFAULT_ANNOUNCEMENT_FORM,
    published_at: publishedAtLocal,
  };
}
