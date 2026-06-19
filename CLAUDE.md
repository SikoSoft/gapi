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

**Deployment issues:** See [`failed-deployment-issues.md`](./failed-deployment-issues.md) for a detailed record of recurring Azure deployment failures, tsup bundling rules, and how to diagnose problems. Read it before touching `tsup.config.ts` or adding new npm packages that use native binaries or Azure SDK packages.

**Critical two-file rule:** Adding a package to `externals` in `tsup.config.ts` requires a matching addition to the package list in `.github/workflows/deploy.yml` (lines ~62–65). The deploy workflow prunes `node_modules` to only what's listed there — if a package is external in tsup but missing from the deploy list, it gets deleted before the zip is built and Azure cannot find it at runtime. This is the most common cause of "Cannot find package X" errors after deployment.

**Critical module-level rule:** Never call code that can throw at the top level of any `src/lib/` or `src/functions/` file. Azure Functions ESM loads all function files at worker startup — a single module-level exception kills all functions. Use lazy initialization patterns instead.

### Documentation

The `docs/` folder contains system-level documentation. When changing code that is covered by a doc file, update the relevant doc to reflect the change:

- [`docs/fact-system.md`](./docs/fact-system.md) — Fact computation, caching, operations, and TTLs
- [`docs/medal-system.md`](./docs/medal-system.md) — MedalConfig fields, FactRequests, StreakRequests, criteria trees, disbursement flow, and worked examples

Doc blocks above public and private method definitions in `src/lib/Fact.ts`, `src/lib/Medal.ts`, and `src/lib/Streak.ts` explain non-obvious contracts and invariants. Keep them current when modifying those methods — stale doc blocks are worse than none.

### OpenAPI Spec

The OpenAPI spec is generated from `src/openapi/registry.ts` via `npm run spec` (output: `openapi.json`). The registry must always be kept in sync with the actual endpoint behavior. Whenever you:

- Add a new endpoint (`src/functions/`) → add a matching `registry.registerPath(...)` block
- Change a response shape (e.g. add fields to a `mapDataToSpec` return, or extend an interface) → update the matching response schema in the registry
- Add fields to a request body schema (`src/models/`) → verify the corresponding `registry.register(...)` schema reflects those fields
- Remove or rename a field from any lib return type or model → update the registry schema

After making any changes to endpoint logic or models, always run `npm run spec` to regenerate `openapi.json` and commit both together. The frontend (`orbit`) and any other consumers depend on this spec — a stale spec causes contract drift that is difficult to debug later.

### Guidelines

- mapDataToSpec functions should never be async
- Never make changes if a Prisma schema change is required, without asking for verification first
- Always use the one-true-brace style of indentation; meaning that braces should always be used when possible
- Keep all edits, reads and and shell commands confined to this projects root directory or its subdirectories. Do not traverse into directories outside of this projects root
- Do not place interfaces, types or enum definitions within library files, but store them separately in models files
- Endpoint route names should always be camelCase
- Do not add envs to local.settings.json; always keep them in .env
