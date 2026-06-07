# CMS — Content Management — Design Spec

> **Status**: DESIGN (S973, 2026-06-07). Capability ④/5 of the platform-capabilities program (`2026-06-03-platform-capabilities-roadmap.md`). **No code until this spec is reviewed + approved + a plan is written.** Approval is Enzo's (the gate) — this spec closes the DESIGN stage only.
> **Core principle**: ONE tenant-scoped content store (versioned documents + a taxonomy), every content scenario (knowledge base, policy, announcement, BPM-linked process doc) is an additive query/page over it. All scenarios additive, none precluded — same inclusive pattern as the AI (②) and BI (①) specs.

## 1. Goal & scope boundary

A tenant-scoped **Content Management** capability: authored, versioned, publishable knowledge content owned by a tenant — knowledge-base articles, HR policies, announcements, rich process documentation tied to the BPM/blueprint engine, and an employee-handbook surface in ESS. Authoring is admin/HR-gated; reading is broad (knowledge base in the admin SPA + ESS portal).

**What CMS IS here** (tenant-scoped published content):
- Knowledge-base articles / how-tos (tenant-authored, organization-wide reach).
- HR policies & the employee handbook (versioned, publishable, ESS-readable).
- Announcements (time-bounded published content).
- Process documentation hooked to BPM `blueprint-*`/`process-*` (the natural domain hook flagged in the roadmap; **out of P1**, a P3 cross-link).

**What CMS is NOT** (collision boundary — explicit):
- It is **NOT** `sys.sys_user_documents` (already exists, **657 rows**, reconciliation F2). That table is **per-person private files** (CV / CERTIFICATE / CONTRACT_REFERENCE / TRAINING_RECORD / EVIDENCE_PROOF / OTHER), keyed `user_document_user_id → sys_users` **ON DELETE CASCADE** (deleting a user destroys their docs), self-scoped, **no versioning, no publish state, no taxonomy**. CMS content is **tenant-owned, not person-owned** — it survives any single user, is versioned, has a publish lifecycle, and is categorized. The two are disjoint domains. **The spec does NOT redefine, extend, or migrate `sys_user_documents`** (see Open Decision D-3 for why reuse was rejected).
- It is **NOT** a file/asset store. P1/P2 are text/rich-text content. Binary media/attachments are a P3 decision (Open Decision D-2), not a P1 deliverable.
- It is **NOT** a headless CMS service (Payload/Strapi). Native PG + Fastify + `@heuresys/ui` only — the roadmap's single-stack discipline (preserves I5 tenant isolation, no-mock live-data doctrine, brand). Architecture option (A) of the roadmap row.

**Evidence (live DB probe, S973, tunnel :5433)**: `\dt sys.*content*` → 0 tables; `\dt sys.*document*` → only `sys.sys_user_documents` (657 rows). No `article`/`policy`/`knowledge`/`announce`/`cms` table exists. No `cms`/`content` module in `apps/api/src/modules/` (70 modules; `surveys` is the freshest 7-step example, S973). DB at 81 migrations; next free number is **000082**.

## 2. Architecture — the content foundation

