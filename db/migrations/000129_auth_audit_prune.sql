-- ============================================================================
-- Migration 000129 — QW-C2 (S-100X-A4 / WS-C F-WS-C-4): one-time prune of the
-- unbounded auth-audit tables. sys_auth_refresh_tokens had grown to ~46k rows
-- for 9 users (test/CI/E2E login leak) with no cleanup, bloating the partial
-- `active_idx` that the refresh-rotation hot path scans. Same class as D-18
-- (append-without-bound) but on the AUTH tables; the recurring guard lives in
-- scripts/auth-housekeeping.sh + the systemd timer.
--
-- Prune rule (SAFE — never logs out a live session):
--   refresh_tokens: revoked OR already expired. A revoked token is dead; an
--     expired token can no longer mint a session (refresh rejects it), so
--     deleting it is loss-free. The ~36.7k still-"active" leak rows (used_at
--     NULL AND revoked_at NULL AND not-yet-expired) are KEPT here — they each
--     have a 30d TTL, so the daily recurring job collects them as they expire,
--     without invalidating any genuinely live session.
--   login_events: 180-day audit retention (no rows match yet — the DB is ~1
--     month old; this is the forward policy, enforced going forward by the job).
-- Idempotent: a 2nd (immediate) run deletes ~0 — the surviving rows no longer
-- match (mirrors the 000094 insights-collapse re-runnable pattern).
-- Authored: 2026-06-16 (S993).
-- ============================================================================

DELETE FROM sys.sys_auth_refresh_tokens
WHERE auth_refresh_token_revoked_at IS NOT NULL
   OR auth_refresh_token_expires_at < now();

DELETE FROM sys.sys_auth_login_events
WHERE created_at < now() - interval '180 days';
