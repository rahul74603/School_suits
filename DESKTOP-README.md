# School Guardian Suite — Desktop App (Windows)

A school management application for Windows PCs. This is the desktop
(Electron) edition; the same React UI also ships as the Android app, and
both sync through the central server (see the master plan).

## Features
- Student management — add, edit, promote
- Fees — structure, collection, receipts, defaulter reports
- Staff management and salary records
- Exams and results
- Printable student ID cards and fee receipts
- Multi-school support with per-school branding (name, logo, colours)

## Build from source
```bash
npm install
npm run build:desktop   # Windows installer (NSIS) is written to dist/
```

## Default login (first run only)
- Username: `admin`
- Password: `admin123`

Change this password immediately after first login. Per-school first
logins replace this shared default in the sellable release.

## Local database (desktop offline cache)
- Engine: SQLite via sql.js
- File: `school_final_v54.db` in the app's user-data folder
  (Windows: `%APPDATA%\School Guardian Suite\`)

## Tech stack
- Frontend: React + TypeScript + Tailwind CSS (shared with Android)
- Desktop shell: Electron + electron-builder
- Server/sync: Express + Postgres (DATABASE_URL via environment)

## Known pending items
- Branded app icon: the build currently uses the default Electron icon.
  A proper `assets/icon.ico` must be added before public release.
