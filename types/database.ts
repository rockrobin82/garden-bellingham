export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded"
  | "review";

export type OrderRow = {
  id: string;
  created_at: string;
  updated_at: string;
  booking_date: string;
  customer_email: string;
  ticket_qty: number;
  normal_qty: number;
  reduced_qty: number;
  unit_price_minor: number;
  total_amount_minor: number;
  payment_status: PaymentStatus;
  p24_session_id: string | null;
  p24_order_id: string | null;
  p24_token: string | null;
  paid_at: string | null;
  email_sent_at: string | null;
  sheet_synced_at: string | null;
  day_sheet_qty: number | null;
  refunded_at: string | null;
  refund_id: string | null;
  refund_amount_minor: number | null;
  refund_reason: string | null;
  invoice_requested: boolean;
  invoice_company_name: string | null;
  invoice_nip: string | null;
  invoice_street: string | null;
  invoice_postal_code: string | null;
  invoice_city: string | null;
  invoice_issued: boolean;
  invoice_issued_at: string | null;
  payment_metadata: Record<string, unknown>;
  notes: string | null;
  entry_slot_id: string | null;
  entry_time_start: string | null;
  entry_time_end: string | null;
  entry_slot_idempotency_key: string | null;
};

export type OrderInsert = {
  id?: string;
  created_at?: string;
  updated_at?: string;
  booking_date: string;
  customer_email: string;
  ticket_qty: number;
  normal_qty: number;
  reduced_qty: number;
  unit_price_minor: number;
  total_amount_minor: number;
  payment_status?: PaymentStatus;
  p24_session_id?: string | null;
  p24_order_id?: string | null;
  p24_token?: string | null;
  paid_at?: string | null;
  email_sent_at?: string | null;
  sheet_synced_at?: string | null;
  day_sheet_qty?: number | null;
  refunded_at?: string | null;
  refund_id?: string | null;
  refund_amount_minor?: number | null;
  refund_reason?: string | null;
  invoice_requested?: boolean;
  invoice_company_name?: string | null;
  invoice_nip?: string | null;
  invoice_street?: string | null;
  invoice_postal_code?: string | null;
  invoice_city?: string | null;
  invoice_issued?: boolean;
  invoice_issued_at?: string | null;
  payment_metadata?: Record<string, unknown>;
  notes?: string | null;
  entry_slot_id?: string | null;
  entry_time_start?: string | null;
  entry_time_end?: string | null;
  entry_slot_idempotency_key?: string | null;
};

export type OrderUpdate = Partial<
  Omit<OrderRow, "id" | "created_at" | "updated_at">
>;

export type TicketRow = {
  id: string;
  order_id: string;
  ticket_code: string;
  qr_payload: string;
  status: string;
  created_at: string;
  used_at: string | null;
};

export type TicketInsert = {
  id?: string;
  order_id: string;
  ticket_code: string;
  qr_payload: string;
  status?: string;
  created_at?: string;
  used_at?: string | null;
};

export type TicketUpdate = Partial<
  Omit<TicketRow, "id" | "created_at">
>;

/**
 * Hand-written to match supabase/migrations/20261011160000_entry_slot_reservations.sql.
 * Replace with `npm run db:types` only after that migration is applied to the local database.
 */
export type EntrySlotHoldStatus = "held" | "confirmed" | "released" | "expired";

export type EntrySlotInventoryRow = {
  slot_id: string;
  ticket_limit: number;
  held_qty: number;
  sold_qty: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type EntrySlotHoldRow = {
  id: string;
  slot_id: string;
  order_id: string;
  qty: number;
  status: EntrySlotHoldStatus;
  expires_at: string;
  created_at: string;
  updated_at: string;
  released_at: string | null;
};

export type Database = {
  public: {
    Tables: {
      orders: {
        Row: OrderRow;
        Insert: OrderInsert;
        Update: OrderUpdate;
        Relationships: [];
      };
      tickets: {
        Row: TicketRow;
        Insert: TicketInsert;
        Update: TicketUpdate;
        Relationships: [];
      };
      entry_slot_inventory: {
        Row: EntrySlotInventoryRow;
        Insert: {
          slot_id: string;
          ticket_limit: number;
          held_qty?: number;
          sold_qty?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<EntrySlotInventoryRow>;
        Relationships: [];
      };
      day_sold_count_sync: {
        Row: {
          booking_date: string;
          target_qty: number | null;
          contributions: Record<string, number>;
          status: string;
          operation_id: string | null;
          observed_qty: number | null;
          detail: string | null;
          updated_at: string;
        };
        Insert: {
          booking_date: string;
          target_qty?: number | null;
          contributions?: Record<string, number>;
          status?: string;
          operation_id?: string | null;
          observed_qty?: number | null;
          detail?: string | null;
          updated_at?: string;
        };
        Update: {
          booking_date?: string;
          target_qty?: number | null;
          contributions?: Record<string, number>;
          status?: string;
          operation_id?: string | null;
          observed_qty?: number | null;
          detail?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      entry_slot_holds: {
        Row: EntrySlotHoldRow;
        Insert: {
          id?: string;
          slot_id: string;
          order_id: string;
          qty: number;
          status?: EntrySlotHoldStatus;
          expires_at: string;
          created_at?: string;
          updated_at?: string;
          released_at?: string | null;
        };
        Update: Partial<EntrySlotHoldRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      reserve_entry_slot: {
        Args: {
          p_slot_id: string;
          p_order_id: string;
          p_qty: number;
          p_ttl_seconds?: number;
        };
        Returns: EntrySlotHoldRow;
      };
      confirm_entry_slot_hold: {
        Args: {
          p_order_id: string;
          p_slot_id: string;
          p_qty: number;
        };
        Returns: EntrySlotHoldRow;
      };
      release_entry_slot_hold: {
        Args: {
          p_order_id: string;
          p_slot_id: string;
          p_qty: number;
        };
        Returns: EntrySlotHoldRow;
      };
      expire_entry_slot_holds: {
        Args: {
          p_slot_id?: string | null;
        };
        Returns: number;
      };
      sync_entry_slot_limit: {
        Args: {
          p_slot_id: string;
          p_ticket_limit: number;
          p_active: boolean;
        };
        Returns: EntrySlotInventoryRow;
      };
      insert_order_tickets: {
        Args: {
          p_order_id: string;
          p_ticket_codes: string[];
        };
        Returns: number;
      };
      plan_day_sold_count_sync: {
        Args: {
          p_booking_date: string;
          p_sheet_qty: number;
        };
        Returns: {
          action: string;
          targetQty: number | null;
          observedQty: number | null;
          operationId: string | null;
          detail: string | null;
        };
      };
      mark_day_sold_count_submitted: {
        Args: {
          p_booking_date: string;
          p_operation_id: string;
        };
        Returns: {
          marked: boolean;
        };
      };
      complete_day_sold_count_sync: {
        Args: {
          p_booking_date: string;
        };
        Returns: {
          completed: boolean;
        };
      };
      claim_order_refund: {
        Args: {
          p_order_id: string;
          p_recovery: Record<string, unknown>;
          p_expected_states: string[];
        };
        Returns: {
          claimed: boolean;
          payment_status: string;
          payment_metadata: Record<string, unknown>;
        };
      };
    };
    Enums: {
      payment_status: PaymentStatus;
      entry_slot_hold_status: EntrySlotHoldStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
