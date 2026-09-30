# SOP & Quality Management Showcase

The SOP & Quality Management Showcase is an enterprise-grade Syncfusion showcase application built with a stateless ASP.NET Core Document Editor service and a Syncfusion-powered React client.

The application demonstrates how a regulated organization can author, review, approve, sign, and audit Standard Operating Procedures (Healthcare SOP, Laboratory SOP, Manufacturing SOP) end to end against a five-step workflow — Upload, Editor, Review, Sign & Publish, Audit Timeline — backed by a real Syncfusion EJ2 Document Editor service. It showcases how Syncfusion UI components and Syncfusion Code Studio accelerate enterprise application development.

> This is a showcase application with deterministic sample data. It is not intended to be used as a production quality management system without adding production authentication, authorization, audit logging, electronic signature controls (21 CFR Part 11), secrets management, and operational controls.

## What the showcase includes

- SOP dashboard with KPI cards, status mix, in-review queue, and signature backlog
- Template gallery covering Healthcare, Laboratory, and Manufacturing SOPs
- Word-compatible document editor with merge fields, clause slots, section protection, reviewer comments, and side-by-side compare
- Multi-stage review routing with captured reviewer decisions and re-render on requested changes
- Electronic signature pad, clean PDF export (DocIO + DocIORenderer), and watermarked published output
- Per-document audit timeline of uploads, edits, reviews, approvals, signatures, and publishes
- Responsive layouts, dark mode, loading states (Skeleton), inline state messages, and accessible navigation

## Technology

| Layer | Technology |
| --- | --- |
| API | ASP.NET Core Web API on .NET 10 (stateless Document Editor service — no database, no EF Core) |
| React client | React 19, TypeScript, Vite, Syncfusion React UI 34.x |
| Data | Deterministic seed modules under `react/src/data/` served by the in-memory `contractService`; session-scoped audit / edit state via sessionStorage |

The UI implementation uses Syncfusion components specifically chosen for the SOP authoring workflow: Document Editor with Ribbon toolbar (authoring + compare), PDF Viewer (executed document preview), DataGrid (Dashboard documents grid), ComboBox + DropDownList (template / owner / reviewer selectors), ListView (template gallery picker), Dialog (reviewer decisions, signature capture, export), Toast / Skeleton / Message (Notifications), AppBar + Sidebar + Breadcrumb + Stepper + Tabs (Navigations — app shell, top bar, per-document stepper, Editor sub-tabs), DropDownButton (per-row action menu), Signature + TextBox (Inputs), and Tooltip, Buttons, Switch, Chip, and CheckBox (Buttons).

## Why Syncfusion Code Studio and UI components?

