# Ogrod Bellingham - Ticket Booking MVP

Minimalist online ticket booking application for "Ogrod Bellingham".

## Implemented sections

- **Section 1**: project scaffold, Tailwind, ESLint, Docker, base UI
- **Section 2**: environment validation, Google Sheets schema/types, Sheets client helpers

## Tech Stack

- Next.js 15 (App Router)
- TypeScript (strict mode)
- TailwindCSS v4
- Zod (runtime validation)
- Google Sheets API (`googleapis`)
- Docker + Docker Compose

## Project Structure

```txt
app/
  (public)/          # booking UI (placeholder)
  api/               # API routes (placeholders for later sections)
lib/
  config/env.ts      # strict env loader (server-only)
  sheets/            # Google Sheets client + helpers
  validation/        # zod schemas (checkout, payment status)
types/
  booking.ts         # CheckoutPayload, PaymentStatus
  sheets.ts          # DateRow, OrderRow
```

## Environment Variables

Copy the example file and fill in values:

```bash
cp .env.example .env.local
```

### Required (Section 2)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_APP_URL` | Public app URL (e.g. `http://localhost:3000`) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Google service account email |
| `GOOGLE_PRIVATE_KEY` | Service account private key (use `\n` for newlines) |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | Spreadsheet ID from the sheet URL |

### Optional (future sections)

| Variable | Used in |
|----------|---------|
| `P24_*` | Przelewy24 payments |
| `RESEND_API_KEY`, `MAIL_FROM` | Ticket email delivery |

Validation runs lazily via `getEnv()` in `lib/config/env.ts` when server code first needs configuration. This keeps `next build` working without secrets until API routes call server modules.

## Google Sheets Schema (MVP)

Create one spreadsheet and share it with the service account (Editor).

### Tab: `dates` (owner-managed)

| Column | Type | Description |
|--------|------|-------------|
| `date` | `YYYY-MM-DD` | Visit date (unique per row) |
| `active` | `TRUE`/`FALSE` | Whether the date is bookable |
| `ticket_limit` | number | Max tickets for this date |
| `sold_count` | number | Tickets already sold |
| `price_normal` | number | Normal ticket price (PLN) |
| `price_reduced` | number | Reduced ticket price (PLN) |
| `note` | text | Optional message shown for this date |
| `max_tickets_per_order` | number | Max tickets per single order |

**Row 1** must be the header row with these exact column names.

### Tab: `orders` (app-written)

| Column | Type | Description |
|--------|------|-------------|
| `order_id` | text | Internal order ID |
| `created_at` | ISO datetime | Order creation time |
| `visit_date` | `YYYY-MM-DD` | Selected visit date |
| `email` | text | Customer email |
| `normal_qty` | number | Normal tickets count |
| `reduced_qty` | number | Reduced tickets count |
| `total_amount` | number | Total price (PLN) |
| `payment_status` | `pending` \| `paid` \| `failed` \| `cancelled` | Payment state |
| `p24_session_id` | text | Przelewy24 session reference |
| `ticket_ids` | text | Comma-separated ticket IDs (after payment) |

**Row 1** must be the header row with these exact column names.

## Section 2 – File reference

| File | Purpose |
|------|---------|
| `lib/config/env.ts` | Zod-validated env loader; `server-only` |
| `lib/sheets/schema.ts` | Tab names and column definitions |
| `lib/sheets/client.ts` | JWT auth + singleton Sheets API client |
| `lib/sheets/helpers.ts` | `readSheetRange`, `appendSheetRow`, row parsers |
| `types/booking.ts` | `CheckoutPayload`, `PaymentStatus` |
| `types/sheets.ts` | `DateRow`, `OrderRow` |
| `lib/validation/checkout.ts` | Zod schema for checkout payload |
| `lib/validation/payment.ts` | Zod schema for payment status values |

## Local Development

### Node.js

```bash
npm install
cp .env.example .env.local
# edit .env.local with your Google credentials
npm run dev
```

### Docker Compose

```bash
docker compose up --build
```

Set env vars via `.env.local` on the host (mount `./` into the container).

## Out of scope (not yet implemented)

- Payment / webhook logic
- QR generation
- Email sending
- Booking API routes and UI flow
- Analytics / statistics tabs
- Advanced logging

## Commands

```bash
npm run dev
npm run lint
npm run build
```
