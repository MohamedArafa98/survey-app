# Survey App

A local desktop survey application. Python (FastAPI + SQLite) backend runs inside a native PyWebView window together with a React frontend. Ships as a single MSI.

## Features

- Two pages: **Admin** (password-protected) and **Guest** (no login).
- Admin: create/edit/clone surveys, group by free-form period label, open/close/archive lifecycle.
- Admin users: first account = `owner` (set on first run), can create additional `admin` accounts and other owners. Role-gated in the API.
- Questions: 1–5 Likert scale with optional comment field. Drag-to-reorder.
- Guest flow: pick an open survey → enter occupation / gender / age / optional name → answer → submit.
  Occupation list is admin-managed (plus an "Other…" free-text fallback).
- Analytics: per-question averages, distribution %, demographic breakdowns, and a **power-user chart builder** (chart type · metric · X axis · group-by) using ECharts. Saved charts persist.
- Excel export: aggregates, raw rows, multi-survey comparison across periods, and saved charts embedded as PNG images.
- Data: SQLite file stored under `%APPDATA%\SurveyApp\data.db`. Alembic-ready schema.
- Future-proof: raw responses are always retained; chart definitions are schema-free JSON.

## Stack

FastAPI · SQLAlchemy 2 · SQLite · pandas · openpyxl · passlib/bcrypt · itsdangerous · PyWebView · React 18 · Vite · TypeScript · Tailwind · TanStack Query · ECharts · `@dnd-kit`.

## Project layout

```
backend/     FastAPI app, SQLAlchemy models, routers, services
frontend/    React + Vite + Tailwind app
desktop/     PyWebView launcher (spawns FastAPI in a thread)
installer/   PyInstaller + WiX MSI build pipeline
```

---

## Prerequisites

Install these on the development machine **before anything else**:

