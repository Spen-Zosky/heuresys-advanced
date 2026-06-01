# ADR-0024 — Legacy ingestion is EMPLOYEE-centric: `sys_user*` ⟸ legacy `employee*` (not `users`)

**Status**: ACCEPTED
**Date**: 2026-06-01
**Author**: CLI session (dual-DBMS structural reconciliation, S954)
**Decision authority**: Enzo Spenuso
**Refines / specializes**: ADR-0023 (data-source doctrine — *which* DB is the source). This ADR fixes *which entity* inside that source is the business root.
**Related**: ADR-0023, ADR-0012 (brownfield wave column), I1 (position-centric advanced model), I7 (auth separate from `sys_users`), RTL tenant rebuild S950, SOT_BACKLOG B-50
**Triggered by**: Enzo's structural correction (2026-06-01): in the legacy Docker DB the **`employees`** table — not `users` — is the entity around which every significant management relation is aggregated. The prior framing (`BROWNFIELD_IMPORT_PLAN.md` §5, `BROWNFIELD_ADAPTATION_MAP.md` row `users`) imported `users` as the person and demoted `employees` to a `tenant_id` lookup. That is backwards. A read-only FK census on the live legacy DB proved it empirically (§3).

---

## §1 — Context

The legacy `heuresys_platform` (Docker `pgvector/pgvector:pg16`) splits a person into two tables:

- **`employees`** — the HR/business entity: 95 columns of bio, job, org, compensation, education, contacts.
- **`users`** — a thin auth shell: 16 columns (`username`, `password_hash`, `role`, `employee_id`, `totp_*`). `users.employee_id → employees.id` is a 1:1 bridge.

The advanced `sys.*` schema collapses both into **`sys.sys_users`** (15 columns, identity core) plus the `sys.sys_user_*` satellites (profiles, position assignments, skill evidence, certifications, education, professional experiences, …), with auth kept separate in `sys.sys_auth_*` (I7). The name collision is a **false friend**: `sys.sys_users` (advanced) carries the *person*, whereas legacy `users` carries only *credentials*.

Earlier brownfield planning read the collision literally — "legacy `users` → `sys.sys_users`" — and treated `employees` as a source of `tenant_id` only. The S950 RTL rebuild inherited a residue of this: its crosswalk key is `sys.sys_users.user_external_code = 'LEGACY:' || legacy.users.id` (the **auth** id), not the employee id. Where a legacy `employees` row has no `users` row, the person is silently dropped.

## §2 — Decision

### §2.1 The legacy business root is `employees`, not `users`
For every ingestion path from `heuresys_platform`, the **person/business entity is `employees`**. `users` is treated as a **subordinate auth attribute** of its employee, never as the entity being imported.

```
legacy.employees   ──►  sys.sys_users (identity)  +  sys.sys_user_* (satellites)   ← all HR payload
legacy.users       ──►  sys.sys_auth_* (credentials only)                          ← username/role/totp
legacy.users.employee_id  =  bridge only (resolve auth → employee), never imported as data
```

### §2.2 The canonical linkage key is the employee, not the user
The natural key for a person is **`employees.id`** (or, as an independent cross-check, `lower(employees.email) = lower(sys_users.user_email)`). The legacy `users.id` is **not** a valid person key:
- It is null for employees that never received an auth account.
- It points at the credential row, not the human.

New ingestion MUST key on `employees`. The legacy crosswalk natural key becomes `LEGACY_EMP::<employees.id>` (preferred) or email-match; `LEGACY:<users.id>` is **deprecated** for person linkage (it survives only as an auth-shell pointer where an account genuinely exists).

### §2.3 An employee without a `users` row is still a person
Coverage is driven by `employees`, not by the auth join. An employee with no `users` row imports as a `sys.sys_users` person with **no `sys.sys_auth_*` credential** (cannot log in until provisioned) — it is **not** skipped. The previous user-centric keying made auth-existence a precondition of personhood; that is reversed here.

