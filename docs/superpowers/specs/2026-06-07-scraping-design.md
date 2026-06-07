# Scraping (Official Sources) — External Reference-Data Ingestion — Design Spec

> **Status**: DESIGN — RESOLVED (S972, 2026-06-07). Capability ⑤/5 of the platform-capabilities program (`2026-06-03-platform-capabilities-roadmap.md`). The six open design decisions are now **resolved with best-practice defaults** (§8) — the spec is **implementation-ready**. **No code until a plan is written.** Implementation is multi-session and out of scope here — this spec closes the **DESIGN stage only**. The single **residual human gate** is per-source legal/ToS sign-off (D-4): everything else is decided.
> **Core principle**: ingest **OFFICIAL / AUTHORITATIVE open sources only** (ESCO, ISTAT/Eurostat, ATECO/NACE, public CCNL registries) via their **published APIs / bulk downloads**, and feed them into the **existing brownfield ingestion backbone** (acquisition → staging → transform → `sys.*` + lineage). Build NO parallel pipeline. Explicitly recommend **against** arbitrary web scraping (see §2.1) — that is a stated design principle, not a caveat.

## 1. Goal & intent

The platform already references **ESCO occupation URIs** (`sys.sys_esco_occupation_mappings`, 7645 mappings) and ships a 21939-row `sys.sys_skills` catalog, but those reference taxonomies are **frozen snapshots** ingested once during the brownfield rebuild. There is **no mechanism to refresh them** when the upstream authority publishes a new release (ESCO versions, ISTAT/ATECO reclassifications, CCNL updates). The intent is a **maintainable, legal, idempotent connector** that periodically re-fetches an official reference source, detects what changed, and re-stages only the delta — enriching `sys.*` reference data **without touching tenant/PII data** (reference taxonomies are global; see §4).

This is **inbound reference-data sync**, not "web scraping" in the sourcing/lead-gen sense. The naming in the roadmap is historical; the safe scope is narrow and authoritative.

## 2. Scope boundary (STRONG — read before anything else)

### 2.1 IN scope — official / authoritative sources via published interfaces

| Source | Interface | What it refreshes | Cadence (typical upstream) |
|---|---|---|---|
| **ESCO** (EU occupation/skill taxonomy) | published API + bulk CSV/RDF download (versioned releases) | `sys_skills` enrichment, `sys_esco_occupation_mappings` (URI/label/ISCO), skill taxonomy edges | ~yearly major version |
| **ISTAT / Eurostat** classifications | bulk download / SDMX API | occupation/classification reference dims for analytics | irregular, versioned |
| **ATECO / NACE** (economic activity codes) | ISTAT/Eurostat published tables | activity-classification reference (`wave1_activity_classifications` lineage) | irregular |
| **Public CCNL registries** (IT collective-bargaining) | published registry / open-data portals | compensation-band / contract reference context | irregular |

All four share the same shape: **a stable, legal, versioned authority publishes a machine-readable artifact** (API or bulk file). The connector consumes that artifact — it does not crawl HTML pages.

### 2.2 OUT of scope — recommended AGAINST (design principle, not afterthought)

**Arbitrary / general-purpose web scraping** (job boards, LinkedIn, company sites, salary-aggregator HTML, headless-browser crawling of non-API pages) is **explicitly recommended against** for this platform:

- **ToS / legal exposure** — most job boards and professional networks prohibit scraping in their terms; a production HR/BPM platform must not carry that liability (even with synthetic data today, the *mechanism* is the risk).
- **Robustness** — HTML scrapers break on every upstream layout change; they are perpetual maintenance debt with no SLA.
- **Provenance integrity** — scraped HTML has no authoritative version/etag, defeating the watermark/idempotency model (§3.3) this spec is built on.
- **Invariant fit** — it produces low-confidence, unstructured data that does not map cleanly to the `column_mappings`-driven transform contract (§3.2).

If a future business need genuinely requires job-market/salary data, the correct answer is a **licensed data feed** (a contractual API), ingested through the *same* connector contract as §2.1 — **never** an HTML scraper. That is a separate, later decision (flagged in §8), not this capability.

## 3. Architecture

### 3.1 Reuse the existing backbone (verified S972, do NOT reinvent)

The brownfield ingestion pipeline already implements the full acquisition → staging → transform → `sys.*` + provenance flow. The scraping connectors **plug into it**:

