# Introspection and Roles

## Overview

Every authenticated endpoint calls `introspect(request)` (exported from `src/index.ts`) to resolve the caller's identity from the `Authorization` header. The result is an `Introspection` object (typed in `api-spec/models/Introspection`) that all handlers use to gate access.

## Introspection Result Shape

```typescript
// Not logged in / anonymous
{ isLoggedIn: false; isSystem: false }

// System caller (SYSTEM_API_KEY bearer)
{ isLoggedIn: false; isSystem: true }

// Authenticated user
{
  isLoggedIn: true;
  isSystem: false;
  user: {
    id: string;         // UUID
    username: string;
    firstName: string;
    lastName: string;
    roles: string[];    // Role enum values, e.g. ["orbit-debug"]
  };
  googleLink: boolean;
  googleAccount?: ...;
  sessionId: string;
  expiresAt: Date;
}
```

Roles on `introspection.user.roles` are raw strings matching the `Role` enum values from `api-spec/models/Identity`.

## Role Enum (api-spec/models/Identity)

```typescript
export enum Role {
  AI     = "orbit-ai",
  NUKE   = "orbit-nuke",
  ACCESS = "orbit-access",
  DEBUG  = "orbit-debug",
}
```

## Checking Roles in Endpoints

Import `Role` from `api-spec/models/Identity` and use `Array.includes`:

```typescript
import { Role } from "api-spec/models/Identity";

const introspection = await introspect(request);

// Require login only
if (!introspection.isLoggedIn) {
  return forbiddenReply();
}

// Require a specific role
if (!introspection.isLoggedIn || !introspection.user.roles.includes(Role.DEBUG)) {
  return forbiddenReply();
}
```

Both checks return a `403` via `forbiddenReply()`. Always combine the `isLoggedIn` guard with the role check in a single condition — `introspection.user` is undefined when `isLoggedIn` is false, so accessing `.roles` without the guard will throw.

## Role Assignments

Roles are stored in the database and managed via `PUT /user` with a `roles` array in the body. Only callers whose `introspection.user.roles.includes("admin")` may update roles (see `src/functions/user.ts`).

## System Calls

`isSystem: true` indicates the caller presented the `SYSTEM_API_KEY` environment variable as their bearer token. System callers are not users and have no `user` object — check `introspection.isSystem` separately when endpoints need to allow system access (e.g. `POST /analysisClassificationResult`).
