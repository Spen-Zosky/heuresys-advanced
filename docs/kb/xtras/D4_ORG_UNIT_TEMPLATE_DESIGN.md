# D4 — Org-Unit Template Full-Fidelity Design (Wall W2, Option C(i))

> **Owner**: CLI. **Type**: READ-ONLY design discovery (SELECT-only; **no DB mutation, no code edits, no migrations, no commit** were performed producing this doc). **Authored**: 2026-06-04. **Decision context**: Enzo has CHOSEN **Option C(i)** for Wall W2 — introduce the legacy org-unit TEMPLATE taxonomy as its own layer in the advanced schema so `org_unit_kpis` (100 rows) resolves to 100%. This document is the precise, measured engineering design for that decision and the **schema sign-off checklist** that must close before any execution (the decision touches I1 / I5 / tenant scoping → it is org-model-sensitive).
>
> **Provenance of every number below**: re-verified live this session against advanced (`localhost:5433` / `heuresys_advanced` / schema `sys`) and legacy (`oracle-vm-default` native PG `heuresys_platform`, `sudo -u postgres psql`). Every figure is a measured `count(*)` / `\d`, not an estimate. Companion: `RECONCILIATION_WALLS_AND_AI_DECISION_DOSSIER.md §3 (W2)`, `DATA_RECONCILIATION_PLAN.md §7`, `SOT_STATE.md §9 (invariants)`, `EMPLOYEE_CENTRIC_MAPPING_DOCTRINE.md` (I14/ADR-0024).

---

## 0. The wall in one paragraph (measured)

The reconciliation target `sys.sys_organization_unit_kpi_templates` is **EMPTY (0 rows, verified)**. Two of its three NOT-NULL FKs are fully resolvable: `kpi_id → sys_kpi_definitions` is **100/100** (all 100 legacy `org_unit_kpis.kpi_code` exist in `sys_kpi_definitions` after the S958.1 KPI-catalog unification — measured), and `tenant_id → sys_tenancies` is trivially satisfiable. The **only** remaining wall is the `unit_id` FK. Legacy `org_unit_kpis` (100 rows) hangs off `public.org_unit_templates` (the **design/blueprint** layer), while advanced `sys_organization_units` (26 rows) was imported from a **different** legacy table, `public.org_units` (the **instance** layer). The two legacy namespaces are **disjoint**: code-overlap is **1 distinct code (`DIR-CORP`) carrying exactly 4 of the 100 KPI rows = 4%**; name-overlap is **0%**. There is no FK bridge between `org_unit_templates` and `org_units` anywhere in legacy (measured: 0 linkage on `template_id`, `parent_id`, `legacy_department_id`). Option C(i) accepts that the legacy KPIs are genuinely **template-keyed** and gives the advanced schema a real template taxonomy to host them.

---

## 1. Legacy template layer — full characterization (measured)

### 1.1 `public.org_unit_templates` (the blueprint taxonomy)

`\d public.org_unit_templates` (measured) — key columns:

| Column | Type | Note |
|---|---|---|
| `id` | uuid PK | the FK target of `org_unit_kpis.org_unit_template_id` |
| `template_id` | uuid NOT NULL | groups rows into **9 blueprint instantiations** (see §1.3); **no FK constraint** (dangling soft ref) |
| `parent_id` | uuid | self-hierarchy within a blueprint (`idx_org_units_parent`) |
| `path` / `depth` / `sort_order` | ltree / int / int | tree ordering; `path` is **all-NULL** (0 distinct, measured) |
| `code` | varchar(20) NOT NULL | the org-unit-type code (CEO, DIR-*, DEPT-*) |
| `name_it` / `name_en` / `short_name` | varchar | generic Italian case-study names |
| `area_code` / `level` / `level_name` / `nature` | — | `nature CHECK ∈ {Strategic,Tactical,Operational}` |
| `is_line` / `is_management` / `headcount_min/max` / `typical_span` | bool/int | design metadata |
| `responsibilities` | text[] | design metadata |

