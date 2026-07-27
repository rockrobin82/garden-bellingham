import { z } from "zod";

const postalCodeRegex = /^\d{2}-\d{3}$/;
const nipRegex = /^\d{10}$/;

export const orderInvoiceFieldsSchema = z.object({
  invoiceRequested: z.boolean().default(false),
  invoiceCompanyName: z.string().trim().optional(),
  invoiceNip: z.string().trim().optional(),
  invoiceStreet: z.string().trim().optional(),
  invoicePostalCode: z.string().trim().optional(),
  invoiceCity: z.string().trim().optional(),
});

export function refineInvoiceFields(
  data: z.infer<typeof orderInvoiceFieldsSchema>,
  ctx: z.RefinementCtx,
): void {
  if (!data.invoiceRequested) {
    return;
  }

  if (!data.invoiceCompanyName) {
    ctx.addIssue({
      code: "custom",
      message: "Nazwa firmy jest wymagana",
      path: ["invoiceCompanyName"],
    });
  }

  const nip = data.invoiceNip?.replace(/\s+/g, "") ?? "";
  if (!nipRegex.test(nip)) {
    ctx.addIssue({
      code: "custom",
      message: "NIP musi składać się z 10 cyfr",
      path: ["invoiceNip"],
    });
  }

  if (!data.invoiceStreet) {
    ctx.addIssue({
      code: "custom",
      message: "Ulica jest wymagana",
      path: ["invoiceStreet"],
    });
  }

  if (!data.invoicePostalCode || !postalCodeRegex.test(data.invoicePostalCode)) {
    ctx.addIssue({
      code: "custom",
      message: "Kod pocztowy musi mieć format XX-XXX",
      path: ["invoicePostalCode"],
    });
  }

  if (!data.invoiceCity) {
    ctx.addIssue({
      code: "custom",
      message: "Miasto jest wymagane",
      path: ["invoiceCity"],
    });
  }
}

export function normalizeInvoicePayload<T extends z.infer<typeof orderInvoiceFieldsSchema>>(
  data: T,
): Pick<
  T,
  | "invoiceRequested"
  | "invoiceCompanyName"
  | "invoiceNip"
  | "invoiceStreet"
  | "invoicePostalCode"
  | "invoiceCity"
> {
  if (!data.invoiceRequested) {
    return {
      invoiceRequested: false,
    } as Pick<
      T,
      | "invoiceRequested"
      | "invoiceCompanyName"
      | "invoiceNip"
      | "invoiceStreet"
      | "invoicePostalCode"
      | "invoiceCity"
    >;
  }

  return {
    invoiceRequested: true,
    invoiceCompanyName: data.invoiceCompanyName!.trim(),
    invoiceNip: data.invoiceNip!.replace(/\s+/g, ""),
    invoiceStreet: data.invoiceStreet!.trim(),
    invoicePostalCode: data.invoicePostalCode!.trim(),
    invoiceCity: data.invoiceCity!.trim(),
  } as Pick<
    T,
    | "invoiceRequested"
    | "invoiceCompanyName"
    | "invoiceNip"
    | "invoiceStreet"
    | "invoicePostalCode"
    | "invoiceCity"
  >;
}