This repository is a practical proof of how [Syncfusion Code Studio](https://www.syncfusion.com/code-studio/) and the [Syncfusion component ecosystem](https://www.syncfusion.com/) can accelerate component-rich enterprise development.

- Code Studio can help teams plan features, generate and refine code, debug issues, and create tests with awareness of the existing codebase.
- Production-oriented UI components reduce the amount of custom code required for advanced grids, charts, workflows, dialogs, theming, and real-time data displays.
- Built-in capabilities such as filtering, grouping, paging, export, responsive rendering, accessibility, and theming help teams focus on quality workflows rather than foundational UI infrastructure.
- A single API surface serves multiple client types, making it easy to adapt the same backend experience across different frontend frameworks.

## Repository structure

```text
showcase-sop-quality-management-master/
├── react/                  # React 19 + Vite + TypeScript client (Syncfusion EJ2 34.x)
│   ├── src/                # App, pages, components, data, services, models, routes, hooks, styles, theme
│   │   └── pages/          # Dashboard, WorkflowLayout (Upload surface), EditorWorkspace, ReviewApproval,    SignPublish, AuditTimeline, AllDocuments, Workspace
│   ├── public/             # Static assets + docx templates + PDF viewer lib
│   ├── scripts/            # Build helpers (e.g. copy-pdfviewer-lib.mjs)
│   ├── server.cjs          # Node static server for the built client
│   ├── vite.config.ts      # Vite + manualChunks for Document Editor / PDF Viewer
│   └── package.json
├── server-side/            # ASP.NET Core Web API (.NET 10) — Document Editor service
│   └── src/ContractWorkspace.DocumentService/
│       ├── Controllers/    # DocumentEditorController, HealthController
│       ├── Models/         # Request/response DTOs for the editor service
│       ├── Helpers/        # Service-layer helpers
│       ├── Properties/     # launchSettings.json
│       ├── wwwroot/        # Templates/ (DOCX) + App_Data
│       └── Program.cs                
├── README.md
```

## Run locally

### Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download) (the service targets `net10.0`)
- A current Node.js LTS release and npm
- A valid Syncfusion license or trial where required

### 1. Start the Document Editor service

```bash
cd server-side/src/ContractWorkspace.DocumentService
dotnet restore
dotnet run
```

The service binds to `http://localhost:5212` by default (HTTPS `https://localhost:5001`) per [appsettings.Development.json](server-side/src/ContractWorkspace.DocumentService/appsettings.Development.json). CORS is open (`AllowedOrigins: *` in [appsettings.json](server-side/src/ContractWorkspace.DocumentService/appsettings.json)) so the React dev server can call it without further setup. A `GET /health` liveness probe is exposed.

Override the bind address via environment variable if you need a different port.

### 2. Start the React client

```bash
cd react
npm install
npm run dev
```

- Vite dev server runs at `http://localhost:5173` (or the next available port).
- The default Document Editor service URL is `https://localhost:5001`. Override with `VITE_DOCUMENT_EDITOR_SERVICE_URL` in `.env.local` (e.g. `http://localhost:5212`).
- The app is built to be served from the **`/sop-quality-management/react/`** base path (set in [vite.config.ts](react/vite.config.ts)).

### 3. (Optional) Serve the built React app from the Node static server

```bash
cd react
npm run build
npm start            # node server.cjs, listens on 0.0.0.0:8080
```

This is what production hosts use. The browser-side Syncfusion license can be injected either at build time via `VITE_SYNCFUSION_LICENSE` in `.env.local` or at runtime by editing `react/public/config.js`.

## Pages

The React app is a single-page workspace mounted at the `/sop-quality-management/react/` base path. Routes are defined in [react/src/App.tsx](react/src/App.tsx) and page files live in [react/src/pages](react/src/pages).

| Route | Page | Description |
| --- | --- | --- |
| `/` | **Dashboard** | KPI cards + documents grid + per-row action menu. Also serves as the inlined Upload surface when entering from `/new`. |
| `/new` | **Upload** (New SOP) | The Workflow Stepper's first step — pick a template from the gallery or upload a `.docx`. |
| `/workflow/:contractId/editor` | **Editor** | Syncfusion Document Editor with Ribbon toolbar and reviewer / protection assignments. |
| `/workflow/:contractId/review` | **Review** | Side-by-side review of the revised document against the original with reviewer decisions. |
| `/workflow/:contractId/sign` | **Sign & Publish** | Electronic signature pad + PDF Viewer for the executed document. |
| `/workflow/:contractId/audit` | **Audit Timeline** | Per-document timeline of uploads, edits, reviews, approvals, signatures, and publishes. |

## API surface

The .NET service in [server-side/src/ContractWorkspace.DocumentService](server-side/src/ContractWorkspace.DocumentService) is a stateless Document Editor service — it does not own SOP data. All data on the React side is mocked in [react/src/data](react/src/data) and accessed through the in-memory `contractService` in [react/src/services/contractService.ts](react/src/services/contractService.ts). Only the document-engine operations hit the real HTTP API.

### Document Editor service (real HTTP)

Base URL: `https://localhost:5001` (override with `VITE_DOCUMENT_EDITOR_SERVICE_URL`).

All endpoints are `POST` unless noted, served under the `/api/documenteditor` prefix, and are stateless — every request carries its own document bytes or SFDT payload.

| Endpoint | Purpose |
| --- | --- |
| `POST /api/documenteditor/Import` | Import a DOCX/RTF/TXT/XML/HTML file (or raw SFDT JSON) into the editor's in-memory SFDT model. |
| `POST /api/documenteditor/SystemClipboard` | Cut / copy / paste system clipboard operations (text + formatting). |
| `POST /api/documenteditor/RestrictEditing` | Apply or lift section-level editing restrictions (Editable / CommentsOnly / ReadOnly). |
| `POST /api/documenteditor/ExportSFDT` | Export the current SFDT model back to JSON, base64 DOCX, or DOCX Blob. |
| `POST /api/documenteditor/ExportCleanDocx` | Export the working DOCX with comments and tracked changes stripped. |
| `POST /api/documenteditor/ExportPdf` | Convert the working DOCX to a clean PDF (DocIO + DocIORenderer) with watermark applied. |
| `POST /api/documenteditor/Save` | Persist the current document bytes (showcase endpoint — the service does not store anything between calls). |
| `POST /api/documenteditor/CompareDocuments` | Compare two DOCX payloads (original vs revised) using DocIO `WordDocument.Compare`. |
| `GET /health` | Liveness probe — returns `{ status, timestamp, environment, version }`. |

### Static template assets

The service also serves the SOP DOCX template catalog and per-template files from `wwwroot/Templates/` directly (no controller routing):

- `GET /Templates/templates.json` — the catalog (`tpl-healthcare-sop`, `tpl-laboratory-sop`, `tpl-manufacturing-sop`).
- `GET /Templates/<TemplateName>.docx` — the raw DOCX for each catalog entry.

CORS is preconfigured open (`AllowedOrigins: *` in [appsettings.json](server-side/src/ContractWorkspace.DocumentService/appsettings.json)) so the React dev server can call these endpoints without extra setup.

### Mocked data (no HTTP)

The SOP rows, versions, assignments, reviewers, clauses, accounts, and per-document audit events all live in [react/src/data](react/src/data) and are served by the in-memory `contractService`. The `auditStore` and `editedDocStore` modules ([react/src/services](react/src/services)) back these flows with session-scoped state so a hard reload survives uploads-in-progress but does not write to any database. There is no `/api/sops`, `/api/dashboard`, `/api/training`, `/api/audits`, or `/api/capa` surface in this codebase.

## Build

```bash
# .NET service
cd server-side/src/ContractWorkspace.DocumentService
dotnet build

# React client
cd ../../../react
npm run build
```

## Resetting demo data

There is no persisted data to reset. The Document Editor service is stateless — every request carries its own document bytes or SFDT payload. The SOP rows, reviewers, clauses, accounts, and audit events are all seeded in [react/src/data](react/src/data) and read through the in-memory `contractService` ([react/src/services/contractService.ts](react/src/services/contractService.ts)). A hard reload of the React app re-reads the seed catalogue; session-scoped uploads / audit events survive only the current browser session via sessionStorage.

## Licensing

Syncfusion packages are governed by Syncfusion's licensing terms. Review the [Syncfusion licensing documentation](https://www.syncfusion.com/sales/licensing) before redistributing or deploying the applications. Publishing this source repository does not grant a license to Syncfusion products.

## Intended audience

This showcase is useful for engineering leaders, architects, quality / regulatory teams, and developers evaluating how a modern SOP and quality management workspace can be implemented with a stateless Document Editor service and enterprise web frameworks like React, with Syncfusion components delivering production-ready UI and data-binding capabilities.