# DB cleanup — orphan inbox notifications (2026-07-07)

**Context**: surfaced during the session-start forensics session. `status_dashboard` reported
`sys.v_inbox_resource_consistency = 4 rows` (structural-invariant violation; the 6 `sys.v_*`
validation views must all be 0).

## What was wrong

4 **UNREAD** inbox notifications for **`paolo.caputo@rtl-bank.org`** (tenant RTL_BANK), created
**2026-07-05**, of `notification_resource_type = 'ASSESSMENT'` pointing to 3 distinct
`notification_resource_id` values that **do not exist** in `sys.sys_assessments` (615 assessments
present, none matching; no soft-delete trace). Subjects: "Nuova valutazione richiesta" ×3 +
"Feedback di valutazione disponibile" ×1. `action_url` was the generic `/me/assessments`.

**Root**: the inbox resource reference is **polymorphic** (`notification_resource_type` +
`notification_resource_id`, **no hard FK**), so deleting the referenced assessments did not cascade
to the notifications; the validation view exists precisely to catch this. All 4 ASSESSMENT
notifications were dangling (4/4). The exact deleter of the assessments was not determined from the
current DB state.

## Action taken

Snapshot → targeted delete (transaction + guard: rollback if the view was not 0 afterward) →
verified. Result: `v_inbox_resource_consistency = 0`, remaining ASSESSMENT notifications = 0,
**all 6 structural views = 0 violations**.

Deleted `notification_id`s:
`7ee9e080-ffaf-41ea-877b-921b3798e961`, `fae99cb9-11a6-4817-a51a-95577b52e405`,
`4a269d32-490e-482f-8f71-7dd042e54dad`, `10292ab2-0f1b-4c93-8000-2ac906131b05`.

## Reversal (if ever needed)

Full rows are snapshotted in `inbox-orphan-cleanup-20260707.csv` (same dir). To restore:

```bash
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced \
  -c "\copy sys.sys_inbox_notifications FROM 'qa_artifacts/inbox-orphan-cleanup-20260707.csv' WITH CSV HEADER"
```

## Recurrence risk (not fixed here — surfaced for a later decision)

The polymorphic notification reference has no cascade, so deleting any referenced resource
(POSITION / LEARNING_MODULE / ASSESSMENT / CAREER_TARGET / KPI / SKILL / APPROVAL_STEP) can leave
dangling inbox rows again. Options for prevention (a future item, not done): a cleanup routine run
on resource deletion, a periodic sweep, or delete-time handling in the resource services.

> Note: this cleanup hit the shared VM/prod DB (reached via the :5433 tunnel). The **linux-pc**
> local twin DB still carries the 4 orphans until refreshed with `scripts/clone-vm-db.sh`.