**No tenant column exists** (measured: `information_schema.columns WHERE column_name ILIKE '%tenant%'` → 0 rows). **`org_unit_templates` is a TENANT-LESS, shared blueprint taxonomy.** It is referenced by 3 legacy tables (`org_unit_kpis`, `org_unit_process_mapping`, `org_unit_tasks`, all `ON DELETE CASCADE`).

### 1.2 `org_unit_kpis` → `org_unit_templates` FK (the keyed relationship)

`\d public.org_unit_kpis` (measured): NOT-NULL `org_unit_template_id → org_unit_templates(id) ON DELETE CASCADE`, with UNIQUE `(org_unit_template_id, kpi_code)`. Payload columns that feed the advanced `weight`/`target` jsonb: `kpi_name`, `measurement_unit`, `target_direction` (CHECK `∈ {increase,decrease,maintain,range}`), `benchmark_value`, `benchmark_min`, `benchmark_max`, `data_source`, `calculation_formula`.

```
# cardinalities (legacy, measured)
org_unit_kpis: 100 rows | 100 distinct kpi_code | 91 distinct org_unit_template_id | 0 orphan FK
org_unit_templates: 225 rows | 225 distinct id | 25 distinct code | 9 distinct template_id | path all-NULL
```

The 100 KPI rows spread across **91 distinct template UUIDs**, which collapse to **24 distinct template CODES** (of the 25), distributed across all **9 blueprints** (per-blueprint KPI counts: 16,14,13,12,12,12,10,9,2 — measured). Per-template-code KPI fan-out ranges 2–6 (e.g. `DIR-QSE` 6, `DEPT-RD-2` 6, …, `DIR-COMM` 2 — measured).

### 1.3 Does `org_unit_templates` relate to `org_units` (template↔instance bridge)? — NO (measured)

```
tpl.template_id present in org_units(id)        : 0   (no link)
tpl.template_id present in blueprint_templates  : 0   (NOT that registry either)
org_units.legacy_department_id present in tpl(id): 0   (no link)
pg_constraint contype='f' on org_unit_templates : (none)   ← template_id/parent_id have NO FK
```

`template_id` has **9 distinct UUIDs** and points at **nothing in the DB** (a soft grouping key — most likely the org-blueprint-run id from a generator, but with no enforced referent). 225 = **9 × 25**: nine independent instantiations of the same 25-node generic org chart (CEO → 8 Directorates `DIR-*` → 16 Departments `DEPT-*-{1,2}`). This is a **generic ESCO-style blueprint catalog**, not RTL data.

### 1.4 Disjointness vs the real advanced org chart (measured)

```
# the advanced 26 org-unit codes (RTL-specific + Heuresys):
DIR-AML,DIR-BACKOFF,DIR-CORP,DIR-CREDITI,DIR-DEV,DIR-INFRA,DIR-PAY,DIR-RISKM,
DIV-CFO,DIV-COMM,DIV-HR,DIV-IT,DIV-LEGAL,DIV-MKT,DIV-OPS,DIV-RETAIL,DIV-RISK,
FIL-BG-CEN,FIL-BS-CEN,FIL-MI-CEN,HS-CORP,HS-MGMT,HS-PROD,RTL,UFF-CRED-PMI,UFF-CRED-RETAIL

# the legacy 25 template codes (generic blueprint):
CEO,DEPT-AFC-1..2,DEPT-COMM-1..2,DEPT-CORP-1..2,DEPT-HR-1..2,DEPT-IT-1..2,
DEPT-OPS-1..2,DEPT-QSE-1..2,DEPT-RD-1..2,DIR-AFC,DIR-COMM,DIR-CORP,DIR-HR,DIR-IT,DIR-OPS,DIR-QSE,DIR-RD

CODE overlap = {DIR-CORP} only.  org_unit_kpis on DIR-CORP = 4  →  4/100 = 4% (matches dossier).
NAME overlap = 0/100.
```

