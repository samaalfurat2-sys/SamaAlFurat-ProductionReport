# Daily Production Report System

## Overview

This is an industrial daily production reporting system for **Sama Alfurat Industries And Trade Co Ltd**. It is a mobile-first web application designed to manage and track production data across multiple warehouse sections (WH1, WH2, WH3, WH4), including raw material intake, production shifts, finished goods transfers, quality metrics, and diesel fuel tracking.

The app supports multiple user roles (operator, supervisor, accountant, auditor, manager, keeper) with a multi-step approval workflow for production records. It generates PDF and CSV reports and supports both English and Arabic (RTL) languages.

**Core features:**
- Production shift entry forms per section/station
- Multi-step approval workflow (Operator → Supervisor/WH2 → WH3 Keeper → Accountant → Auditor)
- Inventory tracking with BOM (Bill of Materials) auto-deduction
- Diesel fuel tracking for Warehouse 4
- PDF and CSV report generation per warehouse
- Analytics dashboard with charts
- Offline-first local database via Dexie (IndexedDB)
- Role-based navigation and access control

---

## User Preferences

Preferred communication style: Simple, everyday language.

---

## System Architecture

### Frontend Architecture

- **Framework:** React 18 with TypeScript, using Vite as the build tool
- **Routing:** `wouter` (lightweight client-side routing)
- **UI Components:** shadcn/ui built on Radix UI primitives with Tailwind CSS v4
- **State Management:** React local state (`useState`, `useEffect`) + TanStack Query (for server-side data if needed)
- **Forms:** React Hook Form with `@hookform/resolvers`
- **Data fetching (local):** `dexie-react-hooks` (`useLiveQuery`) for reactive reads from IndexedDB
- **Internationalization:** `react-i18next` with English and Arabic translations; RTL support toggled via `document.dir`
- **Charts:** Recharts (BarChart, AreaChart, PieChart, LineChart)
- **PDF Export:** `html2pdf.js` + `jsPDF` + `jspdf-autotable`
- **Font:** Cairo (Arabic/RTL) + Inter (LTR) loaded from Google Fonts

#### Page Structure
| Page | Purpose |
|------|---------|
| `Home` | Role-based dashboard with inbox/task queue |
| `Entry` | Multi-section production data entry form |
| `CloseProduction` | Supervisor closes a shift with BOM-based deduction |
| `Records` | Browse all records with search |
| `WH2Approvals` | WH2 supervisor approves/amends WH1 transfers |
| `WH3Approvals` | WH3 keeper approves/amends WH2 transfers |
| `Accounting` | Accountant reviews pending records |
| `Auditor` | Auditor reviews accepted records |
| `Orders` | Manage active production orders |
| `InventorySetup` | Set opening stock balances per warehouse |
| `Warehouse4Diesel` | Track diesel fuel receipts and consumption |
| `Warehouse[1-4]Report` | Per-warehouse PDF/CSV reports |
| `AccountingReport` / `AuditorReport` | Role-specific audit reports |
| `AnalyticsDashboard` | Production analytics with charts |
| `Analytics` | Consumption trend analytics with forecasting |
| `Settings` | Language toggle, data export/import/clear |
| `Auth` | Role selection login screen (prototype-level, no real auth) |

### Backend Architecture

- **Server:** Express.js with TypeScript (`server/index.ts`)
- **Storage layer:** `server/storage.ts` has a `DatabaseStorage` class with full CRUD for records, orders, and inventory using Drizzle ORM against PostgreSQL.
- **API Routes:** `server/routes.ts` provides REST endpoints:
  - `GET/POST /api/records`, `GET/PUT/DELETE /api/records/:id`
  - `GET/POST /api/orders`, `PUT /api/orders/:id`
  - `GET/POST/PUT /api/inventory`, `GET /api/inventory/:location`
  - `POST /api/sync` — bulk sync endpoint (accepts `{records, orders, inventory}` and merges by `clientId`)
- **Static serving:** In production, Express serves the Vite build output from `dist/public`.
- **Dev mode:** Vite dev server is embedded in the Express process via `server/vite.ts`.

### Data Storage

#### Primary (Client-Side): Dexie / IndexedDB
All production data is stored **locally in the browser** via Dexie (IndexedDB wrapper). This is the main data store.

Database: `ProductionReportDB` (version 5)

