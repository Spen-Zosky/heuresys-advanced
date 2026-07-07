# REVIEW-17 — Adversarial review of `wargames/17-heuresys-wave3.md`

**Reviewer**: independent adversarial pass (did not author the plan) · 2026-07-06
**Repo evidence base**: `D:\heuresys-advanced` read-only (file:line for every claim below)
**Standard**: `SUCCESS.md` (8 points) + mission brief `tasks/17-heuresys-wave3.md`

---

## VERDICT: **PASS-WITH-PATCHES**

The recon layer is exceptionally accurate — of ~25 factual claims spot-checked, essentially all verified against the repo (see §3). The plan's structure (recon battery → evidence table → Enzo-gated Master Fork → per-tenant core → verification → aborts) is sound and the brief's mandates (EcoNova first, ADR-0024 keying, no pre-deciding A/B, snapshot-gated) are all honored.

**But the production-safety tail is broken in ways that WILL fire, not might**: the sanctioned rollback procedure fails as written (two independent defects, one of which is documented as a known failure inside the repo's own `dr-drill.sh`), and the full-suite gate V5 is guaranteed red after the EcoNova import because three test files hardcode the current global census — with no counter-move distinguishing that from an import defect. A blind executor hits both. With the patches below applied verbatim, the plan is safe to hand to a blind executor.

---

## 1. FINDINGS

### CRITICAL

**C-1 · Rollback `pg_restore` fails with "Permission denied" as written (§9 rollback block, line 334).**
The plan restores with a **path argument**: `sudo -u postgres pg_restore --no-owner --no-acl -d heuresys_advanced /home/ubuntu/dump_archive/pre-17-L2-<t>_<ts>.dump`. The postgres user cannot traverse `/home/ubuntu` (0750). This exact failure is documented in the repo: `scripts/dr-drill.sh:48-53` — *"passing the path to `sudo -u postgres pg_restore <path>` … fails with 'could not open input file: Permission denied' (found S993)"* — which is why dr-drill feeds the dump **via stdin redirect**. The plan cites dr-drill.sh:53 as its restore precedent (F13) but copied the broken form. A blind executor mid-incident, with the prod DB already renamed away, gets a permission error on the one command that must not fail.
**Patch (§9, replace line 334):**
```bash
sudo -u postgres pg_restore --no-owner --no-acl --role=heuresys -d heuresys_advanced < /home/ubuntu/dump_archive/pre-17-L2-<t>_<ts>.dump
```
(stdin redirect opened by the `ubuntu` shell — dr-drill.sh:48-53 pattern; `--role` per C-2.)

**C-2 · Rollback restore strands the app role — API is permission-denied after a "successful" restore.**
`sudo -u postgres createdb heuresys_advanced` creates a **postgres-owned** DB; `--no-owner --no-acl` then leaves every restored object owned by postgres with no grants. The app connects as `heuresys` (CLAUDE.md smoke check; `db/scripts/create_local_database.sh:42,53` — `CREATE DATABASE … OWNER ${POSTGRES_USER}`). dr-drill.sh uses `--no-owner --no-acl` only because it is a **scratch** DB (its own comment, line 47: "scratch restore need not reproduce grants"). The plan promoted a scratch-only flag set to an in-place prod restore. Result: restore "succeeds", services restart, every API query fails.
**Patch (§9, replace line 333):** `sudo -u postgres createdb -O heuresys heuresys_advanced` (derive the owner from `.env` `POSTGRES_USER`, don't hardcode) and add `--role=heuresys` to pg_restore as in C-1.

**C-3 · V5 ("full suite 0 fail") is guaranteed-unreachable after the first import — three test files hardcode the pre-import global census, and the plan never warns the executor.**
Verified asserts that break the moment EcoNova's ~26 users/OUs/positions land:
- `apps/api/test/analytics.integration.test.ts:81` `expect(body.totalHeadcount).toBe(162)` and `:88` `expect(ouSum).toBe(162)` — **PLATFORM scope** (`:79-80`), so new-tenant users count.
- `apps/api/test/analytics-export.integration.test.ts:114` `expect(parsed.totalHeadcount).toBe(162)`.
- `apps/api/test/reconciliation-org-unit-kpi-templates.integration.test.ts:119-121` — **unscoped** `count(*)` asserts: org_units `toBe(26)`, positions `toBe(162)`, teams `toBe(24)`.
The plan's C0.2 LF covers a red baseline *before* work, and AB-7 covers a census *shortfall* — nothing covers "existing tests correctly went red because prod legitimately grew". A blind executor at C3.5/V5 sees 3+ red files and the nearest applicable rules are AB-3/AB-7 (restore snapshot, park) → a correct import gets rolled back, or worse, the executor "fixes" the import to keep 162.
**Patch (add to C3.5 and V5):** *"KNOWN census asserts to update in the same commit as each tenant's seeds (re-derive expected values live, or scope them to RTL_BANK): `analytics.integration.test.ts:81,88`, `analytics-export.integration.test.ts:114`, `reconciliation-org-unit-kpi-templates.integration.test.ts:118-121`. Before V5, `grep -rn "toBe(162)\|toBe(26)\|toBe(24)\|toBe(158)" apps/api/test/` and triage every hit: a global-census literal is a stale assert (update, R3), a tenant-scoped one must NOT have moved (if it did, that IS an import defect → AB-7). A V5 failure in this named list is NOT an AB-3/AB-7 trigger."*

### MAJOR

**M-1 · Post-rollback verification URL is wrong — `https://www.heuresys.com/readyz` returns 404.**
nginx routes everything to Next :3013 with **no** `/api` block (`deploy/nginx/www.heuresys.com.conf:49-61`, comment lines 16-17); Next rewrites only `/api/:path*` to the API (`apps/web/next.config.js:10-13`). The API's `/readyz` is therefore public only as **`/api/readyz`** (CLAUDE.md: "PROD `/login`+`/api/readyz`"; vm-deploy verifies `http://localhost:$API_PORT/readyz` on-box, `scripts/vm-deploy.sh:192`). The rollback's `curl -fsS …/readyz` exits non-zero → blind executor concludes the restore failed when it succeeded.
**Patch (§9 last line):** `curl -fsS https://www.heuresys.com/api/readyz` (or on the VM: `curl -fsS http://localhost:8013/readyz`). Same fix anywhere `/readyz` is cited against www (C3.6 EO is fine as written only if checked via vm-deploy's own output).

**M-2 · Rollback cannot rename the DB while sessions exist — and the plan stops only the two app services.**
`ALTER DATABASE … RENAME` requires zero other connections. Connected at any time: the four systemd **timers'** jobs (scraping/insights/backup/reindex — `vm-deploy.sh:168-170,184-187`), the PC dev tunnel (:5433), any psql. Also: line 331 (`dropdb heuresys_advanced_broken_$(date +%s)`) is a no-op that drops a DB named with the *current* timestamp — it never exists — and a **second** rollback attempt fails because `heuresys_advanced_broken` already exists.
**Patch (§9, before the RENAME):**
```bash
sudo systemctl stop 'heuresys-advanced-*.timer'
sudo -u postgres psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='heuresys_advanced' AND pid <> pg_backend_pid();"
sudo -u postgres psql -c "ALTER DATABASE heuresys_advanced RENAME TO heuresys_advanced_broken_$(date -u +%Y%m%dT%H%M%SZ)"
```
Delete the bogus line 331; re-enable the timers after the readyz check.

**M-3 · The rollback silently loses concurrent production writes and the plan never says so.**
One shared prod DB (ADR-0026): a full-DB restore to the C3.0 snapshot also rolls back everything RTL_BANK/HEURESYS users and the **public unauthenticated `/v1/leads` endpoint** (GTM lead capture, backlog #4) wrote between snapshot and restore. For the "highest-stakes plan of the batch" this window must be explicit.
**Patch (§9, add a rule):** *"A full restore rolls back ALL tenants to the snapshot instant, including `/v1/leads` lead-capture rows and any RTL/HEURESYS user writes in the window. Before restoring: dump the delta of `sys.sys_leads` (`\copy (SELECT * FROM sys.sys_leads WHERE created_at > '<snapshot_ts>') TO …`) for manual re-insert, note the window boundaries in the incident report, and include the data-loss window in the report to Enzo."*

**M-4 · Markdown-escaped pipes (`\|`) inside the Q0/Q5 command cells produce broken commands when copied from the raw file.**
The executor reads the raw `.md`. Q0 (line 77) contains `docker ps 2>/dev/null \| grep -i heuresys` — in bash, `\|` is a literal pipe **argument**, not a pipeline → `docker ps` errors. Worse, Q5 (line 82) contains the Postgres regex `'^BP-EN\|^BP-EC'` — in POSIX ERE that matches a literal `|`, so **EN rows classify as 0** and the Master-Fork evidence table (the fork's decision input!) is silently wrong.
**Patch:** move Q0-Q11 commands out of the table into fenced code blocks (or replace pipes: Q0 → two separate commands; Q5 → `kpi_definition_code ~ '^BP-(EN|EC)'` in a fenced block). Audit every table cell for `\|`.

**M-5 · V2's pass shape "run 2: '0 pending'" never appears in a `pnpm db:migrate` run.**
`db/scripts/migrate.sh` re-applies **all** files every run and prints `OK: $applied migrations applied.` (line 67; D-38's fix log: "138 migrations applied" on a re-run). "Pending" is the vocabulary of `migrate-if-pending.sh` (sha256 vs `sys.sys_schema_migrations`), which runs only inside vm-deploy (`vm-deploy.sh:111-116`). A blind executor expecting "0 pending" on the local ×2 run sees "OK: 170 migrations applied", concludes V2 failed → AB-3 → unnecessary snapshot restore.
**Patch (V2):** *"local `pnpm db:migrate` ×2: BOTH runs print `OK: N migrations applied.` exit 0 with no error at any earlier file (the ×2 proof is idempotency, not skipping); on the VM, vm-deploy's migrate-if-pending step reports the new file(s) on deploy 1 and nothing pending on deploy 2 (V8)."*

**M-6 · `db/seeds/tenant-onboard-<t>/extracted/` is NOT gitignored — C3.6's commit would push legacy person CSVs to the repo.**
C3.1 claims the new extraction dir is "gitignored, regenerable — same convention", but `.gitignore:35` covers only the literal path `db/seeds/rtl-rebuild/extracted/` (and `:24` the source_bundle one). `git add db/seeds/tenant-onboard-econova/` at C3.6 commits the CSVs — names, addresses, phone numbers, and (if F7's trim is fumbled) iban/swift columns — violating the repo's own never-commit convention for extraction payloads.
**Patch (C3.1):** *"First action of C3.1: append `db/seeds/tenant-onboard-*/extracted/` to `.gitignore` (commit it with the seeds). Verify with `git status --ignored db/seeds/tenant-onboard-<t>/extracted/` before C3.6."*

### MINOR

**m-1 · V6 smoke route `/org-chart` does not exist.** Actual admin route: `/organization/org-chart` (`apps/web/src/app/(authenticated)/organization/org-chart/page.tsx`); ESS: `/me/org-chart`. `/users`, `/dashboard`, `/me/profile` all verified. Patch V6: `/organization/org-chart`.

**m-2 · F12 implies the 0-UNCLASSIFIED assert lives only in 000062.** At least nine later migrations carry their own assert (`000064:136`, `000081:115`, `000082:89`, `000086:215`, `000092:108`, `000100:94`, `000102`, `000103:122`, `000105:85`). The plan's operative rule (C3.2.4: register in the SAME file) is correct and sufficient; fix F12's wording so the executor doesn't reason from a single assert point.

**m-3 · Recon gap: the legacy process keyspace is ALREADY quantified in-repo, and it pre-answers the Master-Fork framing.** `db/seeds/reconciliation/53_registry_process_kpi_templates_s994_evidence.sql:14-24` (live-measured S994): 25 KPI-bearing legacy processes = `BP-001..BP-011` (banking) + **`BP-EN-001..007` (energy)** + `BP-SF-001..007` (food); CODE-overlap with v5 registry **0/25**, exact name-overlap **1/25**. So (a) A1's "only BP-SF positively sighted" is stale — BP-EN is sighted too; (b) at 7 processes/industry the plan's own framing threshold ("≤7 → Route A = author-from-zero, 6-8 sessions") is already met before Q3 runs. Patch: cite seed 53 in F7 and pre-fill the evidence table's "expected" column with these numbers (Q3/Q5 still run to confirm live).

**m-4 · Push without session authorization.** C3.6 orders commit+push, but the repo rule is "Never `git push` without an explicit ask" with per-session authorization (CLAUDE.md, Autonomia operativa). Patch: *"Request push+deploy authorization in the same exchange where Enzo answers the Master Fork; record it in the session log."*

**m-5 · C3.2.1's size-band text thinks out loud** ("size_band `S` for EcoNova, `M`? no — 82 emp → `S`/`M` judgement…"). State it flat: EcoNova=`S`, SmartFood=`M` (matches legacy inventory: SmartFood "50-150 MEDIUM", EcoNova "10-50 SMALL" — `cowork_reserved/01_DB_PLATFORM_INVENTORY.md:86-87`; CHECK allows both, `000003:38`).

**m-6 · A4 and B3 carry no EO/LF** (SUCCESS points 1-2 strictness). Add one-line EO/LF each (A4: EO = IT names non-English on all new rows, LF = join-by-code misses → 000156-159 only-if-differs pattern; B3: EO = `tenant_metadata` keys readable via `SELECT tenant_metadata FROM sys.sys_tenancies WHERE tenant_code='<T>'`, LF = jsonb overwrite of existing keys → use `||` merge).

---

## 2. SUCCESS.md — independent 8-point grade

| # | Standard | Grade | Evidence |
|---|---|---|---|
| 1 | Every move states its expected observation | **PASS** (marginal) | EO on all C/A/B moves; A4 and B3 lack one (m-6) |
| 2 | Every move: likely failure + cause + counter-move | **PASS** (marginal) | LF→cause→CM systematically present, failure causes correctly name debt classes (verified D-12/D-22/D-38/D-46 against DEBT_REGISTER); A4/B3 gaps (m-6); the one *missing* LF that matters is C3.5/V5's "suite red because prod legitimately grew" (C-3) |
| 3 | Every fork has a trigger, no judgment calls left | **PASS with patch** | Master Fork = Enzo's manual decision is brief-mandated, not an evasion; F1–F9 triggers observable; BUT Q5's `\|` regex bug silently corrupts the fork's evidence input (M-4) — decidability restored by the patch |
| 4 | RECON NEEDED marked with exact settling check | **PASS** | Q0–Q11 exemplary: literal commands + interpretation rules; A1–A6 each mapped to a Q; m-3 shows one question was partly answerable from the repo, which weakens efficiency, not compliance |
| 5 | Abort conditions exist | **PASS with patches** | AB-1..AB-8 are well-chosen and strict; but the attached "only sanctioned rollback path" fails as written (C-1, C-2, M-1, M-2) and hides a data-loss window (M-3) — an abort that lands in a broken rollback is worse than no abort |
| 6 | Verification spelled out with pass criteria | **PARTIAL → PASS after patches** | V1–V10 ordered per tenant with pass shapes; V2's shape is factually wrong (M-5), V5's "0 fail" unattainable-unwarned (C-3), V6 cites a nonexistent route (m-1) |
| 7 | Survived a red-team pass; doc records failed + successful attack + patch | **PASS** | §10 records both, and the successful attack (fresh-rebuild assert, D-46 class) produced a real patch (C3.2.3/V2 guard) that I verified is doctrinally correct against 000062/D-22/D-38. The red team missed the rollback and census-assert attacks — but the standard requires a recorded pass, not omniscience |
| 8 | Executable blind by a mid-tier model | **FAIL as written → PASS after patches** | Five verified guess-points: broken rollback recovery (C-1/C-2/M-1/M-2), red V5 with no rule (C-3), "0 pending" that never prints (M-5), `\|` command corruption (M-4), unignored extraction dir (M-6). Each has an exact patch above; none is structural |

**Score as written: 6.5/8. After the patches in §1: 8/8.**

---

## 3. CLAIMS SPOT-CHECKED (26)

| # | Claim (plan ref) | Outcome |
|---|---|---|
| 1 | F1 — `SOT_BACKLOG.md:30-33`: #17 HOLD, L1 done S987/S988, trigger `{kind: manual}` | **VERIFIED** (exact lines) |
| 2 | F1 — `SOT_STATE.md:120` confirms L1, 4 users/4 pos/3 OU | **VERIFIED** |
| 3 | F2 — 000110: guarded UPDATE, `IS DISTINCT FROM`, tenant by code JOIN | **VERIFIED** (lines 16-22) |
| 4 | F2 — 000111: `LEGACY_EMP::`, `WHERE NOT EXISTS` everywhere, no BEGIN/COMMIT (psql -1 note line 18), stable ARGON2ID literal (line 80), non-aborting `RAISE NOTICE` (93-110), USER grant, LOCAL identity, HEURESYS mandatory-MFA note (73-75) | **VERIFIED** (all eight details) |
| 5 | F3 — SmartFood `1d7bf448-ceac-4215-917d-45ff13678104`, EcoNova `fb1e866c-e90a-4e25-a146-f68d660a0be8`, intentionally not mapped | **VERIFIED** (`000033:65-82`, `000047:30-34`; plan's ":70-87" is off by a few lines, content correct) |
| 6 | F4 — `SOT_STATE.md:613`: 000047 dropped legacy_mirror (115 tables, SF 82 + EN 26) | **VERIFIED** |
| 7 | F5 — `000021:137-168`: 23 processes `00`-`22` under `REGIONAL_RETAIL_BANK_MEDIUM`; "catalogo GLOBALE non tenant-scoped" | **VERIFIED** (actual 137-166) |
| 8 | F6 — 243 = 81+45+100+17 (`02_kpi_catalog_unification.sql:78`) | **VERIFIED** (exact line) |
| 9 | F7 — `BP-SF-007` keyspace note in `04_registry.sql`; ADAPTATION_MAP `:467` "per industry prototype", `:477` "per industry family" | **VERIFIED** (exact lines) |
| 10 | F8 — 82/26 employees (`BROWNFIELD_IMPORT_PLAN.md:298`) | **VERIFIED** |
| 11 | F8 — 412→248/164 kpi_targets (`03_kpi_targets.sql`) | **VERIFIED** (lines 8-11 vs cited 9-11) |
| 12 | F8 — 4 SmartFood career_paths (`05:15`), 8 SF+EN bonus_pools (`08:15`), RTL 32 OU / HEU 8 OU (rtl-rebuild README) | **VERIFIED** (all three) |
| 13 | F9 — `employee-centric-doctrine.integration.test.ts` exists | **VERIFIED** |
| 14 | F10 — extract script: `TENANTS` param lines 12-14, `deleted_at IS NULL`, extracted/ gitignored for rtl-rebuild | **VERIFIED** |
| 15 | F11 — `wave_3_runner.md` exists; §10.2 PII blacklist (line 474-476), §7.3 email collisions (365-367), §6.1 rollback (307-309) | **VERIFIED** |
| 16 | F12 — 000062 `RAISE EXCEPTION` 0-UNCLASSIFIED; D-22 text (`DEBT_REGISTER.md:33`) "must live inside 000062, later fix does NOT survive fresh rebuild" | **VERIFIED** (assert at 000062:46-47 vs cited 45-47) — but see m-2 (not the only assert point) |
| 17 | F13 — `vm-deploy.sh:85-107` pg_dump -Fc pre-migrate, fail-loud, retention 10; services at :160-184 | **VERIFIED** |
| 18 | F13 — `dr-drill.sh:53` restore pattern | **VERIFIED as citation — REFUTES the plan's own rollback form** (scratch-DB only; stdin-redirect required; --no-owner/--no-acl explicitly scratch-only) |
| 19 | F14 — native legacy access (`01_kpi_definitions.sql:6-16`, `DATA_RECONCILIATION_PLAN.md:108`) | **VERIFIED** (both exact) |
| 20 | F15 — 000003: `tenant_industry_code varchar(64)` no value-CHECK, size_band CHECK {XS,S,M,L,XL}, tenant_code UNIQUE, tenant_metadata jsonb | **VERIFIED** (lines 19-20, 38, 40-41 — `FOOD_BEV`/`ENERGY_GREEN` are constraint-safe) |
| 21 | F16 — tenant-materialization module, `RETAIL_BANK_REFERENCE` archetype, RBR-* namespace | **VERIFIED** (`blueprints.ts:52-61`) |
| 22 | F17 — 167 migration files, max `000169` | **VERIFIED** (glob count 167; tail 000169; 000170 free) |
| 23 | C3.3/V3 — `sys.v_active_primary_assignment_per_user` is a violations view (expect 0 rows) | **VERIFIED** (`000023:76-82`, `HAVING count(*) > 1`) |
| 24 | B1 — `sys_organization_unit_processes` from 000121 | **VERIFIED** (`000121_organization_unit_processes.sql`) |
| 25 | Personas — federica.marchetti TENANT_ADMIN / paolo.caputo MANAGER (`seed-test-admin.ts`) | **VERIFIED** (lines 16-17) |
| 26 | C3.2 LF CM — D-38 precedent "000135 broke 000078", fix = assert-by-owned-codes | **VERIFIED** (`DEBT_REGISTER.md:48`) |

**Refuted / materially wrong** (each is a finding above): rollback executable-as-written (C-1/C-2/M-1/M-2) · V2 "0 pending" (M-5, `migrate.sh:67`) · tenant-onboard extracted "gitignored, same convention" (M-6, `.gitignore:35`) · V6 `/org-chart` (m-1) · "only BP-SF positively sighted" (m-3, seed 53).

**Production-safety walkthrough results** (attack items from the review order):
- *Partial import crash mid-seed* → AB-8 + snapshot: sound (given C-1/C-2/M-2 patches).
- *Idempotency re-run* → V1/V2 + 000110/000111 patterns: sound; V2 wording patched (M-5).
- *Fresh-rebuild chain break (D-22 class)* → C3.2.3/.4 is the correct doctrine (verified against 000062's own S982 amendment comment); default path creates no new `sys.*` table, so no registry row is needed; the assert-point mapping is imprecise but harmless (m-2).
- *000047 collision* → NO conflict: 000047 deletes only `RTL_BANK_REFERENCE` + the SF/EN **mappings**; the new migration is later in the chain, so on any replay 000047's DELETE runs first and the new tenancy+mapping INSERTs re-land. Verified 000047 full text.
- *RBAC lockout* → C3.3/06_rbac grants USER + 2 personas per 000111 pattern; RBAC cache is a server-start load, and vm-deploy restarts the API → new grants live. Sound.
- *Rollback* → broken as written (C-1, C-2, M-1, M-2) + unstated data-loss window (M-3).
- *Fork decidability* → genuinely decidable; the only pre-decision left to the executor is none (Enzo-gated per brief); Q5 evidence corruption patched (M-4); seed 53 pre-answers the thin-content scenario (m-3).

---

## 4. Bottom line

Structurally this is the best-evidenced plan of the batch — the recon findings survive verification at a rate I rarely see. Its failures cluster where the wargame stopped simulating: everything after "restore snapshot" was written from memory instead of from the repo, and the post-import blast radius on the *existing* test suite was never walked. Apply C-1..C-3 and M-1..M-6 verbatim (m-1..m-6 recommended), then hand it to the executor.
