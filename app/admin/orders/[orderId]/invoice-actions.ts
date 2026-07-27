"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/admin/require-admin";
import { markOrderInvoiceIssued } from "@/lib/admin/orders";

export type MarkInvoiceIssuedState = {
  error: string | null;
  success: boolean;
};

export async function markInvoiceIssuedAction(
  orderId: string,
): Promise<MarkInvoiceIssuedState> {
  try {
    await requireAdminSession();
    await markOrderInvoiceIssued(orderId);
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin");
    return { error: null, success: true };
  } catch (error) {
    console.error("[markInvoiceIssuedAction]", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Nie udało się oznaczyć faktury.",
      success: false,
    };
  }
}
