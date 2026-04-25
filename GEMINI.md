# Project Overview: Survey App

A comprehensive local desktop application for managing and conducting surveys, featuring an admin dashboard for survey creation and advanced analytics.

## Key Technologies
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, TanStack Query, ECharts.
- **Backend**: Python (FastAPI), SQLAlchemy 2, SQLite, pandas, openpyxl.
- **Desktop Wrapper**: PyWebView (hosts the FastAPI backend and React frontend).
- **Packaging**: PyInstaller and WiX Toolset (for MSI installer).

## Project Structure
- `backend/`: FastAPI application, SQLAlchemy models, and data processing logic.
- `frontend/`: React single-page application (SPA).
- `desktop/`: PyWebView launcher that integrates the frontend and backend.
- `installer/`: Configuration for building the Windows MSI installer.
- `data.db`: SQLite database stored in `%APPDATA%\SurveyApp\` (created on first run).

## Key Workflows

### Development Setup
1. **Backend**:
   - Create a virtual environment: `py -3.13 -m venv .venv`
   - Install dependencies: `.\.venv\Scripts\python.exe -m pip install -r requirements.txt`
2. **Frontend**:
   - Install dependencies: `npm install`
3. **Running in Dev**:
   - Start the integrated dev environment from the `desktop/` directory: `npm run dev` (starts backend, frontend, and Electron).

### Authentication
- **Admin**: Password-protected. The first account created becomes the `owner`.
- **Guest**: Open access for survey respondents.

### Analytics & Export
- **Analytics**: Computed on demand using pandas; visualized with ECharts.
- **Export**: Generates Excel files with raw data, aggregates, and embedded charts.

## Usage with Gemini CLI
- **Codebase Analysis**: Inspect React components or FastAPI routers to understand logic.
- **Database Operations**: Query the SQLite `data.db` using the `sqlite` MCP.
- **Testing**: Add or modify smoke tests in `backend/smoke_test.py`.
- **Deployment**: Help troubleshoot or run the build pipeline in `installer/`.

## Deployment Branches
- `prod`: Main production-ready branch.
- `preprod`: Staging branch for testing and integration.
