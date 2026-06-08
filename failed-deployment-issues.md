# Failed Deployment Issues

This file tracks recurring Azure Functions deployment failures, the root causes, and the nuances of how this project is packaged and deployed. It exists because these issues repeat and the causes are non-obvious.

---

## Deployment Architecture

**Platform:** Azure Functions v4, Linux consumption plan, Node.js ESM.

**Build tool:** `tsup` (wraps esbuild). Compiles all `src/**/*.ts` → ESM `.mjs` files in `dist/`. The output is NOT minified.

**Deploy method:** The full project directory (source, `dist/`, `node_modules/`) is zipped and deployed. Azure then runs `npm install` (Oryx remote build) on the server at `/home/site/wwwroot/`.

**Key constraints on Linux consumption plan:**
- No SSH / Kudu console access.
- No `func azure functionapp publish --no-build` workaround (remote build runs anyway).
- Log stream in Azure portal shows `console.log` / `console.error` output from the Node.js worker but does NOT show module-load errors at startup.
- Module-load errors appear only in **Diagnose and solve problems → Application Event Logs** (with a multi-minute lag).

---

## How tsup Bundling Works Here

The `tsup.config.ts` uses `noExternal` with a negative-lookahead regex to bundle everything EXCEPT the packages in the `externals` array:

```ts
const externals = [ "argon2", "@prisma/client", ... ];
noExternal: [new RegExp(`^(?!(${externals.join("|")}))`)]
```

**Packages in `externals`** → NOT bundled → must be present in `node_modules` at runtime on Azure.  
**Everything else** → bundled inline into `dist/` chunks → no runtime dependency on `node_modules`.

### Why Certain Packages Must Be External

| Package | Reason |
|---|---|
| `argon2` | Native `.node` binary — cannot be bundled |
| `@prisma/client` | Contains generated code + native query engine binary |
| `@azure/functions` | Provided by the Azure Functions runtime itself — not in `node_modules` |
| `@azure/storage-blob`, `@azure/storage-queue`, `@azure/storage-common` | See below |

---

## THE CRITICAL RULE: Two-File Contract for External Packages

**Every time a package is added to `externals` in `tsup.config.ts`, it MUST also be added to the package list in `.github/workflows/deploy.yml`.**

The deploy workflow uses a custom Node.js script (lines ~62–65) that prunes `node_modules` down to only the packages listed there (plus their transitive deps). If a package is external in tsup but not in this list, it gets deleted from node_modules before the zip is created and will not be present on Azure at runtime.

```js
// .github/workflows/deploy.yml — update this list whenever tsup externals changes
const needed = new Set(['.prisma']);
for (const pkg of ['argon2', '@prisma/client', '@azure/functions', '@azure/storage-blob', '@azure/storage-queue']) {
  getAllDeps(pkg, needed);
}
```

**Note:** `@azure/storage-common` does not need to be listed — it is a transitive dep of storage-blob and storage-queue, so `getAllDeps` will include it automatically.

---

## Recurring Issue: Azure Storage Package Externals

**Root cause (confirmed June 2026):** `@azure/storage-blob` and `@azure/storage-queue` both depend on `@azure/storage-common` as a shared internal package. These three packages do NOT bundle cleanly — when esbuild processes them, internal calls to `createRequire(import.meta.url)` fail because `import.meta.url` is lost in the chunk output context.

**The correct rule:** All three must be treated identically — either all bundled or all external. Mixing them (e.g. externalizing only `@azure/storage-common` while bundling the blob/queue packages) causes the bundled code to reference an external that cannot be located, because Node's ESM resolver looks for it relative to the `dist/` directory, not `node_modules/`.

**Current state (correct):** All three are in `externals` in `tsup.config.ts`. They are direct dependencies in `package.json`, so npm installs them (and `@azure/storage-common` as a transitive dep) to `node_modules/` on Azure.

### Error Signatures for This Issue

```
Worker was unable to load entry point '...': Cannot find package '@azure/storage-common'
  imported from /home/site/wwwroot/dist/chunk-XXXXX.mjs
```
→ `@azure/storage-common` is in `externals` but its parent (`storage-blob` or `storage-queue`) is being bundled.  
**Fix:** Externalize the parent packages too.