**Conclusion: the legacy KPI templates are a genuinely separate, RTL-agnostic blueprint vocabulary.** Any attempt to fold them onto the 26 RTL instances (Option A code-match / A-name) silent-skips 96–100% of rows — the exact failure mode the plan forbids. C(i) is the only path to 100% fidelity, and it requires hosting the template vocabulary as its own layer.

---

## 2. Advanced target — full characterization (measured)

### 2.1 `sys.sys_organization_unit_kpi_templates` (the empty target)

`\d` (measured): 3 NOT-NULL FKs + weight/target/metadata jsonb + UNIQUE `(unit_id, kpi_id)`.

| Column | Type | FK / constraint |
|---|---|---|
| `organization_unit_kpi_template_id` | uuid PK | gen_random_uuid() |
| `organization_unit_kpi_template_unit_id` | uuid NOT NULL | **→ `sys.sys_organization_units(organization_unit_id)` ON DELETE CASCADE** ← THE WALL |
| `organization_unit_kpi_template_kpi_id` | uuid NOT NULL | → `sys.sys_kpi_definitions(kpi_definition_id)` (100/100 resolvable) |
| `organization_unit_kpi_template_tenant_id` | uuid NOT NULL | → `sys.sys_tenancies(tenant_id)` |
| `organization_unit_kpi_template_weight` | numeric(4,3) NOT NULL = 1.000 | from legacy benchmark/derived |
| `organization_unit_kpi_template_target` | jsonb NOT NULL = '{}' | from legacy `target_direction`+`benchmark_*` |
| `organization_unit_kpi_template_metadata` | jsonb NOT NULL = '{}' | provenance |
| UNIQUE | — | `(unit_id, kpi_id)` |

**Decisive structural fact**: today the `unit_id` FK points at the **instance** table (`sys_organization_units`). C(i) changes WHAT that column references (or adds a sibling column) — that is the org-model edit requiring sign-off.

### 2.2 `sys.sys_organization_units` (the instance table — 26 rows)

`\d` (measured): tenant-scoped (`organization_unit_tenant_id NOT NULL → sys_tenancies`), UNIQUE `(tenant_id, code)`, self-parent FK, `organization_unit_type_id → sys_organization_unit_types`, plus a denormalized `organization_unit_type varchar(64)`. **Consumers (regression surface, all measured)**: `sys_positions` (160/162 carry an org_unit), `sys_teams` (24), `sys_branches` (0), `sys_bonus_pools`, `sys_organization_hierarchies` (0 rows today), `sys_organization_unit_history` (0), self-parent, and `sys_organization_unit_kpi_templates`. **26 rows / 2 tenants** (RTL_BANK 86ba…, HEURESYS 8bc5…, both ACTIVE).

### 2.3 Provenance carried today (measured)

`sys_organization_units` carries legacy provenance **in `organization_unit_metadata` jsonb**, NOT in a dedicated `legacy_org_unit_id` column. Distinct metadata keys (measured): `color, description, headcount_budget, icon, legacy_org_type, legacy_org_unit_id, name_en, name_it, org_level, sort_order`. **26/26** rows carry `legacy_org_unit_id` (→ resolves 26/26 in legacy `org_units`, 0/26 in `org_unit_templates`, per prior F3b, consistent). So the import-seed convention for the new template layer should mirror this: stash `legacy_org_unit_template_id` (+ `template_id` blueprint group) in metadata.

### 2.4 `sys.sys_organization_unit_types` — a taxonomy table already exists (measured)

`\d` (measured): 8 seeded rows, `organization_unit_type_code` CHECK `∈ {HEADQUARTERS, DIVISION, DEPARTMENT, TEAM, BRANCH, OFFICE, PLANT, WAREHOUSE}`. This is the *type* dimension, NOT a unit-template taxonomy — it does not host KPIs and is too coarse (8 types vs 25 template codes). It is the natural place to map `org_unit_templates.code` semantics (DIR→DIVISION, DEPT→DEPARTMENT, CEO→HEADQUARTERS) but it is **not** the FK target the KPI templates need.

