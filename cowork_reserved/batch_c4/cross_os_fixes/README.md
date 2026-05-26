# Cross-OS Fixes — CW-B28/B29/B30 mitigations

**Author**: Cowork batch C4.5
**Date**: 2026-05-21
**Triggered by**: REPORT X3 §6 — 3 new biases catalogued by CLI

---

## §1 — CW-B28 mitigation: extract script Windows-compat

### Issue
PG 16+ `pg_dump` emits `\restrict <token>` + `\unrestrict <token>` lines incompatible with psql non-interactive Windows mode. Plus `vector(N)` types (pgvector ext) + `uuid_generate_v4()` (uuid-ossp ext) require extension install.

### Fix — universal compatibility wrapper

All extract scripts going forward MUST use this pipeline:

```bash
#!/usr/bin/env bash
# Universal pg_dump → legacy_mirror restore pipeline (cross-OS, ext-agnostic)
ssh "${SSH_HOST}" "sudo -u postgres pg_dump --data-only --no-owner --no-privileges \
  $(for t in "${TABLES[@]}"; do printf -- '-t public.%s ' "$t"; done) \
  -d heuresys_platform" \
  | grep -v '^\\restrict ' \
  | grep -v '^\\unrestrict ' \
  | sed 's/COPY public\./COPY legacy_mirror./g' \
  | psql "${DB_URL}"

# For schema dumps (CREATE TABLE):
ssh "${SSH_HOST}" "sudo -u postgres pg_dump --schema-only --no-owner --no-privileges \
  $(for t in "${TABLES[@]}"; do printf -- '-t public.%s ' "$t"; done) \
  -d heuresys_platform" \
  | grep -v '^\\restrict ' \
  | grep -v '^\\unrestrict ' \
  | sed 's/vector([0-9]*)/text/g' \
  | sed 's/uuid_generate_v4()/gen_random_uuid()/g' \
  | sed 's/CREATE TABLE public\./CREATE TABLE IF NOT EXISTS legacy_mirror./g' \
  | sed 's/public\./legacy_mirror./g' \
  | sed '/^ALTER TABLE.*ADD CONSTRAINT/d' \
  | sed '/^CREATE INDEX/d' \
  | psql "${DB_URL}"
```

### Action
Update `db/scripts/extract_users_employees_legacy.sh` (already committed in X3) with these grep/sed lines. Apply same pattern to future SDBI extract scripts.

---

## §2 — CW-B29 mitigation: migration convention

### Issue
Existing migrations 000031-000037 do NOT have explicit `INSERT INTO sys.sys_schema_migrations`. Cowork-authored migration 000039 (batch C3) DID. Inconsistency.

### Decision (Cowork-authored, ratify in C5 ADR if needed)

**Standardize on**: NO explicit `INSERT INTO sys.sys_schema_migrations`. `pnpm db:migrate` runner handles tracking automatically.

### Action

1. Remove `INSERT INTO sys.sys_schema_migrations` block from `cowork_reserved/batch_c3/schema_migrations/000039_audit_source_table_id_nullable.sql` (CLI X3 already applied — DB row exists, harmless).
2. Future migrations Cowork-authored MUST follow this convention.

```sql
-- WRONG (CW-B29):
INSERT INTO sys.sys_schema_migrations (file_name, sha256, applied_by, duration_ms)
VALUES ('000039_...', REPEAT('0', 64), CURRENT_USER, 0)
ON CONFLICT (file_name) DO NOTHING;

-- CORRECT (project convention):
-- (nothing — pnpm db:migrate inserts the row with real sha256 + actual duration)
```

### Verification
```bash
grep -l "INSERT INTO sys.sys_schema_migrations" db/migrations/*.sql
# Expected: 0 files (post-cleanup)
```

---

## §3 — CW-B30 mitigation: shared/dist build coupling

### Issue
Editing `packages/shared/src/*.ts` → `pnpm typecheck` in apps/api fails until `pnpm build` in packages/shared/ regenerates `dist/*.d.ts`. Despite `exports.default = ./src/*.ts` config.

### Decision

Add pre-flight step in all PROMPT templates (this pattern memo updated in §8 anti-pattern 9 already).

### Action — root cause investigation TODO

Investigate why `exports.default = ./src/*.ts` doesn't propagate type changes without build:
- Possible: tsc in apps/api resolves @heuresys/shared via node_modules link → reads dist/ first?
- Possible: tsconfig "moduleResolution" or "paths" config needs adjustment

Defer deep fix to dedicated tooling batch. For now: PROMPT pre-flight section §2.X includes explicit `pnpm --filter @heuresys/shared build` if editing shared/src/.

### PROMPT pre-flight template update (apply in PROMPT 007+)

```markdown
## §2.X — Build artefact pre-flight (CW-B30)

If your batch involves editing files in `packages/shared/src/`:
1. After edit + before `pnpm typecheck` in apps/api:
   pnpm --filter @heuresys/shared build
2. Verify `packages/shared/dist/` regenerated.

If your batch involves editing files in `packages/ui/src/` (D:\ux-design-shared symlink):
1. After edit + reach apps/web typecheck:
   (typically no rebuild needed — Tailwind 4 + tsx watch in dev cycle handle live updates)
```

---

## §4 — Summary

| Issue | Status | Mitigation |
|---|---|---|
| CW-B28 cross-OS pg_dump | ⚠️ NOT YET applied to existing scripts | Update extract_users_employees_legacy.sh + future scripts use wrapper §1 |
| CW-B29 migration convention | ⚠️ DB has 1 row inconsistency (harmless) | Future Cowork migrations OMIT explicit INSERT — already convention in 000038 by CLI |
| CW-B30 shared/dist coupling | ✅ Mitigated via pre-flight section in PROMPT 007+ | Long-term: investigate tsc config |

All 3 mitigations are P2 (housekeeping). No P0 impact.

---

*End cross-OS fixes spec*
