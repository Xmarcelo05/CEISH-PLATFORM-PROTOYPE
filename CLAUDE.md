# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation rule

Every time a change is made to the codebase, document it in `CEISH_AVANCE.md` (roadmap table update + a dated session entry with file:line evidence, following the existing style in that file). Do this for every change, not just large features.

## Commands

```bash
npm run dev            # Start Vite dev server + API middleware (http://localhost:5173)
npm run build          # Type-check then build for production (tsc -b && vite build)
npm run lint           # ESLint
npx tsc -b             # Type-check only (both app + node projects), no build artifacts

docker compose up -d   # Start PostgreSQL + MinIO (required for the app to load data)
docker compose down    # Stop services (keeps volumes)
docker compose down -v # Stop and wipe data/files (re-runs schema + seed on next up)
```

There are no automated tests configured yet. Verification is done end-to-end (hit `/api/*`, check the DB/MinIO).

## Architecture

React 19 + TypeScript + Vite multi-role platform for academic PDF document evaluation. Three roles — **student**, **evaluator**, **admin** — each with its own interface.

**The data is real**, backed by PostgreSQL (metadata) and MinIO (PDF files), both running in Docker. There is **no separate backend project** (no NestJS/Express): the browser cannot open TCP sockets to PostgreSQL/MinIO, so a thin API layer lives **inside the Vite dev server** as a plugin.

```
React (browser)
   src/services/*.ts ──fetch──► /api/* routes  (src/server/apiPlugin.ts, a Vite plugin)
                                      │
                        ┌─────────────┼──────────────┐
                        ▼             ▼              
                 src/lib/database.ts  src/lib/minio.ts
                   (pg Pool)          (MinIO client)
                        │             │
                        ▼             ▼
                   PostgreSQL      MinIO (bucket "documents")
                   (metadata)      (PDF files)
```

- Components call `src/services/*` and **never** run SQL or talk to MinIO directly.
- SQL lives in `src/server/queries/` (server-only, run inside the Vite middleware).
- The single pg `Pool` is in `src/lib/database.ts`; the MinIO client in `src/lib/minio.ts`.
- **PDFs are never stored in PostgreSQL** — the file goes to MinIO and the DB stores only the object key (`submissions.document_path`).

### Server vs. browser code split (important for tsconfig)

`src/server/**` and `src/lib/**` run **only in Node** (inside the Vite middleware), use Node types, and import `pg`/`minio`/`busboy`. They are compiled by **`tsconfig.node.json`** (`types: ["node"]`, `esModuleInterop`) and **excluded from `tsconfig.app.json`** (which has DOM libs). When adding a server file under `src/lib` or `src/server`, it is already covered by the node project's `include`. Do not import server files from browser code.

### Feature-first structure

```
database/
├── schema.sql                    # Tables, indexes, constraints (runs once on empty volume)
└── seed.sql                      # Demo data
docker-compose.yml                # postgres + minio + minio-init (bucket) + volumes
src/
├── lib/                          # SERVER-ONLY (Node, inside Vite middleware)
│   ├── database.ts               # pg Pool, query(), withTransaction()
│   └── minio.ts                  # MinIO client: ensureBucket, uploadPdf, presigned URL, object stream
├── server/                       # SERVER-ONLY (Node, inside Vite middleware)
│   ├── apiPlugin.ts              # Vite plugin: routes /api/* (incl. /upload and /documents)
│   └── queries/                  # SQL per domain: users, submissions, assignments, reviews
├── services/                     # BROWSER: what components call (fetch, no SQL)
│   ├── http.ts                   # apiGet helper
│   ├── storage.ts                # upload PDF + view URL + raw embed URL (MinIO)
│   ├── submissions.ts            # orchestrates storage (file) + persistence (DB)
│   ├── userService.ts / submissionService.ts / assignmentService.ts / reviewService.ts
├── app/
│   ├── router/index.tsx          # React Router v7 — all routes, role-based redirect
│   └── providers/AppProviders.tsx
├── features/
│   ├── auth/                     # LoginPage (user-card login, simulated auth)
│   ├── evaluation/               # Original standalone PDF evaluation module (legacy)
│   │   ├── hooks/                # usePDFViewer (accepts File | URL string), useEvaluation
│   │   └── components/PDFViewer, CriteriaPanel, EvaluationHeader
│   ├── student/                  # SubmissionPage, SubmissionCard, UploadModal
│   ├── evaluator/                # EvaluatorDashboard, StudentCard, ReviewPage, StageNav, useReview
│   └── admin/                    # AdminDashboard, AssignmentPanel
├── shared/
│   ├── types/platform.types.ts   # User, UserRole, StudentSubmission, Review, ReviewStage, Assignment
│   ├── services/platformService.ts  # API-backed adapter + BD↔UI type mapping (the swap point)
│   ├── components/AppShell.tsx   # 220px dark sidebar + Outlet
│   └── styles/platform.css
├── store/                        # Zustand: authStore, reviewStore, evaluationStore
├── utils/cn.ts
└── index.css                     # Design tokens + reset
```

### Routes

