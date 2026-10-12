export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      entry_slot_holds: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          order_id: string
          qty: number
          released_at: string | null
          slot_id: string
          status: Database["public"]["Enums"]["entry_slot_hold_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          order_id: string
          qty: number
          released_at?: string | null
          slot_id: string
          status?: Database["public"]["Enums"]["entry_slot_hold_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          order_id?: string
          qty?: number
          released_at?: string | null
          slot_id?: string
          status?: Database["public"]["Enums"]["entry_slot_hold_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entry_slot_holds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_slot_holds_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "entry_slot_inventory"
            referencedColumns: ["slot_id"]
          },
        ]
      }
      entry_slot_inventory: {
        Row: {
          active: boolean
          created_at: string
          held_qty: number
          slot_id: string
          sold_qty: number
          ticket_limit: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          held_qty?: number
          slot_id: string
          sold_qty?: number
          ticket_limit: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          held_qty?: number
          slot_id?: string
          sold_qty?: number
          ticket_limit?: number
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          booking_date: string
          created_at: string | null
          customer_email: string
          email_sent_at: string | null
          entry_slot_id: string | null
          entry_slot_idempotency_key: string | null
          entry_time_end: string | null
          entry_time_start: string | null
          id: string
          invoice_city: string | null
          invoice_company_name: string | null
          invoice_issued: boolean
          invoice_issued_at: string | null
          invoice_nip: string | null
          invoice_postal_code: string | null
          invoice_requested: boolean
          invoice_street: string | null
          normal_qty: number
          notes: string | null
          p24_order_id: string | null
          p24_session_id: string | null
          p24_token: string | null
          paid_at: string | null
          payment_metadata: Json
          payment_status: Database["public"]["Enums"]["payment_status"]
          reduced_qty: number
          refund_amount_minor: number | null
          refund_id: string | null
          refund_reason: string | null
          refunded_at: string | null
          sheet_synced_at: string | null
          ticket_qty: number
          total_amount_minor: number
          unit_price_minor: number
          updated_at: string | null
        }
        Insert: {
          booking_date: string
          created_at?: string | null
          customer_email: string
          email_sent_at?: string | null
          entry_slot_id?: string | null
          entry_slot_idempotency_key?: string | null
          entry_time_end?: string | null
          entry_time_start?: string | null
          id?: string
          invoice_city?: string | null
          invoice_company_name?: string | null
          invoice_issued?: boolean
          invoice_issued_at?: string | null
          invoice_nip?: string | null
          invoice_postal_code?: string | null
          invoice_requested?: boolean
          invoice_street?: string | null
          normal_qty?: number
          notes?: string | null
          p24_order_id?: string | null
          p24_session_id?: string | null
          p24_token?: string | null
          paid_at?: string | null
          payment_metadata?: Json
          payment_status?: Database["public"]["Enums"]["payment_status"]
          reduced_qty?: number
          refund_amount_minor?: number | null
          refund_id?: string | null
          refund_reason?: string | null
          refunded_at?: string | null
          sheet_synced_at?: string | null
          ticket_qty: number
          total_amount_minor: number
          unit_price_minor: number
          updated_at?: string | null
        }
        Update: {
          booking_date?: string
          created_at?: string | null
          customer_email?: string
          email_sent_at?: string | null
          entry_slot_id?: string | null
          entry_slot_idempotency_key?: string | null
          entry_time_end?: string | null
          entry_time_start?: string | null
          id?: string
          invoice_city?: string | null
          invoice_company_name?: string | null
          invoice_issued?: boolean
          invoice_issued_at?: string | null
          invoice_nip?: string | null
          invoice_postal_code?: string | null
          invoice_requested?: boolean
          invoice_street?: string | null
          normal_qty?: number
          notes?: string | null
          p24_order_id?: string | null
          p24_session_id?: string | null
          p24_token?: string | null
          paid_at?: string | null
          payment_metadata?: Json
          payment_status?: Database["public"]["Enums"]["payment_status"]
          reduced_qty?: number
          refund_amount_minor?: number | null
          refund_id?: string | null
          refund_reason?: string | null
          refunded_at?: string | null
          sheet_synced_at?: string | null
          ticket_qty?: number
          total_amount_minor?: number
          unit_price_minor?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_entry_slot_id_fkey"
            columns: ["entry_slot_id"]
            isOneToOne: false
            referencedRelation: "entry_slot_inventory"
            referencedColumns: ["slot_id"]
          },
        ]
      }
      tickets: {
        Row: {
          created_at: string
          id: string
          order_id: string
          qr_payload: string
          status: string
          ticket_code: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          qr_payload: string
          status?: string
          ticket_code: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          qr_payload?: string
          status?: string
          ticket_code?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      confirm_entry_slot_hold: {
        Args: { p_order_id: string; p_qty: number; p_slot_id: string }
        Returns: {
          created_at: string
          expires_at: string
          id: string
          order_id: string
          qty: number
          released_at: string | null
          slot_id: string
          status: Database["public"]["Enums"]["entry_slot_hold_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "entry_slot_holds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      expire_entry_slot_holds: { Args: { p_slot_id?: string }; Returns: number }
      insert_order_tickets: {
        Args: { p_order_id: string; p_ticket_codes: string[] }
        Returns: number
      }
      release_entry_slot_hold: {
        Args: { p_order_id: string; p_qty: number; p_slot_id: string }
        Returns: {
          created_at: string
          expires_at: string
          id: string
          order_id: string
          qty: number
          released_at: string | null
          slot_id: string
          status: Database["public"]["Enums"]["entry_slot_hold_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "entry_slot_holds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reserve_entry_slot: {
        Args: {
          p_order_id: string
          p_qty: number
          p_slot_id: string
          p_ttl_seconds?: number
        }
        Returns: {
          created_at: string
          expires_at: string
          id: string
          order_id: string
          qty: number
          released_at: string | null
          slot_id: string
          status: Database["public"]["Enums"]["entry_slot_hold_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "entry_slot_holds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sync_entry_slot_limit: {
        Args: { p_active: boolean; p_slot_id: string; p_ticket_limit: number }
        Returns: {
          active: boolean
          created_at: string
          held_qty: number
          slot_id: string
          sold_qty: number
          ticket_limit: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "entry_slot_inventory"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      entry_slot_hold_status: "held" | "confirmed" | "released" | "expired"
      payment_status:
        | "pending"
        | "paid"
        | "failed"
        | "cancelled"
        | "refunded"
        | "review"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      entry_slot_hold_status: ["held", "confirmed", "released", "expired"],
      payment_status: [
        "pending",
        "paid",
        "failed",
        "cancelled",
        "refunded",
        "review",
      ],
    },
  },
} as const