- **New API module `content`** (7-step pattern, mirrors `surveys`): `/v1/content/*` (admin authoring) + a read surface reused by ESS. Repository = raw parameterized SQL against `sys.sys_content_*`; service = `ActorContext` tenant scoping (I5, FK + middleware — **never RLS**); routes = `requirePermission` + `app.verifyCsrf` on writes.
- **Content store**: tenant-scoped base tables `sys.sys_content_documents` (+ versions, + categories), all `uuid` PK `DEFAULT gen_random_uuid()`, `*_tenant_id uuid NOT NULL → sys.sys_tenancies ON DELETE RESTRICT`, `jsonb metadata DEFAULT '{}'`, categorical fields as `varchar(N) + CHECK` (RD-08, **never** PG ENUM), `date`/`timestamptz` per RD-09, `updated_at` + `sys.sys_set_updated_at` trigger on mutable rows. Migration conventions verbatim from `000077`.
- **Read surface**: the same content read endpoints serve both the admin SPA and ESS. P1 ESS reads through `/v1/content/*` with a `published`-only filter enforced server-side by scope (ESS personas cannot see drafts). If a dedicated self-scope path is wanted it lives in the `me` module per ADR-0011 (`/v1/me/content` — deferred to P2/P3 decision, not P1; see §4).
- **Frontend**: `apps/web/src/app/(authenticated)/content/*` (admin authoring) + ESS knowledge-base read pages under the ESS route group, composing **`@heuresys/ui` primitives** only. The editor primitive (markdown or rich-text) belongs **upstream in `ux-design-shared` → `@heuresys/ui`** — never built in this repo (Design-System rule). Live-data only (no mock/placeholder — `NEXT_SESSION_MVP_2A` doctrine).
- **Shared schemas**: `@heuresys/shared/schemas/content` (Zod Create/Update/Filter/Response), exported from `packages/shared/src/index.ts` + a subpath export in `packages/shared/package.json` → `./schemas/content` (mirrors the `./schemas/surveys` entry).

## 3. Scenarios as additive views (same foundation)

| Phase | Scenario | Surface | Data |
|---|---|---|---|
| **1** | Knowledge-base article authoring + read | admin `/content/*` + KB read (admin SPA) | `sys_content_documents` (current version), `sys_content_categories` |
| **1** | Category/taxonomy CRUD | admin `/content/categories` | `sys_content_categories` (flat, tenant-scoped) |
| **2** | Versioning (history + restore) | admin version drawer | `sys_content_versions` (row-per-version) |
| **2** | Publish/lifecycle workflow (draft→review→published→archived) | admin status transitions + ESS published-only read | `content_status` CHECK + publish audit |
| **2** | ESS knowledge base / employee handbook | ESS `/me/knowledge` (read, published-only) | published `sys_content_documents` |
| **3** | Rich editor + media/attachments | upgraded editor primitive + asset refs | media storage (Open Decision D-2) |
| **3** | BPM/process-doc cross-link | content ↔ `blueprint-*`/`process-*` | a nullable `content_linked_process_id` + join |
| **3** | Search/full-text (`pg_trgm` already installed) | KB search box | trigram/`tsvector` index on title+body |

## 4. Data model (descriptive — NO DDL in this spec)

Proposed `sys.sys_content_*` tables (described, not authored — the plan writes the migration). All follow `000077` conventions: `sys.sys_<plural>`, column prefix `<entity>_<field>`, PK `<entity>_id uuid DEFAULT gen_random_uuid()`, `<entity>_tenant_id uuid NOT NULL → sys.sys_tenancies(tenant_id) ON DELETE RESTRICT` (I5), `jsonb metadata NOT NULL DEFAULT '{}'`, CHECK for categoricals (RD-08), `updated_at` + trigger on mutable tables, idempotent (`CREATE TABLE IF NOT EXISTS` + guarded `ADD CONSTRAINT` + `CREATE INDEX IF NOT EXISTS` + guarded `CREATE TRIGGER`).

**(1) `sys.sys_content_categories`** — flat, tenant-scoped taxonomy (P1).
- `category_id`, `category_tenant_id` (FK), `category_natural_key varchar` + UQ `(tenant_id, natural_key)`, `category_name varchar(255)`, `category_slug varchar`, `category_description text`, `category_is_system boolean DEFAULT false`, `category_metadata jsonb`, `created_at`/`updated_at` + trigger.
- Self-FK `category_parent_id` (nullable) reserved for a future tree; **P1 ships flat** (no recursion) to avoid scope creep — see Open Decision D-4.

