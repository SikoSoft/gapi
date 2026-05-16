# Audit Log Implementation

Implement a full audit log system in gapi that tracks creates, updates, and deletes across Entity, List, Tag, and Setting resources, with the ability to restore any resource to a previous state.

## Prisma Schema

Add to `prisma/schema.prisma`:

```prisma
model AuditLog {
  id         String   @id @default(uuid())
  userId     String
  resource   String   // "entity" | "list" | "tag" | "setting"
  resourceId String
  action     String   // "create" | "update" | "delete"
  before     Json?    // full snapshot before change (null on create)
  after      Json?    // full snapshot after change (null on delete)
  createdAt  DateTime @default(now())

  @@index([userId, resource, resourceId])
}
```

Run `npx prisma migrate dev --name "add-audit-log"` after adding the model.

## New Files

### `src/models/auditLog.models.ts`
Define interfaces and io-ts codecs for AuditLog.

### `src/lib/AuditLog.ts`
- `record(userId, resource, resourceId, action, before, after)` — writes an AuditLog row; returns `Result<AuditLog, Error>`
- `restore(userId, auditLogId)` — reads the target log entry, restores the resource to its `before` snapshot, then writes a new audit log entry for the restore action (so the history is fully reversible); returns `Result<void, Error>`

### `src/functions/auditLog.ts`
HTTP handler for:
- `GET /auditLog?resource=entity&resourceId={id}` — paginated history for a resource, scoped by userId
- `POST /auditLog/{id}/restore` — restore resource to that snapshot's `before` state

## Integration Points

Call `AuditLog.record()` after each successful mutation in the following lib files:

- `src/lib/Entity.ts` — create, update, delete
- `src/lib/List.ts` — create, update, delete
- `src/lib/Tag.ts` — create, update, delete
- `src/lib/Setting.ts` — create, update, delete

## Snapshot Requirements

**Entity snapshots must include all property values** — not just the entity row — because property values are stored across 6 separate tables (`EntityBooleanProperty`, `EntityDateProperty`, `EntityIntProperty`, `EntityImageProperty`, `EntityLongTextProperty`, `EntityShortTextProperty`). A bare entity row snapshot would be unrestorable.

## Restore Logic Per Resource

- `entity` — upsert entity row + delete and recreate all property rows from snapshot
- `list`, `tag`, `setting` — upsert row directly from snapshot

## Restore Audit Trail

The `restore` action should itself be recorded as an audit log entry (action: `"update"`, before: current state, after: restored state), so every restore can itself be undone.