```
official source (ESCO API / ISTAT bulk / ...)
   │  connector.fetch()  ── politeness, etag/version check (§3.3)
   ▼
.apify-style local cache  (raw artifact on disk, dated — §6.2)
   │  parser.normalize()  ── source-specific → tabular rows
   ▼
brownfield.source_exports   (one row per fetched artifact: name, file_hash, retrieved_at, size, status)
   │  + source_tables / source_columns  (artifact structure registered)
   ▼
staging.<source>_*   (normalized rows, FK staging_import_run_id → brownfield.import_runs)
   │  table_mappings + column_mappings  (data-driven transform config — NO hardcoded ETL)
   ▼  generic transform/upsert engine (the wave-executor's stage/validate/upsert phases)
sys.* reference tables  (sys_skills, sys_esco_occupation_mappings, sys_skill_taxonomy_edges, …)
   +
sys.sys_source_lineage_records   (provenance: source_system, source_record_id, content_hash, import_run_id)
```

Every load is therefore: **already auditable** (`import_runs` + `import_run_logs` + `import_validation_results`), **already idempotent at the row level** (`source_lineage_source_content_hash` + the upsert engine's `ON CONFLICT` natural-key inference), and **already lineage-tracked**. The only genuinely new infra is the **delta/HWM layer** (§3.3) — everything below it already exists and is live.

### 3.2 Per-source connector / parser (the new code, thin)

A new connector is **three small pieces + config**, mirroring the brownfield doctrine that ETLs are *configuration, not hardcoded functions*:

1. **`fetch(source, watermark)`** — calls the official API / downloads the bulk file using the prior watermark for a conditional/incremental request (etag, `If-Modified-Since`, or version cursor). Returns the raw artifact + new watermark candidate, or "unchanged" (304-equivalent → no-op run).
2. **`normalize(artifact)`** — source-specific parser (ESCO CSV/RDF, ISTAT SDMX/CSV) → tabular rows written to `staging.<source>_*`. This is the only source-specific logic; it is pure (artifact in, rows out) and unit-testable against a recorded fixture (§7).
3. **`register()`** — writes the `brownfield.source_exports` row + `source_tables`/`source_columns`, opens a `brownfield.import_runs` row, then hands off to the **existing** generic transform/upsert engine via `table_mappings`/`column_mappings` seeded once per source (a migration, like the wave-1 mappings).

The mapping from a normalized staging table to a `sys.*` reference table is expressed **entirely in `brownfield.column_mappings`** (target column + transform + payload), so adding/adjusting a source is mostly data, not procedural code — the same property that made the wave executor wave-agnostic.

### 3.3 The MISSING piece — `brownfield.source_watermarks` (delta / HWM layer)

**Confirmed missing (verified S972): no `*watermark*` / `*cursor*` / `*hwm*` table exists in any schema** (only `pg_catalog.pg_cursors`). The roadmap (line ~52) already flagged this. This is the **one new structural object** the capability needs. It records, per official source, *what we last fetched* so the next run is incremental + idempotent.

Proposed table (DDL described, **not** authored here — RD-08 categorical fields = `varchar(N) + CHECK`, never ENUM; `timestamptz` for time-of-day, `date` otherwise):

| Column (described) | Purpose |
|---|---|
| `source_watermark_id` (uuid PK) | identity |
| `source_watermark_source_key` (varchar, UNIQUE) | stable source identifier, e.g. `ESCO`, `ISTAT_CP2021`, `ATECO_2025` |
| `source_watermark_cursor` (varchar) | upstream version/release id last ingested (e.g. ESCO `v1.2.0`) |
| `source_watermark_etag` (varchar, null) | HTTP etag of last artifact (conditional GET) |
| `source_watermark_content_hash` (char(64), null) | sha256 of last artifact (skip re-stage if unchanged) |
| `source_watermark_last_fetched_at` (timestamptz) | last fetch attempt |
| `source_watermark_last_succeeded_at` (timestamptz, null) | last successful ingest |
| `source_watermark_last_import_run_id` (uuid FK → `brownfield.import_runs`) | ties the HWM to its lineage run |
| `source_watermark_status` (varchar + CHECK: `IDLE`/`FETCHING`/`STAGED`/`FAILED`/`UNCHANGED`) | run-state of the source |
| `source_watermark_metadata` (jsonb, default `{}`) | source-specific cursor details (e.g. SDMX dataflow version) |
| `created_at` / `updated_at` (timestamptz) | audit |

**Idempotent re-stage logic**: on each run, `fetch()` compares the upstream etag/version against `source_watermark_cursor`/`_etag`. If unchanged → status `UNCHANGED`, no staging write, run closes COMPLETED with `metadata.skipped=true` (cheap, safe to re-run on any schedule). If changed → re-stage into `staging.<source>_*`, run the transform/upsert, then advance the watermark in the **same transaction** as the run-finish (so a crash mid-load never advances the HWM). Row-level idempotency is preserved by the existing `source_lineage_source_content_hash` + `ON CONFLICT` natural-key upsert — re-running an *identical* artifact is a no-op even if the HWM check is bypassed (belt-and-suspenders).

### 3.4 Scheduler — DECIDED: systemd timer on the OCI VM (D-2)

Official sources change rarely (yearly-ish), so a heavy scheduler is unwarranted. **DECIDED (D-2): a systemd timer on the OCI VM**, not an in-app cron — scheduling stays at the OS/infra layer, decoupled from the request path and independently observable.

- **systemd timer on the OCI VM** (the decided mechanism) — a `heuresys-advanced-scraping.timer` calling a one-shot script that hits the trigger endpoint (or runs the connector CLI). Consistent with the existing VM ops model (`vm-deploy.sh`/`vm-bootstrap.sh` already manage systemd units); no in-process scheduler, survives API restarts, observable via `journalctl`.
- **(rejected) in-app scheduled job** — a Fastify-side cron firing the connector. Simpler to ship in one place, but couples long-running fetch/transform to the API process lifecycle, complicates the single-thread test model, and is less aligned with the NO-DOCKER native-runtime + VM-systemd posture. Not adopted.

Either way the **unit of work is the trigger endpoint** (§3.5): the scheduler is just a clock that POSTs it, so manual + scheduled runs share one code path (matches the wave-executor: a trigger that both humans and automation invoke).

### 3.5 API surface (7-step module pattern)

A new module **`scraping-source-runs`** (or `reference-sync`), mirroring the wave-executor's trigger/list/cancel/acceptance shape:

- `GET  /v1/reference-sync/sources` — list registered official sources + their current watermark/status.
- `GET  /v1/reference-sync/runs` / `:id` — list/inspect sync runs (reuses `import_runs` lineage).
- `POST /v1/reference-sync/runs` — trigger a sync for a source (CSRF + `requirePermission('reference_sync:trigger')`); the scheduler calls this.
- `POST /v1/reference-sync/runs/:id/cancel` — cancel an in-flight run.
- `GET  /v1/reference-sync/runs/:id/acceptance` — post-load acceptance report (rows staged, upserted, skipped-unchanged, validation results) — same idea as the wave-executor acceptance endpoint.

Permission verbs reuse the brownfield RBAC family style (`reference_sync:read` / `reference_sync:trigger`). Platform-admin-only by default (reference data is global infra, §4) — no tenant ESS surface.

## 4. Data model & tenant/I5 note

- **Reference data is GLOBAL (tenant-less).** ESCO/ISTAT/ATECO/CCNL taxonomies are not tenant-owned — they land in the **global** `sys.*` reference tables (`sys_skills`, `sys_esco_occupation_mappings`, `sys_skill_taxonomy_edges`, activity classifications), exactly as the brownfield rebuild placed them. There is **no tenant FK** on these rows and **no per-tenant copy**. I5 (tenant isolation = FK + middleware, never RLS) is **not engaged** here precisely because the data is platform-global; tenant-scoped *consumption* of this reference data (e.g. a tenant's skills referencing ESCO URIs) is unchanged. `sys_source_lineage_records` does carry `source_lineage_tenant_id` — for global reference loads this is the platform tenant (resolved the same way the wave-executor resolves `resolvePlatformTenantId()`).
- **New objects** (all described, **no DDL authored** — RD-08, idempotent migration `000058+` at plan time): `brownfield.source_watermarks` (§3.3); per-source `staging.<source>_*` tables (mirroring `staging.wave1_*`); seeded `table_mappings`/`column_mappings` rows per source. Embedding sidecars (`sys_skill_embeddings`, `sys_esco_occupation_embeddings`) **already exist** (AI ②) — a reference refresh that adds/changes skills or occupations should enqueue a re-embed of the affected rows (cross-capability hook to AI ②'s incremental embedding job; not a new substrate).
- **Provenance/audit** reuses the existing chain end-to-end: `source_exports.file_hash`, `import_runs` + `audit.import_run_logs` + `audit.import_validation_results`, and `sys_source_lineage_records` (with `source_lineage_source_system` set to the source key, e.g. `ESCO`). No new audit infra.

## 5. Operational concerns

- **Rate-limiting / politeness to official APIs**: conditional requests first (etag / `If-Modified-Since` / version cursor — most runs are a cheap 304-equivalent no-op via the watermark). For bulk downloads, fetch the versioned artifact once per release, not per run. A per-source minimum interval + a single in-flight run guard (status `FETCHING` on the watermark acts as a lock). Polite User-Agent identifying the platform; respect documented quotas. **No parallel hammering** — sources change yearly, there is no need.
- **Caching / retention**: the raw fetched artifact is cached locally under the user's **`.apify/<YYYY-MM-DD>/` convention** (`.meta.json` + the raw `.content` artifact) — durable copy independent of upstream availability, dated per fetch (matches `memory/feedback_apify_results_storage.md` + the in-repo `.apify/README.md`). This applies to **any acquisition**, including (if ever) a licensed Apify-sourced feed — but per §2.2 Apify here means the *storage convention*, not endorsement of arbitrary-site Apify actors. The `source_exports` row holds the hash/metadata; the bytes live in `.apify/`.
- **Failure / retry**: a failed fetch sets watermark status `FAILED` and the run `FAILED` **without** advancing the cursor (next run retries the same delta — safe because of row-level idempotency). Transient HTTP errors get a bounded retry with backoff inside `fetch()`; a malformed artifact fails at the `normalize()`/validation phase (reuses `import_validation_results`), leaving `sys.*` untouched. The watermark only advances on a COMPLETED run, in the run-finish transaction.
- **Observability**: runs surface in the existing `import_runs` lineage views + acceptance endpoint; scheduler runs are additionally visible in `journalctl` (systemd timer — D-2). No new dashboards required for P1.

## 6. Phasing

### 6.1 Phases

| Phase | Scope | Deliverable | Effort | Risk |
|---|---|---|---|---|
| **P1** | **ESCO, one source end-to-end** (recommended first — the platform already uses ESCO occupation URIs, so the target tables + mappings exist) | ESCO connector (`fetch`/`normalize`/`register`) + `staging.esco_*` + seeded `column_mappings` → `sys_esco_occupation_mappings`/`sys_skills` enrichment via the existing transform engine + integration test + manual-trigger endpoint. **Watermark NOT yet required** (P1 can be a manual one-shot to prove the connector + transform contract). | **M** | med |
| **P2** | **Watermark + scheduler + a second source** | `brownfield.source_watermarks` table + incremental fetch (etag/version) + idempotent skip-if-unchanged + scheduler (systemd timer on the VM — D-2) + a second source (ISTAT/ATECO) to prove the contract generalizes. | **M-L** | med |
| **P3** | **More sources** | additional official sources (Eurostat/Eurostat-SDMX, public CCNL) as pure config + thin parsers; optional cross-capability re-embed hook into AI ②. | **M** (per source, mostly config) | low-med |

Phasing is deliberately P1-without-watermark-first: it de-risks the *connector + transform mapping* (the part most likely to surprise) before building the HWM machinery, and delivers a usable ESCO refresh immediately.

### 6.2 Effort/risk notes

- P1 risk is dominated by **ESCO artifact format** (CSV vs RDF, size, licence terms of the download) — a plan-time spike on the actual ESCO release artifact resolves it. Target tables + lineage already exist, so the back half is well-trodden.
- P2 risk is the **scheduler + transactional watermark advance** (don't advance HWM on partial load) and the **second-source generalization** proving the connector contract isn't ESCO-shaped only.
- P3 is low-risk additive config once P1+P2 establish the contract.

## 7. Testing

- **Unit** (`normalize()` per source): recorded-fixture artifact in → expected staging rows out. No live HTTP in CI (record/replay the official artifact, like the AI spec's Voyage fixture).
- **Integration** (`apps/api/test/reference-sync.integration.test.ts`, real DB via tunnel): RBAC (`reference_sync:trigger`/`:read`) + CSRF on trigger; a fixture artifact staged → transform → assert deterministic `sys.*` upsert (e.g. a known ESCO URI appears/updates in `sys_esco_occupation_mappings`); **idempotency** — re-running the *same* artifact upserts 0 net rows (content-hash no-op); **watermark unchanged path** (P2) — second run with same etag closes `UNCHANGED` with no staging write.
- **No live external API in CI** — the connector's `fetch()` is injected/mocked; the live-data doctrine applies to *our* DB (real tunnel), not to hammering EU servers in CI.

## 8. Dependencies, blockers & RESOLVED DESIGN DECISIONS (S972)

**Missing infra (the one structural gap):** `brownfield.source_watermarks` — the per-source delta/HWM layer — **does not exist** and must be designed/built (P2). Everything else (acquisition → staging → transform → `sys.*` + lineage + audit + content-hash idempotency) is **already live** and reused.

### 8.1 Resolved design decisions (S972)

The six previously-open decisions are now **decided with best-practice defaults**, making the spec implementation-ready. Each records the chosen option + a short rationale. The recommended default was adopted in every case; the only item still needing a human is **D-4** (per-source legal/ToS sign-off — see §8.2).

| # | Decision | DECIDED | Rationale (best-practice) |
|---|---|---|---|
| **D-1** | First official source | **ESCO** | The platform already references ESCO occupation URIs (`sys_esco_occupation_mappings`, 7645 rows) and ships `sys_skills` (21939 rows) — the target tables, lineage, and natural keys already exist, so ESCO is a true end-to-end P1 with no new sink to design. Lowest-friction proof of the connector + transform contract. |
| **D-2** | Scheduler mechanism | **systemd timer on the OCI VM** (§3.4) | Keep scheduling at the OS/infra layer — observable (`journalctl`), survives API restarts, decoupled from the request path. Matches the existing `vm-deploy.sh`/systemd ops model; avoids coupling long-running fetch/transform to the Fastify process and the single-thread test model. An in-app cron was rejected. |
| **D-3** | Watermark storage | **dedicated `brownfield.source_watermarks` table** (§3.3) | The one identified missing infra piece. A first-class table gives a typed per-source cursor/etag/version + status with a transactional HWM advance **only on COMPLETED runs**, queryable for observability — superior to stuffing cursor state into `source_exports.metadata` (which would conflate per-artifact provenance with per-source run-state and lose the in-flight `FETCHING` lock). |
| **D-4** | Legal / ToS confirmation per source | **official/authoritative published APIs & bulk downloads ONLY; each source requires a one-time human legal/ToS confirmation before its connector is enabled** (checklist gate) | This is the **one irreducibly human gate** — licence/ToS interpretation is a legal judgement, not a technical default. Posture is decided (authoritative published interfaces only, never HTML scraping per D-6); the per-source confirmation remains a human checkbox. **ESCO is recommended as the low-legal-risk first source** (EU open data, CC-licensed), so P1 can proceed against the lowest-risk source. See §8.2. |
| **D-5** | Refresh cadence | **conservative default, watermark-driven, per-source configurable** (e.g. **weekly probe for the ESCO taxonomy**) | Reference taxonomies change slowly (~yearly upstream), so a weekly conditional probe is ample headroom while staying cheap — most runs are a 304-equivalent no-op via the watermark (§3.3/§5). Don't over-poll authoritative sources; cadence is per-source config so slower sources (ISTAT/CCNL) can probe less often. |
| **D-6** | Arbitrary-scraping / licensed-feed posture | **LOCKED design principle: NO arbitrary web/HTML scraping, ever; any future market/salary data MUST be a LICENSED feed through the same connector contract** (§2.2) | ToS/legal safety + provenance integrity: arbitrary HTML has no authoritative version/etag (defeats the watermark/idempotency model) and carries scraping liability. Licensed contractual feeds ingest through the *same* §2.1 connector shape, preserving lineage and the `column_mappings` transform contract. This is a standing principle, not to be reopened ad hoc. |

### 8.2 Residual human sign-off (the only remaining gate)

Everything above is **resolved** — except **D-4**, which is irreducibly human:

- **ONLY D-4 needs Enzo before a connector is enabled**: a **one-time legal/ToS confirmation per source** that the source's published API/bulk-download licence permits this programmatic re-use. It is a per-source checklist gate, not a re-opening of the design.
- **ESCO (P1) is recommended as the low-legal-risk first source** — EU open data, CC-licensed — so the first enablement is the safest confirmation to obtain. Subsequent sources (ISTAT/Eurostat open-data; CCNL registries, which vary) each get their own one-time D-4 confirmation as they come online.
- **No other human decision is outstanding.** D-1, D-2, D-3, D-5, D-6 are decided; the spec is ready for **plan → implementation on Enzo's go**.

**Honesty note:** this remains **design-only** and **multi-session** implementation work (P1 alone is a module + connector + mappings + tests; P2 adds the watermark infra + systemd timer). The design decisions are closed; the spec **closes the DESIGN stage only** — no code, no migration, no implementation here. Implementation proceeds once Enzo gives the go (and provides the per-source D-4 confirmation for ESCO).

## 9. Out of scope (this spec)

- Arbitrary web scraping / headless-browser crawling / job-board / LinkedIn sourcing — **recommended against** (§2.2), not designed.
- Licensed salary/job-market data feeds — a separate, later business+legal decision; if ever pursued, ingested through the *same* connector contract (§2.1 shape), never an HTML scraper.
- Tenant-scoped or PII reference data — N/A; this capability handles **global, public, no-PII** reference taxonomies only (ADR-0023 keeps the whole project no-PII regardless).
- The AI ② re-embed job itself — this spec only *enqueues* a re-embed when reference rows change; the embedding pipeline is AI ②'s.