**(2) `sys.sys_content_documents`** — the authored content head (current state + pointer to current version).
- `document_id`, `document_tenant_id` (FK, RESTRICT, I5), `document_natural_key varchar` + UQ `(tenant_id, natural_key)`, `document_category_id uuid → sys_content_categories ON DELETE SET NULL`, `document_title varchar(255)`, `document_slug varchar`, `document_kind varchar(32) CHECK IN ('article','policy','announcement','handbook','process_doc')` (RD-08), `document_status varchar(20) CHECK IN ('draft','in_review','published','archived')` (RD-08, lifecycle), `document_body text` (rendered/source body of the current version — denormalized for fast read; the version table is the durable history), `document_body_format varchar(16) CHECK IN ('markdown','html')` (depends on Open Decision D-1), `document_current_version_id uuid` (→ `sys_content_versions`, the active version; nullable until first version exists), `document_author_user_id uuid → sys_users ON DELETE SET NULL` (I14: person preserved as NULL + legacy id in metadata if unresolved, never dropped), `document_published_at timestamptz` (nullable), `document_published_by_user_id uuid → sys_users ON DELETE SET NULL`, `document_effective_date date` / `document_expires_date date` (RD-09, for announcements/policy validity windows), `document_metadata jsonb`, `created_at`/`updated_at` + trigger. P3 adds nullable `document_linked_process_id` (BPM cross-link).
- Indexes: `(tenant_id)`, `(tenant_id, document_status)`, `(tenant_id, document_kind)`, `(document_category_id) WHERE NOT NULL`, partial published-effective index for ESS read.

**(3) `sys.sys_content_versions`** — **row-per-version** immutable history (the chosen versioning approach — see below).
- `version_id`, `version_tenant_id` (FK, RESTRICT), `version_document_id uuid NOT NULL → sys_content_documents ON DELETE CASCADE`, `version_number integer NOT NULL` + UQ `(document_id, version_number)`, `version_title varchar(255)`, `version_body text`, `version_body_format varchar(16) CHECK`, `version_author_user_id uuid → sys_users ON DELETE SET NULL`, `version_change_note text`, `version_metadata jsonb`, `created_at`. **Immutable event-log table — no `updated_at`, no trigger** (mirrors `sys_engagement_survey_responses` §3 of `000077`). A new edit appends a row + repoints `document_current_version_id`; "restore" appends a new version copied from an old one (never mutates history).

**Versioning approach decision (recommended)**: **row-per-version table** (option above), NOT a `version` integer column on the head row. Rationale: full history + diff + restore + per-version authorship are first-class; the head table stays small and fast for the common "read current" path (denormalized current body); the version table is append-only/immutable (audit-friendly, matches the established immutable-event-log pattern). The alternative (single mutable row, no history) is rejected — it cannot satisfy the P2 versioning scenario and would force a painful migration later. (The third alternative — JSONB blob of versions — is rejected by the same spirit as I9: history is a relation, not a blob.)

**Authorship / publish / permission flow**:
- Author = the actor (`document_author_user_id` from `ActorContext`). Create → `status='draft'`.
- Lifecycle transitions (`draft → in_review → published → archived`, and `published → archived`/back to `draft` for re-edit) gated by `content:update` for draft/review and a dedicated `content:publish` for the publish/unpublish transition (separation of duties: an author may edit but a publisher promotes). Each transition stamps `published_at`/`published_by_user_id` and appends a version.
- ESS read sees **only `published`** (and within its effective/expiry window) — enforced server-side in the service by scope, never client-side.

**Reconciliation-registry entry (REQUIRED — non-negotiable invariant)**: the registry view `sys.v_reconciliation_status` marks any `sys.*` table **absent from `sys.sys_reconciliation_registry` as `UNCLASSIFIED`**, and the project holds **0 UNCLASSIFIED** as an asserted invariant (see `000062`). Therefore the plan's migration MUST register all 3 new tables in the registry in the same wave. CMS content is **app-authored tenant content, not a legacy-import target** → classify **`EXCLUDE` / bucket `D`** (same treatment as the AI embedding tables in `000062` and `sys_inbox_notifications`), with a sign-off rationale noting "app-generated tenant content, no legacy source". An `INSERT … ON CONFLICT (table_name) DO NOTHING` + a post-condition `DO $$ … RAISE EXCEPTION IF UNCLASSIFIED <> 0` assertion, exactly like `000062`. **If this is skipped, `pnpm db:validate` fails** — flag to the plan author as a hard requirement.

