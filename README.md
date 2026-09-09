# School Suite

School Suite is a school-management application for maintaining school, student, fee, and staff records.

## Active architecture

The active product is the React/Express/PostgreSQL application in this repository:

```text
React + Vite
    ↓
Express API
    ↓
Drizzle ORM
    ↓
PostgreSQL
```

- **Frontend:** React, TypeScript, Vite, Wouter, TanStack Query, and the existing UI components in `client/src`.
- **Backend:** Express and TypeScript in `server/`.
- **Database access:** Drizzle ORM with `pg` in `server/db.ts` and `server/storage.ts`.
- **Shared contracts:** PostgreSQL schema, inferred types, and Zod route definitions in `shared/`.

`flutter_guide/` is currently a separate prototype/reference implementation. It is not the active production runtime, is not connected to the web application, and is not used by the Node/Vite scripts. Electron is not part of this project.

## Current capabilities

The current web application contains basic screens and APIs for:

- school profile data
- student admissions and listing
- fee structures and payment recording
- basic fee defaulter lookup
- staff listing and creation
- student ID-card printing

The web application now has session-based authentication, server-side role checks, school-scoped student/staff/fee access, and password hashing. Academic sessions, backups, restore, payroll, examinations, attendance, document management, and production financial reporting are not implemented yet.

## Prerequisites

- Node.js 20 or newer
- npm
- PostgreSQL 16 or a compatible PostgreSQL server

Install dependencies with:

```bash
npm install
```

## Environment variables

The backend requires:

```text
DATABASE_URL=postgresql://user:password@localhost:5432/school_suite
```

`PORT` is optional and defaults to `5000`.

`SESSION_SECRET` is required in production and must be a long, random secret. Development uses a local fallback only.

Do not commit `.env` files or real credentials. The repository currently does not load a dotenv file automatically, so provide variables through the shell, deployment environment, or your process manager.

## Database setup

The current schema is defined in `shared/schema.ts`.

For a new local database:

```bash
npm run db:push
npm run db:migrate
```

For an existing database from before Phase 2, back it up and run the security migration **before** running `db:push` so legacy plaintext passwords can be converted safely:

```bash
npm run db:migrate
npm run db:push
```

`npm run db:migrate` applies the committed SQL files in `migrations/` once each, in deterministic filename order. Each migration runs in a transaction and is recorded in `schema_migrations` only after success. A PostgreSQL advisory lock prevents concurrent migration runners. The security migration creates the PostgreSQL-backed session table and converts the legacy user password column to bcrypt-compatible password hashes before removing the plaintext column. The database-foundation migration adds school-owned academic sessions, backfills existing records into an initial session, and adds integrity constraints/indexes. Back up an existing database before applying migrations.

The active API requires a PostgreSQL session store. Do not start the production server until the migrations have been applied and `SESSION_SECRET` has been configured. Academic sessions are represented by `academic_sessions`; students, fee structures, and payments are associated with a school-owned session. Only one session can be active per school.

For development-only sample data, use the explicit seed command:

```bash
SEED_ADMIN_PASSWORD='choose-a-local-development-password' npm run db:seed
```

The seed command refuses to run unless `NODE_ENV=development` and is never called by normal server startup. If `SEED_ADMIN_PASSWORD` is not supplied, the sample school/student/payment records are created without a sample user.

## Development startup

After PostgreSQL is available and `DATABASE_URL` is set:

```bash
npm run db:push
npm run dev
```

The combined development server listens on port `5000` by default and serves both the API and Vite frontend.

## Production build and startup

```bash
npm run build
NODE_ENV=production DATABASE_URL='postgresql://user:password@host:5432/school_suite' npm start
```

The build creates the client output and bundles the server at `dist/index.cjs`.

Production startup does **not** seed demo users, students, fee structures, or payments.

## Validation commands

```bash
npm run check
npm run build
```

There is currently no test script or committed automated test suite. The Flutter guide has its own separate dependencies and is not included in these Node commands.

## Project layout

```text
client/             React/Vite frontend
server/             Express server, routes, database access, Vite integration
shared/             Drizzle schema and shared route contracts
script/             Build and explicit development seed scripts
flutter_guide/      Separate Flutter/SQLite prototype/reference code
```
