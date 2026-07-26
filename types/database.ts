export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded";

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
  refunded_at: string | null;
  refund_id: string | null;
  refund_amount_minor: number | null;
  refund_reason: string | null;
  payment_metadata: Record<string, unknown>;
  notes: string | null;
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
  refunded_at?: string | null;
  refund_id?: string | null;
  refund_amount_minor?: number | null;
  refund_reason?: string | null;
  payment_metadata?: Record<string, unknown>;
  notes?: string | null;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      payment_status: PaymentStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