## 5. API surface — `/v1/content` module (7-step pattern)

Mirrors `surveys` (`apps/api/src/modules/surveys/{repository,service,routes}.ts`). The 7 steps: (1) `@heuresys/shared/schemas/content` Zod + subpath export; (2) `repository.ts` raw parameterized SQL (`$1,$2` only; `withTransaction` for the multi-statement publish = append-version + repoint-head + stamp); (3) `service.ts` `ActorContext` tenant scoping + lifecycle guards; (4) `routes.ts` `FastifyPluginAsyncZod` + `requirePermission` + `app.verifyCsrf` on writes; (5) register in `app.ts` step 13 `app.register(contentRoutes, { prefix: '/v1/content' })`; (6) `apps/api/test/content.integration.test.ts` (live DB via `buildTestApp()`); (7) `pnpm test` 100% green → atomic commit.

| Method | Path | Permission | CSRF | Notes |
|---|---|---|---|---|
| GET | `/v1/content` | `content:read` | — | list + filter (kind/status/category/q), tenant-scoped |
| GET | `/v1/content/:id` | `content:read` | — | head + current version |
| POST | `/v1/content` | `content:create` | ✅ | create draft (appends v1) |
| PATCH | `/v1/content/:id` | `content:update` | ✅ | edit (appends a new version) |
| DELETE | `/v1/content/:id` | `content:delete` | ✅ | soft via `archived` or hard delete (CASCADE versions) — Open Decision D-5 |
| POST | `/v1/content/:id/publish` | `content:publish` | ✅ | `draft/in_review → published`, stamps publish fields |
| POST | `/v1/content/:id/unpublish` | `content:publish` | ✅ | `published → draft/archived` |
| GET | `/v1/content/:id/versions` | `content:read` | — | version history (immutable log) |
| POST | `/v1/content/:id/versions/:versionId/restore` | `content:update` | ✅ | appends a new version copied from an old one |
| GET | `/v1/content/categories` | `content:read` | — | taxonomy list |
| POST/PATCH/DELETE | `/v1/content/categories(/:id)` | `content:{create,update,delete}` | ✅ | category CRUD |

**Permissions** (seed migration mirroring `000078`): `content:read`, `content:create`, `content:update`, `content:delete`, `content:publish` (5). Audience by precedent: `content:read` → the 6 non-leaf HRMS-read roles (`PLATFORM_ADMIN, TENANT_ADMIN, BLUEPRINT_MANAGER, HRMS_MANAGER, PROCESS_OWNER, MANAGER`); writes (`create/update/delete`) → `PLATFORM_ADMIN, TENANT_ADMIN, HRMS_MANAGER`; `content:publish` → `PLATFORM_ADMIN, TENANT_ADMIN` (separation of duties — Open Decision D-6 may widen). **ESS published-read** is the open item: either a `content:read` grant extended to `USER`/`READ_ONLY` filtered to published, OR a self-scope `me:content:read` permission via the `me` module per ADR-0011 (recommended — keeps the admin/ESS permission split clean; see §6 + Open Decision D-7). `ON CONFLICT DO NOTHING`, idempotent, post-condition assert count, NB PLATFORM_ADMIN listed explicitly (not auto-granted — the `000005` grant was one-time).

## 6. Frontend

