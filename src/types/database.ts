// Auto-generated from Supabase schema + manual extensions
// Run: supabase gen types typescript --project-id <id> > src/types/database.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      organisations: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          active_flag: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['organisations']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['organisations']['Insert']>
        Relationships: []
      }
      departments: {
        Row: {
          id: string
          organisation_id: string
          name: string
          code: string | null
          active_flag: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['departments']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['departments']['Insert']>
        Relationships: []
      }
      teams: {
        Row: {
          id: string
          organisation_id: string
          department_id: string | null
          name: string
          manager_user_id: string | null
          active_flag: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['teams']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['teams']['Insert']>
        Relationships: []
      }
      users: {
        Row: {
          id: string
          auth_user_id: string | null
          organisation_id: string
          email: string
          first_name: string
          last_name: string
          job_title: string | null
          role: 'employee' | 'manager' | 'approver' | 'admin' | 'system_admin'
          status: 'active' | 'inactive' | 'on_leave'
          department_id: string | null
          team_id: string | null
          manager_user_id: string | null
          primary_office_id: string | null
          normal_working_days: number[]
          normal_office_days: number[]
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['users']['Insert']>
        Relationships: []
      }
      offices: {
        Row: {
          id: string
          organisation_id: string
          name: string
          address: string | null
          city: string | null
          timezone: string
          active_flag: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['offices']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['offices']['Insert']>
        Relationships: []
      }
      floors: {
        Row: {
          id: string
          office_id: string
          name: string
          sequence: number
          map_background_url: string | null
          width_units: number
          height_units: number
          active_flag: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['floors']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['floors']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'floors_office_id_fkey'
            columns: ['office_id']
            isOneToOne: false
            referencedRelation: 'offices'
            referencedColumns: ['id']
          }
        ]
      }
      workspace_assets: {
        Row: {
          id: string
          floor_id: string
          asset_type: 'desk' | 'room' | 'zone' | 'amenity' | 'no_book'
          code: string
          name: string | null
          x: number
          y: number
          width: number
          height: number
          capacity: number | null
          features: string[]
          status: 'available' | 'unavailable' | 'maintenance' | 'restricted'
          restriction_type: 'none' | 'named_user' | 'team' | 'admin_only'
          restricted_user_id: string | null
          restricted_team_id: string | null
          is_draft: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['workspace_assets']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['workspace_assets']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'workspace_assets_floor_id_fkey'
            columns: ['floor_id']
            isOneToOne: false
            referencedRelation: 'floors'
            referencedColumns: ['id']
          }
        ]
      }
      bookings: {
        Row: {
          id: string
          asset_id: string
          user_id: string
          booking_date: string
          start_time: string | null
          end_time: string | null
          status: 'confirmed' | 'pending_approval' | 'cancelled' | 'rejected' | 'completed'
          source: 'user' | 'admin' | 'recurring' | 'import'
          notes: string | null
          cancelled_at: string | null
          cancelled_by_user_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['bookings']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['bookings']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'bookings_asset_id_fkey'
            columns: ['asset_id']
            isOneToOne: false
            referencedRelation: 'workspace_assets'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bookings_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      attendance_plans: {
        Row: {
          id: string
          user_id: string
          work_date: string
          plan_status: 'in_office' | 'remote' | 'leave' | 'unavailable' | 'unplanned'
          linked_booking_id: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['attendance_plans']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['attendance_plans']['Insert']>
        Relationships: []
      }
      approval_requests: {
        Row: {
          id: string
          request_type: 'advance_booking' | 'restricted_asset' | 'exception'
          target_booking_id: string | null
          requester_user_id: string
          approver_user_id: string | null
          status: 'pending' | 'approved' | 'rejected' | 'withdrawn'
          rationale: string | null
          decision_notes: string | null
          decided_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['approval_requests']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['approval_requests']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'approval_requests_requester_user_id_fkey'
            columns: ['requester_user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'approval_requests_target_booking_id_fkey'
            columns: ['target_booking_id']
            isOneToOne: false
            referencedRelation: 'bookings'
            referencedColumns: ['id']
          }
        ]
      }
      notification_preferences: {
        Row: {
          id: string
          user_id: string
          weekly_digest: boolean
          daily_digest: boolean
          approval_alerts: boolean
          reminder_lead_days: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['notification_preferences']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['notification_preferences']['Insert']>
        Relationships: []
      }
      notification_schedules: {
        Row: {
          id: string
          organisation_id: string
          schedule_type: 'weekly_digest' | 'daily_digest' | 'approval_alert' | 'booking_confirmation'
          cron_expression: string
          active_flag: boolean
          last_run_at: string | null
          last_run_status: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['notification_schedules']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['notification_schedules']['Insert']>
        Relationships: []
      }
      audit_events: {
        Row: {
          id: string
          actor_user_id: string | null
          entity_type: string
          entity_id: string | null
          action_type: string
          event_time: string
          payload_json: Json | null
        }
        Insert: Omit<Database['public']['Tables']['audit_events']['Row'], 'id' | 'event_time'>
        Update: Partial<Database['public']['Tables']['audit_events']['Insert']>
        Relationships: []
      }
    }
    Views: {
      v_daily_occupancy: {
        Row: {
          office_id: string
          office_name: string
          booking_date: string | null
          desks_booked: number
          desks_total: number
          rooms_booked: number
          rooms_total: number
        }
        Relationships: []
      }
      v_weekly_occupancy: {
        Row: {
          office_id: string
          office_name: string
          week_start: string | null
          desk_bookings: number
          room_bookings: number
          unique_attendees: number
        }
        Relationships: []
      }
      v_team_attendance: {
        Row: {
          team_id: string
          team_name: string
          work_date: string | null
          user_id: string
          user_name: string
          plan_status: string | null
          linked_booking_id: string | null
        }
        Relationships: []
      }
      v_utilisation: {
        Row: {
          asset_id: string
          code: string
          name: string | null
          asset_type: string
          floor_name: string
          office_name: string
          total_bookings: number
          bookings_last_30d: number
          utilisation_pct_30d: number | null
        }
        Relationships: []
      }
    }
    CompositeTypes: {
      [_ in never]: never
    }
    Functions: {
      fn_create_booking: {
        Args: {
          p_asset_id: string
          p_user_id: string
          p_booking_date: string
          p_start_time?: string | null
          p_end_time?: string | null
          p_notes?: string | null
        }
        Returns: Json
      }
      fn_cancel_booking: {
        Args: { p_booking_id: string; p_reason?: string | null }
        Returns: Json
      }
      fn_decide_approval: {
        Args: { p_request_id: string; p_decision: string; p_notes?: string | null }
        Returns: Json
      }
      fn_upsert_attendance: {
        Args: {
          p_work_date: string
          p_status: string
          p_linked_booking_id?: string | null
          p_notes?: string | null
        }
        Returns: Json
      }
      publish_floor_layout: {
        Args: { p_floor_id: string }
        Returns: void
      }
    }
    Enums: {
      user_role: 'employee' | 'manager' | 'approver' | 'admin' | 'system_admin'
      employment_status: 'active' | 'inactive' | 'on_leave'
      asset_type: 'desk' | 'room' | 'zone' | 'amenity' | 'no_book'
      asset_status: 'available' | 'unavailable' | 'maintenance' | 'restricted'
      restriction_type: 'none' | 'named_user' | 'team' | 'admin_only'
      booking_status: 'confirmed' | 'pending_approval' | 'cancelled' | 'rejected' | 'completed'
      booking_source: 'user' | 'admin' | 'recurring' | 'import'
      plan_status: 'in_office' | 'remote' | 'leave' | 'unavailable' | 'unplanned'
      approval_status: 'pending' | 'approved' | 'rejected' | 'withdrawn'
      request_type: 'advance_booking' | 'restricted_asset' | 'exception'
      schedule_type: 'weekly_digest' | 'daily_digest' | 'approval_alert' | 'booking_confirmation'
    }
  }
}

// Convenience type helpers
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type Views<T extends keyof Database['public']['Views']> =
  Database['public']['Views'][T]['Row']

export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T]