### 2.5 The architectural precedent that decides the design (measured)

The advanced schema **already solves this exact template-vs-instance problem once**, for processes:

```
sys.sys_process_kpi_templates  (the analogous sibling, also a reconciliation target)
  process_kpi_template_process_id  →  sys.sys_blueprint_process_registry(blueprint_process_id)   ← a TEMPLATE registry
  process_kpi_template_kpi_id       →  sys.sys_kpi_definitions
  + default_weight numeric(4,3), default_target jsonb, metadata jsonb, UNIQUE(process_id, kpi_id)

sys.sys_blueprint_process_registry  (measured: 23 rows, NO tenant column, keyed by
  blueprint_process_variant_id + blueprint_process_code)  ← a TENANT-LESS, GLOBAL blueprint registry
```

`sys_process_kpi_templates` does **NOT** FK its `process_id` to a tenant instance — it FKs to a **separate, global, tenant-less blueprint registry**. **This is the established heuresys-advanced pattern for "KPI templates keyed at the blueprint level", and it is the direct structural twin of what org-unit KPI templates need.** Option A below replicates it.

---

## 3. Schema design options

The three NOT-NULL FKs of the target are fixed facts; the design question is **only** what `unit_id` resolves to and where the template vocabulary lives. The legacy KPIs are template-keyed (§1), so the honest design hosts a real template layer.

### Option A — NEW table `sys.sys_organization_unit_templates` (the template taxonomy) + repoint the KPI template FK to it

A dedicated tenant-less template-taxonomy table (mirroring `sys_blueprint_process_registry`), with the KPI templates FK'd to it.

