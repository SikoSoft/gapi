# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

**gapi** is a TypeScript REST API running as an Azure Function App, serving as the backend for the Orbit frontend. It uses PostgreSQL via Prisma, with all endpoints as HTTP triggers.

- Local port: **9999**
- Runtime: Azure Functions v4 (ESM, Node.js)
- Auth: custom session tokens (argon2 passwords, UUID sessions)

## Commands

```bash
npm start          # Build, install extensions, then run func host + file watcher in parallel
npm run build      # tsup compilation (ESM .mjs output to dist/)
npm run watch      # tsup in watch mode
```

**Prisma migrations:**

```bash
npx prisma migrate dev --name "migration-name"
npx prisma generate        # Regenerate client after schema changes
```

No test suite exists in this project.

## Architecture

### Request Flow

Every endpoint follows the same pattern:

```typescript
// 1. Introspect auth from Authorization header
const introspection = await introspect(request);
if (!introspection.isLoggedIn) return forbiddenReply();
const userId = introspection.user.id;

// 2. Dispatch on HTTP method
switch (request.method) { ... }

// 3. Business logic returns Result<T, Error>
const result = await SomeLib.doThing(userId, body);
if (result.isErr()) { context.error(result.error); return { status: 500 }; }

// 4. Respond
return jsonReply({ ...result.value });
```

### Key Directories

- **`src/functions/`** — 29 Azure HTTP trigger handlers; thin layer: auth check → method dispatch → call lib → reply
- **`src/lib/`** — All business logic; every method returns `Result<T, Error>` (neverthrow); no thrown exceptions
- **`src/models/`** — TypeScript interfaces, Prisma type validators, and io-ts codecs for runtime validation
- **`src/index.ts`** — Exports the shared `prisma` client singleton, `introspect()`, `jsonReply()`, `forbiddenReply()`
- **`prisma/schema.prisma`** — PostgreSQL schema; property values use per-type tables (polymorphic storage)

### Error Handling

All `src/lib/` classes use **neverthrow** (`ok()` / `err()` / `Result<T, Error>`). Never throw from lib methods — wrap `try/catch` and return `err(new Error(..., { cause }))`. Functions check `isErr()` before using `.value`.

### Property Value Storage

Entity property values are stored in separate tables per data type: `EntityBooleanProperty`, `EntityDateProperty`, `EntityIntProperty`, `EntityImageProperty`, `EntityLongTextProperty`, `EntityShortTextProperty`. Relations cascade delete from `Entity`.

### Multi-tenancy

All queries are scoped by `userId`. No cross-user data access; `introspect()` provides the `userId` from the session.

### Runtime Type Validation

- **io-ts**: Used in model files for parsing request bodies and validating Prisma query payloads
- **zod**: Used selectively for newer validation needs
- Prisma validators (`satisfies Prisma.XxxDefaultArgs`) are used to extract exact query shapes for type inference

### External Integrations

- **Google OAuth**: `src/lib/Google.ts` + `src/functions/googleLink.ts` / `googleCallback.ts`
- **Azure Blob Storage**: `src/lib/FileStorage.ts` for image uploads
- **AI Assist proxy**: `src/functions/assistEntity.ts` proxies to `ASSIST_API_BASE_URL` env var
- **api-spec** (GitHub package `SikoSoft/api-spec`): Shared type contract with Orbit frontend; bundled into output via tsup `noExternal`

### Build

tsup compiles all `src/**/*.ts` to ESM `.mjs` files in `dist/`. `api-spec` is bundled (not left as external) because Azure Functions runtime cannot resolve GitHub package URLs at runtime.

### Guidelines

- mapDataToSpec functions should never be async
- Never make changes if a Prisma schema change is required, without asking for verification first
- Always use the one-true-brace style of indentation; meaning that braces should always be used when possible
- Keep all edits, reads and and shell commands confined to this projects root directory or its subdirectories. Do not traverse into directories outside of this projects root