| Table | Key Fields | Purpose |
|-------|-----------|---------|
| `records` | `id`, `date`, `shift`, `section`, `orderId`, `status`, `createdAt` | All production shift entries, transfers, WH4 diesel logs |
| `orders` | `id`, `status`, `createdAt` | Active production orders (BOM size: 330ml, 750ml, 1500ml) |
| `inventory` | `id`, `location`, `material`, `updatedAt` | Opening stock balances per warehouse/material |

Record `status` workflow:
`pending_supervisor` → `pending_wh2` → `pending_wh3` → `pending` → `accepted` → `audited`
(with rejection variants at each step: `wh2_rejected`, `wh3_rejected`, `rejected`, `audit_rejected`)

#### Secondary (Server-Side): PostgreSQL via Drizzle ORM
- Schema in `shared/schema.ts` defines `production_records`, `production_orders`, `inventory` tables (+ legacy `users` table).
- `server/db.ts` creates the Drizzle connection using `DATABASE_URL`.
- Each record has a `clientId` field linking it to its Dexie local ID for sync deduplication.
- Drizzle configured for PostgreSQL (`drizzle.config.ts`) using `DATABASE_URL`.

#### Sync Layer (`client/src/lib/sync.ts`)
- On app load: pulls all data from server API and merges into Dexie (server wins for conflicts by `updatedAt`).
- Sync-aware wrappers in `client/src/lib/db.ts`: `addRecordWithSync`, `updateRecordWithSync`, `addOrderWithSync`, `updateOrderWithSync`, `updateInventoryWithSync(id, changes)`.
- All pages use these wrappers so every local write is also sent to the server.
- Manual "Sync Now" button in Settings page.
- **Offline-first architecture:** When offline, changes are queued in `localStorage` (`pendingSyncItems`) and auto-synced on reconnect.
- **Auto-sync:** `startAutoSync()` listens for online/offline events and retries every 60s when pending items exist.
- **Status indicators:** App.tsx shows offline banner, syncing banner, and pending count. Settings page shows offline warning, pending count, last sync time.
- **Offline login:** Credentials cached locally using SHA-256 hashed passwords (Web Crypto API). Users who logged in online can authenticate offline.

#### Edit/Correction Flow
- Records with status `pending_supervisor`, `pending_wh2`, or `returned_to_operator` show an Edit button in Records.tsx.
- Operators can edit their production section reports; supervisors can edit their close/transfer records.
- Edit navigates to Entry.tsx or CloseProduction.tsx pre-populated with existing data via `sessionStorage`.
- On save in edit mode, the existing record is updated (not duplicated).

### Authentication & Authorization

- **Login:** Username/password authentication via `POST /api/auth/login`. Passwords are hashed with scrypt (Node.js crypto). On success, server-side session is created (express-session + connect-pg-simple) and user data is stored in `localStorage`.
- **Session Auth:** Server-side sessions stored in PostgreSQL via `connect-pg-simple`. All API routes protected with `requireAuth` middleware (returns 401). Admin routes use `requireManager` middleware (returns 403). Client sends `credentials: 'include'` with all fetch requests.
- **Session endpoints:** `POST /api/auth/login` (creates session), `POST /api/auth/logout` (destroys session), `GET /api/auth/me` (check session status).
- **Default manager:** On server start, a default manager user is auto-created if none exists (username: `manager`, password: `admin123`).
- **Roles:** `operator`, `supervisor`, `accountant`, `auditor`, `manager`, `keeper1`, `keeper2`, `keeper3`
- **Admin Panel** (`/admin`): Manager-only page for user CRUD, password resets, role assignment, account enable/disable, and dashboard permission control.
- **Dashboard permissions:** Stored in `users.permissions` JSONB — controls which dashboard sections (warehouse_1-4, utilities, analytics, orders, inventory_setup) each user can see.
- Navigation items and page access are conditionally rendered based on `localStorage.getItem('userRole')`.
- **Inventory reversal:** When supervisor or accountant rejects a WH2 production record, consumed raw materials are credited back to WH2 inventory.
- **WH1 receiving:** Submitting a `wh1_receiving` record adds received quantity to WH1 inventory.
- **Supervisor approval flow:** WH2Approvals page now shows both WH1 transfer approvals AND WH2 production approvals (tabbed). Production records go `pending_supervisor` → `pending` on approval.