DDL sketch (migration `000062`, idempotent):
```sql
-- 1. the template taxonomy (TENANT-LESS, global blueprint — mirrors sys_blueprint_process_registry)
CREATE TABLE IF NOT EXISTS sys.sys_organization_unit_templates (
  organization_unit_template_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_unit_template_blueprint_id  uuid NOT NULL,              -- legacy template_id group (the 9)
  organization_unit_template_code          varchar(64) NOT NULL,       -- CEO, DIR-*, DEPT-*
  organization_unit_template_name          varchar(255) NOT NULL,      -- name_it
  organization_unit_template_name_en       varchar(255),
  organization_unit_template_parent_id     uuid REFERENCES sys.sys_organization_unit_templates(organization_unit_template_id) ON DELETE SET NULL,
  organization_unit_template_type_id       uuid REFERENCES sys.sys_organization_unit_types(organization_unit_type_id) ON DELETE SET NULL,
  organization_unit_template_level         smallint,
  organization_unit_template_nature        varchar(20),                -- CHECK in {Strategic,Tactical,Operational}
  organization_unit_template_metadata      jsonb NOT NULL DEFAULT '{}',-- legacy id, area_code, responsibilities[]...
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_org_unit_template_blueprint_code_uq UNIQUE (organization_unit_template_blueprint_id, organization_unit_template_code)
);
-- nature CHECK + guarded set_updated_at trigger (mirror 000058 pattern)

-- 2. add a NULLABLE template FK on the KPI-template target; keep the instance unit_id NULLABLE-able later
ALTER TABLE sys.sys_organization_unit_kpi_templates
  ADD COLUMN IF NOT EXISTS organization_unit_kpi_template_unit_template_id uuid
    REFERENCES sys.sys_organization_unit_templates(organization_unit_template_id) ON DELETE CASCADE;
-- relax: make organization_unit_kpi_template_unit_id NULLABLE, add a XOR CHECK
--   (exactly one of {unit_id, unit_template_id} non-null) + tenant nullable for global templates
```
- **org_unit_kpis → 100%**: each legacy KPI's `org_unit_template_id` maps 1:1 to a new `sys_organization_unit_templates` row → `unit_template_id` resolves **100/100**, no silent skip. `kpi_id` already 100/100. The UNIQUE moves to `(unit_template_id, kpi_id)` (UNIQUE on legacy is already `(template_id, kpi_code)` — 1:1 preserved).
- **Migration shape**: 1 new table + 2 altered columns on the existing target (add `unit_template_id`, relax `unit_id`/`tenant_id` to NULLABLE) + a XOR CHECK so a row is EITHER an instance-KPI-template OR a blueprint-KPI-template. Idempotent (`IF NOT EXISTS` everywhere).
- **Import seed shape**: COPY `org_unit_templates` (225) → `sys_organization_unit_templates` (keep blueprint grouping); COPY `org_unit_kpis` (100) → `sys_organization_unit_kpi_templates` with `unit_template_id` set, `unit_id`/`tenant_id` NULL, `weight`/`target` derived from `benchmark_*`+`target_direction`, `metadata` carrying `{legacy_org_unit_kpi_id, kpi_code, measurement_unit, data_source, calculation_formula}`. **Optionally** dedup the 9 identical blueprints to 1 (25 template rows, 24-code KPI set) — a granularity sub-decision (§4 D4.4).
- **Tenant treatment**: **GLOBAL / tenant-less** for the taxonomy (mirrors `sys_blueprint_process_registry`, mirrors the legacy table which has no tenant). The blueprint-keyed KPI templates get `tenant_id = NULL`. **This requires relaxing `tenant_id` from NOT-NULL to NULLABLE on the existing target** (the only invariant-touching edit on the existing table).
- **Invariant impact**: **I1 (position-centric)** — UNTOUCHED: positions still FK only `sys_organization_units` (instances); the template layer is org-design, never a position parent. **I5 (FK+middleware, never RLS)** — UPHELD: pure FK + a global tenant-less table; the API middleware filter ignores tenant-less template rows (they are blueprint reference data, like `sys_organization_unit_types`). **Tenant scoping** — the global-template / tenant-instance split is made EXPLICIT and matches the existing process-blueprint precedent → cleanest separation, no leakage into tenant instance lists.
- **Regression risk to the 26 instances + positions: LOW.** Zero change to `sys_organization_units` rows, zero change to `sys_positions`, zero change to existing consumers. The only edit to a populated table is making two columns NULLABLE on the **empty** target (`sys_organization_unit_kpi_templates`, 0 rows) — a non-destructive widening.

### Option B — discriminator on `sys_organization_units` (templates + instances coexist in one table)

Add `organization_unit_is_template boolean` / `organization_unit_kind varchar` to `sys_organization_units`; load the 225 template rows alongside the 26 instances; KPI templates keep the existing `unit_id` FK.

