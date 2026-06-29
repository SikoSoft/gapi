# Streak Alert System

## Overview

The streak alert system notifies users when an active streak is at risk of being broken before the end of their local day. Users configure one or more `StreakAlertConfig` entries per streak, each with a `noticeTime` (minutes before local midnight) at which the notification should fire.

## Data Model

### StreakAlertConfig

Stores the user's alert preferences for a specific streak.

| Field       | Type     | Description                                      |
|-------------|----------|--------------------------------------------------|
| id          | Int      | Primary key                                      |
| streakId    | Int      | FK → StreakConfig (cascade delete)               |
| userId      | String   | Owner UUID                                       |
| noticeTime  | Int      | Minutes before local midnight to send the alert  |
| createdAt   | DateTime |                                                  |
| updatedAt   | DateTime |                                                  |

### StreakAlert

A scheduled (and eventually sent) instance of an alert. Created at scheduling time; `sentAt` is populated by the queue handler after the push notification is delivered.

| Field         | Type      | Description                                      |
|---------------|-----------|--------------------------------------------------|
| id            | Int       | Primary key                                      |
| userId        | String    | Owner UUID                                       |
| alertConfigId | Int       | FK → StreakAlertConfig (cascade delete)          |
| sentAt        | DateTime? | Null until the push notification is delivered    |
| createdAt     | DateTime  |                                                  |
| updatedAt     | DateTime  |                                                  |

## Scheduling Flow

1. **Timer trigger** (`streakAlertSchedule`, runs daily at 00:05 UTC):
   - Finds all users who have at least one `StreakAlertConfig`.
   - For each user, fetches their timezone (`TIMEZONE` setting → `utcOffsetMinutes`).
   - Resolves all saved streaks via `Streak.resolveStreaks`.
   - For each streak with `current >= 1` (active streak), loads its `StreakAlertConfig` rows.
   - For each alert config, calls `StreakAlertScheduler.computeNotifyAt` to determine when the notification should fire:
     - Computes the user's next local midnight in UTC.
     - Subtracts `noticeTime` minutes.
   - Skips the alert if `notifyAt` is already in the past.
   - Deduplicates: skips if a `StreakAlert` row for this `alertConfigId` was already created today (UTC day).
   - Creates a `StreakAlert` row and enqueues a message on `streak-alert-queue` with the appropriate Azure Storage Queue visibility timeout.

2. **Queue trigger** (`streakAlert`, queue: `streak-alert-queue`):
   - Receives the delayed message when `notifyAt` arrives.
   - Sends a push notification via `Notification.send`.
   - Updates `StreakAlert.sentAt` to mark the notification as delivered.

## Endpoint

`GET/POST/PUT/DELETE /streakAlertConfig/{id?}`

Standard CRUD, scoped to the authenticated user. `id` is required for PUT and DELETE.

## `computeNotifyAt` Logic

```
localMs         = now.getTime() + utcOffsetMinutes * 60_000
startOfLocalDay = Date.UTC(year, month, day)   // derived from localMs
nextMidnightUTC = startOfLocalDay + 24h - utcOffsetMinutes * 60_000
notifyAt        = nextMidnightUTC - noticeTime * 60_000
```

Example (UTC+5, noticeTime=120):
- User's local midnight is 19:00 UTC.
- Alert fires at 17:00 UTC.

Example (UTC-5, noticeTime=120):
- User's local midnight is 05:00 UTC next day.
- Alert fires at 03:00 UTC next day.

## @todo: Alert deduplication across same-day sequence

**@todo** — Multiple `StreakAlertConfig` rows can exist per streak (e.g., alerts at 240 min and 60 min before midnight). A planned future feature would prevent re-firing any remaining alerts in the same streak+day sequence once the user has already maintained the streak that day. The mechanism would be: a composite key of `(streakConfigId, localDateKey)` on `StreakAlert`, checked at queue-handler time before sending the notification — if the streak `current` is still >= 1 at fire time the streak has not yet been maintained, so the alert should still send; if the user already completed the streak since scheduling, skip it. This requires resolving the streak inside the queue handler, which is non-trivial due to timezone-scoped cache invalidation.