- **Admin authoring** (`apps/web/src/app/(authenticated)/content/*`): list/table (TanStack Query over `/v1/content`), create/edit form, version-history drawer, publish/unpublish actions, category management. Composed from `@heuresys/ui` primitives (`DataTable`, `Button`, `Card`, form inputs) + the **editor primitive** (see Open Decision D-1). i18n IT+EN keys (`pnpm i18n:check` parity).
- **ESS knowledge base** (ESS route group, e.g. `/me/knowledge` per ADR-0011): read-only published content, category filter, search. **No `/me/*` route added to existing modules** — if a self-scope content read is chosen it gets a route in the dedicated `me` module (ADR-0011). Published-only enforced server-side.
- **Editor primitive — upstream**: a markdown or rich-text editor component is a **new `@heuresys/ui` primitive added in `ux-design-shared`**, released to npm, then bumped here (post-X18 workflow). It is **NOT** created in `apps/web`. P1 may ship with a plain `<textarea>` markdown source (no new primitive) to unblock authoring, with the rich editor primitive landing at P2/P3 (sequencing tied to Open Decision D-1).
- **Live-data E2E doctrine** (`NEXT_SESSION_MVP_2A`): every page fed by a real `/v1/content/*` call; no mock/fixture/`initialData`. No page commit without a Playwright E2E green that logs in as a real seeded persona (`admin@heuresys.com` / `Admin#PassW0rd!` or HR persona), authors → publishes → re-reads, and an ESS persona reads the published article. Empty-state UI only for a real empty API response.

## 7. Phasing

| Phase | Scope | Effort | Risk |
|---|---|---|---|
| **P1** | Minimal read + author: `sys_content_documents` + `sys_content_categories` (versions table created but single active version), `content` module CRUD (read/create/update/delete + category CRUD), 5 permissions, admin authoring page (markdown `<textarea>`), admin KB read, integration + E2E green, registry registration. **No publish workflow, no ESS surface yet.** | **M** (~1.5 sessions; module mirrors `surveys` 1:1) | low — established pattern; main risk = editor scope (deferred via D-1) |
| **P2** | Versioning (history + restore over `sys_content_versions`) + publish/lifecycle workflow (`draft→in_review→published→archived`, `content:publish`, separation of duties) + ESS knowledge-base read surface (published-only, self-scope per ADR-0011). | **M** (~1–1.5 sessions) | med — lifecycle transition correctness + ESS scope isolation (tested) |
| **P3** | Richer editor primitive (rich-text in `@heuresys/ui`) + media/attachments storage + BPM/process-doc cross-link + full-text search (`pg_trgm`/`tsvector`). | **M–L** (multi-session, each sub-slice independent) | med — media storage is the real unknown (D-2); editor primitive is upstream work |

Effort is order-of-magnitude, re-estimated at each phase's own plan step (per roadmap §"How to read this"). Full capability = **multi-session**, gated on Enzo approval.

## 8. Testing

- **Integration** (`apps/api/test/content.integration.test.ts`, live DB via tunnel): RBAC (each of the 5 permissions enforced) + CSRF on writes + tenant-scope isolation (a TENANT_ADMIN of tenant A cannot read/edit tenant B content) + lifecycle guards (publish requires `content:publish`; ESS persona sees only published) + versioning (edit appends a version, restore appends a copy, history immutable) + empty-state. Deterministic on the rebuilt RTL_BANK seed personas.
- **E2E** (Playwright, live data): admin authors + publishes an article, asserts it renders; an ESS persona reads it in the KB; a draft is NOT visible to ESS. No mock.
- **Validation**: `pnpm db:validate` (7 views) must stay green — the registry registration (§4) is what keeps `0 UNCLASSIFIED`. Migrations idempotent + twice-run empty `pg_dump` diff (the established invariant).

## 9. Dependencies / blockers