### User Management API (Manager Only)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | Authenticate with username/password |
| `/api/admin/users` | GET | List all users (passwords excluded) |
| `/api/admin/users` | POST | Create new user |
| `/api/admin/users/:id` | PUT | Update user (role, password, enabled, permissions) |
| `/api/admin/users/:id` | DELETE | Delete user (cannot delete last manager) |

### Progressive Web App (PWA)

The app is configured as an installable PWA via `vite-plugin-pwa`:
- **Manifest:** Auto-generated `manifest.webmanifest` with app name, icons, standalone display mode
- **Service Worker:** Workbox-powered with offline caching for static assets, Google Fonts, and API responses (NetworkFirst)
- **Icons:** 10 icon sizes generated from `client/public/logo.png` in `client/public/icons/` (72-512px + maskable + apple-touch)
- **Install prompt:** Users can install the app from Chrome/Edge/Safari — it appears as a standalone app with its own icon on home screen/desktop
- **Offline support:** Static assets cached, API calls use NetworkFirst strategy with 10s timeout fallback to cache
- **Apple support:** apple-touch-icon, apple-mobile-web-app-capable meta tags configured

### Build System

- **Client:** Vite builds to `dist/public`
- **Server:** esbuild bundles `server/index.ts` to `dist/index.cjs`
- **Build script:** `script/build.ts` orchestrates both builds
- **Key aliases:** `@/` → `client/src/`, `@shared/` → `shared/`

---

## External Dependencies

### UI & Styling
- **shadcn/ui** — Component system (style: `new-york`, base color: `neutral`)
- **Radix UI** — Headless accessible primitives (accordion, dialog, select, tabs, etc.)
- **Tailwind CSS v4** — Utility-first CSS with `@tailwindcss/vite` plugin
- **tw-animate-css** — Animation utilities
- **lucide-react** — Icon library
- **class-variance-authority + clsx + tailwind-merge** — Component variant utilities

### Data & State
- **Dexie v4 + dexie-react-hooks** — IndexedDB ORM for client-side offline storage
- **TanStack React Query v5** — Server-state management (configured but minimally used)
- **React Hook Form + @hookform/resolvers** — Form state and validation
- **Zod + drizzle-zod** — Schema validation

### Database (Server)
- **Drizzle ORM** — PostgreSQL ORM
- **`pg`** — PostgreSQL Node.js client
- **`connect-pg-simple`** — PostgreSQL session store for Express (wired up, sessions in `session` table)

### Reporting & Export
- **jsPDF + jspdf-autotable** — Programmatic PDF generation
- **html2pdf.js** — HTML-to-PDF conversion
- **Recharts** — Chart library for analytics dashboard
- **date-fns** — Date formatting and manipulation (with `ar` and `enUS` locales)

### Internationalization
- **react-i18next + i18next** — Translation framework
- Translations are hardcoded inline in `client/src/lib/i18n.ts` (English and Arabic)

### Replit-Specific Plugins (dev only)
- `@replit/vite-plugin-runtime-error-modal`
- `@replit/vite-plugin-cartographer`
- `@replit/vite-plugin-dev-banner`

### Server Utilities
- **Express** — HTTP server
- **nanoid** — Unique ID generation
- **express-session + connect-pg-simple** — Server-side session handling with PostgreSQL store
- **passport + passport-local** — Auth framework (installed, not implemented)
- **multer** — File upload (installed, not implemented)
- **xlsx** — Spreadsheet generation (installed)
- **nodemailer** — Email (installed, not implemented)

### Native App Packages

#### Windows Desktop (Electron)
- **Location:** `electron-app/` directory
- **Architecture:** Electron wrapper that loads the deployed web URL in a desktop window
- **Build output:** `electron-app/output/win-unpacked/` contains the unpacked Windows app with `Sama AlFurat Production Report.exe`
- **Distribution:** `SamaAlFurat-ProductionReport-Windows.zip` (133 MB) — users extract and run the EXE
- **Electron version:** 40.8.0

#### Android APK (WebView)
- **Location:** `android-apk/` directory
- **Architecture:** Native Android Activity with WebView that loads the deployed web URL
- **Build tools:** Android SDK 34, build-tools 34.0.0, compiled with `aapt2`, `javac`, `d8`, `apksigner`
- **Build output:** `SamaAlFurat-ProductionReport.apk` (33 KB) — debug-signed, installable on Android 5.0+
- **Package name:** `com.samaalfurat.production`
- **Features:** Full-screen WebView, JavaScript enabled, DOM storage, back button navigation, portrait orientation