| Tool | Minimum version | Why |
|---|---|---|
| **Python 3.13.x** | 3.13.0 | Python 3.14 is **not supported** yet (pywebview's `pythonnet` dependency has no 3.14 wheel). |
| **Node.js** | 20 LTS | Frontend build (Vite + TypeScript). |
| **npm** | 10.x | Comes with Node. |
| **WebView2 Runtime** | Evergreen | Shipped with Windows 11 by default; needed for PyWebView. |
| **WiX Toolset v3** *(only for MSI build)* | 3.14 | Produces the installer. |

### Install Python 3.13 on Windows

```powershell
winget install Python.Python.3.13 -e --accept-source-agreements --accept-package-agreements
```

Close and reopen PowerShell, then verify:

```powershell
py -3.13 --version
# Python 3.13.x
```

### Install Node.js

```powershell
winget install OpenJS.NodeJS.LTS -e
node --version
npm --version
```

### Install WiX Toolset (MSI builds only)

```powershell
winget install WiXToolset.WiXToolset -e
```

---

## Development setup (first-time only)

All commands below are **PowerShell** and assume the repo root is the current directory.

### 1. Backend — create the virtualenv and install deps

```powershell
cd backend
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

> **Important:** always invoke the venv's Python explicitly with `.\.venv\Scripts\python.exe -m <cmd>`. Don't call bare `pip` or `python` — those may point at a different Python version on your PATH.

Verify:

```powershell
.\.venv\Scripts\python.exe --version
# Python 3.13.x
.\.venv\Scripts\python.exe -c "import fastapi, pandas, webview, openpyxl; print('OK')"
```

### 2. Frontend — install npm dependencies

```powershell
cd ..\frontend
npm install
```

---

## Running in development

One command starts uvicorn (backend, port 8765, `--reload`), Vite (frontend, port 5173, HMR), and Electron (pointed at the Vite URL):

```powershell
cd desktop
npm install              # one-time, if not done yet
npm run dev
```

Prerequisites:

- `backend\.venv` exists and has the requirements installed (see "Development setup" above).
- `frontend\node_modules` exists (`cd frontend && npm install`).

What happens:

1. `concurrently` fans out three processes with prefixed logs (`be`, `fe`, `el`).
2. `wait-on` gates Electron until both `http://localhost:5173` and `http://127.0.0.1:8765/docs` respond.
3. The Electron window opens on the Vite URL with DevTools detached, so React HMR works on frontend edits and uvicorn `--reload` picks up backend edits.
4. Ctrl+C in the `desktop` terminal tears all three down.

Vite proxies `/api/*` → `http://127.0.0.1:8765` (see `vite.config.ts`). If you prefer the browser over Electron during a session, open http://localhost:5173 directly — the backend and frontend processes keep running.

### First-run flow

- **Admin:** click **Admin** → setup screen → create the first `owner` account (username + password) → admin dashboard.
- **Guest:** click **Guest** → pick an open survey → fill demographics → answer questions → submit.

### Troubleshooting dev startup

| Problem | Fix |
|---|---|
| `python.exe` not found | `backend\.venv` is missing. Create it per §"Development setup" step 1. |
| `wait-on` times out after 60s | Port 8765 or 5173 already in use. Close whatever owns it (Task Manager → `python.exe` / `node.exe`) and retry. |
| Electron window opens blank | Vite hasn't compiled yet — check the `fe` prefix in the terminal for errors. |

### Where the data lives

The SQLite database and signing secret are created on first launch under:

```
%APPDATA%\SurveyApp\data.db
%APPDATA%\SurveyApp\.secret
%APPDATA%\SurveyApp\backups\
```

You can override the location during development by setting `SURVEYAPP_DATA_DIR`:

```powershell
$env:SURVEYAPP_DATA_DIR = "C:\temp\surveyapp-dev"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8765 --reload
```

To reset the app to a blank first-run state, just delete `data.db`.

---

## Building the release MSI

Produces a single `SurveyApp.msi` installer that can be distributed and installed on any Windows PC (no Python or Node needed on the target machine).

### One-time prerequisites for builds

```powershell
# Ensure PyInstaller is in the backend venv
cd backend
.\.venv\Scripts\python.exe -m pip install pyinstaller

# Verify WiX is on PATH
candle.exe -? | Select-Object -First 3
light.exe -? | Select-Object -First 3
```

### Build

From the repo root:

```powershell
pwsh .\installer\build.ps1
```

What the script does:

1. **Frontend build** → `cd frontend && npm install && npm run build` → static assets in `frontend/dist/`.
2. **Copy static** → copies `frontend/dist/*` into `backend/app/static/` (served by FastAPI).
3. **PyInstaller** → packages the backend + desktop launcher + React assets into a single-folder dist at `dist/SurveyApp/SurveyApp.exe`.
4. **WiX MSI** → harvests that folder, compiles `product.wxs`, and links → `installer/SurveyApp.msi`.

Output:

```
installer/SurveyApp.msi
```

### Installing the MSI

Double-click `SurveyApp.msi` (or `msiexec /i installer\SurveyApp.msi`). This installs:

- **`%ProgramFiles%\Survey App\`** — application files (`SurveyApp.exe` + bundled Python runtime + React assets).
- **Start Menu → Survey App** — launcher shortcut.
- **Desktop shortcut** (optional).

On first launch the installed app creates `%APPDATA%\SurveyApp\` for its SQLite database and secret. To uninstall: **Settings → Apps → Survey App → Uninstall**.

### Troubleshooting the build

| Problem | Fix |
|---|---|
| `py : not recognized` | Python launcher isn't on PATH — reinstall Python 3.13 from the official installer with "Add python.exe to PATH" checked, or use the full path to `python.exe`. |
| `candle.exe : not recognized` | WiX isn't on PATH. After `winget install WiXToolset.WiXToolset`, open a **new** PowerShell so it picks up the updated PATH. |
| `ModuleNotFoundError: pydantic_core._pydantic_core` when running uvicorn | Your venv is on the wrong Python version. Delete `backend\.venv` and recreate with `py -3.13 -m venv .venv`. |
| `Failed building wheel for pythonnet` | You're on Python 3.14 — downgrade the venv to 3.13 (see above). |
| Frontend types fail in CI | Run `npx tsc --noEmit` locally; make sure `@types/node` and `@types/react` are installed (they are in `package.json`). |

---

## Common development tasks

### Reset first-run state

```powershell
Remove-Item "$env:APPDATA\SurveyApp\data.db"
```

### Run the E2E smoke test *(optional, for contributors)*

Create `backend/smoke_test.py` with TestClient-driven steps (bootstrap → setup → survey → answer → export), then:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pip install httpx
.\.venv\Scripts\python.exe smoke_test.py
```

### Frontend type-check only

```powershell
cd frontend
npx tsc --noEmit
```

### Frontend production build (without packaging)

```powershell
cd frontend
npm run build         # outputs to frontend/dist/
```

---

## Data & analytics notes

- All raw answers stay in SQLite forever. Analytics/aggregations are computed on demand by pandas — nothing is denormalized.
- Chart definitions are arbitrary JSON (`chart_def.config_json`), so adding new chart types is a frontend-only change.
- Age is stored as an integer per response; the admin-configurable buckets are applied at query time, so changing bucket ranges re-segments all historical data instantly.