- **No new infra** (unlike AI's pgvector/Voyage) and **no new external service** (unlike a headless CMS). `pg_trgm` for P3 search is already installed. This is the lowest-infra capability of the five.
- **Editor primitive** (P1+) depends on the `ux-design-shared` → `@heuresys/ui` release workflow (post-X18) — an upstream-repo task, not in-repo. Mitigated for P1 by the plain-markdown `<textarea>` fallback.
- **Media/attachments** (P3) has no storage layer today (the platform stores `sys_user_documents` as URIs, not blobs) — a genuine open design (D-2), explicitly deferred out of P1/P2.

## 10. OPEN DECISIONS for Enzo (the gate)

| # | Decision | Options | CLI recommendation |
|---|---|---|---|
| **D-1** | **Editor format / primitive** | (a) markdown source (`<textarea>` P1, lightweight markdown render); (b) rich-text WYSIWYG primitive in `@heuresys/ui` (upstream work, heavier); (c) both — markdown P1, rich-text P3 | **(c)** — markdown unblocks P1 with zero upstream dependency; rich-text primitive lands P3 in `ux-design-shared`. `document_body_format` CHECK already accommodates both. |
| **D-2** | **Media / attachment storage** | (a) none — text-only CMS; (b) URI references (like `sys_user_documents`, external/object store, no blobs in PG); (c) blobs in PG (`bytea`/large objects — rejected by spirit, bloats DB) | **(b)** if media is wanted at all, URI references at P3; (a) is fine for P1/P2. **Not** (c). Needs Enzo's call on whether media is in scope at all. |
| **D-3** | **Reuse/extend `sys_user_documents` vs new tables** | (a) new `sys_content_*` tables (this spec); (b) extend `sys_user_documents` with tenant-scope + versioning + status | **(a)** — the existing table is person-owned `ON DELETE CASCADE`, unversioned, untaxonomized, self-scoped private files (657 rows). Bending it into tenant-owned versioned published content would corrupt its semantics and risk the 657 live rows. The two domains are disjoint. **Reuse rejected.** |
| **D-4** | **Taxonomy authority / shape** | (a) flat tenant categories (P1); (b) hierarchical tree (self-FK); (c) tag-based (many-to-many) | **(a) flat P1**, with `category_parent_id` reserved (nullable) for an optional tree later. Tags = a P3 add if needed. Avoids P1 recursion scope creep. |
| **D-5** | **Delete semantics** | (a) soft (`archived` status, never hard-delete); (b) hard delete (CASCADE versions); (c) both (archive default, hard-delete admin-only) | **(c)** — `archived` is the default user-facing "delete"; a hard delete reserved for `PLATFORM_ADMIN`. Preserves audit/history. |
| **D-6** | **Publish authority (separation of duties)** | (a) `content:publish` = `PLATFORM_ADMIN, TENANT_ADMIN` only; (b) also `HRMS_MANAGER`; (c) author can self-publish (no separation) | **(a)** default (publisher ≠ author), widen to (b) if HR ownership is desired. Enzo's policy call. |
| **D-7** | **ESS read path** | (a) extend `content:read` to `USER`/`READ_ONLY` filtered to published; (b) a self-scope `me:content:read` via the `me` module (ADR-0011) | **(b)** — keeps the admin/ESS permission split clean and consistent with ADR-0011 ("ESS routes get a dedicated module, don't bolt `/me/*` onto existing modules"). |
| **D-8** | **BPM/process-doc cross-link** | (a) in scope as P3 (`document_linked_process_id` → `process-*`); (b) out of scope entirely | **(a) P3** — it's the roadmap's natural hook ("process documentation tied to the BPM/blueprint engine") but additive and deferrable. |

## 11. Honest note

Full CMS implementation is **multi-session** (P1 ~1.5 sessions, P2 ~1–1.5, P3 multi-slice), **gated on Enzo's approval** of this design and the open decisions above. This spec closes the **DESIGN stage only** — no code, no migration, no DDL is authored here. Per the program model (brainstorm → spec → **Enzo approval** → plan → implementation), the next artifact is a P1 plan, authored only after Enzo approves this spec and resolves at least D-1, D-2 (in/out), and D-7. CMS is the roadmap's #4 priority (useful, low-risk, ties to BPM; not differentiating) — lower than ① BI / ② AI.

## 12. Out of scope (this spec)

Headless CMS integration (Payload/Strapi — rejected, breaks single-stack + I5); binary blob storage in PG; per-page CMS / site-builder; the BPM cross-link beyond a nullable FK reference (the deep process-documentation modeling is a separate slice); approval-workflow beyond the linear lifecycle (multi-step review chains = a later add). Phases 2/3 get their own thin plans on top of this P1 foundation.
