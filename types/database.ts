export type PaymentStatus = "pending" | "paid" | "failed" | "cancelled";

export type OrderRow = {
  id: string;
  created_at: string;
  updated_at: string;
  booking_date: string;
  customer_email: string;
  ticket_qty: number;
  unit_price_minor: number;
  total_amount_minor: number;
  payment_status: PaymentStatus;
  p24_session_id: string | null;
  p24_order_id: string | null;
  paid_at: string | null;
  email_sent_at: string | null;
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
  unit_price_minor: number;
  total_amount_minor: number;
  payment_status?: PaymentStatus;
  p24_session_id?: string | null;
  p24_order_id?: string | null;
  paid_at?: string | null;
  email_sent_at?: string | null;
  payment_metadata?: Record<string, unknown>;
  notes?: string | null;
};

export type OrderUpdate = Partial<
  Omit<OrderRow, "id" | "created_at" | "updated_at">
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      payment_status: PaymentStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
