export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type MembershipRole =
  | "super_admin"
  | "admin"
  | "syndic"
  | "sub_syndic"
  | "resident"
  | "doorman"
  | "staff";

export type ResidentType = "owner" | "tenant" | "dependent" | "responsible";

export type ReservationStatus =
  | "awaiting_receipt"
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

export type AnnouncementPriority = "normal" | "important" | "urgent";

export type AnnouncementPublicationStatus = "draft" | "published";

export type GuestType = "visitor" | "service_provider";

export type VisitorAuthorizationStatus = "pending" | "approved" | "rejected" | "cancelled";

export type RegistrationRequestStatus = "pending" | "approved" | "rejected";

export type RegistrationUnitKind = "apartment" | "house";

export type RegistrationProfileType =
  | "resident"
  | "syndic"
  | "staff"
  | "visitor"
  | "service_provider"
  | "other";

export type VehicleStatus = "pending" | "approved" | "rejected";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      condominiums: {
        Row: {
          id: string;
          name: string;
          slug: string;
          is_commercial: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          is_commercial?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          is_commercial?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      memberships: {
        Row: {
          id: string;
          profile_id: string;
          condominium_id: string;
          role: MembershipRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          condominium_id: string;
          role: MembershipRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          condominium_id?: string;
          role?: MembershipRole;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "memberships_profile_id_fkey",
            columns: ["profile_id"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"],
          },
          {
            foreignKeyName: "memberships_condominium_id_fkey",
            columns: ["condominium_id"],
            isOneToOne: false,
            referencedRelation: "condominiums",
            referencedColumns: ["id"],
          },
        ];
      };
      towers: {
        Row: {
          id: string;
          condominium_id: string;
          name: string;
          floors: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          condominium_id: string;
          name: string;
          floors?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          condominium_id?: string;
          name?: string;
          floors?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "towers_condominium_id_fkey",
            columns: ["condominium_id"],
            isOneToOne: false,
            referencedRelation: "condominiums",
            referencedColumns: ["id"],
          },
        ];
      };
      units: {
        Row: {
          id: string;
          tower_id: string;
          number: string;
          block: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tower_id: string;
          number: string;
          block?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tower_id?: string;
          number?: string;
          block?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "units_tower_id_fkey",
            columns: ["tower_id"],
            isOneToOne: false,
            referencedRelation: "towers",
            referencedColumns: ["id"],
          },
        ];
      };
      residents: {
        Row: {
          id: string;
          unit_id: string;
          profile_id: string | null;
          full_name: string;
          email: string | null;
          phone: string | null;
          photo_url: string | null;
          type: ResidentType;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          unit_id: string;
          profile_id?: string | null;
          full_name: string;
          email?: string | null;
          phone?: string | null;
          photo_url?: string | null;
          type?: ResidentType;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          unit_id?: string;
          profile_id?: string | null;
          full_name?: string;
          email?: string | null;
          phone?: string | null;
          photo_url?: string | null;
          type?: ResidentType;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "residents_unit_id_fkey",
            columns: ["unit_id"],
            isOneToOne: false,
            referencedRelation: "units",
            referencedColumns: ["id"],
          },
          {
            foreignKeyName: "residents_profile_id_fkey",
            columns: ["profile_id"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"],
          },
        ];
      };
      common_areas: {
        Row: {
          id: string;
          condominium_id: string;
          name: string;
          capacity: number;
          description: string | null;
          is_active: boolean;
          requires_approval: boolean;
          requires_payment: boolean;
          max_duration_minutes: number | null;
          min_advance_minutes: number;
          min_advance_days: number;
          max_advance_days: number | null;
          max_reservations_per_unit: number | null;
          reservation_period_days: number;
          buffer_minutes: number;
          buffer_days: number;
          operating_hours: Json;
          allowed_days: Json;
          maintenance_blocks: Json;
          rules: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          condominium_id: string;
          name: string;
          capacity?: number;
          description?: string | null;
          is_active?: boolean;
          requires_approval?: boolean;
          requires_payment?: boolean;
          max_duration_minutes?: number | null;
          min_advance_minutes?: number;
          min_advance_days?: number;
          max_advance_days?: number | null;
          max_reservations_per_unit?: number | null;
          reservation_period_days?: number;
          buffer_minutes?: number;
          buffer_days?: number;
          operating_hours?: Json;
          allowed_days?: Json;
          maintenance_blocks?: Json;
          rules?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          condominium_id?: string;
          name?: string;
          capacity?: number;
          description?: string | null;
          is_active?: boolean;
          requires_approval?: boolean;
          requires_payment?: boolean;
          max_duration_minutes?: number | null;
          min_advance_minutes?: number;
          min_advance_days?: number;
          max_advance_days?: number | null;
          max_reservations_per_unit?: number | null;
          reservation_period_days?: number;
          buffer_minutes?: number;
          buffer_days?: number;
          operating_hours?: Json;
          allowed_days?: Json;
          maintenance_blocks?: Json;
          rules?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "common_areas_condominium_id_fkey",
            columns: ["condominium_id"],
            isOneToOne: false,
            referencedRelation: "condominiums",
            referencedColumns: ["id"],
          },
        ];
      };
      reservations: {
        Row: {
          id: string;
          common_area_id: string;
          unit_id: string;
          requested_by: string | null;
          start_at: string;
          end_at: string;
          status: ReservationStatus;
          notes: string | null;
          guest_count: number | null;
          payment_receipt_url: string | null;
          payment_receipt_submitted_at: string | null;
          handover_signature_data: string | null;
          handover_signed_at: string | null;
          handover_signed_by: string | null;
          handover_collected_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          common_area_id: string;
          unit_id: string;
          requested_by?: string | null;
          start_at: string;
          end_at: string;
          status?: ReservationStatus;
          notes?: string | null;
          guest_count?: number | null;
          payment_receipt_url?: string | null;
          payment_receipt_submitted_at?: string | null;
          handover_signature_data?: string | null;
          handover_signed_at?: string | null;
          handover_signed_by?: string | null;
          handover_collected_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          common_area_id?: string;
          unit_id?: string;
          requested_by?: string | null;
          start_at?: string;
          end_at?: string;
          status?: ReservationStatus;
          notes?: string | null;
          guest_count?: number | null;
          payment_receipt_url?: string | null;
          payment_receipt_submitted_at?: string | null;
          handover_signature_data?: string | null;
          handover_signed_at?: string | null;
          handover_signed_by?: string | null;
          handover_collected_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reservations_common_area_id_fkey",
            columns: ["common_area_id"],
            isOneToOne: false,
            referencedRelation: "common_areas",
            referencedColumns: ["id"],
          },
          {
            foreignKeyName: "reservations_unit_id_fkey",
            columns: ["unit_id"],
            isOneToOne: false,
            referencedRelation: "units",
            referencedColumns: ["id"],
          },
          {
            foreignKeyName: "reservations_requested_by_fkey",
            columns: ["requested_by"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"],
          },
          {
            foreignKeyName: "reservations_handover_signed_by_fkey",
            columns: ["handover_signed_by"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"],
          },
          {
            foreignKeyName: "reservations_handover_collected_by_fkey",
            columns: ["handover_collected_by"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"],
          },
        ];
      };
      announcements: {
        Row: {
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
        Insert: {
          id?: string;
          condominium_id: string;
          tower_id?: string | null;
          target_condominium_id?: string | null;
          target_profile_id?: string | null;
          parent_id?: string | null;
          attachment_url?: string | null;
          attachment_name?: string | null;
          staff_only?: boolean;
          title: string;
          body: string;
          priority?: AnnouncementPriority;
          publication_status?: AnnouncementPublicationStatus;
          published_at?: string;
          expires_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          condominium_id?: string;
          tower_id?: string | null;
          target_condominium_id?: string | null;
          target_profile_id?: string | null;
          parent_id?: string | null;
          attachment_url?: string | null;
          attachment_name?: string | null;
          staff_only?: boolean;
          title?: string;
          body?: string;
          priority?: AnnouncementPriority;
          publication_status?: AnnouncementPublicationStatus;
          published_at?: string;
          expires_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "announcements_condominium_id_fkey";
            columns: ["condominium_id"];
            isOneToOne: false;
            referencedRelation: "condominiums";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "announcements_tower_id_fkey";
            columns: ["tower_id"];
            isOneToOne: false;
            referencedRelation: "towers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "announcements_target_condominium_id_fkey";
            columns: ["target_condominium_id"];
            isOneToOne: false;
            referencedRelation: "condominiums";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "announcements_target_profile_id_fkey";
            columns: ["target_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "announcements_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "announcements_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "announcements";
            referencedColumns: ["id"];
          },
        ];
      };
      announcement_reads: {
        Row: {
          announcement_id: string;
          profile_id: string;
          read_at: string;
        };
        Insert: {
          announcement_id: string;
          profile_id: string;
          read_at?: string;
        };
        Update: {
          announcement_id?: string;
          profile_id?: string;
          read_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey";
            columns: ["announcement_id"];
            isOneToOne: false;
            referencedRelation: "announcements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "announcement_reads_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      visitor_authorizations: {
        Row: {
          id: string;
          condominium_id: string;
          unit_id: string;
          guest_type: GuestType;
          full_name: string;
          document_type: string | null;
          document_number: string | null;
          company_name: string | null;
          vehicle_plate: string | null;
          access_starts_at: string;
          access_ends_at: string;
          status: VisitorAuthorizationStatus;
          notes: string | null;
          doorman_notes: string | null;
          requested_by: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          condominium_id: string;
          unit_id: string;
          guest_type?: GuestType;
          full_name: string;
          document_type?: string | null;
          document_number?: string | null;
          company_name?: string | null;
          vehicle_plate?: string | null;
          access_starts_at: string;
          access_ends_at: string;
          status?: VisitorAuthorizationStatus;
          notes?: string | null;
          doorman_notes?: string | null;
          requested_by?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          condominium_id?: string;
          unit_id?: string;
          guest_type?: GuestType;
          full_name?: string;
          document_type?: string | null;
          document_number?: string | null;
          company_name?: string | null;
          vehicle_plate?: string | null;
          access_starts_at?: string;
          access_ends_at?: string;
          status?: VisitorAuthorizationStatus;
          notes?: string | null;
          doorman_notes?: string | null;
          requested_by?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "visitor_authorizations_condominium_id_fkey",
            columns: ["condominium_id"],
            isOneToOne: false,
            referencedRelation: "condominiums",
            referencedColumns: ["id"],
          },
          {
            foreignKeyName: "visitor_authorizations_unit_id_fkey",
            columns: ["unit_id"],
            isOneToOne: false,
            referencedRelation: "units",
            referencedColumns: ["id"],
          },
          {
            foreignKeyName: "visitor_authorizations_requested_by_fkey",
            columns: ["requested_by"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"],
          },
          {
            foreignKeyName: "visitor_authorizations_reviewed_by_fkey",
            columns: ["reviewed_by"],
            isOneToOne: false,
            referencedRelation: "profiles",
            referencedColumns: ["id"],
          },
        ];
      };
      unit_notifications: {
        Row: {
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
          sender_last_seen_at: string | null;
        };
        Insert: {
          id?: string;
          source_condominium_id: string;
          target_condominium_id: string;
          target_unit_id: string;
          target_profile_id: string;
          title: string;
          body: string;
          attachment_url?: string | null;
          attachment_name?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
          sender_last_seen_at?: string | null;
        };
        Update: {
          id?: string;
          source_condominium_id?: string;
          target_condominium_id?: string;
          target_unit_id?: string;
          target_profile_id?: string;
          title?: string;
          body?: string;
          attachment_url?: string | null;
          attachment_name?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          sender_last_seen_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "unit_notifications_source_condominium_id_fkey";
            columns: ["source_condominium_id"];
            isOneToOne: false;
            referencedRelation: "condominiums";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "unit_notifications_target_condominium_id_fkey";
            columns: ["target_condominium_id"];
            isOneToOne: false;
            referencedRelation: "condominiums";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "unit_notifications_target_unit_id_fkey";
            columns: ["target_unit_id"];
            isOneToOne: false;
            referencedRelation: "units";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "unit_notifications_target_profile_id_fkey";
            columns: ["target_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "unit_notifications_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      unit_notification_reads: {
        Row: {
          notification_id: string;
          profile_id: string;
          read_at: string;
          read_receipt_sent_at: string | null;
        };
        Insert: {
          notification_id: string;
          profile_id: string;
          read_at?: string;
          read_receipt_sent_at?: string | null;
        };
        Update: {
          notification_id?: string;
          profile_id?: string;
          read_at?: string;
          read_receipt_sent_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "unit_notification_reads_notification_id_fkey";
            columns: ["notification_id"];
            isOneToOne: false;
            referencedRelation: "unit_notifications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "unit_notification_reads_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      unit_notification_replies: {
        Row: {
          id: string;
          notification_id: string;
          created_by: string;
          body: string;
          attachment_url: string | null;
          attachment_name: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          notification_id: string;
          created_by: string;
          body: string;
          attachment_url?: string | null;
          attachment_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          notification_id?: string;
          created_by?: string;
          body?: string;
          attachment_url?: string | null;
          attachment_name?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "unit_notification_replies_notification_id_fkey";
            columns: ["notification_id"];
            isOneToOne: false;
            referencedRelation: "unit_notifications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "unit_notification_replies_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      correspondence_notices: {
        Row: {
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
        };
        Insert: {
          id?: string;
          condominium_id: string;
          unit_id: string;
          target_profile_id: string;
          recipient_name?: string | null;
          notified_via_responsible?: boolean;
          description: string;
          carrier?: string | null;
          notes?: string | null;
          created_by: string;
          created_at?: string;
          picked_up_at?: string | null;
          picked_up_by_name?: string | null;
        };
        Update: {
          id?: string;
          condominium_id?: string;
          unit_id?: string;
          target_profile_id?: string;
          recipient_name?: string | null;
          notified_via_responsible?: boolean;
          description?: string;
          carrier?: string | null;
          notes?: string | null;
          created_by?: string;
          created_at?: string;
          picked_up_at?: string | null;
          picked_up_by_name?: string | null;
        };
        Relationships: [];
      };
      water_meter_readings: {
        Row: {
          id: string;
          condominium_id: string;
          reading_date: string;
          reading_value: number;
          daily_consumption: number | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          condominium_id: string;
          reading_date: string;
          reading_value: number;
          daily_consumption?: number | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          condominium_id?: string;
          reading_date?: string;
          reading_value?: number;
          daily_consumption?: number | null;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      water_meter_alerts: {
        Row: {
          id: string;
          condominium_id: string;
          reading_id: string;
          daily_consumption: number;
          average_consumption: number;
          excess_percent: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          condominium_id: string;
          reading_id: string;
          daily_consumption: number;
          average_consumption: number;
          excess_percent: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          condominium_id?: string;
          reading_id?: string;
          daily_consumption?: number;
          average_consumption?: number;
          excess_percent?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      access_devices: {
        Row: {
          id: string;
          condominium_id: string;
          display_name: string;
          access_type: Database["public"]["Enums"]["access_device_type"];
          manufacturer: string;
          model: string;
          host_url: string;
          api_username: string;
          api_password_encrypted: string;
          direction: Database["public"]["Enums"]["access_device_direction"];
          entry_kind: string;
          is_active: boolean;
          is_pilot: boolean;
          last_connection_ok_at: string | null;
          last_connection_error: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          condominium_id: string;
          display_name: string;
          access_type?: Database["public"]["Enums"]["access_device_type"];
          manufacturer?: string;
          model?: string;
          host_url: string;
          api_username?: string;
          api_password_encrypted: string;
          direction?: Database["public"]["Enums"]["access_device_direction"];
          entry_kind?: string;
          is_active?: boolean;
          is_pilot?: boolean;
          last_connection_ok_at?: string | null;
          last_connection_error?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          condominium_id?: string;
          display_name?: string;
          access_type?: Database["public"]["Enums"]["access_device_type"];
          manufacturer?: string;
          model?: string;
          host_url?: string;
          api_username?: string;
          api_password_encrypted?: string;
          direction?: Database["public"]["Enums"]["access_device_direction"];
          entry_kind?: string;
          is_active?: boolean;
          is_pilot?: boolean;
          last_connection_ok_at?: string | null;
          last_connection_error?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      access_device_shares: {
        Row: {
          id: string;
          access_device_id: string;
          condominium_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          access_device_id: string;
          condominium_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          access_device_id?: string;
          condominium_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      access_sync_jobs: {
        Row: {
          id: string;
          resident_id: string;
          access_device_id: string;
          grant_id: string | null;
          action: Database["public"]["Enums"]["access_sync_action"];
          status: Database["public"]["Enums"]["access_sync_job_status"];
          attempts: number;
          max_attempts: number;
          last_error: string | null;
          controlid_user_id: number | null;
          scheduled_at: string;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          resident_id: string;
          access_device_id: string;
          grant_id?: string | null;
          action: Database["public"]["Enums"]["access_sync_action"];
          status?: Database["public"]["Enums"]["access_sync_job_status"];
          attempts?: number;
          max_attempts?: number;
          last_error?: string | null;
          controlid_user_id?: number | null;
          scheduled_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          resident_id?: string;
          access_device_id?: string;
          grant_id?: string | null;
          action?: Database["public"]["Enums"]["access_sync_action"];
          status?: Database["public"]["Enums"]["access_sync_job_status"];
          attempts?: number;
          max_attempts?: number;
          last_error?: string | null;
          controlid_user_id?: number | null;
          scheduled_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      resident_access_grants: {
        Row: {
          id: string;
          resident_id: string;
          access_device_id: string;
          sync_status: Database["public"]["Enums"]["access_grant_sync_status"];
          sync_error: string | null;
          controlid_user_id: number | null;
          controlid_registration: string | null;
          synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          resident_id: string;
          access_device_id: string;
          sync_status?: Database["public"]["Enums"]["access_grant_sync_status"];
          sync_error?: string | null;
          controlid_user_id?: number | null;
          controlid_registration?: string | null;
          synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          resident_id?: string;
          access_device_id?: string;
          sync_status?: Database["public"]["Enums"]["access_grant_sync_status"];
          sync_error?: string | null;
          controlid_user_id?: number | null;
          controlid_registration?: string | null;
          synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      registration_request_access_devices: {
        Row: {
          id: string;
          registration_request_id: string;
          access_device_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          registration_request_id: string;
          access_device_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          registration_request_id?: string;
          access_device_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      vehicles: {
        Row: {
          id: string;
          condominium_id: string;
          unit_id: string;
          resident_id: string | null;
          brand: string;
          model: string;
          color: string | null;
          license_plate: string;
          tag_number: string | null;
          photo_url: string | null;
          status: VehicleStatus;
          reviewed_by: string | null;
          reviewed_at: string | null;
          review_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          condominium_id: string;
          unit_id: string;
          resident_id?: string | null;
          brand: string;
          model: string;
          color?: string | null;
          license_plate: string;
          tag_number?: string | null;
          photo_url?: string | null;
          status?: VehicleStatus;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          condominium_id?: string;
          unit_id?: string;
          resident_id?: string | null;
          brand?: string;
          model?: string;
          color?: string | null;
          license_plate?: string;
          tag_number?: string | null;
          photo_url?: string | null;
          status?: VehicleStatus;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vehicles_condominium_id_fkey";
            columns: ["condominium_id"];
            isOneToOne: false;
            referencedRelation: "condominiums";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vehicles_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "units";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vehicles_resident_id_fkey";
            columns: ["resident_id"];
            isOneToOne: false;
            referencedRelation: "residents";
            referencedColumns: ["id"];
          },
        ];
      };
      registration_requests: {
        Row: {
          id: string;
          profile_id: string;
          condominium_id: string;
          resident_type: ResidentType;
          profile_type: RegistrationProfileType;
          unit_kind: RegistrationUnitKind | null;
          unit_number: string | null;
          requested_unit_id: string | null;
          full_name: string;
          email: string;
          phone: string | null;
          photo_url: string | null;
          status: RegistrationRequestStatus;
          reviewed_by: string | null;
          reviewed_at: string | null;
          review_notes: string | null;
          unit_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          condominium_id: string;
          resident_type?: ResidentType;
          profile_type?: RegistrationProfileType;
          unit_kind?: RegistrationUnitKind | null;
          unit_number?: string | null;
          requested_unit_id?: string | null;
          full_name: string;
          email: string;
          phone?: string | null;
          photo_url?: string | null;
          status?: RegistrationRequestStatus;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_notes?: string | null;
          unit_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          condominium_id?: string;
          resident_type?: ResidentType;
          profile_type?: RegistrationProfileType;
          unit_kind?: RegistrationUnitKind | null;
          unit_number?: string | null;
          requested_unit_id?: string | null;
          full_name?: string;
          email?: string;
          phone?: string | null;
          photo_url?: string | null;
          status?: RegistrationRequestStatus;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_notes?: string | null;
          unit_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "registration_requests_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "registration_requests_condominium_id_fkey";
            columns: ["condominium_id"];
            isOneToOne: false;
            referencedRelation: "condominiums";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "registration_requests_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "registration_requests_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "units";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_super_admin: { Args: Record<string, never>; Returns: boolean };
      is_condo_member: { Args: { p_condominium_id: string }; Returns: boolean };
      is_condo_staff: { Args: { p_condominium_id: string }; Returns: boolean };
      is_condo_doorman: { Args: { p_condominium_id: string }; Returns: boolean };
      owns_unit: { Args: { p_unit_id: string }; Returns: boolean };
      my_condominium_ids: { Args: Record<string, never>; Returns: string[] };
      my_unit_ids: { Args: Record<string, never>; Returns: string[] };
      is_visitor_in_doorman_consult_window: {
        Args: {
          p_access_starts_at: string;
          p_access_ends_at: string;
          p_horizon?: string;
        };
        Returns: boolean;
      };
      is_announcement_visible_to_profile: {
        Args: { p_announcement_id: string };
        Returns: boolean;
      };
      can_access_announcement: {
        Args: { p_announcement_id: string };
        Returns: boolean;
      };
      announcement_thread_root_id: {
        Args: { p_announcement_id: string };
        Returns: string;
      };
      mark_announcement_read: {
        Args: { p_announcement_id: string };
        Returns: string;
      };
      granja_condominium_id: { Args: Record<string, never>; Returns: string | null };
    };
    Enums: {
      membership_role: MembershipRole;
      resident_type: ResidentType;
      reservation_status: ReservationStatus;
      announcement_priority: AnnouncementPriority;
      announcement_publication_status: AnnouncementPublicationStatus;
      guest_type: GuestType;
      visitor_authorization_status: VisitorAuthorizationStatus;
      registration_request_status: RegistrationRequestStatus;
      registration_unit_kind: RegistrationUnitKind;
      registration_profile_type: RegistrationProfileType;
      access_device_type:
        | "facial_pedestrian"
        | "facial_vehicle"
        | "tag_vehicle"
        | "visitor_temp"
        | "staff_maintenance";
      access_device_direction: "entry" | "exit" | "both";
      access_grant_sync_status: "pending" | "synced" | "error";
      access_sync_action: "create" | "update" | "remove";
      access_sync_job_status: "pending" | "processing" | "completed" | "error";
    };
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Condominium = Database["public"]["Tables"]["condominiums"]["Row"];
export type Membership = Database["public"]["Tables"]["memberships"]["Row"];
export type Tower = Database["public"]["Tables"]["towers"]["Row"];
export type Unit = Database["public"]["Tables"]["units"]["Row"];
export type Resident = Database["public"]["Tables"]["residents"]["Row"];
export type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];
export type CommonArea = Database["public"]["Tables"]["common_areas"]["Row"];
export type Reservation = Database["public"]["Tables"]["reservations"]["Row"];
export type Announcement = Database["public"]["Tables"]["announcements"]["Row"];
export type VisitorAuthorization =
  Database["public"]["Tables"]["visitor_authorizations"]["Row"];
export type RegistrationRequest =
  Database["public"]["Tables"]["registration_requests"]["Row"];
