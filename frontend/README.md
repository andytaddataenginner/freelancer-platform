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
- Public website: responsive React rebuild with founder profile, skills, live portfolio, services, resume preview/download, contact form, theme toggle and portal navigation.
- Login: connected to the existing `POST /auth/login` endpoint; token and user response fields were verified against `routes/auth.js`.
- Dashboard: connected to the existing freelancer stats, clients and time-log endpoints; metric names match `routes/stats.js`.
- Client management: client listing, search, create, profile update, tracked rate changes (through the existing contracts endpoint), and delete are migrated.
- Client portal: overview, project/task progress, time-log filters, billing history, booking requests/cancellation, freelancer availability and password changes.
- Time Logs: manual log review, filters, monthly grouping, paid/unpaid updates, bulk payment status, edit/delete, payment remittance and timer controls.
- Schedule: booking list and status management.
- Reports: monthly revenue, outstanding balances and time-log summaries.
- Fixed Invoices: month selection, invoice generation and paid/unpaid status.
- Contracts: contract history and pause/resume/terminate controls.
- Projects: project creation, task listing, task creation and task status updates.
- Portfolio: create, edit, publish/unpublish and delete portfolio items. Uses the authenticated `/api/portfolio/manage` listing endpoint added on this branch; public portfolio remains published-only.
- Client Notes: create, pin/unpin and delete client notes.

## Safety

The existing root backend `package.json`, `server.js`, database schema, Supabase RLS policies and existing Render API service are unchanged. Additive authenticated endpoints are included for portfolio management (`GET /api/portfolio/manage`) and client billing/booking (`GET /api/client/fixed-payments`, `GET /api/client/payments`, `POST /api/client/bookings`, `PATCH /api/client/bookings/:id/cancel`). Existing public portfolio behavior and existing database schema are unchanged. Never expose Supabase service-role credentials in Vite variables. Deploy the frontend as a separate Render Static Site from `feature/react-migration`; leave Render Root Directory blank so the build can copy the existing logo, founder photo and resume files into `frontend/dist`. Do not change the existing API service. See [DEPLOYMENT.md](./DEPLOYMENT.md) for the exact settings.