## §3 — Verified evidence (S954, read-only FK census on live legacy DB)

| Probe | Result | Reading |
|---|---|---|
| FK constraints in `public` referencing `employees` | **207** | the business gravity centre |
| FK constraints referencing `users` | **45** | audit-actor only (`created_by`, `author_id`, `user_id`) |
| ratio employees : users | **4.6 : 1** | management data hangs off `employees` |
| `employees.manager_id` → | `employees` (self-FK) | the reporting line is employee→employee |
| `users.employee_id` → | `employees` | `users` points *at* employees (subordinate) |
| HR domains FK→`employees` | bio, contracts, job_assignments, kpi_targets, goals, performance_reviews, learning_path_enrollments, career_paths, employee_skills, salary_history, onboarding, wellbeing | every significant management relation |
| domains FK→`users` | account, session, audit_logs, error_logs, news_*, notifications, blueprint_*, enrichment_* | technical / authorship only |

Tables that FK to **both** (e.g. `performance_reviews`, `notifications`, `document_comments`) carry two distinct columns — `..._employee_id → employees` for the HR **subject**, `user_id → users` for the technical **actor** — which independently confirms the split.

**Impact of the prior (user-centric) keying, measured:** in the S950 rtl+heuresys subset, 162 employees / 160 with a `users` row → **2 employees dropped** by keying on `users`. Globally (4 tenants) 270 employees / 2 without a user — the same defect class at scale. Artefacts: `qa_artifacts/_FK_centric.txt`, `_FK_users.txt`, `_emp_user_gap.txt`.

## §4 — Consequences

**Positive**
- Ingestion coverage is bounded by the real population (`employees`), not by the auth subset — no silent person loss.
- The advanced model's intent (I1 position-centric, I7 auth-separate) is honoured at the source-read level, not only at the target.
- Email cross-check (97.5% match in the current data) becomes the validation oracle for the employee-keyed join.

**Negative / bounded**
- The S950 RTL data on the live bare-metal was wired with the deprecated `LEGACY:<users.id>` key. It is **not wrong data** (the persons are correct), but the **key is**. Re-keying to `LEGACY_EMP::<employees.id>` is a gated, destructive re-run (S950 protocol: backup → dry-run COUNT → execute → E2E). Tracked under B-50.
- The 5 `rtl-rebuild` seed files (`04`, `06`, `07`, `08`, README) and `BROWNFIELD_IMPORT_PLAN.md` §5 / `BROWNFIELD_ADAPTATION_MAP.md` encode the old key and must be rewritten (Phase 2 of S954).

**Neutral**
- This ADR changes ingestion *method*, not the `sys.*` schema. No migration. The advanced structural authority (ADR-0023 §2.1) is unchanged.

## §5 — Scope boundary (cardinal)

This ADR locks the **direction** (employee-centric ingestion). Rewriting the seeds (Phase 2) and re-keying the live bare-metal (Phase 3) are executed under the explicit, separately-greenlit S954 authorization and the S950 gated-destructive protocol. No bulk re-run is implied by acceptance alone (`feedback_scope_discipline_no_cascade`).

## §6 — References
- ADR-0023 (data-source doctrine; this ADR specializes its §2.2)
- I1 / I7 (CLAUDE.md "Non-negotiable invariants")
- `docs/brownfield/EMPLOYEE_CENTRIC_MAPPING_DOCTRINE.md` (the full mapping table this ADR governs)
- `docs/brownfield/BROWNFIELD_IMPORT_PLAN.md` §5 (corrected), `BROWNFIELD_ADAPTATION_MAP.md` (corrected)
- `db/seeds/rtl-rebuild/README.md` (re-key note)
- SOT_BACKLOG B-50 (full reconciliation umbrella)
- Evidence: `qa_artifacts/_FK_centric.txt`, `_FK_users.txt`, `_emp_user_gap.txt`, `_FINAL_match.txt`, `_FINAL_chain.txt`

---

*End ADR-0024*