DDL sketch (migration `000062`):
```sql
ALTER TABLE sys.sys_organization_units
  ADD COLUMN IF NOT EXISTS organization_unit_kind varchar(16) NOT NULL DEFAULT 'INSTANCE';
-- CHECK in {INSTANCE, TEMPLATE}; relax organization_unit_tenant_id to NULLABLE for TEMPLATE rows;
-- relax UNIQUE(tenant_id, code) — templates collide on code across blueprints + with instances (DIR-CORP!)
```
- **org_unit_kpis → 100%**: legacy templates become `kind='TEMPLATE'` rows in `sys_organization_units`; KPI templates FK them via the existing `unit_id` → 100/100.
- **Migration shape**: 1 discriminator column + relax `tenant_id` NOT-NULL + **break/replace `UNIQUE(tenant_id, code)`** (templates have NULL tenant and repeat `code` across 9 blueprints, and `DIR-CORP` collides with the real instance). This is a UNIQUE-constraint change on a **populated** core table.
- **Import seed**: 225 template rows INSERTed into `sys_organization_units` + 100 KPI templates.
- **Tenant treatment**: TEMPLATE rows tenant-less in the **same** table as tenant-scoped instances → forces every consumer query to add `WHERE kind='INSTANCE'`.
- **Invariant impact**: **I1** — borderline: positions FK `sys_organization_units`; nothing stops a position pointing at a `kind='TEMPLATE'` row (would need a CHECK/trigger). **I5** — the tenant-isolation middleware filter now has to special-case `kind='TEMPLATE'` (NULL tenant) inside the primary instance table → the cleanest place for a leak (a forgotten `kind` filter shows blueprint rows in a tenant's org chart). **Tenant scoping** — muddied: one table, two tenancy regimes.
- **Regression risk to the 26 instances + positions: HIGH.** Touches the UNIQUE constraint and NOT-NULL tenant on a **populated** core table that 7 consumer tables + positions + the API depend on. Every existing `SELECT … FROM sys_organization_units` becomes a potential template-leak unless audited. This is the worst fit against I1/I5.

### Option C(found) — global template registry + the KPI-template **target stays instance-only**; org-unit blueprints live in the existing blueprint stack

A third option surfaced from the real schema (§2.5): instead of a NEW org-unit-template table, **reuse the existing blueprint machinery**. The advanced schema already has `sys_blueprint_*` (`sys_blueprint_variants`, `sys_blueprint_process_registry`, `sys_blueprint_overrides`). An org-unit blueprint registry `sys_blueprint_org_unit_registry` keyed by `blueprint_variant_id` would sit perfectly beside `sys_blueprint_process_registry`, and a NEW `sys_blueprint_org_unit_kpi_templates` (twin of `sys_process_kpi_templates`) would host the 100 KPIs — leaving `sys_organization_unit_kpi_templates` reserved for **tenant-instance** OU KPIs (derived/authored later, e.g. via Option-B-of-W2 aggregation).
- **Pros**: maximal consistency with the existing process-blueprint pattern; the instance KPI-template target is never relaxed (stays NOT-NULL tenant + instance FK); the cleanest I1/I5 story (templates fully inside the tenant-less blueprint subsystem, zero edit to any populated table).
- **Cons**: introduces 2 new tables (registry + kpi-template twin) instead of 1; the reconciliation target `sys_organization_unit_kpi_templates` then **stays empty by design** (the 100 KPIs land in the new blueprint twin, not the named target) → the registry row would flip to REFERENCE/derived, not "this exact table populated". If the acceptance criterion is *"`sys_organization_unit_kpi_templates` itself must show 100 rows"*, Option C(found) does **not** satisfy it (the KPIs live in the sibling). If the criterion is *"the 100 legacy KPIs are faithfully represented at 100% in the advanced schema"*, it satisfies it best.
- **Regression risk: LOWEST** (two brand-new tables, zero touch to any populated table).

---

## 4. Recommendation + exact schema decisions needing Enzo's sign-off

**Recommended: Option A** — a NEW `sys.sys_organization_unit_templates` taxonomy table + repoint the KPI-template `unit_id` to it via a nullable `unit_template_id` + XOR CHECK.

**Measured justification:**
- It hits the literal acceptance criterion (the named target `sys_organization_unit_kpi_templates` shows **100 rows**, `unit_template_id` resolves **100/100**, `kpi_id` already **100/100**) — Option C(found) puts the rows in a sibling and leaves the named target empty.
- It replicates an **existing, proven advanced pattern** (`sys_process_kpi_templates → sys_blueprint_process_registry`, measured 23 rows tenant-less) → it is template-replication, not green-field invention.
- **Regression risk LOW** (vs HIGH for Option B): zero edit to any **populated** table; the only schema change to a populated object is widening two columns to NULLABLE on the **empty** target. Option B touches the UNIQUE + NOT-NULL of the core 26-row instance table that positions + 7 consumers depend on.
- It keeps **I1 clean** (positions never see templates), **I5 clean** (global tenant-less taxonomy outside the middleware tenant filter, like `sys_organization_unit_types`), and makes the global-vs-tenant split **explicit**.
- Option C(found) is the runner-up and is *architecturally* slightly cleaner, but only choose it if Enzo accepts that the named reconciliation target stays empty-by-design and the KPIs live in a blueprint twin. **Flag both to Enzo; A is recommended on the acceptance-criterion + minimal-new-objects axis.**

### Schema decisions requiring Enzo's sign-off (org-model-sensitive — I1/I5/tenant)

| # | Decision | Recommended | Why it needs Enzo |
|---|---|---|---|
| **D4.1** | **A vs C(found)**: populate the NAMED target `sys_organization_unit_kpi_templates` (A) **or** route the 100 KPIs into a new blueprint twin and leave the named target empty-by-design (C-found)? | **A** | defines whether the named reconciliation row flips to POPULATED or to REFERENCE-by-design |
| **D4.2** | **Tenant treatment of templates**: GLOBAL / tenant-less taxonomy (recommended, mirrors legacy + `sys_blueprint_process_registry`)? This requires **relaxing `organization_unit_kpi_template_tenant_id` from NOT-NULL to NULLABLE** on the existing (empty) target. | GLOBAL, tenant_id NULLABLE | directly touches I5 tenant-scoping semantics of an existing table |
| **D4.3** | **FK shape on the target**: add nullable `unit_template_id` + relax `unit_id` to NULLABLE + XOR CHECK (exactly one of unit_id / unit_template_id) — confirm the dual-mode target is acceptable vs a template-only target. | dual-mode XOR | changes the target's contract; affects any future instance-OU KPI authoring |
| **D4.4** | **Blueprint dedup granularity**: load all **225** template rows (9 identical blueprints preserved as distinct UUIDs, 100 KPIs land 1:1) **or** dedup to **25** canonical template codes (then the 100 KPIs collapse onto 24 codes and the `(unit_template_id, kpi_id)` UNIQUE forces a merge/aggregation of duplicate KPI rows across blueprints)? | **preserve 225** (1:1, no fabricated merge) | the dedup path invents a merge rule (which benchmark wins) — a fabrication call only Enzo authorizes |
| **D4.5** | **`weight` / `target` derivation**: legacy has no per-KPI weight → default `weight=1.000`; build `target` jsonb from `target_direction`+`benchmark_value`+`benchmark_min/max`. Confirm the jsonb shape (e.g. `{"direction":"decrease","benchmark":8.00}`) and that defaulting weight=1.000 is acceptable (not fabricated business weighting). | weight=1.000, target from benchmarks | the target jsonb schema is a new contract; weight default is a modeling choice |
| **D4.6** | **Registry + invariant docs**: on populate, flip `sys_organization_unit_kpi_templates` registry row from NEEDS_DECISION→IMPORT(POPULATED), retract the stale §7 "code-overlap 0" line in `DATA_RECONCILIATION_PLAN.md`, and record the new template layer as an ADR (org-model change). | yes, new ADR | introducing a second org-unit layer is an architectural decision → ADR per the invariant-change rule |

---

## 5. Execution sequence (plan-level only — NO SQL written here)

Gated on D4.1–D4.6 sign-off. Each step is idempotent + supervised-run + validate-after-each, per the established pattern.

1. **ADR** (`docs/architecture/adr/`): "Org-unit template layer (W2 C(i))" — records the second org-unit layer as a deliberate org-model decision, the I1/I5 reasoning, and the global-tenant-less treatment. *(authored first, since it gates the invariant change.)*
2. **Migration `000062_org_unit_template_layer.sql`** (next free number — disk is at 000061): `CREATE TABLE IF NOT EXISTS sys.sys_organization_unit_templates` (+ nature CHECK + guarded `set_updated_at` trigger + audit cols, mirroring 000058) + `ALTER … ADD COLUMN unit_template_id` + relax `unit_id`/`tenant_id` to NULLABLE + XOR CHECK on the target. Idempotent, twice-run-clean (pg_dump diff empty). NO data.
3. **Staging COPY-pipe from legacy** (`db/seeds/…/00_extract`): `ssh oracle-vm-default sudo -u postgres psql … \copy (SELECT … FROM org_unit_templates) TO STDOUT` and same for `org_unit_kpis`, landing in `staging.*` (read legacy is authorized; do not commit absolute legacy paths). Measure: 225 + 100 rows land.
4. **Import seed** (`db/seeds/…/`, idempotent `INSERT … ON CONFLICT DO NOTHING`): `staging → sys_organization_unit_templates` (225, preserve blueprint grouping per D4.4) then `staging org_unit_kpis → sys_organization_unit_kpi_templates` (100, `unit_template_id` set, `unit_id`/`tenant_id` NULL, weight/target per D4.5, metadata provenance). Map `template.code → sys_organization_unit_types` where derivable.
5. **Validate**: `unit_template_id` resolves 100/100; target rowcount = 100; `kpi_id` 100/100; XOR CHECK holds; 26 instances + 162 positions + 24 teams **unchanged** (regression assert). Flip registry row → IMPORT/POPULATED; retract stale §7 line (D4.6).
6. **Integration test** (`apps/api/test/…`): the org-unit KPI templates endpoint returns the 100 template rows; an RTL-tenant request does NOT see template rows leak into the instance org-unit list (I5 assertion); empty-state preserved for instance-OU KPIs. `pnpm test` 100% green. Then atomic commit `feat(db): W2 C(i) — org-unit template layer (000062, 100 KPI templates)`.

---

## 6. 8-line summary

1. **Recommended: Option A** — NEW tenant-less `sys.sys_organization_unit_templates` taxonomy + nullable `unit_template_id` FK on the empty target + XOR CHECK; replicates the proven `sys_process_kpi_templates → sys_blueprint_process_registry` pattern (measured 23 rows, tenant-less). Runner-up C(found) routes KPIs into a blueprint twin but leaves the named target empty.
2. **Key measured numbers**: target `sys_organization_unit_kpi_templates` = **0 rows**; legacy `org_unit_kpis` = **100 rows / 100 distinct codes / 91 template UUIDs / 24 codes**; `org_unit_templates` = **225 = 9 blueprints × 25 codes**, **NO tenant column**, `template_id` has **0 FK** (points at nothing).
3. **kpi-FK = 100/100** (all 100 codes in `sys_kpi_definitions`); **tenant-FK** trivial; the **ONLY** wall is `unit_id`.
4. **Disjointness measured**: code-overlap = **1 code `DIR-CORP` = 4/100 (4%)**, name-overlap **0/100**; no legacy bridge between `org_unit_templates` and `org_units` (0 on template_id/parent_id/legacy_department_id).
5. **Regression risk LOW**: zero edit to any populated table — only NULLABLE-widening on the empty target; 26 instances + 160-of-162 positions + 24 teams untouched. (Option B = HIGH: touches UNIQUE+NOT-NULL on the core instance table.)
6. **Invariants**: I1 clean (positions never FK templates), I5 clean (global tenant-less taxonomy outside the middleware filter, like `sys_organization_unit_types`), tenant split made explicit.
7. **Decisions needing Enzo (sign-off gate)**: D4.1 A-vs-C(found); D4.2 global/tenant-less + relax target `tenant_id` NULLABLE; D4.3 dual-mode XOR FK; D4.4 preserve 225 vs dedup to 25 (dedup = fabricated merge → recommend preserve); D4.5 weight=1.000 + target jsonb from benchmarks; D4.6 new ADR + registry flip + retract stale §7 line.
8. **Sequence**: ADR → migration `000062` (next free; 000061 = learning re-home) → staging COPY-pipe (225+100) → idempotent import seed → validate (100/100 + regression unchanged + registry flip) → integration test (100 rows returned + I5 no-leak) → atomic commit.