```
Worker was unable to load entry point '...':
  The argument 'filename' must be a file URL object, file URL string, or absolute path string. Received undefined
  at createRequire (node:internal/modules/cjs/loader:...)
  at .../dist/chunk-XXXXX.mjs:NNNN:NN
```
→ One of the Azure storage packages is being bundled, and internal `createRequire(import.meta.url)` calls inside the package lose their `import.meta.url` context after esbuild processes them.  
**Fix:** Externalize `@azure/storage-blob`, `@azure/storage-queue`, and `@azure/storage-common` in `tsup.config.ts`.

---

## Module-Level Initialization

**Rule:** Never call code that can throw at module (top-level) scope. Azure Functions v4 with ESM loads each `dist/functions/*.mjs` file at worker startup. If any file throws during load, the **entire worker fails** and ALL functions report "no job functions found" — even functions that have nothing to do with the failing code.

**Symptom:** `No job functions found. Try making your job classes and methods public.`  
This message is misleading — it almost always means a module-level exception in one of the function entry files.

**Pattern to avoid:**
```typescript
// BAD — throws at import time if env var is missing
const client = SomeClient.fromConnectionString(process.env.SOME_VAR);
```

**Pattern to use:**
```typescript
// GOOD — throws only when actually called, produces a real error message
let client: SomeClient | null = null;
function getClient(): SomeClient {
  if (!client) {
    const cs = process.env.SOME_VAR;
    if (!cs) throw new Error("SOME_VAR is not set");
    client = SomeClient.fromConnectionString(cs);
  }
  return client;
}
```

This was fixed in `FileStorage.ts` (June 2026) — `BlobServiceClient.fromConnectionString` was being called at module level with `process.env.AZURE_STORAGE_CONNECTION_STRING` which would throw if the env var was undefined.

---

## Diagnostics

### When the App Won't Start

1. Check **Diagnose and solve problems → Application Event Logs** in the Azure portal. The real exception and stack trace appear there (with a ~5 minute lag after deploy).

2. Hit `GET /api/diagnostics` — added June 2026. Returns Node.js version, uptime, and which env vars are set vs missing. This only works if the worker starts successfully; if the worker fails to start, this won't respond.

3. The Log stream shows `[gapi:startup]` lines from `src/index.ts` if the shared module loads successfully. If those lines don't appear, the failure is happening before `src/index.ts` is imported (i.e. a broken import in the specific failing function file).

### Useful Information to Gather

- The exact exception message from Application Event Logs (not the summary — the full stack trace)
- Which `dist/functions/*.mjs` file is named in the "Worker was unable to load entry point" message
- Whether `[gapi:startup]` appears in Log stream (tells you if `src/index.ts` loaded)

---

## The Banner

```ts
banner: {
  js: `import { createRequire as __tsupCreateRequire } from 'module'; const require = __tsupCreateRequire(import.meta.url);`,
},
```

This is prepended to every output file. It provides a `require()` shim so bundled CJS packages can call `require()` in ESM output. The alias `__tsupCreateRequire` (not `createRequire`) avoids collisions with bundled package code that imports `createRequire` by its own name.

Do not remove this banner — several bundled dependencies use `require()` internally.

---

## History of Changes

| Date | Commit | Change | Outcome |
|---|---|---|---|
| 2026-06-07 | `ed216ba` | Added `@azure/storage-queue`, updated api-spec, added `@azure/storage-common` to externals while keeping blob bundled | **Broke app** — storage-common not found |
| 2026-06-08 | (Claude) | Removed storage-common from externals (bundled it) | **Still broken** — createRequire undefined error |
| 2026-06-08 | (Claude) | Externalized all three: storage-blob, storage-queue, storage-common | Should fix module-load errors |
| 2026-06-08 | (Claude) | Fixed FileStorage.ts module-level BlobServiceClient.fromConnectionString call | Prevents crash when env var missing |
| 2026-06-08 | (Claude) | Added `/api/diagnostics` endpoint and startup logging | Better diagnostics going forward |
| 2026-06-08 | (Claude) | Added `@azure/storage-blob` and `@azure/storage-queue` to the `needed` list in `deploy.yml` | **Root cause fixed** — packages were being deleted from node_modules before zip was created |
