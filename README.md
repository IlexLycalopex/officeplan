# Locustworks

> Desk, rota, timesheets and room management for the modern workplace.

A browser-based workplace management application covering desk booking, shift rotas, timesheet approval and room management. Built for an internal pilot with a clear path to commercial multi-tenant SaaS.

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
| Hosting | Vercel (or GitHub Pages via Actions) |

## Quick start

### Prerequisites

- Node.js 20+ and npm (or pnpm: `npm install -g pnpm`)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (optional for local development)

### Install dependencies

```bash
npm install
```

### Configure environment

```bash
cp .env.example .env
# Edit .env with your Supabase project credentials
```

### Run locally

```bash
npm run dev
```

### Run against local Supabase

```bash
supabase start          # starts local Postgres, Auth, Edge Runtime
npm run dev             # front end at http://localhost:5173
```

## Database

All migrations are in `supabase/migrations/` in numbered order. Apply to a remote project:

```bash
supabase db push --project-ref vqgppnpggwlbtarqqnhg
```

Apply seed data after migrations:

```bash
supabase db query --file supabase/seed.sql --project-ref vqgppnpggwlbtarqqnhg
```

## Edge Functions

Three functions are deployed to Supabase:

| Function | Purpose | JWT required |
|---|---|---|
| `send-notifications` | Weekly/daily digest emails via Resend | No (called by cron) |
| `process-approvals` | Approval outcome emails | Yes |
| `invite-user` | Invitation emails | Yes |

Set the following secrets in your Supabase project dashboard:

```
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

## Vercel deployment (recommended)

1. Import the GitHub repo in [vercel.com](https://vercel.com)
2. Set these environment variables in the Vercel project settings:

```
VITE_SUPABASE_URL        → your Supabase project URL
VITE_SUPABASE_ANON_KEY   → your Supabase anon key
VITE_APP_NAME            → Locustworks
VITE_BASE_PATH           → /
```

3. Add your Vercel deployment URL to Supabase → Authentication → URL Configuration.

## GitHub Pages deployment (alternative)

The project can also deploy via `.github/workflows/deploy.yml` on push to `main`/`master`.

Set these variables in your GitHub repository settings (Settings → Variables):

```
VITE_SUPABASE_URL        → your Supabase project URL
VITE_SUPABASE_ANON_KEY   → your Supabase anon key
VITE_BASE_PATH           → /locustworks/   (for project pages)
                           /               (for user/org pages)
```

## Supabase project

| Property | Value |
|---|---|
| Project ID | `vqgppnpggwlbtarqqnhg` |
| Region | eu-west-2 (London) |
| URL | https://vqgppnpggwlbtarqqnhg.supabase.co |

## First admin setup

After signing in for the first time with your email:

1. Open Supabase dashboard → Table Editor → `users`
2. Find your row and set `role` to `admin`
3. Refresh the app — the Administration section will appear in the sidebar

## Testing

```bash
npm test               # unit tests (Vitest)
npm run typecheck      # TypeScript type check
```

## Key modules

| Module | Routes | Description |
|---|---|---|
| Desk booking | `/book` | Book desks and meeting rooms |
| Rota | `/rota` | View assigned shifts, acknowledge, set attendance |
| Timesheets | `/timesheets` | Log shifts, track break compliance, submit for approval |
| Rota Builder | `/admin/rota` | Manager grid planner — assign, publish and cancel shifts |
| Timesheet Review | `/admin/timesheet-approvals` | Manager approval queue |
| Reports | `/reports` | Space utilisation + Workforce hours/compliance analytics |
