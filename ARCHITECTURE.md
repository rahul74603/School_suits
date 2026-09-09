# School Suite Architecture Decision

## Decision

The active production direction is the existing React + Vite + Express + PostgreSQL application. Phase 1 stabilizes this implementation without replacing its architecture.

## Request flow

```text
React/Vite client
       ↓ fetch()
Express API routes
       ↓
Storage layer
       ↓ Drizzle ORM
PostgreSQL
```

### Frontend

The React application is under `client/`. `client/src/App.tsx` defines the current routes. TanStack Query hooks call the shared API paths and validate responses with the shared Zod contracts.

### Backend

The Express application starts from `server/index.ts`. API handlers are registered in `server/routes.ts`. Database operations are kept in `server/storage.ts`, while `server/db.ts` owns the PostgreSQL pool and Drizzle instance.

### Shared contracts

`shared/schema.ts` defines PostgreSQL tables, Drizzle types, insert schemas, and inferred TypeScript types. `shared/routes.ts` defines API paths, input schemas, and response contracts.

### Build and runtime

- Development uses `tsx server/index.ts`, Express, and Vite middleware.
- Production uses the Vite-built client and the esbuild bundle at `dist/index.cjs`.
- PostgreSQL is selected through `DATABASE_URL`.

## Security foundation

The web API uses an HTTP-only, same-site session cookie backed by the PostgreSQL `user_sessions` table. Login verifies bcrypt password hashes, and the server stores only a minimal authenticated identity in the session. Protected routes use server-side role checks and derive the school scope from that session identity; client-supplied `schoolId` values are ignored for ownership decisions. Student responses omit Aadhaar, and authentication failures use generic messages.

## Seed policy

Normal server startup does not seed data. Development sample data is provided only by the explicit `npm run db:seed` command, which requires `NODE_ENV=development`. A development admin password must be supplied through `SEED_ADMIN_PASSWORD`; no hard-coded credential is created by the repository.

## Flutter status

`flutter_guide/` is a separate SQLite/Flutter prototype/reference implementation. It is not imported by the web application, is not started by the Node scripts, and is not the active production runtime. It will not be converted or used as the active architecture during this phase.

## Electron status

Electron is not part of the current architecture and is not introduced by Phase 1.
