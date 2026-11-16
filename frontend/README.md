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
- Login: connected to the existing `POST /auth/login` endpoint; token and user response fields were verified against `routes/auth.js`.
- Dashboard: connected to the existing freelancer stats, clients and time-log endpoints; metric names match `routes/stats.js`.
- Client management: client listing, search, create, profile update, tracked rate changes (through the existing contracts endpoint), and delete are migrated.
- Client portal: read-only dashboard loads the existing stats, projects, time logs, bookings and notes endpoints.
- Time Logs: manual log review, filters, monthly grouping, paid/unpaid updates, bulk payment status, edit/delete, payment remittance and timer controls.
- Schedule: booking list and status management.
- Reports: monthly revenue, outstanding balances and time-log summaries.
- Fixed Invoices: month selection, invoice generation and paid/unpaid status.
- Contracts: contract history and pause/resume/terminate controls.
- Projects: project creation, task listing, task creation and task status updates.
- Portfolio: create, edit, publish/unpublish and delete portfolio items.
- Client Notes: create, pin/unpin and delete client notes.

## Safety

Do not change the root backend `package.json`, `server.js`, database schema, Supabase RLS policies, or Render production service as part of this frontend migration. Never expose Supabase service-role credentials in Vite variables. Deploy the new frontend as a separate Render Static Site only after functional parity and route fallback testing.
