# WARGAME 17 — Wave-3 residual: L2/L3 multi-industry tenant onboarding (SmartFood 82 + EcoNova 26)

| | |
|---|---|
| **Mission** | Backlog item **#17** — onboard the two non-banking legacy tenants **EcoNova (26 emp, L2 pilot)** then **SmartFood (82 emp)** into the v5 platform as REAL production tenants. L1 (Heuresys System fix) is **ALREADY DONE** (S987/S988, mig 000110+000111) — **do not redo it** (Move C0.3 verifies and skips). |
| **Executor** | Claude Code CLI (Sonnet or Opus) on `D:\heuresys-advanced` (Windows) / `/home/ubuntu/heuresys-advanced` (VM) |
| **Wargamed by** | Fable 5 (wargame architect), 2026-07-06 |
| **Open product fork** | Route A = multi-industry taxonomy program · Route B = single-industry reference mapping with documented gaps. **Enzo has NOT decided.** This plan fights both; the executor runs Phase 0–2 (recon + evidence), STOPS at the Master Fork for Enzo's decision, then runs the chosen route. |
| **Sources of truth to RE-READ at execution, in order** | 1. `docs/kb/SOT_STATE.md` · 2. `docs/kb/SOT_BACKLOG.md` (item #17) · 3. `docs/kb/DEBT_REGISTER.md` (D-08, D-12, D-22, D-38, D-46) · 4. `.handoff/STATE.md` · 5. `docs/architecture/adr/0024_legacy_ingestion_employee_centric.md` · 6. `docs/architecture/adr/0026_single_production_environment_two_tenants.md` · 7. `db/seeds/rtl-rebuild/README.md` · 8. `docs/kb/DATA_RECONCILIATION_PLAN.md`. **SoT wins over this document** — if SoT contradicts a fact below, trust SoT and re-derive. |

Production doctrine that governs every move: **ADR-0026 / I15** — there is ONE environment and it is production. Every write in this plan is a production write: idempotent (twice-run = 0-diff), reversible, snapshot-gated.

---

## 1. RECON FINDINGS (verified vs assumed)

### 1.1 VERIFIED (evidence = file:line in the repo, read 2026-07-06)

**F1 — Item #17 state.** `docs/kb/SOT_BACKLOG.md:30-33`: status HOLD; L1 done (S987/S988, confirmed live S1005: tenant HEURESYS 4 users / 4 pos / 3 OU); residual = L2/L3 SmartFood+EcoNova; reactivation-trigger = `{kind: manual}` Enzo decides the multi-industry strategy. `docs/kb/SOT_STATE.md:120` confirms L1 with the same numbers.

**F2 — L1 precedent (the pattern to copy, not redo).** `db/migrations/000110_fix_heuresys_tenant_mapping.sql`: guarded `UPDATE brownfield.tenant_id_mappings` with `WHERE … IS DISTINCT FROM`, tenant resolved **by tenant_code join, never hard-coded UUID**. `db/migrations/000111_import_chiara_spenuso_heuresys.sql`: person INSERT with `user_external_code = 'LEGACY_EMP::<employees.id>'`, every INSERT `WHERE NOT EXISTS`, no BEGIN/COMMIT (migrate.sh wraps each file in `psql -1`), role grant (USER), LOCAL auth identity, ARGON2ID **stable literal hash** of the project-standard demo password (idempotent across runs), informational `DO $$ RAISE NOTICE` verification that does NOT abort.

**F3 — Legacy tenant UUIDs and their exclusion.** `db/migrations/000033_…​.sql:70-87`: SmartFood = `1d7bf448-ceac-4215-917d-45ff13678104`, EcoNova = `fb1e866c-e90a-4e25-a146-f68d660a0be8`; both **intentionally NOT mapped** in `brownfield.tenant_id_mappings` (S954 case-study scope). Legacy RTL = `0c54b84a-…`, legacy Heuresys = `d5855519-…`.

**F4 — SmartFood/EcoNova do NOT exist in v5 today.** `docs/kb/SOT_STATE.md:613`: migration 000047 dropped the `legacy_mirror` schema (115 tables, contained SmartFood 82 + EcoNova 26) and their tenant mappings; only RTL_BANK + HEURESYS tenancies are ACTIVE. L2 must **create** the tenants from scratch.

**F5 — v5 process taxonomy is banking-native, GLOBAL, variant-scoped.** `db/migrations/000021_seed_reference_bank.sql:137-168`: 23 processes (codes `00`–`22`) seeded into `sys.sys_blueprint_process_registry` under blueprint variant `REGIONAL_RETAIL_BANK_MEDIUM`. IT-canonical names in `000157_g01_process_names_it.sql` ("Standard banking process taxonomy"). The catalog is **global, not tenant-scoped** (`SOT_STATE.md:613`: "23 processi (catalogo GLOBALE non tenant-scoped)"). Rough semantic split (my classification, not code): ~10 banking-specific (01 acquisition/onboarding-bancario, 02 KYC/AML, 03 conti, 04 pagamenti, 05-06 credito, 07 wealth, 08 investimenti retail, 09 tesoreria/ALM, 13 filiale) vs ~13 industry-agnostic (00 strategy, 10 risk, 11 compliance, 12 audit, 14 customer service, 15 marketing, 16 IT, 17 HR, 18 finance, 19 procurement, 20 facility, 21 legal, 22 data).

**F6 — v5 KPI catalog: 243 GLOBAL definitions.** `db/seeds/reconciliation/01_kpi_definitions.sql` (81 from legacy `process_kpis`, codes `BP-NNN-KPI-NN`, tenant NULL + is_global) + `02_kpi_catalog_unification.sql:78` (`expect 243 = 81+45+100+17`: +45 `job_kpis`, +100 `org_unit_kpis` `KPI-*`, +17 `employee_kpi_targets`). All global (tenant NULL) → **structurally industry-neutral, semantically banking-flavoured**.

**F7 — Legacy processes are per industry prototype, and BOTH non-banking code families EXIST — already quantified in-repo.** `db/seeds/reconciliation/04_registry.sql`, row `sys_process_kpi_templates`: "legacy business_processes keyspace (**BP-001..BP-SF-007**) does not map to blueprint_process_registry ordinals (00..22)". The keyspace is **live-measured (S994)** in `db/seeds/reconciliation/53_registry_process_kpi_templates_s994_evidence.sql:14-24`: **25 KPI-bearing legacy processes = `BP-001..BP-011` (banking, 11) + `BP-EN-001..007` (energy/EcoNova, 7) + `BP-SF-001..007` (food/SmartFood, 7)**; CODE-overlap with the v5 registry **0/25**, exact name-overlap **1/25**. So `BP-EN-*` is positively sighted too, not just `BP-SF-*`. `docs/brownfield/BROWNFIELD_ADAPTATION_MAP.md:467`: `business_processes` = "Standard business processes **per industry prototype**"; `:477`: legacy `blueprint_templates` = "Variant **per industry family**". → the legacy platform already modelled multi-industry; v5 imported only the banking slice. Note: at 7 KPI-bearing processes per industry, the Master-Fork framing threshold "≤7 → Route A = author-from-zero" is already met on in-repo evidence — Q3/Q5 still run to confirm live (seed 53 counts only KPI-bearing processes).

**F8 — Quantified SmartFood/EcoNova legacy footprint already visible in repo:**
- Employees: SmartFood **82**, EcoNova **26** (`docs/brownfield/BROWNFIELD_IMPORT_PLAN.md:298`; `wave_3_runner.md` §0).
- `employee_kpi_targets`: **412 total → 248 imported (RTL) / 164 skipped = SmartFood+EcoNova** (`db/seeds/reconciliation/03_kpi_targets.sql:9-11`).
- `career_paths`: **4 SmartFood rows** skipped (`05_career_paths.sql:15`).
- `bonus_pools`: **8 rows** of SF+EN skipped (`08_bonus_pools.sql:15`).
- Legacy OU counts known only for RTL (32) and Heuresys (8) (`db/seeds/rtl-rebuild/README.md` "Legacy source"); SF/EN OU counts = RECON NEEDED Q2.

**F9 — Keying doctrine.** ADR-0024 / I14 (`CLAUDE.md:203`): person = legacy `employees` (207 FK) not `users` (45 FK); crosswalk `user_external_code = 'LEGACY_EMP::' || employees.id`; an employee without a `users` row imports as a **credential-less person**, never skipped. Permanently guarded by `apps/api/test/employee-centric-doctrine.integration.test.ts`.

**F10 — Onboarding template exists and is proven.** `db/seeds/rtl-rebuild/` (16 seed files + README): `00_extract_legacy_subset.sh` is **tenant-UUID-parameterized** (line 12-13: `RTL=…`, `HEU=…`; every `\copy` filters `tenant_id IN ($TENANTS) AND deleted_at IS NULL`), staging `staging.rtl_*` pattern (`CREATE TABLE IF NOT EXISTS` + `TRUNCATE` + `\copy` + transform), idempotent writes everywhere, D7 org-type collapse onto the v5 8-type catalog with legacy `org_type` preserved in metadata, RBAC grants in `08_rbac_role_grants.sql`. This — not the wave-executor — is the proven L2 method.

**F11 — `wave_3_runner.md` is a STALE DRAFT.** It predates ADR-0024/0026: uses `user_is_synthetic = true` + `SYNTHETIC_REFERENCE` (retired by mig 000154, ADR-0026) and never got the sign-off/ADR-0020..0023 chain. Flagged as stale marginal in SOT_BACKLOG #18 note (S1005). **Use it only for**: PII column blacklist (§10.2), email-collision risk (§7.3), rollback ordering idea (§6.1). **Do not follow its import mechanics.**

**F12 — Reconciliation registry / D-22 class.** `sys.sys_reconciliation_registry` + hard assert `0 UNCLASSIFIED` (`db/migrations/000062_…​.sql:46-47`, `RAISE EXCEPTION` on violation) — and the SAME assert is replicated in at least nine later migrations (`000064:136`, `000081:115`, `000082:89`, `000086:215`, `000092:108`, `000100:94`, `000102`, `000103:122`, `000105:85`), so do NOT reason from a single assert point: an unregistered table trips at the FIRST assert-carrying migration after it, wherever that is. The operative rule is C3.2.4 (register in the SAME file that creates the table). D-22 lesson (`DEBT_REGISTER.md:33`): a new `sys.*` table must be registered **inside the same migration that creates it** — a fix in a later migration does NOT survive a fresh-rebuild replay. Related: D-38 (asserts by owned codes only), D-46 (a migration must not depend on data seeded outside the chain), D-12 (twice-run idempotent).

**F13 — Pre-deploy snapshot D-08.** `scripts/vm-deploy.sh:85-107`: `pg_dump -Fc` into `pg_dump_snapshots/pre-deploy/` BEFORE the migrate step, fail-loud on empty dump, retention 10. Services are systemd `heuresys-advanced-api.service` / `heuresys-advanced-web.service` (`vm-deploy.sh:160-184`), plus **four systemd timers** (scraping/insights/backup/reindex, `vm-deploy.sh:168-170,184-187`) whose jobs hold DB sessions. Manual restore pattern (`scripts/dr-drill.sh:48-53`): the dump MUST be fed **via stdin redirect opened by the `ubuntu` shell** — passing the path to `sudo -u postgres pg_restore <path>` fails with "could not open input file: Permission denied" because postgres cannot traverse `/home/ubuntu` (0750, found S993); and dr-drill's `--no-owner --no-acl` is a **scratch-DB-only** flag set (its own comment, line 47) — an in-place prod restore must preserve the `heuresys` app-role ownership (see §9). Off-machine archive: `scripts/archive-dumps.sh` → `oracle-vm-default:/home/ubuntu/dump_archive/` (`docs/kb/DUMP_ARCHIVAL_RUNBOOK.md`).

**F14 — Legacy DB access path.** Reconciliation seeds (S958, executed) access it as a **native co-hosted Postgres DB**: `sudo -u postgres psql -d heuresys_platform` on the VM (`01_kpi_definitions.sql:6-16`, `DATA_RECONCILIATION_PLAN.md:108`). The older rtl-rebuild README (2026-05-30) says Docker `heuresys_evo_platform_db` — superseded, but settle live (Q0).

**F15 — Tenancy schema is industry-ready.** `db/migrations/000003_tenancies.sql`: `sys_tenancies` has `tenant_industry_code varchar(64)`, `tenant_size_band` CHECK ∈ {XS,S,M,L,XL}, `tenant_code` UNIQUE. RTL is `M / FIN_BANKING` (ADR-0026 §2.2 table).

**F16 — Tenant-materialization module ≠ legacy importer.** `apps/api/src/modules/tenant-materialization/` (600 LOC, 1 archetype `RETAIL_BANK_REFERENCE`, namespaced RBR-* codes, GENERATED_INCUMBENT placeholders, POST gated PLATFORM_ADMIN + CSRF). It generates **synthetic skeletons**; it does not import legacy people. Relevant to Route A as the delivery vehicle for new industry archetypes, NOT for the SF/EN person import.

**F17 — Chain & baseline numbers (stale by definition — re-derive live, Move C0.2).** 167 migration files, max `000169` at S1015 → next free ≈ `000170`. apiTests 1098 / e2e 123 / CI 6-7 jobs at S1011 (`SOT_STATE.md:59` and brief). HEURESYS tenant has mandatory-MFA (S984, noted in 000111).

**F18 — PII-class columns in the extraction path.** `00_extract_legacy_subset.sh:34` extracts `iban, swift_bic, bank_name, emergency_contact_*` for the compensation/profile seeds. wave_3_runner §10.2 blacklists `*fiscal*|*iban*|*passport*|*bank_account*` from person imports. Data is synthetic (ADR-0023 no-PII by provenance) but the OUTPUT RULE retires the "synthetic" qualifier — treat as real. Default for SF/EN: extract only what the seeds actually consume (Fork F7).

### 1.2 ASSUMED (plausible, not proven — each has a settling check in §2)

- **A1**: ~~legacy `business_processes` contains EcoNova-prefixed codes too (only `BP-SF-*` positively sighted)~~ **largely SETTLED in-repo** by seed 53 (F7): `BP-EN-001..007` exist among the KPI-bearing processes. Q3 still runs to confirm live and to count any non-KPI-bearing processes seed 53 excludes. → Q3.
- **A2**: some of the 243 global KPI codes are already SmartFood/EcoNova-semantic (the 81 `process_kpis` were imported **globally** and the keyspace runs `BP-001..BP-SF-007`) — i.e. part of the "multi-industry taxonomy" may ALREADY be in prod. → Q5.
- **A3**: SmartFood/EcoNova legacy org_units/contracts/skills volumes are proportional to RTL's (82/26 emp vs 158). → Q2.
- **A4**: legacy `employees.deleted_at IS NULL` filter keeps 82/26 (the documented counts may include soft-deleted). → Q1.
- **A5**: no email collisions across tenants (distinct demo domains per tenant, e.g. `@smartfood…`/`@econova…` vs `@rtl-bank.org`). → Q6.
- **A6**: legacy `blueprint_templates` holds usable food/green-energy variant definitions Route A could import instead of authoring from zero. → Q4.

---

## 2. RECON NEEDED — settling checks (run in Phase 1, read-only, before anything writes)

Run on the VM (`ssh oracle-vm-default`), read-only. Every check outputs evidence per R5 (command + output + timestamp). `LEG` = `sudo -u postgres psql -d heuresys_platform -At -c`, `ADV` = `sudo -u postgres psql -d heuresys_advanced -At -c`. (From Windows, `ADV` can also run through the tunnel `localhost:5433`.)

> **Copy-safety rule**: the commands live in fenced code blocks, NOT in table cells. A markdown-escaped `\|` inside a table cell copies out of the raw `.md` as a literal `\|` — in bash that is a pipe *argument* (command breaks), and inside a POSIX-ERE regex it matches a literal `|` character (classification silently returns 0 rows). Never move these commands into a table; audit any new table cell for `\|` before adding one.

**Q0 — settles F14/A-Docker: where the legacy DB lives.**
```bash
ssh oracle-vm-default 'sudo -u postgres psql -lqt | grep heuresys_platform; docker ps 2>/dev/null | grep -i heuresys'
```
Interpretation: native row present → proceed. Only Docker → adapt every `LEG` call to `docker exec`. Neither → **ABORT AB-1** (source gone; restore legacy dump from `/home/ubuntu/dump_archive/` first).

**Q1 — settles A4: real importable headcount.**
```bash
LEG "SELECT tenant_id, count(*) FILTER (WHERE deleted_at IS NULL), count(*) FROM employees WHERE tenant_id IN ('1d7bf448-ceac-4215-917d-45ff13678104','fb1e866c-e90a-4e25-a146-f68d660a0be8') GROUP BY 1"
```
Interpretation: non-deleted counts become the **per-tenant pass criteria** in §8 (expected ≈82 / ≈26; any delta is documented, not "fixed").

**Q2 — settles A3: org/positions/contracts/skills volume per tenant.**
```bash
LEG "SELECT 'org_units', tenant_id, count(*) FROM org_units WHERE tenant_id IN ('1d7bf448-ceac-4215-917d-45ff13678104','fb1e866c-e90a-4e25-a146-f68d660a0be8') AND deleted_at IS NULL GROUP BY 2
     UNION ALL SELECT 'employee_contracts', tenant_id, count(*) FROM employee_contracts WHERE tenant_id IN ('1d7bf448-ceac-4215-917d-45ff13678104','fb1e866c-e90a-4e25-a146-f68d660a0be8') GROUP BY 2
     UNION ALL SELECT 'employee_skills', tenant_id, count(*) FROM employee_skills WHERE tenant_id IN ('1d7bf448-ceac-4215-917d-45ff13678104','fb1e866c-e90a-4e25-a146-f68d660a0be8') GROUP BY 2"
```
Interpretation: fills the expected-rows table for §8. 0 org_units for a tenant → Fork F6 (skeleton needed).

**Q3 — MASTER-FORK EVIDENCE: process mismatch, quantified.**
```bash
LEG "SELECT COALESCE(substring(process_code from '^BP-[A-Z]+'), 'BP-<numeric>') AS family, count(*) FROM business_processes GROUP BY 1 ORDER BY 1"
LEG "SELECT process_code, name FROM business_processes WHERE process_code !~ '^BP-[0-9]'"
```
Interpretation: counts SF-/EN-/other-prefixed legacy processes vs numeric banking ones. **These numbers go verbatim into the Master-Fork evidence table.** Expected from seed 53 (F7): 11 banking + 7 EN + 7 SF among KPI-bearing processes; a live total above 25 means non-KPI-bearing processes exist — count them, they are still Master-Fork input.

**Q4 — settles A6: reusable industry variants.**
```bash
LEG "\d blueprint_templates"
LEG "SELECT * FROM blueprint_templates LIMIT 20"
```
(Columns first; adapt.) Interpretation: food/green variants present → Route A cost drops (import, not author). Absent → Route A authors from zero.

**Q5 — MASTER-FORK EVIDENCE: KPI mismatch, quantified.**
```bash
ADV "SELECT CASE WHEN kpi_definition_code ~ '^BP-SF' THEN 'SF' WHEN kpi_definition_code ~ '^BP-(EN|EC)' THEN 'EN?' WHEN kpi_definition_code ~ '^BP-' THEN 'BP-banking' ELSE 'other' END, count(*) FROM sys.sys_kpi_definitions WHERE kpi_definition_tenant_id IS NULL GROUP BY 1"
LEG "SELECT pk.kpi_code, bp.process_code FROM process_kpis pk JOIN business_processes bp ON bp.id = pk.process_id WHERE bp.process_code !~ '^BP-[0-9]' LIMIT 40"
```
Interpretation: how many of the 243 global KPI defs are already SF/EN-semantic, and which legacy KPIs hang off non-banking processes. **Master-Fork evidence.** (Regex note: alternation is grouped `'^BP-(EN|EC)'` — a `\|` form would match a literal pipe and classify EN rows as 0.)

**Q6 — settles A5: email collisions.**
```bash
LEG "SELECT lower(e.email), count(DISTINCT e.tenant_id) FROM employees e WHERE e.deleted_at IS NULL GROUP BY 1 HAVING count(DISTINCT e.tenant_id) > 1"
ADV "SELECT lower(user_email) FROM sys.sys_users"
```
Then intersect the `ADV` list with the Q1 tenant emails (`LEG` export + `comm`). Interpretation: 0 rows → clean. >0 → Fork F4 (suffix policy).

**Q7 — per-tenant KPI-target split of the 164 skipped rows.**
```bash
LEG "SELECT e.tenant_id, count(*) FROM employee_kpi_targets t JOIN employees e ON e.id = t.employee_id WHERE e.tenant_id IN ('1d7bf448-ceac-4215-917d-45ff13678104','fb1e866c-e90a-4e25-a146-f68d660a0be8') GROUP BY 1"
```
Interpretation: expected sum = 164 (F8). Feeds Route B's seed-03-extension scope.

**Q8 — employees without a `users` row (credential-less persons, ADR-0024 §2.3).**
```bash
LEG "SELECT e.tenant_id, count(*) FROM employees e LEFT JOIN users u ON u.employee_id = e.id WHERE e.deleted_at IS NULL AND e.tenant_id IN ('1d7bf448-ceac-4215-917d-45ff13678104','fb1e866c-e90a-4e25-a146-f68d660a0be8') AND u.id IS NULL GROUP BY 1"
```
Interpretation: documents how many SF/EN persons import with no credential (expected small; any number is fine — they are persons regardless).

**Q9 — live baseline re-derivation (brief: "re-derive live").**
```bash
ls db/migrations | wc -l && ls db/migrations | tail -1
ADV "SELECT count(*) FROM sys.sys_tenancies WHERE tenant_status='ACTIVE'"
pnpm typecheck && pnpm test   # green baseline; note CI job count from the latest run
```
Interpretation: next migration number = max+1. Tenancies expected = 2 (RTL_BANK, HEURESYS). Test baseline = the number every later run must not regress.

**Q10 — L1 really done on LIVE (no-redo guard).**
```bash
ADV "SELECT legacy_id, t.tenant_code FROM brownfield.tenant_id_mappings m JOIN sys.sys_tenancies t ON t.tenant_id = m.canonical_tenant_id"
ADV "SELECT count(*) FROM sys.sys_users u JOIN sys.sys_tenancies t ON t.tenant_id=u.user_tenant_id WHERE t.tenant_code='HEURESYS'"
```
Interpretation: expect `d5855519→HEURESYS`, `0c54b84a→RTL_BANK`, HEURESYS users = 4. If NOT → STOP: state drift vs SoT; flag to Enzo before any write (do not "fix" L1 yourself — it is out of scope).

**Q11 — legacy org-type domain vs v5 8-type catalog.**
```bash
LEG "SELECT DISTINCT org_type FROM org_units WHERE tenant_id IN ('1d7bf448-ceac-4215-917d-45ff13678104','fb1e866c-e90a-4e25-a146-f68d660a0be8')"
```
Interpretation: every value must map onto the D7 collapse used by `02_organization_units.sql`; unmapped value → Fork F6 counter-move (extend the CASE, preserve original in metadata).

---

## 3. COMMON MOVES (both routes) — Phases 0–2, then the per-tenant onboarding core

Legend per move: **EO** = expected observation (what you see if it worked) · **LF** = likely failure → cause it signals → **CM** = counter-move.

### Phase 0 — Orientation (read-only, Windows or VM)

**C0.1 Re-read SoT in the header order.**
EO: #17 still HOLD with residual L2/L3; no session after S1016 has touched SF/EN.
LF: SOT shows #17 moved/partially done → a later session acted → CM: diff SOT_STATE deltas, re-scope this plan to the residual only; if ambiguous, stop and report.

**C0.2 Re-derive baselines (Q9).**
EO: N migrations (max `0001NN`), 2 ACTIVE tenancies, typecheck green, full suite green at the recorded count.
LF: suite not green at baseline → pre-existing break → CM: R3 says fix it first; record it as a separate finding; do NOT stack onboarding on a red baseline.

**C0.3 Verify L1 done, live (Q10). This is the no-redo guard.**
EO: `d5855519→HEURESYS` mapping present; 4 HEURESYS users.
LF: mapping stale → live DB drifted from SoT → CM: STOP, report to Enzo (AB-6). Never re-run 000110/000111 logic blind.

### Phase 1 — Legacy recon battery (read-only)

**C1.1 Run Q0–Q11 in one SSH session; save all outputs to `qa_artifacts/wave3_l2_recon_<date>.txt`.**
EO: every query returns; SF/EN populations ≈ 82/26; process/KPI family counts land in a small table.
LF: `heuresys_platform` missing (Q0 empty) → legacy source decommissioned → CM: AB-1 path — locate legacy dump in `/home/ubuntu/dump_archive/`, restore to a scratch DB (`dr-drill.sh` pattern), re-point `LEG`; if no dump either, mission is blocked-on-Enzo.
LF2: SF/EN row counts wildly off the documented 82/26 (e.g. 0) → the S950-era numbers were mirror-based and the live legacy diverged → CM: trust the live counts, update the evidence table, continue (the mission is defined by what exists, not by the doc).

**C1.2 Build the MISMATCH EVIDENCE TABLE** (this is the deliverable that unlocks the Master Fork):

| Metric | Query | Expected (in-repo, seed 53 S994 / F7-F8) | Value (fill live) |
|---|---|---|---|
| Legacy processes, banking-numeric (`BP-0NN`) | Q3 | 11 (`BP-001..BP-011`, KPI-bearing) | _n_ |
| Legacy processes, SmartFood-prefixed (`BP-SF-*`) | Q3 | 7 (`BP-SF-001..007`) | _n_ |
| Legacy processes, EcoNova-prefixed (`BP-EN-*`) / other | Q3 | 7 (`BP-EN-001..007`) / 0 other sighted | _n_ |
| v5 global KPI defs already SF/EN-semantic | Q5 | unknown (seed 53's 0/25 CODE-overlap is processes-vs-registry, not KPI defs) | _n_ / 243 |
| Legacy KPIs hanging off non-banking processes | Q5 | unknown | _n_ / 81 |
| SF/EN employee_kpi_targets rows importable | Q7 | sum = 164 | _n_ |
| v5 process registry: banking-specific vs agnostic | F5 (static) | ~10 vs ~13 of 23 | — |

(Expected column pre-filled from `db/seeds/reconciliation/53_registry_process_kpi_templates_s994_evidence.sql:14-24` — live Q3/Q5 confirm; a live/expected delta is itself evidence, not an error.)

EO: table complete with live numbers + the `qa_artifacts` evidence file.
LF: `business_processes` column names differ from assumption (`process_code`/`name`) → schema drift vs 04_registry-era notes → CM: `LEG "\d business_processes"` first, adapt column names, re-run.

### Phase 2 — THE MASTER FORK GATE (see §6). Executor STOPS here and presents the table to Enzo. No production write happens before Enzo picks A or B.

EO: an explicit answer from Enzo: "Route A" / "Route B" (optionally with modifiers, e.g. "B now, A later").
LF: no answer → CM: park the mission exactly here; write the evidence table + this plan's state into `.handoff/STATE.md` (`blocked-on-Enzo: route A/B decision, evidence attached`); DO NOT default to either route.

### Phase 3 — Per-tenant onboarding core (identical for both routes; run for **EcoNova first**, then SmartFood; Route A inserts its taxonomy program BEFORE this phase, Route B enters directly)

> Naming below: `<T>` ∈ {`ECONOVA`, `SMARTFOOD`}; legacy UUID `<LUID>` ∈ {`fb1e866c-…`, `1d7bf448-…`}; seed dir `db/seeds/tenant-onboard-<t>/`; migration numbers `000<N>` = next-free re-derived in C0.2 (do NOT hardcode 000170 — re-derive).

**C3.0 Pre-op snapshot (D-08 discipline, manual because seeds run outside vm-deploy).**
`ssh oracle-vm-default 'sudo -u postgres pg_dump -Fc heuresys_advanced > /home/ubuntu/dump_archive/pre-17-L2-<t>_$(date -u +%Y%m%dT%H%M%SZ).dump && ls -la /home/ubuntu/dump_archive/ | tail -3'`
EO: dump file > 100 MB (prod DB was ~719 MB at S954; anything < 1 MB is a failed dump).
LF: tiny/empty dump → wrong DB name or perms → CM: fail-loud like vm-deploy.sh:100-104 — delete the bad dump, fix, re-dump; **no writes until a good snapshot exists**.

**C3.1 Extraction script: `db/seeds/tenant-onboard-<t>/00_extract_legacy_subset.sh`** — copy of `rtl-rebuild/00_extract_legacy_subset.sh` with `TENANTS='<LUID>'`, output to `db/seeds/tenant-onboard-<t>/extracted/` (regenerable, must be gitignored — **but it is NOT yet**: `.gitignore:35` covers only the literal path `db/seeds/rtl-rebuild/extracted/`). **First action of C3.1: append `db/seeds/tenant-onboard-*/extracted/` to `.gitignore` (commit it with the seeds). Verify with `git status --ignored db/seeds/tenant-onboard-<t>/extracted/` before C3.6** — otherwise the C3.6 `git add` commits the extraction CSVs (names, addresses, phones, and if F7's trim is fumbled, iban/swift columns), violating the repo's never-commit convention for extraction payloads. Keep the `deleted_at IS NULL` filter. Trim the column list per Fork F7 (default: DROP `iban,swift_bic,bank_name` unless the compensation seed is in scope).
EO: CSVs with header rows; `wc -l` matches Q1/Q2 counts (+1 header).
LF: 0-row CSV for a table Q2 said is populated → tenant filter typo (UUID) → CM: echo the exact `\copy` SQL, verify UUID against Q1 output, re-extract.

**C3.2 Migration `000<N>_onboard_<t>_tenant.sql`** (chain-safe by design):
1. INSERT `sys.sys_tenancies` (tenant_code `<T>`, industry code per route: B → real industry code e.g. `FOOD_BEV` / `ENERGY_GREEN` as **tenant attribute** regardless of taxonomy route; size_band: **EcoNova = `S`, SmartFood = `M`** — matches the legacy inventory classification (SmartFood "50-150 MEDIUM", EcoNova "10-50 SMALL", `cowork_reserved/01_DB_PLATFORM_INVENTORY.md:86-87`; the CHECK allows both, `000003:38`), `ON CONFLICT (tenant_code) DO NOTHING` via the unique index / `WHERE NOT EXISTS`.
2. INSERT `brownfield.tenant_id_mappings (<LUID> → tenant by code JOIN)` — exactly the 000110 pattern (`WHERE … IS DISTINCT FROM` guard for re-point, `NOT EXISTS` for insert).
3. NO data asserts on seed-populated tables (D-46/D-38: a fresh rebuild runs this file with zero seeded users — assert only what this file owns, i.e. the tenancy row + mapping row).
4. NO new `sys.*` tables are created by this mission's default path → no registry rows needed. **IF any route/fix creates a new `sys.*` table, its registry INSERT goes in the SAME migration file, before any assert** (D-22, F12).
EO: `pnpm db:migrate` ×2 → BOTH runs print `OK: N migrations applied.` with no error (migrate.sh re-applies all files; the ×2 proof is that the second pass makes zero data changes — see V2 pass shape); `sys_tenancies` now 3 (then 4) ACTIVE.
LF: chain breaks at an EARLIER migration on the ×2 replay → you inherited a D-12/D-38-class regression → CM: R3 — fix the earlier assert by owned-codes scoping (precedent: D-38 fix in 000078), never `--no-verify`-style bypass, never renumber.

**C3.3 Seeds 01–06 (copy rtl-rebuild patterns, tenant-scoped):**
- `01_org_units.sql` — staging `staging.<t>_org_units` + D7 org-type collapse (Q11-verified CASE), parents second-pass via `*_metadata->>'legacy_ou_id'`.
- `02_positions.sql` — D1 pattern: one position per employee from `employees.position_id × org_unit_id` (verify live whether SF/EN employees carry `position_id`; if NULL-heavy → Fork F6).
- `03_users.sql` — persons keyed `LEGACY_EMP::<employees.id>` (I14), `user_type='STANDARD'` (not SYNTHETIC_REFERENCE — retired, F11), tenant by code JOIN, `WHERE NOT EXISTS` on external code.
- `04_assignments.sql` — PRIMARY ACTIVE assignment per user; at most 1 (guard: the view `sys.v_active_primary_assignment_per_user` must stay at 0 violations).
- `05_skills_certs.sql` — employee_skills → skill evidence via ESCO uri / custom names (rtl-rebuild 06 pattern).
- `06_rbac.sql` — role grants: all persons → `USER` on their tenant (000111 §2 pattern); **exactly 2 login personas per tenant** (Fork F5 default): 1 `TENANT_ADMIN` + 1 `MANAGER`, LOCAL identity + ARGON2ID standard demo-password literal (copy the exact literal from 000111 — it is idempotency-stable); everyone else credential-less (ADR-0024 §2.3).
EO per seed: first run `INSERT <n>` matching Q1/Q2 counts; **second run `INSERT 0 0` everywhere** (twice-run proof); doctrine test still green.
LF: FK failure on `org_unit parent` → parent ordering → CM: two-pass resolve via metadata key (pattern already in rtl-rebuild/02).
LF2: UQ violation on `(tenant, lower(email))` → collision Q6 missed → CM: Fork F4.
LF3: doctrine test red (`LEGACY:%` keys appear) → a seed copied the deprecated key from an old file → CM: grep the new seeds for `'LEGACY:' ||` — must be zero; only `LEGACY_EMP::`.

**C3.4 Route-specific skill/KPI/process mapping step — see §4/§5 (this is the only phase-3 slot where A and B differ).**

**C3.5 Verification battery (§8) for `<T>`.** All green before touching the next tenant.

> **STALE-CENSUS-ASSERT RULE (mandatory triage — do NOT treat these as import defects).** The existing suite hardcodes the PRE-import global census; it goes red the moment `<T>`'s users/OUs/positions land, and that red is CORRECT behaviour of stale asserts, not an import failure. KNOWN census asserts to update **in the same commit as each tenant's seeds** (re-derive expected values live, or scope them to RTL_BANK): `apps/api/test/analytics.integration.test.ts:81,88` (`totalHeadcount`/`ouSum` `toBe(162)`, PLATFORM scope so new-tenant users count), `apps/api/test/analytics-export.integration.test.ts:114` (`toBe(162)`), `apps/api/test/reconciliation-org-unit-kpi-templates.integration.test.ts:118-121` (unscoped `count(*)`: org_units `toBe(26)`, positions `toBe(162)`, teams `toBe(24)`). Before V5 run:
> ```bash
> grep -rn "toBe(162)\|toBe(26)\|toBe(24)\|toBe(158)" apps/api/test/
> ```
> and triage EVERY hit: a **global-census literal** is a stale assert → update it (R3); a **tenant-scoped** literal must NOT have moved — if it did, that IS an import defect → AB-7. **A V5 failure in this named list is NOT an AB-3/AB-7 trigger.** Rolling back a correct import to keep the suite green — or "fixing" the import to keep 162 — is the failure mode this rule exists to prevent.

**C3.6 Deploy + LIVE check.** Commit (repo hygiene: seeds + migration + `.gitignore` line from C3.1 + updated census asserts from C3.5 + docs — first verify `git status --ignored db/seeds/tenant-onboard-<t>/extracted/` shows the CSVs ignored), push, `scripts/vm-deploy.sh` (its own pre-deploy snapshot fires — that's the SECOND net), then LIVE login per §8.V6.
**Push authorization (per-session rule):** request push+deploy authorization **in the same exchange where Enzo answers the Master Fork**; record it in the session log. No `git push` without it (repo rule: per-session authorization, CLAUDE.md Autonomia operativa).
EO: deploy green (vm-deploy's own on-box `http://localhost:$API_PORT/readyz` check passes), `https://www.heuresys.com/api/readyz` OK (NOT bare `/readyz` — nginx routes everything to Next, which rewrites only `/api/:path*` to the API; bare `/readyz` on www is a 404), login works.
LF: deploy migrate step fails on the VM but passed locally → env drift (D-46 class: local DB had seed data the fresh chain lacks) → CM: rollback = restore snapshot (§9), fix the migration to own its asserts, redeploy.

**C3.7 Repeat C3.0→C3.6 for SmartFood** (fresh snapshot first — C3.0 is per-tenant, not once).
EO: same battery green at SmartFood scale (~82 users).
LF: anything that worked for EcoNova fails at 3× scale → volume-sensitive step (lock contention unlikely at 82 rows; more likely data-quality variance) → CM: the failing row set is small by construction — list offending rows, decide include/exclude explicitly, document in the gap doc.

### Phase 4 — Closure (both routes)
Update `SOT_BACKLOG.md` #17 (status → per outcome), `SOT_STATE.md` delta, `.handoff/STATE.md`, `docs/brownfield/` gap doc (Route B) or taxonomy docs (Route A). Run `scripts/archive-dumps.sh` so the pre-op snapshots reach the VM archive.
EO: `handoff_lint.py` / `build_menu.py` clean if run; register block for #17 machine-parseable.
LF: forgot registry/menu format → lint fails → CM: follow the block format at SOT_BACKLOG.md:8-13 exactly.

---

## 4. ROUTE A — multi-industry taxonomy program (honest costing: a PROGRAM, not a session)

**What A really is.** Before any SF/EN onboarding, v5 grows first-class industry taxonomies: new blueprint variants + process registries + KPI sets for **food** and **green-energy**, so the two tenants land on semantically-correct catalogs instead of a banking lens. The schema is ready for this (F5: registry is variant-scoped; F15: tenants carry industry codes; F16: archetype vehicle exists) — the COST is content + governance, not schema.

### Moves (comparable depth to B)

**A1 — ADR + scope decision (with Enzo).** Author `ADR-00XX multi-industry taxonomy doctrine`: variant naming (`FOOD_PROCESSING_MEDIUM`, `GREEN_ENERGY_SMALL`?), whether industry KPI defs stay GLOBAL (tenant NULL, like the 243) or become tenant-scoped, i18n policy (IT-canonical per G-01 precedent).
EO: ACCEPTED ADR; variant codes fixed.
LF: scope creep toward "generic industry framework for all future industries" → program balloons → CM: ADR explicitly scopes to 2 industries; extension is future work.

**A2 — Harvest before authoring (Q3/Q4 driven).** Legacy `business_processes` has BOTH `BP-SF-001..007` and `BP-EN-001..007` (seed 53, F7 — Q3 confirms live); if `blueprint_templates` also has industry variants (Q4): IMPORT them (adaptation-map row 467 already classifies `business_processes` as IMPORT → `sys_blueprint_process_registry`). Migration seeds new variant rows + process registry rows (`ON CONFLICT DO NOTHING`, codes namespaced per variant — the registry PK is (variant_id, process_code), so `BP-SF-*` or re-coded `00..NN` under the new variant never collides with banking `00..22`).
EO: `SELECT count(*) FROM sys.sys_blueprint_process_registry GROUP BY variant` shows 23 banking + n food + n green.
LF: legacy SF/EN process sets are thin (e.g. 7 processes vs banking's 23) → legacy multi-industry content was a sketch → CM: that IS the finding — report to Enzo: Route A cost jumps from "import" to "author ~2×20 processes + KPIs"; re-confirm route before authoring.

**A3 — KPI sets per industry.** From Q5: legacy KPIs hanging off SF/EN processes get imported as global defs (pattern seed 01 — they may ALREADY be among the 243, in which case this is a no-op + verification). Gaps get authored (Enzo or CLI-drafted + Enzo sign-off).
EO: every food/green process has ≥1 KPI; counts documented.
LF: authored KPI codes collide with the 243 → namespace discipline → CM: prefix industry KPIs (`FOOD-KPI-*`, `GRN-KPI-*`); assert-by-owned-codes in the seeding migration.

**A4 — IT-canonical names** for all new processes/KPIs (G-01 precedent, 000156-000159 pattern: join-by-code UPDATE, only-if-differs).
EO: IT names non-English on ALL new rows (spot-query per variant/namespace; feeds V10).
LF: join-by-code misses rows (code drift between authoring and naming migration) → silent English leftovers → CM: the 000156-159 only-if-differs pattern + a count query of still-English rows must return 0 before the move closes.

**A5 — (Optional, Enzo's call) archetypes** `FOOD_REFERENCE`/`GREEN_ENERGY_REFERENCE` in `tenant-materialization/blueprints.ts` for future greenfield tenants. NOT needed for the SF/EN legacy import itself — cuttable.

**A6 — Then run Phase 3 (common core)** with C3.4 = link imported org-units/positions/KPI-targets to the **industry** variant's processes/KPIs; tenant industry codes point at the new variants.

### Honest cost (Route A)
| Block | Estimate |
|---|---|
| A1 ADR + decisions | 0.5–1 session (needs Enzo synchronously) |
| A2 process harvest/author ×2 industries | 1–2 sessions if harvestable (Q3/Q4 rich); **2–4 sessions if authored from zero** |
| A3+A4 KPI sets + i18n ×2 | 1–2 sessions |
| A5 archetypes (optional) | 0.5–1 session |
| A6 onboarding core (Phase 3, both tenants) | 1–1.5 sessions |
| **Total** | **4–8 dedicated sessions (~25–50 h)** before the last verification runs green. Plus a standing maintenance cost: every future taxonomy change ×3 industries. |

**Route A risks:** content authority (who validates a food-industry process taxonomy? Enzo — repeated sign-off latency); i18n parity debt; the "reference tenant" GTM story changes (3 industries to keep coherent for demos).

---

## 5. ROUTE B — single-industry reference mapping with documented gaps

**What B really is.** SF/EN onboard onto the EXISTING global catalogs (23 banking processes stay the only process registry; 243 global KPI defs). Everything structural imports identically (Phase 3 core — org, people, assignments, skills, RBAC are industry-neutral). The banking-semantic layers are handled honestly: map what maps, **document what doesn't** instead of forcing it.

### Moves

**B1 — Mapping decision table (from Q3/Q5/Q7 evidence).** Three buckets per artifact class:
- **CLEAN**: KPI codes already global (Q5: `BP-SF-*` KPIs among the 243; the 17 employee-target codes) → import SF/EN `employee_kpi_targets` (their 164-row share from Q7) as a seed-03 extension — the FK resolves today, only the user crosswalk was missing. EO: `sys_kpi_targets` grows by ~164; twice-run 0.
- **AGNOSTIC-FIT**: org-level links to the ~13 industry-agnostic processes (00, 10-12, 14-22) where legacy data implies them → optional `sys_organization_unit_processes` links (000121 table; #5 RACI is a SEPARATE backlog item — do NOT wander into it; link only what the legacy data states, or nothing).
- **GAP**: banking-only processes (KYC/AML, credito, tesoreria…) get NO SF/EN links; SF/EN-specific semantics that have no v5 home are LISTED, not shoehorned.

**B2 — The gap document (the deliverable that makes B honest):** `docs/brownfield/MULTI_INDUSTRY_SEMANTIC_GAPS.md` — per tenant: what was mapped (counts + code lists), what was not and why, what Route A would have to add. This doubles as the pre-work for a future Route A.
EO: doc exists, numbers cross-check with the §8 verification counts; SOT_BACKLOG #17 note links it.
LF: gap doc drifts into opinion ("v5 should…") → CM: facts + counts only; product commentary belongs to Enzo.

**B3 — Reference-tenant labelling.** `tenant_metadata` gets `{"reference_scope":"single-industry-mapped","taxonomy":"REGIONAL_RETAIL_BANK_MEDIUM","gaps_doc":"docs/brownfield/MULTI_INDUSTRY_SEMANTIC_GAPS.md"}` so no future session (or demo viewer) mistakes SF/EN for fully-modelled industry tenants.
EO: keys readable via `SELECT tenant_metadata FROM sys.sys_tenancies WHERE tenant_code='<T>'`.
LF: jsonb assignment overwrites existing `tenant_metadata` keys → CM: use the `||` merge operator (`tenant_metadata = tenant_metadata || '<new keys>'::jsonb`), never plain assignment.

**B4 — Run Phase 3 core** with C3.4 = B1's CLEAN bucket only.

### Honest cost (Route B)
| Block | Estimate |
|---|---|
| B1 mapping table (from Phase-1 evidence) | 1–2 h |
| Phase 3 EcoNova pilot end-to-end | 0.5–1 session |
| Phase 3 SmartFood | 0.5 session |
| B2 gap doc + closure | 1–2 h |
| **Total** | **1.5–2.5 sessions (~10–16 h)** |

**Route B risks:** the tenants are semantically "wearing a banking suit" — dashboards/process pages show banking taxonomy to a food company (mitigated by B3 labelling + B2 doc); if Enzo later picks A, the B import is NOT wasted (people/org/skills carry over; only the taxonomy links re-point) — state this explicitly in the gap doc.

---

## 6. THE MASTER FORK

**Fork M — Route A vs Route B.**
**Trigger**: Enzo's explicit strategy decision at Phase 2, informed by the Mismatch Evidence Table (C1.2). This is `{kind: manual}` per the backlog register — the executor NEVER pre-decides, NEVER defaults.

Decision-support framing the executor presents WITH the table (framing, not a recommendation):
- If Q3/Q5 show the legacy already contains substantial SF/EN process+KPI content (say ≥15 processes and ≥20 KPIs per industry harvestable) → Route A's cost floor is the "import" scenario (4–5 sessions).
- If Q3/Q5 show thin non-banking content (≤7 processes, few KPIs) → Route A means authoring taxonomies from zero (6–8 sessions) and Route B's gap doc becomes the cheap way to scope that future program. (In-repo evidence already points here: seed 53 measured exactly 7 KPI-bearing processes per non-banking industry — F7. Q3/Q5 confirm live before the table is presented.)
- Either way: **Route B first is never wasted** (org/people/skill import is route-invariant), and "B now + A later" is a valid Enzo answer this plan supports (B4's links are re-pointable).

**Observable trigger conditions:**
- Enzo says "A" → execute §4 then Phase 3.
- Enzo says "B" → execute §5 (Phase 3 with C3.4=B1).
- Enzo says "B now, A later" → §5 + file the A program as a new backlog item with the evidence table attached.
- No answer → park per Phase-2 LF (blocked-on-Enzo), zero writes.

---

## 7. OTHER FORKS (trigger → route)

| # | Fork | Trigger (observable) | Route |
|---|---|---|---|
| **F1** | Legacy DB location | Q0: native row present | proceed with `LEG` as written |
| | | Q0: only Docker container | rewrite `LEG` as `docker exec <container> psql -U <user> -d heuresys_platform -At -c`; everything else unchanged |
| | | Q0: neither | AB-1 → restore legacy dump from `/home/ubuntu/dump_archive/` to scratch DB; if no dump: blocked-on-Enzo |
| **F2** | Soft-deleted employees | Q1: deleted counts > 0 and Enzo has not spoken | default EXCLUDE (`deleted_at IS NULL`, rtl-rebuild precedent); list the excluded persons in the gap/closure doc; import-despite-soft-delete is an Enzo-only override (000111 precedent shows the shape if granted) |
| **F3** | Import mechanics | always | **direct seeds + migrations (rtl-rebuild pattern)** — chosen at wargame time, rationale: proven twice (S950 RTL, S958 reconciliation), whereas the brownfield wave-executor path requires Wave-2 machinery whose completion is not verifiable from SoT. Only flip to wave-executor if Enzo explicitly orders it (it buys audit-trail UI, costs a full runner rebuild per stale F11) |
| **F4** | Email collision | C3.3 LF2 or Q6 > 0 rows | suffix policy: keep employee email as `user_email` when unique per `(tenant, lower(email))`; on cross-tenant duplicates nothing breaks (UQ is tenant-scoped) — only a TRUE same-tenant dup or a collision with an existing v5 email forces `local-part+<t>@domain`; document each rename |
| **F5** | Credentials for imported persons | always (default) vs Enzo modifier | default: 2 login personas per tenant (TENANT_ADMIN + MANAGER, standard demo password literal from 000111), everyone else credential-less. If Enzo wants all-login (RTL parity): extend 06_rbac with the same literal — cost minutes, decision his |
| **F6** | SF/EN org/position source too thin | Q2: org_units = 0, or Q11 unmappable types, or `employees.position_id` NULL-rate > 50% | org: derive minimal OU skeleton from `employees.department` distinct values (metadata-flagged `derived:true`); positions: D1 fallback = one position per employee named from `job_title`, org-unit from department skeleton. Both stay idempotent; flag prominently in gap doc |
| **F7** | PII-class columns (iban/swift/bank, emergency contacts) | always (default) vs compensation-in-scope | default: DROP from extraction (F18) — person+org+skills+KPI-targets need none of them. If Enzo puts compensation in scope: follow rtl-rebuild/05 exactly (it is the governed precedent) |
| **F8** | Legacy schema drift vs assumed columns | any `\copy`/`\d` mismatch during C3.1 | `\d <table>` first, adapt SELECT list, note drift in closure doc; if a whole assumed table is missing → treat its seed as N/A (honest-zero precedent: rtl-rebuild 12 `sys_user_learning_evidence` 0 rows) |
| **F9** | MFA policy for new tenants | first LIVE login of `<T>` admin persona prompts MFA enrollment vs not | either observation is fine; if mandatory-MFA is tenant-scoped (HEURESYS has it, S984) the new tenants likely default OFF → verify login completes; if a global mandatory-MFA blocks the smoke login → enroll TOTP for the persona during the LIVE check (do NOT disable MFA) |

---

## 8. VERIFICATION RUNS (per tenant, in this order; ALL must pass before the next tenant / before closure)

Run after C3.3+C3.4, again after deploy (C3.6). `<T>`, expected `N_users` = Q1 live count (≈26 EcoNova / ≈82 SmartFood).

| # | Run | Command | PASS looks like |
|---|---|---|---|
| **V1** | Twice-run seeds | re-run every `db/seeds/tenant-onboard-<t>/*.sql` a second time | every INSERT reports `INSERT 0 0`; `UPDATE 0`; no error (D-12 empty-diff) |
| **V2** | Migrate chain ×2 | `pnpm db:migrate` twice (local), then on VM via deploy | local `pnpm db:migrate` ×2: BOTH runs print `OK: N migrations applied.` exit 0 with no error at any earlier file (`migrate.sh` re-applies ALL files every run — the ×2 proof is **idempotency, not skipping**; "pending" vocabulary belongs to `migrate-if-pending.sh`, which runs only inside vm-deploy); on the VM, vm-deploy's migrate-if-pending step reports the new file(s) on deploy 1 and nothing pending on deploy 2 (V8). **No earlier migration trips** on either run |
| **V3** | Population census | `ADV`: `SELECT count(*) FROM sys.sys_users u JOIN sys.sys_tenancies t ON t.tenant_id=u.user_tenant_id WHERE t.tenant_code='<T>'`; same for org_units, positions, assignments, kpi_targets | users = N_users (exact, from Q1); org_units/positions/targets = Q2/Q7 counts (exact or documented delta); assignments ≥ users with 0 rows in `sys.v_active_primary_assignment_per_user` (violations view) |
| **V4** | Keying doctrine | `ADV "SELECT count(*) FROM sys.sys_users WHERE user_external_code LIKE 'LEGACY:%' AND user_external_code NOT LIKE 'LEGACY_EMP::%'"` + run `apps/api/test/employee-centric-doctrine.integration.test.ts` | query = 0; test file green |
| **V5** | Full gates | `pnpm typecheck` · full API suite · Playwright · CI — **run the C3.5 stale-census-assert triage FIRST** (grep + per-hit classification) | typecheck 0 err; suite ≥ C0.2 baseline with **0 fail AFTER the C3.5 triage** — a failure in the C3.5 named census-assert list is a stale assert to update in the same commit (R3), NOT an import defect and NOT an AB-3/AB-7 trigger; a moved *tenant-scoped* literal IS an import defect → AB-7; CI all jobs green (count re-derived at C0.2, 6-7) |
| **V6** | LIVE per-tenant smoke (I15/DoD: real login, real data) | www.heuresys.com: login as `<t>` TENANT_ADMIN persona → `/dashboard`, `/users` (shows N_users rows), `/organization/org-chart` (tenant OUs render; bare `/org-chart` does not exist — ESS variant is `/me/org-chart`), `/me/profile` | pages 200, data belongs to `<T>` only; evidence = screenshot/curl + timestamp (R5) |
| **V7** | Tenant isolation (I5) | logged in as `federica.marchetti@rtl-bank.org`: `/users` list + a direct `GET /v1/users/<econova_user_id>` | RTL admin sees ZERO `<T>` rows; cross-tenant direct GET → 403/404. **Any leak = AB-4, instant abort** |
| **V8** | Idempotent re-deploy | second `vm-deploy.sh` run | green, 0 pending migrations, services active |
| **V9** | Route-B only: gap-doc cross-check | counts in `MULTI_INDUSTRY_SEMANTIC_GAPS.md` vs V3 census | numbers agree; every unmapped legacy artifact class appears in the doc |
| **V10** | Route-A only: taxonomy census | `ADV`: process count per variant; KPI count per industry namespace; i18n name parity | each new variant has its full process set; 0 KPI-code collisions; IT names non-English for all new rows |

---

## 9. ABORT CONDITIONS (stop, flag, do not improvise — production, ADR-0026)

| # | Condition | Action |
|---|---|---|
| **AB-1** | Legacy source unreachable (Q0 empty) AND no restorable legacy dump | STOP before any write; report blocked-on-Enzo |
| **AB-2** | Pre-op snapshot cannot be produced or is < 1 MB (C3.0) | NO writes, period. Fix the dump first |
| **AB-3** | Twice-run proof fails (V1/V2) after ONE fix attempt | restore snapshot, park, report — a non-idempotent seed in prod is worse than a late mission |
| **AB-4** | Tenant isolation leak (V7) | IMMEDIATE: restore snapshot (writes are the only possible cause — the code path didn't change); report as a potential platform bug, not a data fix |
| **AB-5** | Migration chain breaks at an EARLIER migration and the owned-codes fix is not obvious within ~30 min (R14 timebox) | restore snapshot, report the exact failing assert + file:line |
| **AB-6** | Live state contradicts SoT on L1 (C0.3) or on the 2-tenant baseline (Q9/Q10) | zero writes; state-drift report to Enzo |
| **AB-7** | V3 census off by > 10% from Q1/Q2 with no explainable row list | restore snapshot; the extraction or a JOIN is silently wrong — silent data loss is the ADR-0024 defect class this mission exists to avoid |
| **AB-8** | Any error mid-seed leaves a partial tenant (some seeds applied, later one failed twice) | do NOT hand-delete; restore snapshot (clean point-in-time), fix offline, re-run from C3.0 |

> **NOT an abort trigger**: a V5 red confined to the C3.5 named stale-census-assert list (`analytics.integration.test.ts:81,88`, `analytics-export.integration.test.ts:114`, `reconciliation-org-unit-kpi-templates.integration.test.ts:118-121`). That red means prod legitimately grew — update the asserts per the C3.5 rule (R3), do NOT invoke AB-3/AB-7. A moved **tenant-scoped** literal, by contrast, IS AB-7.

**Data-loss window rule (read BEFORE restoring):** a full restore rolls back ALL tenants to the snapshot instant, including `/v1/leads` lead-capture rows (public unauthenticated GTM endpoint) and any RTL/HEURESYS user writes in the window. Before restoring: dump the delta of `sys.sys_leads` (`\copy (SELECT * FROM sys.sys_leads WHERE created_at > '<snapshot_ts>') TO …`) for manual re-insert, note the window boundaries in the incident report, and include the data-loss window in the report to Enzo.

**Documented rollback path (the only sanctioned one):**
```bash
# on the VM — restore the pre-op snapshot taken at C3.0 (or vm-deploy's pre-deploy/ dump)
sudo systemctl stop heuresys-advanced-api heuresys-advanced-web
sudo systemctl stop 'heuresys-advanced-*.timer'   # the 4 timers' jobs (scraping/insights/backup/reindex) also hold DB sessions
sudo -u postgres psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='heuresys_advanced' AND pid <> pg_backend_pid();"   # RENAME requires ZERO other connections (incl. the PC :5433 tunnel, any psql)
sudo -u postgres psql -c "ALTER DATABASE heuresys_advanced RENAME TO heuresys_advanced_broken_$(date -u +%Y%m%dT%H%M%SZ)"   # timestamped forensic copy — a SECOND rollback attempt must not collide with an existing _broken name
sudo -u postgres createdb -O heuresys heuresys_advanced   # owner = the APP role (derive from .env POSTGRES_USER, don't hardcode) — a postgres-owned DB + --no-owner strands the heuresys role and every API query fails after a "successful" restore
sudo -u postgres pg_restore --no-owner --no-acl --role=heuresys -d heuresys_advanced < /home/ubuntu/dump_archive/pre-17-L2-<t>_<ts>.dump
#   ^ stdin redirect opened by the ubuntu shell — passing the PATH to pg_restore fails with "could not open input file: Permission denied"
#     (postgres cannot traverse /home/ubuntu 0750 — dr-drill.sh:48-53, found S993); --role=heuresys so restored objects belong to the app role
sudo systemctl start heuresys-advanced-api heuresys-advanced-web
curl -fsS https://www.heuresys.com/api/readyz   # must be OK — the API is public ONLY as /api/readyz (nginx routes all to Next; Next rewrites /api/:path* to the API; bare /readyz on www 404s). On-box equivalent: curl -fsS http://localhost:8013/readyz
sudo systemctl start 'heuresys-advanced-*.timer'   # re-enable the timers ONLY after the readyz check is green
# then re-run V3 census to confirm pre-op state; re-insert the sys_leads delta dumped above (manual, documented)
```
(Keep the renamed broken DB for forensics until the post-mortem; then drop it explicitly with Enzo's ack.)

---

## 10. RED-TEAM RECORD (point 7)

**Attack 1 — FAILED (the plan held).** *"The executor will redo L1: the mission title says Wave-3, the runner doc §0 includes Heuresys System 4 users, and POST_V1_ROADMAP §1.B still lists L1 as to-do — a blind executor follows the runner and re-imports the Heuresys persons or re-runs the d5855519 remap."* — The attack fails: C0.3/Q10 verify L1 on LIVE before any write and hard-stop on drift (AB-6); F11 explicitly demotes `wave_3_runner.md` to historical reference with a named list of the only 3 things it may be used for; the header and F1/F2 repeat "L1 DONE, do not redo" with the migration numbers. There is no step anywhere in Phases 0–4 that touches HEURESYS data.

**Attack 2 — SUCCEEDED → PATCH APPLIED.** *"Make migration `000<N>_onboard_<t>_tenant.sql` assert its outcome like a good citizen: `ASSERT (SELECT count(*) FROM sys_users JOIN tenancies … WHERE tenant_code='<T>') = 26`. Local run passes (seeds ran before the assert was written). Weeks later ANY fresh rebuild or VM chain replay explodes: on a virgin DB the chain reaches 000<N> with ZERO seeded users — the D-46 failure class exactly, and it breaks every future deploy."* — The original draft of C3.2 indeed said "assert imported counts in the migration". **Patch applied**: C3.2 rule 3 now forbids data asserts on seed-populated tables inside migrations (assert only tenancy+mapping rows the file itself owns, D-38 owned-codes doctrine); population checks moved to §8 V3 as runtime verification queries, which is where they belong. The same patch propagated a second guard: V2 explicitly runs the chain twice and watches for **earlier** migrations tripping (the D-38 precedent where 000135 broke 000078).

### Independent adversarial review 2026-07-06 (REVIEW-17, PASS-WITH-PATCHES → all patches incorporated)

An independent reviewer (did not author the plan) verified ~26 recon claims against the repo (essentially all held) and found the production-safety tail broken in ways that WOULD fire. Every finding below is now incorporated into the body of this plan:

- **C-1** — rollback `pg_restore` with a path argument fails "Permission denied" (postgres cannot traverse `/home/ubuntu`, dr-drill.sh:48-53 / S993) → §9 now feeds the dump via **stdin redirect** opened by the ubuntu shell; F13 corrected.
- **C-2** — `createdb` + `--no-owner --no-acl` (scratch-only flag set) stranded the `heuresys` app role: restore "succeeds", every API query then fails → §9 now `createdb -O heuresys` (owner from `.env` `POSTGRES_USER`) + `--role=heuresys`.
- **C-3** — V5 "0 fail" was guaranteed-unreachable post-import: three test files hardcode the pre-import global census (`analytics:81,88`, `analytics-export:114`, `reconciliation-org-unit-kpi-templates:118-121`) and no rule distinguished stale-census-assert from import defect → C3.5 stale-census-assert rule (grep + per-hit triage, update in the same commit as the seeds), V5 pass shape amended, explicit "NOT an abort trigger" note in §9.
- **M-1** — post-rollback check `https://www.heuresys.com/readyz` 404s (nginx→Next; only `/api/:path*` rewrites to the API) → §9 and C3.6 now use `/api/readyz` (on-box: `localhost:8013/readyz` / vm-deploy's own check).
- **M-2** — `ALTER DATABASE … RENAME` fails with live sessions (4 systemd timers, PC tunnel) and the old line 331 `dropdb …_$(date +%s)` was a no-op that also broke second attempts → §9 now stops the timers, `pg_terminate_backend`s remaining sessions, renames to a **timestamped** `_broken_<ts>` name, re-enables timers only after readyz.
- **M-3** — a full restore silently loses concurrent prod writes (incl. public `/v1/leads` lead capture) → §9 data-loss window rule: dump the `sys.sys_leads` delta pre-restore, report the window to Enzo.
- **M-4** — markdown-escaped `\|` inside Q0/Q5/Q9 table cells corrupted the copied commands and the Q5 regex (ERE `\|` = literal pipe → EN rows classify 0, corrupting the Master-Fork evidence) → §2 restructured: every command in a fenced code block, Q5 regex now `'^BP-(EN|EC)'`, copy-safety rule added.
- **M-5** — V2's pass shape "run 2: 0 pending" never appears in `pnpm db:migrate` output (`migrate.sh` re-applies all files, prints `OK: N migrations applied.`; "pending" is `migrate-if-pending.sh` vocabulary, vm-deploy only) → V2 pass shape rewritten (×2 = idempotency proof, not skipping).
- **M-6** — `db/seeds/tenant-onboard-*/extracted/` was NOT gitignored (`.gitignore:35` covers only the rtl-rebuild literal path); C3.6's `git add` would commit legacy person CSVs → C3.1 first action: append the gitignore line, verify with `git status --ignored` before C3.6.
- **m-1** — V6 smoke route `/org-chart` does not exist → `/organization/org-chart` (ESS: `/me/org-chart`).
- **m-2** — F12 implied the 0-UNCLASSIFIED assert lives only in 000062; ≥9 later migrations carry their own → F12 reworded (operative rule C3.2.4 unchanged and sufficient).
- **m-3** — the legacy process keyspace was already quantified in-repo (seed 53, S994: 25 KPI-bearing = 11 banking + 7 EN + 7 SF; code-overlap 0/25, name-overlap 1/25), pre-answering the Master-Fork thin-content framing → F7/A1 updated, C1.2 evidence table pre-filled with expected values, §6 framing notes it (Q3/Q5 still confirm live).
- **m-4** — C3.6 ordered a push without session authorization → push+deploy authorization requested in the same exchange as Enzo's Master-Fork answer, recorded in the session log.
- **m-5** — C3.2.1 size-band "thought out loud" → stated flat: EcoNova `S`, SmartFood `M` (legacy inventory + CHECK citations).
- **m-6** — A4 and B3 carried no EO/LF → one-line EO/LF added to each.

---

## 11. SELF-GRADE vs SUCCESS.md (8 points)

| # | Standard | Grade | Justification |
|---|---|---|---|
| 1 | Every move states expected observation | **PASS** | Every C/A/B move carries an explicit EO (counts, `INSERT 0 0`, exact query outputs, HTTP codes) — A4/B3 gaps closed post-review (m-6) |
| 2 | Every move carries likely failure + cause + counter-move | **PASS** | LF→cause→CM on every move; failure causes name the debt-class they signal (D-12/D-38/D-46/D-22); the review-found missing LF that mattered — "suite red because prod legitimately grew" — is now the C3.5 stale-census-assert rule (C-3) |
| 3 | Every fork has a trigger | **PASS** | Master fork = Enzo's manual decision with the evidence table as input (the brief mandates this NOT be pre-decided); F1–F9 have observable triggers; the fork's evidence input is now copy-safe (Q5 regex fixed, §2 fenced blocks — M-4) and pre-anchored to seed 53 expected values (m-3) |
| 4 | RECON NEEDED marked with exact settling check | **PASS** | Q0–Q11, each with the literal command in a fenced block and the interpretation rule; A1–A6 assumptions each point at their Q; A1 partly settled in-repo by seed 53 (m-3) |
| 5 | Abort conditions exist | **PASS** (post-review) | AB-1..AB-8, strict (production per ADR-0026). The originally-written rollback path would have FAILED mid-incident (path-arg pg_restore, stranded app role, live-session RENAME, wrong readyz URL, silent data-loss window) — rebuilt per C-1/C-2/M-1/M-2/M-3; the "not an abort trigger" carve-out for stale census asserts prevents a correct import being rolled back (C-3) |
| 6 | Verification runs spelled out with pass criteria | **PASS** (post-review) | V1–V10 per tenant, ordered, with exact pass shapes; V2's pass shape corrected to what `migrate.sh` actually prints (M-5), V5 gated on the C3.5 census-assert triage (C-3), V6 route corrected (m-1) |
| 7 | Survived a red-team pass, doc records failed + successful attack + patch | **PASS** | §10: L1-redo attack (failed), fresh-rebuild assert attack (succeeded → C3.2 rule 3 + V2 guard); PLUS the independent adversarial review of 2026-07-06 (3 CRITICAL / 6 MAJOR / 6 MINOR, all incorporated — §10 record). The original red team missed the rollback and census-assert attacks; the review caught them |
| 8 | Executable blind by a mid-tier model | **PASS with one bounded caveat** | The five review-verified guess-points (broken rollback, unwarned-red V5, phantom "0 pending", `\|` command corruption, unignored extraction dir) are patched with exact commands/rules. Remaining caveat: legacy column names in Q2/Q3/Q7 may drift (F8 covers it with the `\d`-first rule), so a blind run survives schema drift but produces slightly different SQL than printed |

**Overall: 8/8 — of which points 5, 6 and 8 only AFTER the 2026-07-06 adversarial-review patches (score as originally written: 6.5/8 per REVIEW-17).**

---

*End wargame 17 — written 2026-07-06 by Fable 5. Evidence base: heuresys-advanced repo read-only recon (no repo file touched, no git command run, no live DB reached from the wargame session — live checks are the executor's Phase 1).*
