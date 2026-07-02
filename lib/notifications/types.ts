export type UnitNotificationRecord = {
  id: string;
  source_condominium_id: string;
  target_condominium_id: string;
  target_unit_id: string;
  target_profile_id: string;
  title: string;
  body: string;
  attachment_url: string | null;
  attachment_name: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type UnitNotificationWithDetails = UnitNotificationRecord & {
  source_condominium: {
    id: string;
    name: string;
    slug: string;
  } | null;
  target_condominium: {
    id: string;
    name: string;
    slug: string;
  } | null;
  target_unit: {
    id: string;
    number: string;
    block: string | null;
    tower: {
      id: string;
      name: string;
    };
  } | null;
  target_resident: {
    id: string;
    full_name: string;
  } | null;
  author: {
    id: string;
    full_name: string;
  } | null;
  read_at: string | null;
  recipient_read_at: string | null;
  reply_count: number;
  has_unread_activity: boolean;
};

export type UnitNotificationReply = {
  id: string;
  notification_id: string;
  created_by: string;
  body: string;
  attachment_url: string | null;
  attachment_name: string | null;
  created_at: string;
  author: {
    id: string;
    full_name: string;
  } | null;
};
