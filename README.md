# QABase

A lightweight, web-based QA test case management app.

**Stack:** SvelteKit (frontend + API routes) + Supabase Auth + Tailwind CSS v4 · PostgreSQL (Supabase) · Single Vercel deployment.

## Prerequisites

- **Supabase project** — [Create one free](https://supabase.com)
  - Note the Project URL and anon/service role keys (Settings → API)
  - JWT Secret (Settings → API, scroll to JWT Secret)
- **Node.js 22+**

## Local Development

### 1. Environment Setup

Create a `.env` file in the project root and fill in your Supabase credentials:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_JWT_SECRET=your_jwt_secret
STORAGE_BUCKET=attachments
```

### 2. Frontend + API

```bash
cd frontend
npm install
npm run dev
```

The frontend and API will be available at http://localhost:5173.

- Frontend: http://localhost:5173
- API routes: http://localhost:5173/api/*
- Interactive API docs: See `src/routes/api/` for all endpoints

### 3. Login

Go to http://localhost:5173/login and create your account via Supabase Auth (email/password or OAuth).

On first login, your user record is automatically created in the database.

## Deployment to Vercel

### Single Deployment (Frontend + API)

```bash
cd frontend
npm install -g vercel

# Login to your Vercel account
vercel login

# Deploy
vercel deploy --prod
```

Set environment variables in Vercel project settings:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STORAGE_BUCKET`

The Vercel deployment includes both the frontend and all API routes.

## Project Layout

```
qabase/
├── frontend/                    # SvelteKit app (frontend + API)
│   ├── src/
│   │   ├── lib/
│   │   │   ├── api.ts          # Client-side API wrapper
│   │   │   └── server/         # Server-only utilities
│   │   │       ├── supabase.ts
│   │   │       ├── auth.ts
│   │   │       ├── permissions.ts
│   │   │       ├── projects.ts
│   │   │       ├── audit.ts
│   │   │       ├── notify.ts
│   │   │       ├── helpers.ts
│   │   │       └── suite-utils.ts
│   │   └── routes/
│   │       ├── [projectSlug]/   # Frontend pages
│   │       └── api/             # SvelteKit API routes (59 files)
│   │           ├── healthz/
│   │           ├── auth/
│   │           ├── projects/
│   │           ├── cases/
│   │           ├── suites/
│   │           ├── plans/
│   │           ├── runs/
│   │           ├── reviews/
│   │           ├── defects/
│   │           ├── dashboard/
│   │           ├── requirements/
│   │           ├── steps/
│   │           ├── milestones/
│   │           ├── environments/
│   │           ├── exploratory-sessions/
│   │           ├── comments/
│   │           ├── share/
│   │           ├── public/
│   │           └── audit/
│   ├── package.json
│   ├── svelte.config.js
│   └── vite.config.js
├── .env                 # Local only, don't commit
├── vercel.json
└── README.md
```

## Useful Commands

```bash
# Type check frontend
npm run check

# Build frontend
npm run build
```

## Architecture Notes

- **Auth**: Supabase JWT (frontend sends `Authorization: Bearer <token>`)
- **Database**: PostgreSQL via Supabase client library
- **Files**: Supabase Storage (bucket: `attachments`)
- **Multi-tenancy**: Projects with role-based access control (viewer < qa < manager < admin)
- **API**: SvelteKit `+server.ts` routes with project scoping via `X-Project-Id` header
- **Analytics**: Supabase PostgreSQL functions (RPC) for complex queries
- **Audit**: Fire-and-forget logging to `audit_events` table

## API Routes Summary

| Group | Routes |
|-------|--------|
| **Auth** | `GET /api/auth/me`, `POST /api/auth/logout` |
| **Projects** | `GET/POST /api/projects`, `GET /api/projects/current`, `PUT/DELETE /api/projects/[id]` |
| **Test Cases** | `GET/POST /api/cases`, `GET /api/cases/count`, `POST /api/cases/bulk`, `GET/PUT/DELETE /api/cases/[id]`, `GET /api/cases/[id]/revisions`, `POST /api/cases/[id]/archive`, `POST /api/cases/[id]/restore` |
| **Suites** | `GET/POST /api/suites`, `GET/PUT/DELETE /api/suites/[id]`, `GET /api/suites/[id]/cases`, `POST/DELETE /api/suites/[id]/cases/[caseId]`, `POST /api/suites/[id]/reparent`, `POST /api/suites/[id]/quick-case` |
| **Plans** | `GET/POST /api/plans`, `GET/PUT/DELETE /api/plans/[id]`, `GET /api/plans/[id]/cases` |
| **Runs** | `GET/POST /api/runs`, `GET /api/runs/my-queue`, `GET/DELETE /api/runs/[id]`, `PUT /api/runs/[id]/results/[idx]`, `POST /api/runs/[id]/results/[idx]/assign`, `POST /api/runs/[id]/rerun-failed`, `POST /api/runs/[id]/finish` |
| **Reviews** | `GET/POST /api/reviews`, `DELETE /api/reviews/[id]`, `POST /api/reviews/[id]/decide` |
| **Defects** | `GET/POST /api/defects`, `GET/PUT/DELETE /api/defects/[id]`, `POST /api/defects/[id]/link`, `POST /api/defects/[id]/external`, `DELETE /api/defects/[id]/external/[extId]` |
| **Dashboard** | `GET /api/dashboard/overview`, `GET /api/dashboard/coverage`, `GET /api/dashboard/flakiness`, `GET /api/dashboard/top-failing`, `GET /api/dashboard/release-readiness` |
| **Requirements** | `GET/POST /api/requirements`, `GET/PUT/DELETE /api/requirements/[id]`, `GET /api/requirements/coverage-matrix` |
| **Steps** | `GET/POST /api/steps`, `GET/PUT/DELETE /api/steps/[id]` |
| **Milestones** | `GET/POST /api/milestones`, `GET/PUT/DELETE /api/milestones/[id]` |
| **Environments** | `GET/POST /api/environments`, `GET/PUT/DELETE /api/environments/[id]` |
| **Exploratory Sessions** | `GET/POST /api/exploratory-sessions`, `GET/PUT/DELETE /api/exploratory-sessions/[id]`, `POST /api/exploratory-sessions/[id]/pause`, `POST /api/exploratory-sessions/[id]/resume`, `POST /api/exploratory-sessions/[id]/complete`, `POST /api/exploratory-sessions/[id]/bugs`, `DELETE /api/exploratory-sessions/[id]/bugs/[bugId]`, `POST /api/exploratory-sessions/[id]/screenshots`, `GET /api/exploratory-sessions/[id]/screenshots/[screenshotId]` |
| **Comments** | `GET/POST /api/comments`, `DELETE /api/comments/[id]`, `GET /api/comments/inbox` |
| **Share** | `GET/POST /api/share`, `POST /api/share/[id]/revoke` |
| **Public** | `GET /api/public/run/[token]` (no auth) |
| **Audit** | `GET /api/audit` |
| **Attachments** | `GET /api/runs/[id]/attachments`, `GET /api/runs/[id]/attachments/[attachmentId]`, `POST /api/runs/[id]/results/[idx]/steps/[pos]/attachments` |

## License

Private — internal use only at this stage.
