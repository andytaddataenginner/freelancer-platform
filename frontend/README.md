# QFA React frontend

This is the new React + Vite frontend for the QFA platform. It is intentionally isolated in `frontend/` so the existing Node.js API and current production pages remain unchanged while migration is underway.

## Stack

- React + Vite
- React Router
- Tailwind CSS v4 (Vite plugin)
- Lucide React
- TanStack Query (available for subsequent data modules)
- Recharts (available for analytics modules)
- Supabase JS (available where the existing frontend uses direct Supabase access)

## Local development

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Set `VITE_API_BASE_URL` to the existing Render API URL. The current default points to the existing QFA API.

## Current migration status

- React/Vite application shell and route structure: scaffolded.
- Public website: initial React landing page; full original content, portfolio feed, contact form, resume links, and theme behavior still require parity work.
- Login: connected to the existing `POST /auth/login` endpoint; verify the exact response shape against the backend before production use.
- Dashboard: initial reads from existing freelancer stats, clients, and time-log endpoints; field mapping and totals need verification against actual API responses.
- Clients, time logs, schedule, reports, fixed invoices, contracts, projects, and portfolio: routes are mapped but their existing CRUD and business workflows are not yet migrated.
- Client portal: route and role-specific flow still need migration.

## Safety

Do not change the root backend `package.json`, `server.js`, database schema, Supabase RLS policies, or Render production service as part of this frontend migration. Never expose Supabase service-role credentials in Vite variables. Deploy the new frontend as a separate Render Static Site only after functional parity and route fallback testing.
