# Ogrod Bellingham - Ticket Booking MVP

Minimalist online ticket booking application for "Ogrod Bellingham".

This repository currently contains **Section 1 only**:
- project initialization
- strict TypeScript setup
- TailwindCSS and ESLint setup
- Docker + Docker Compose setup
- base UI layout and placeholder homepage
- initial shallow folder structure

## Tech Stack

- Next.js 15 (App Router)
- TypeScript (strict mode)
- TailwindCSS v4
- ESLint
- Docker (multi-stage build)
- Docker Compose (local development)

## Architecture Decisions (MVP First)

### Why Next.js 15 + App Router
- Stable, widely adopted, and production-ready.
- Supports clear separation between UI and server-side API routes.
- Good fit for Vercel deployment.

### Why strict TypeScript
- Improves reliability early.
- Helps keep business logic understandable as features are added.
- Prevents accidental `any`-driven complexity.

### Why shallow folder structure
- Easier onboarding and maintenance.
- Avoids enterprise-style over-abstraction in MVP.
- Keeps core app areas explicit: `app`, `components`, `lib`, `types`.

### Why simple `lib/*` modules
- Grouped by responsibility without repository or event-driven patterns.
- Direct, readable integration points for future sections:
  - `lib/sheets` for Google Sheets
  - `lib/payments` for Przelewy24
  - `lib/tickets` for pricing/stock/ticket helpers
  - `lib/email` for sending tickets

### Why Docker setup now
- Reproducible local environment from day one.
- Multi-stage Dockerfile for future production images.
- Compose with fixed container name and mounted code volume for fast local iteration.

## Current Project Structure

```txt
app/
  (public)/
    layout.tsx
    page.tsx
  api/
    availability/
    checkout/
    payment/
      webhook/
      return/
  globals.css
  layout.tsx
components/
  booking/
  ui/
lib/
  config/
  sheets/
  payments/
  tickets/
  email/
  validation/
  utils/
types/
Dockerfile
docker-compose.yml
.env.example
```

## Local Development

### 1) Node.js local
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

### 2) Docker Compose local
```bash
docker compose up --build
```
Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

Copy:
```bash
cp .env.example .env.local
```

Only variable templates are defined now. Integrations are intentionally not implemented in Section 1.

## Out Of Scope in Section 1

Not implemented yet:
- Google Sheets integration
- payment integration
- QR generation
- email sending
- booking business logic
- analytics and advanced logging

These will be added in later sections, step by step.
