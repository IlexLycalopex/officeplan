# OfficePlan

> Desk, rota and room management for the modern workplace.

A browser-based office seating and workplace management application built for an initial internal pilot (phase 1) with a clear path to commercial multi-tenant SaaS (phase 2).

## Architecture

| Layer | Technology |
|---|---|
| Front end | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + custom design tokens |
| State | Zustand + TanStack Query |
| Auth | Supabase Auth (magic-link / OTP) |
| Database | Supabase Postgres + RLS |
| Server logic | Supabase Edge Functions (Deno) |
| Email | Resend |
| Hosting | GitHub Pages (static build via GitHub Actions) |

## Quick start

### Prerequisites

- Node.js 20+ and pnpm (`npm install -g pnpm`)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (optional for local development)

### Install dependencies

```bash
pnpm install
```

### Configure environment

```bash
cp .env.example .env
# Edit .env with your Supabase project credentials
```

### Run locally

```bash
pnpm dev
```

### Run against local Supabase

```bash
supabase start          # starts local Postgres, Auth, Edge Runtime
pnpm dev                # front end at http://localhost:5173
```

## Database

All migrations are in `supabase/migrations/` in numbered order. Apply to a remote project:

```bash
supabase db push --project-ref plbdskgnrjtprkfgycdq
```

Apply seed data after migrations:

```bash
supabase db query --file supabase/seed.sql --project-ref plbdskgnrjtprkfgycdq
```

## Edge Functions

Three functions are deployed to Supabase:

| Function | Purpose | JWT required |
|---|---|---|
| `send-notifications` | Weekly/daily digest emails via Resend | No (called by cron) |
| `process-approvals` | Approval outcome emails | Yes |
| `export-report` | CSV export for reports page | Yes |

Set the following secrets in your Supabase project dashboard:

```
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

## GitHub Pages deployment

The project deploys automatically on push to `main` via `.github/workflows/deploy.yml`.

Set these secrets in your GitHub repository settings:

```
VITE_SUPABASE_URL        → your Supabase project URL
VITE_SUPABASE_ANON_KEY   → your Supabase anon key
```

Set this variable (not secret):

```
VITE_BASE_PATH   → /your-repo-name/   (for project pages)
                   /                  (for user/org pages)
```

## Supabase project

| Property | Value |
|---|---|
| Project ID | `plbdskgnrjtprkfgycdq` |
| Region | eu-west-2 (London) |
| URL | https://plbdskgnrjtprkfgycdq.supabase.co |

## First admin setup

After signing in for the first time with your email:

1. Open Supabase dashboard → Table Editor → `users`
2. Find your row and set `role` to `admin`
3. Refresh the app — the Administration section will appear in the sidebar

## Testing

```bash
pnpm test          # unit tests (Vitest)
pnpm test:e2e      # E2E tests (Playwright) — requires running dev server
pnpm typecheck     # TypeScript type check
```

## Phase 2 readiness

The following are designed-in from day one but not yet active:

- **Multi-tenant**: `organisation_id` on all data tables; RLS policies ready for multiple orgs
- **Outlook integration**: booking service abstracted via RPC functions — add calendar adapter
- **Teams notifications**: notification layer separated from email delivery channel
- **SSO**: auth abstraction in `src/lib/auth.ts` — swap provider without touching components

## Specification

See `office_seating_workplace_management_specification.docx` for the full product specification.