| Path | Layout | Role |
|------|--------|------|
| `/login` | none | all |
| `/` | none | all (redirects by role via `RootRedirect`, reads `authStore`) |
| `/estudiante` | AppShell | student |
| `/evaluador` | AppShell | evaluator |
| `/evaluador/revision/:submissionId` | none (full-screen) | evaluator |
| `/admin` / `/admin/asignaciones` | AppShell | admin |
| `/evaluacion` / `/evaluacion/:id` | none (full-screen) | evaluator (legacy) |

### `platformService` — the integration / mapping layer

`src/shared/services/platformService.ts` is the **single swap point** between the UI and the backend. It exposes the same method names the hooks/components already used (`getUsers`, `getSubmissionForStudent`, `createSubmission`, `getOrCreateReview`, `saveReview`, …) but each method now calls `/api/*` and **maps DB rows to the UI types**. Two translations happen here:

- role: `teacher` (DB) ↔ `evaluator` (UI)
- submission status: `submitted` (DB) ↔ `under-review` (UI)
- `Review.currentStageIndex` is **derived** from stage statuses (the DB does not store it).

Because of this, feature components are unaware of the DB; to change persistence, edit `platformService.ts` (UI mapping) and `src/server/queries/*` (SQL).

### API routes (src/server/apiPlugin.ts)

| Method + path | Purpose |
|---------------|---------|
| `GET /api/users[?role=]`, `GET /api/users/:id` | users (joins `roles`) |
| `GET /api/submissions[?studentId=]`, `GET /api/submissions/:id` | submissions |
| `POST /api/submissions`, `PATCH/DELETE /api/submissions/:id` | submission writes |
| `POST /api/upload` | multipart (busboy): validate PDF + size, upload to MinIO, return `documentPath` |
| `GET /api/documents/:id` | presigned URL (5 min) to open the PDF in a new tab |
| `GET /api/documents/:id/raw` | streams the PDF (same-origin) for embedding in the viewer |
| `GET /api/assignments[?teacherId=]`, `POST`, `DELETE /api/assignments/:id` | assignments |
| `POST /api/reviews` | getOrCreate review (creates 4 stages + criteria from template) |
| `GET /api/reviews/:submissionId`, `PUT /api/reviews/:reviewId` | read / save review |

### Database schema (database/schema.sql)

`roles`, `users` (FK→roles), `submissions` (FK→users; `document_path` is the MinIO key, no PDF bytes), `assignments` (teacher↔student), `reviews` (one per submission, unique), `review_stages` (4 per review), `criteria_evaluations` (per stage), `annotations` (per criterion: page + x/y/width/height as % of page). Seed: 1 admin, 1 teacher (Profesor Demo), 3 students (Juan/María/Carlos), with one submission + an in-progress review.

### Document storage flow (MinIO)

```
Student picks PDF → multipart POST /api/upload (validates PDF + size)
   → middleware uploads to MinIO → returns object key
   → submission saved in PostgreSQL with document_path
View: student "Ver documento" → GET /api/documents/:id → presigned URL (new tab)
Review: ReviewPage auto-loads GET /api/documents/:id/raw into the PDF viewer (same-origin stream)
```

### State management

Three Zustand stores: **`authStore`** (`currentUser`), **`reviewStore`** (active `Review` + stage mutations), **`evaluationStore`** (legacy). Feature hooks are the only consumers of store + service layers; components get props.

### Data flow — review module

`useReview` bridges `reviewStore` + `platformService`. `ReviewPage` builds a synthetic `EvaluationSession` from the current `ReviewStage` to reuse `CriteriaPanel` unchanged, and auto-loads the student's PDF (from MinIO) into the PDF viewer. `getOrCreateReview` runs inside a transaction with a `pg_advisory_xact_lock` keyed on the submission, so concurrent calls (React dev double-mount) don't violate the unique constraint.

### Styling

Plain global CSS with custom properties (no CSS modules, no Tailwind). Tokens in `src/index.css` (`--c-*`, `--r-*`, `--shadow-*`); shared styles in `src/shared/styles/platform.css`; per-feature `<feature>/feature.css` imported once by the page.

### PDF rendering

`react-pdf` (PDF.js). Worker configured via `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)` at module level in `PDFViewer.tsx` — keep it there. `<Document file=...>` accepts a `File` or a URL string; the review passes the same-origin `/api/documents/:id/raw` URL.

### Environment (.env, see .env.example)

`DATABASE_*` (host `localhost`, port **5433** to avoid clashing with a local Postgres on 5432). `MINIO_*` (endpoint `localhost`, API **9000**, console **9001**, bucket `documents`), `UPLOAD_MAX_MB`. `.env` is git-ignored; the Vite config loads it into `process.env` for the middleware.

### Adding a new feature

1. Create `src/features/<name>/`, add the route in `src/app/router/index.tsx` (wrap in `<AppShell>` for sidebar).
2. For data: add SQL in `src/server/queries/`, a route in `src/server/apiPlugin.ts`, and a method in `platformService.ts` (with DB↔UI mapping). Browser-only helpers go in `src/services/`.
3. Server-only files belong under `src/lib` or `src/server` (compiled by `tsconfig.node.json`); never import them from browser code.

### Prepared extension points

- `annotations` table + `PDFAnnotation` type are ready for coordinate-based PDF annotations.
- `authStore` is the integration point for real auth (JWT); `users.password` exists for it.
- `submissions.document_path` + `storage_provider`-style indirection allow swapping MinIO for S3.
