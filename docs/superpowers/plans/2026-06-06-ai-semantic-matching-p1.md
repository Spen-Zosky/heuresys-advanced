# AI ② Semantic Matching — P1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backfill the (already-shipped, empty) pgvector embedding substrate with real Voyage embeddings and expose a `semantic-matching` API module so a person can be matched (kNN cosine) to ESCO occupations, and skills to similar skills.

**Architecture:** Embeddings are computed **at index time** by a standalone, operator-run backfill script (reads `VOYAGE_API_KEY` from the local `.env`, calls Voyage REST, writes vectors through the DB pool/tunnel). The serving API is **pure pgvector** (kNN over precomputed vectors) — the production VM API never calls Voyage. Person-profile vectors are **derived in SQL** as the mean-pool (`avg(vector)`) of each person's skill-evidence skill embeddings. The Voyage call is hidden behind an injectable `Embedder` interface so CI/tests use a deterministic offline fake (no live API).

**Tech Stack:** Fastify 5 + `fastify-type-provider-zod` 6, Zod 4.4.3 (`z.uuid()/z.iso.*`), `pg` raw parameterized SQL, pgvector 0.8.2 (`<=>` cosine, HNSW, `avg(vector)`), Voyage `voyage-4-lite` (1024-dim, REST `https://api.voyageai.com/v1/embeddings`), vitest 4 singleThread integration tests via `buildTestApp()`.

---

## Verified facts (live DB, 2026-06-06 — do NOT re-assume)

| Fact | Value |
|---|---|
| pgvector extension | installed (`pg_extension` `vector` = 1), v0.8.2 |
| 4 embedding tables (mig `000060`) | exist, **empty** (`sys_skill_embeddings`, `sys_esco_occupation_embeddings`, `sys_job_role_embeddings`, `sys_user_profile_embeddings`) |
| `matching:read` / `matching:admin` perms | seeded (read → 6 admin roles + USER; admin → PLATFORM_ADMIN+TENANT_ADMIN) |
| `sys_skills` | **21939** rows, all with `skill_name`; cols `skill_id, skill_name, skill_description, skill_esco_uri, skill_is_global, skill_tenant_id, …` |
| `sys_job_roles` | **227** rows; cols `job_role_id, job_role_name, job_role_description, …` |
| `sys_esco_occupation_mappings` | 7645 rows = **7645 distinct `esco_occupation_mapping_esco_uri`**; cols `…_esco_uri, …_esco_label, …_isco_code, …_job_role_id, …` (note: distinct *labels* < URIs → dedup texts before embedding) |
| `sys_user_skill_evidence` | **902** rows / **156** distinct users / 31 distinct skills; cols `user_skill_evidence_user_id, user_skill_evidence_skill_id, user_skill_evidence_tenant_id, …` |
| `sys_users` | 161; PK `user_id`, tenant `user_tenant_id`, email `user_email` |
| `avg(vector)` aggregate | **supported** → mean-pool in SQL |
| cosine `<=>` | `1 - (a <=> b)` = similarity; `ORDER BY a <=> b ASC` = nearest first |

**No new migration** — `000060` already shipped the tables + permissions. P1 is code + backfill data only.

## Scope

**In P1 (this plan):** env wiring · Voyage client + fake · shared Zod schema · embedding repository (upsert/corpus/derive/kNN) · backfill script · `semantic-matching` service+routes (`/v1/matching/*`, 3 read endpoints) · integration tests · operator backfill run.

**NOT in P1 (explicit, deferred):**
- ESS frontend page `/me/matching` + Playwright E2E → **P1b** (follow-on, like BI P1→P1b).
- Server-side `POST /v1/matching/reindex` (`matching:admin`) → **P2** (the standalone script is the reindex path for P1; the permission is already seeded for later).
- Free-text arbitrary search (live query-time embed) → later (Phase 1 uses **precomputed** vectors only).
- person↔person, person→job_roles surface, position→candidates → **Phase 2/3** (spec §3) on this same substrate.

## File structure

| File | Action | Responsibility |
|---|---|---|
| `apps/api/src/config/env.ts` | modify | add optional `VOYAGE_API_KEY` |
| `.env.example` | modify | document the Voyage block |
| `packages/shared/src/schemas/semantic-matching.ts` | create | Zod schemas (matches + queries + responses) |
| `packages/shared/src/index.ts` | modify | barrel `export *` |
| `packages/shared/package.json` | modify | subpath export `./schemas/semantic-matching` |
| `apps/api/src/modules/semantic-matching/voyage-client.ts` | create | `Embedder` iface + `VoyageEmbedder` (REST) + `FakeEmbedder` + `makeEmbedder()` |
| `apps/api/src/modules/semantic-matching/repository.ts` | create | vector-literal helper, upserts, corpus reads, SQL mean-pool derive, kNN queries |
| `apps/api/src/modules/semantic-matching/backfill.ts` | create | runnable one-shot/incremental backfill (compose embedder + repo) |
| `apps/api/src/modules/semantic-matching/service.ts` | create | `ActorContext` scope + match ops |
| `apps/api/src/modules/semantic-matching/routes.ts` | create | `/v1/matching/*` (3 GET reads) |
| `apps/api/src/app.ts` | modify | import + `register(..., { prefix: "/v1/matching" })` |
| `package.json` (root) | modify | `"embeddings:backfill"` script |
| `apps/api/test/semantic-matching.integration.test.ts` | create | deterministic kNN + scope + empty-state + 401 |

**Two atomic commits** (project convention "module = atomic commit"; pipeline and serving module are separable deliverables — may be squashed into one if preferred):
- **Commit 1 (pipeline):** Tasks 1–6 → `feat(api): AI ② P1 — embedding pipeline (Voyage client + backfill + env wiring)`
- **Commit 2 (module):** Tasks 7–10 → `feat(api): AI ② P1 — semantic-matching module (/v1/matching/*, 3 endpoints, N tests)`

---

## Task 1: Env wiring — `VOYAGE_API_KEY`

**Files:**
- Modify: `apps/api/src/config/env.ts` (EnvSchema, after `MFA_ENCRYPTION_KEY`)
- Modify: `.env.example` (new block before the Frontend block)

- [ ] **Step 1: Add the optional key to the Zod env schema**

In `apps/api/src/config/env.ts`, inside `const EnvSchema = z.object({ … })`, after the `MFA_ENCRYPTION_KEY` field, add:

```ts
  // AI ② Semantic Matching — Voyage embeddings API key. OPTIONAL: only the
  // embedding BACKFILL script (db/embeddings:backfill) needs it. The serving
  // API never calls Voyage (kNN runs over precomputed pgvector rows), so a
  // missing key does NOT break the server — it only fails the backfill loudly.
  VOYAGE_API_KEY: z.string().min(1).optional(),
```

- [ ] **Step 2: Document it in `.env.example`**

In `.env.example`, insert before the `# Frontend (apps/web)` block:

```bash
# -----------------------------------------------------------------------------
# AI ② Semantic Matching — Voyage embeddings (voyage-4-lite, 1024-dim)
# ONLY required to run the embedding backfill (pnpm embeddings:backfill).
# The serving API does NOT need it (kNN runs over precomputed pgvector rows).
# Create a key at https://dashboard.voyageai.com/organization/api-keys
# -----------------------------------------------------------------------------
# VOYAGE_API_KEY=pa-...
```

- [ ] **Step 3: Typecheck the API**

Run: `cd apps/api && pnpm typecheck`
Expected: PASS (the new optional field changes nothing else).

---

## Task 2: Shared Zod schema

**Files:**
- Create: `packages/shared/src/schemas/semantic-matching.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/package.json`

- [ ] **Step 1: Write the schema file**

Create `packages/shared/src/schemas/semantic-matching.ts`:

```ts
/**
 * @heuresys/shared — semantic-matching schemas (AI ② P1).
 * Backs /v1/matching/* read endpoints (kNN cosine over pgvector embeddings).
 * Matches are derived/read-only; score = cosine similarity in [0,1].
 */
import { z } from "zod";

export const MatchQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});
export type MatchQuery = z.infer<typeof MatchQuerySchema>;

export const OccupationMatchSchema = z.object({
  escoUri: z.string(),
  label: z.string().nullable(),
  iscoCode: z.string().nullable(),
  score: z.number(),
});
export type OccupationMatch = z.infer<typeof OccupationMatchSchema>;

export const OccupationMatchListResponseSchema = z.object({
  items: z.array(OccupationMatchSchema),
  total: z.number().int().min(0),
  evidenceCount: z.number().int().min(0), // person-profile sparsity, honest empty-state
});

export const SkillMatchSchema = z.object({
  skillId: z.uuid(),
  skillName: z.string().nullable(),
  score: z.number(),
});
export type SkillMatch = z.infer<typeof SkillMatchSchema>;

export const SkillMatchListResponseSchema = z.object({
  items: z.array(SkillMatchSchema),
  total: z.number().int().min(0),
});

export const MatchUserIdParamSchema = z.object({ userId: z.uuid() });
export const MatchSkillIdParamSchema = z.object({ skillId: z.uuid() });
```

- [ ] **Step 2: Register in the barrel + package exports**

In `packages/shared/src/index.ts`, after the mentorship line (`export * from "./schemas/mentorship.js";`) add:

```ts
export * from "./schemas/semantic-matching.js";
```

In `packages/shared/package.json`, inside `"exports"`, after the `"./schemas/mentorship"` block add:

```json
    "./schemas/semantic-matching": {
      "types": "./dist/schemas/semantic-matching.d.ts",
      "default": "./src/schemas/semantic-matching.ts"
    }
```

- [ ] **Step 3: Rebuild the shared dist (the api typecheck resolves `@heuresys/shared` types from `dist/`)**

Run: `pnpm --filter @heuresys/shared build`
Expected: PASS, emits `packages/shared/dist/schemas/semantic-matching.d.ts`.

- [ ] **Step 4: Typecheck consumers**

Run: `cd apps/api && pnpm typecheck`
Expected: PASS.

---

## Task 3: Voyage client (`Embedder` interface + real + fake)

**Files:**
- Create: `apps/api/src/modules/semantic-matching/voyage-client.ts`
- Test: `apps/api/test/semantic-matching-backfill.test.ts` (created here, extended in Task 6)

- [ ] **Step 1: Write the failing unit test for batching + fake determinism**

Create `apps/api/test/semantic-matching-backfill.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { FakeEmbedder, fakeVector } from "../src/modules/semantic-matching/voyage-client.js";

describe("voyage-client (fake, offline)", () => {
  it("FakeEmbedder returns one 1024-dim vector per text, deterministic", async () => {
    const e = new FakeEmbedder();
    const a = await e.embed(["data analyst", "chef"], "document");
    expect(a).toHaveLength(2);
    expect(a[0]).toHaveLength(1024);
    const b = await e.embed(["data analyst"], "document");
    expect(b[0]).toEqual(a[0]); // deterministic for the same text
    expect(fakeVector("chef")).not.toEqual(fakeVector("data analyst"));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/api && pnpm exec vitest run test/semantic-matching-backfill.test.ts`
Expected: FAIL — module `voyage-client.js` not found.

- [ ] **Step 3: Implement the client**

Create `apps/api/src/modules/semantic-matching/voyage-client.ts`:

```ts
/**
 * apps/api/src/modules/semantic-matching/voyage-client.ts
 * Embedding provider abstraction. VoyageEmbedder hits the Voyage REST API
 * (backfill only); FakeEmbedder is deterministic + offline (CI/tests). The
 * serving API never instantiates an embedder — kNN reads precomputed vectors.
 */
import { env } from "../../config/env.js";

export const EMBED_DIM = 1024;
export const VOYAGE_MODEL = "voyage-4-lite";
const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const MAX_BATCH = 1000; // Voyage hard limit: 1000 texts/request

export interface Embedder {
  readonly modelId: string;
  /** Embed texts → one EMBED_DIM vector each, order-preserving. */
  embed(texts: string[], inputType: "document" | "query"): Promise<number[][]>;
}

export class VoyageEmbedder implements Embedder {
  readonly modelId = VOYAGE_MODEL;
  constructor(private readonly apiKey: string) {}

  async embed(texts: string[], inputType: "document" | "query"): Promise<number[][]> {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += MAX_BATCH) {
      const batch = texts.slice(i, i + MAX_BATCH);
      const res = await fetch(VOYAGE_URL, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          input: batch, model: VOYAGE_MODEL, input_type: inputType, output_dimension: EMBED_DIM,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Voyage embed failed: HTTP ${res.status} — ${body.slice(0, 300)}`);
      }
      const json = (await res.json()) as { data: { index: number; embedding: number[] }[] };
      const ordered = [...json.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
      out.push(...ordered);
    }
    return out;
  }
}

/** Deterministic offline embedder: same text → same sparse 1024-dim vector. No network. */
export class FakeEmbedder implements Embedder {
  readonly modelId = "fake-test-embedder";
  async embed(texts: string[], _inputType: "document" | "query"): Promise<number[][]> {
    return texts.map(fakeVector);
  }
}

export function fakeVector(text: string): number[] {
  const v = new Array<number>(EMBED_DIM).fill(0);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  for (let k = 0; k < 8; k++) {
    h = Math.imul(h ^ (h >>> 13), 16777619);
    v[Math.abs(h) % EMBED_DIM] = (((h >>> 8) & 0xff) / 255) + 0.1;
  }
  return v;
}

/** Build the real embedder; throws loudly if the key is absent (backfill-only path). */
export function makeEmbedder(): Embedder {
  if (!env.VOYAGE_API_KEY) {
    throw new Error("VOYAGE_API_KEY is not set — required to run the embedding backfill. Add it to .env (see .env.example).");
  }
  return new VoyageEmbedder(env.VOYAGE_API_KEY);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/api && pnpm exec vitest run test/semantic-matching-backfill.test.ts`
Expected: PASS.

---

## Task 4: Embedding repository (upsert · corpus · derive · kNN)

**Files:**
- Create: `apps/api/src/modules/semantic-matching/repository.ts`

- [ ] **Step 1: Write the repository**

Create `apps/api/src/modules/semantic-matching/repository.ts`:

```ts
/**
 * apps/api/src/modules/semantic-matching/repository.ts
 * Raw parameterized SQL for the embedding substrate (sys.sys_*_embeddings) +
 * kNN cosine queries (pgvector <=>). Person profiles are mean-pooled in SQL.
 */
import type { Pool, PoolClient } from "pg";
import type { OccupationMatch, SkillMatch } from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

/** pgvector text input format: '[v1,v2,...]'. */
export const toVectorLiteral = (v: number[]): string => `[${v.join(",")}]`;

const num = (v: string | null): number => (v === null ? 0 : Number(v));

// ── Corpus reads (entity → text to embed) ──
export interface CorpusItem { id: string; text: string }

export async function readSkillCorpus(q: DbConnector): Promise<CorpusItem[]> {
  const r = await q.query<CorpusItem>(
    `SELECT skill_id AS id,
            btrim(coalesce(skill_name,'') || ' ' || coalesce(skill_description,'')) AS text
     FROM sys.sys_skills
     WHERE skill_name IS NOT NULL AND btrim(skill_name) <> ''`);
  return r.rows;
}

export async function readJobRoleCorpus(q: DbConnector): Promise<CorpusItem[]> {
  const r = await q.query<CorpusItem>(
    `SELECT job_role_id AS id,
            btrim(coalesce(job_role_name,'') || ' ' || coalesce(job_role_description,'')) AS text
     FROM sys.sys_job_roles
     WHERE job_role_name IS NOT NULL AND btrim(job_role_name) <> ''`);
  return r.rows;
}

export interface OccCorpusItem { uri: string; label: string; isco: string | null; text: string }
export async function readOccupationCorpus(q: DbConnector): Promise<OccCorpusItem[]> {
  // One row per distinct URI (the embedding table is keyed by URI). Text = label.
  const r = await q.query<OccCorpusItem>(
    `SELECT DISTINCT ON (esco_occupation_mapping_esco_uri)
            esco_occupation_mapping_esco_uri  AS uri,
            esco_occupation_mapping_esco_label AS label,
            esco_occupation_mapping_isco_code  AS isco,
            btrim(coalesce(esco_occupation_mapping_esco_label,'')) AS text
     FROM sys.sys_esco_occupation_mappings
     WHERE esco_occupation_mapping_esco_label IS NOT NULL
       AND btrim(esco_occupation_mapping_esco_label) <> ''
     ORDER BY esco_occupation_mapping_esco_uri`);
  return r.rows;
}

// ── Existing-hash reads (for hash-skip idempotency) ──
export async function readSkillHashes(q: DbConnector): Promise<Map<string, string>> {
  const r = await q.query<{ skill_id: string; source_text_hash: string | null }>(
    `SELECT skill_id, source_text_hash FROM sys.sys_skill_embeddings`);
  return new Map(r.rows.map((x) => [x.skill_id, x.source_text_hash ?? ""]));
}
export async function readJobRoleHashes(q: DbConnector): Promise<Map<string, string>> {
  const r = await q.query<{ job_role_id: string; source_text_hash: string | null }>(
    `SELECT job_role_id, source_text_hash FROM sys.sys_job_role_embeddings`);
  return new Map(r.rows.map((x) => [x.job_role_id, x.source_text_hash ?? ""]));
}
export async function readOccupationHashes(q: DbConnector): Promise<Map<string, string>> {
  const r = await q.query<{ esco_uri: string; source_text_hash: string | null }>(
    `SELECT esco_uri, source_text_hash FROM sys.sys_esco_occupation_embeddings`);
  return new Map(r.rows.map((x) => [x.esco_uri, x.source_text_hash ?? ""]));
}

// ── Upserts (1:1 on the natural key; re-embed = clean overwrite) ──
export async function upsertSkillEmbedding(q: DbConnector, skillId: string, vec: number[], modelId: string, hash: string): Promise<void> {
  await q.query(
    `INSERT INTO sys.sys_skill_embeddings (skill_id, embedding, model_id, source_text_hash)
     VALUES ($1, $2::vector, $3, $4)
     ON CONFLICT (skill_id) DO UPDATE SET embedding = EXCLUDED.embedding, model_id = EXCLUDED.model_id, source_text_hash = EXCLUDED.source_text_hash`,
    [skillId, toVectorLiteral(vec), modelId, hash]);
}
export async function upsertJobRoleEmbedding(q: DbConnector, jobRoleId: string, vec: number[], modelId: string, hash: string): Promise<void> {
  await q.query(
    `INSERT INTO sys.sys_job_role_embeddings (job_role_id, embedding, model_id, source_text_hash)
     VALUES ($1, $2::vector, $3, $4)
     ON CONFLICT (job_role_id) DO UPDATE SET embedding = EXCLUDED.embedding, model_id = EXCLUDED.model_id, source_text_hash = EXCLUDED.source_text_hash`,
    [jobRoleId, toVectorLiteral(vec), modelId, hash]);
}
export async function upsertOccupationEmbedding(q: DbConnector, uri: string, vec: number[], label: string | null, isco: string | null, modelId: string, hash: string): Promise<void> {
  await q.query(
    `INSERT INTO sys.sys_esco_occupation_embeddings (esco_uri, embedding, label_text, isco_code, model_id, source_text_hash)
     VALUES ($1, $2::vector, $3, $4, $5, $6)
     ON CONFLICT (esco_uri) DO UPDATE SET embedding = EXCLUDED.embedding, label_text = EXCLUDED.label_text, isco_code = EXCLUDED.isco_code, model_id = EXCLUDED.model_id, source_text_hash = EXCLUDED.source_text_hash`,
    [uri, toVectorLiteral(vec), label, isco, modelId, hash]);
}

/** Mean-pool every person's skill-evidence skill embeddings into a profile vector (SQL avg). Returns #profiles written. */
export async function deriveUserProfiles(q: DbConnector, modelId: string): Promise<number> {
  const r = await q.query(
    `INSERT INTO sys.sys_user_profile_embeddings (user_id, tenant_id, embedding, derived_from_evidence_count, model_id)
     SELECT e.user_skill_evidence_user_id, u.user_tenant_id, avg(se.embedding), count(*)::int, $1
     FROM sys.sys_user_skill_evidence e
     JOIN sys.sys_skill_embeddings se ON se.skill_id = e.user_skill_evidence_skill_id
     JOIN sys.sys_users u ON u.user_id = e.user_skill_evidence_user_id
     GROUP BY e.user_skill_evidence_user_id, u.user_tenant_id
     ON CONFLICT (user_id) DO UPDATE SET embedding = EXCLUDED.embedding, derived_from_evidence_count = EXCLUDED.derived_from_evidence_count, model_id = EXCLUDED.model_id`,
    [modelId]);
  return r.rowCount ?? 0;
}

// ── kNN queries (cosine; ORDER BY <=> ASC = nearest) ──
export async function knnOccupationsForUser(q: DbConnector, userId: string, limit: number): Promise<{ items: OccupationMatch[]; evidenceCount: number }> {
  const prof = await q.query<{ derived_from_evidence_count: number }>(
    `SELECT derived_from_evidence_count FROM sys.sys_user_profile_embeddings WHERE user_id = $1`, [userId]);
  if (prof.rowCount === 0) return { items: [], evidenceCount: 0 };
  const r = await q.query<{ esco_uri: string; label_text: string | null; isco_code: string | null; score: string }>(
    `WITH me AS (SELECT embedding FROM sys.sys_user_profile_embeddings WHERE user_id = $1)
     SELECT oe.esco_uri, oe.label_text, oe.isco_code,
            (1 - (oe.embedding <=> (SELECT embedding FROM me)))::text AS score
     FROM sys.sys_esco_occupation_embeddings oe
     ORDER BY oe.embedding <=> (SELECT embedding FROM me)
     LIMIT $2`, [userId, limit]);
  return {
    items: r.rows.map((x) => ({ escoUri: x.esco_uri, label: x.label_text, iscoCode: x.isco_code, score: num(x.score) })),
    evidenceCount: prof.rows[0]!.derived_from_evidence_count,
  };
}

export async function knnSimilarSkills(q: DbConnector, skillId: string, limit: number): Promise<SkillMatch[]> {
  const self = await q.query(`SELECT 1 FROM sys.sys_skill_embeddings WHERE skill_id = $1`, [skillId]);
  if (self.rowCount === 0) return [];
  const r = await q.query<{ skill_id: string; skill_name: string | null; score: string }>(
    `WITH s AS (SELECT embedding FROM sys.sys_skill_embeddings WHERE skill_id = $1)
     SELECT se.skill_id, sk.skill_name,
            (1 - (se.embedding <=> (SELECT embedding FROM s)))::text AS score
     FROM sys.sys_skill_embeddings se
     JOIN sys.sys_skills sk ON sk.skill_id = se.skill_id
     WHERE se.skill_id <> $1
     ORDER BY se.embedding <=> (SELECT embedding FROM s)
     LIMIT $2`, [skillId, limit]);
  return r.rows.map((x) => ({ skillId: x.skill_id, skillName: x.skill_name, score: num(x.score) }));
}

/** Resolve a target user's tenant (for admin scope checks). */
export async function findUserTenant(q: DbConnector, userId: string): Promise<string | null> {
  const r = await q.query<{ user_tenant_id: string }>(`SELECT user_tenant_id FROM sys.sys_users WHERE user_id = $1`, [userId]);
  return r.rows[0]?.user_tenant_id ?? null;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/api && pnpm typecheck`
Expected: PASS.

---

## Task 5: Backfill script

**Files:**
- Create: `apps/api/src/modules/semantic-matching/backfill.ts`
- Modify: `package.json` (root) — add the run script

- [ ] **Step 1: Write the backfill**

Create `apps/api/src/modules/semantic-matching/backfill.ts`:

```ts
/**
 * apps/api/src/modules/semantic-matching/backfill.ts
 * One-shot + incremental embedding backfill. Run on-demand by an operator:
 *   pnpm embeddings:backfill
 * Reads VOYAGE_API_KEY from .env (via config/env.ts), embeds skills/occupations/
 * job_roles (hash-skip on re-run), then derives person profiles in SQL.
 * The production serving API never runs this — kNN reads precomputed vectors.
 */
import { createHash } from "node:crypto";
import { pool } from "../../db/client.js";
import { makeEmbedder, type Embedder } from "./voyage-client.js";
import * as repo from "./repository.js";

const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

interface Stats { embedded: number; skipped: number }

/** Embed a corpus with hash-skip, in batches, calling `upsert` per item. */
async function backfillCorpus(
  embedder: Embedder,
  items: { id: string; text: string }[],
  existing: Map<string, string>,
  upsert: (id: string, vec: number[], hash: string) => Promise<void>,
): Promise<Stats> {
  const stats: Stats = { embedded: 0, skipped: 0 };
  const pending = items.filter((it) => { const h = sha(it.text); if (existing.get(it.id) === h) { stats.skipped++; return false; } return true; });
  const BATCH = 500;
  for (let i = 0; i < pending.length; i += BATCH) {
    const slice = pending.slice(i, i + BATCH);
    const vectors = await embedder.embed(slice.map((s) => s.text), "document");
    for (let j = 0; j < slice.length; j++) {
      await upsert(slice[j]!.id, vectors[j]!, sha(slice[j]!.text));
      stats.embedded++;
    }
    console.log(JSON.stringify({ phase: "backfill", batch: `${i + slice.length}/${pending.length}`, embedded: stats.embedded }));
  }
  return stats;
}

export async function runBackfill(embedder: Embedder = makeEmbedder()): Promise<void> {
  const modelId = embedder.modelId;

  const skills = await repo.readSkillCorpus(pool);
  const skillHashes = await repo.readSkillHashes(pool);
  const s1 = await backfillCorpus(embedder, skills, skillHashes,
    (id, vec, hash) => repo.upsertSkillEmbedding(pool, id, vec, modelId, hash));
  console.log(JSON.stringify({ phase: "skills", ...s1 }));

  const roles = await repo.readJobRoleCorpus(pool);
  const roleHashes = await repo.readJobRoleHashes(pool);
  const s2 = await backfillCorpus(embedder, roles, roleHashes,
    (id, vec, hash) => repo.upsertJobRoleEmbedding(pool, id, vec, modelId, hash));
  console.log(JSON.stringify({ phase: "job_roles", ...s2 }));

  const occ = await repo.readOccupationCorpus(pool);
  const occHashes = await repo.readOccupationHashes(pool);
  const occByUri = new Map(occ.map((o) => [o.uri, o]));
  const s3 = await backfillCorpus(
    embedder, occ.map((o) => ({ id: o.uri, text: o.text })), occHashes,
    (uri, vec, hash) => { const o = occByUri.get(uri)!; return repo.upsertOccupationEmbedding(pool, uri, vec, o.label, o.isco, modelId, hash); });
  console.log(JSON.stringify({ phase: "occupations", ...s3 }));

  const profiles = await repo.deriveUserProfiles(pool, modelId);
  console.log(JSON.stringify({ phase: "user_profiles", written: profiles }));
}

// Run when invoked directly (tsx). Closes the pool so the process exits.
const isMain = process.argv[1]?.endsWith("backfill.ts") || process.argv[1]?.endsWith("backfill.js");
if (isMain) {
  runBackfill()
    .then(() => { console.log("backfill complete"); return pool.end(); })
    .then(() => process.exit(0))
    .catch((err) => { console.error("backfill FAILED:", err); void pool.end().finally(() => process.exit(1)); });
}
```

- [ ] **Step 2: Add the run script to root `package.json`**

In `package.json` `"scripts"`, after `"db:seed-r1b": …` add:

```json
    "embeddings:backfill": "pnpm --filter @heuresys/api exec tsx src/modules/semantic-matching/backfill.ts",
```

- [ ] **Step 3: Extend the unit test — `runBackfill` with the FakeEmbedder writes + derives (offline, against live DB tunnel)**

Append to `apps/api/test/semantic-matching-backfill.test.ts`:

```ts
import { runBackfill } from "../src/modules/semantic-matching/backfill.js";
import { pool } from "../src/db/client.js";

describe("runBackfill (FakeEmbedder, offline)", () => {
  it("populates skill/occupation/role embeddings + derives ≥1 user profile", async () => {
    await runBackfill(new FakeEmbedder());
    const skill = await pool.query("SELECT count(*)::int AS c FROM sys.sys_skill_embeddings");
    const occ = await pool.query("SELECT count(*)::int AS c FROM sys.sys_esco_occupation_embeddings");
    const role = await pool.query("SELECT count(*)::int AS c FROM sys.sys_job_role_embeddings");
    const prof = await pool.query("SELECT count(*)::int AS c FROM sys.sys_user_profile_embeddings");
    expect(skill.rows[0].c).toBeGreaterThan(20000);
    expect(occ.rows[0].c).toBeGreaterThan(7000);
    expect(role.rows[0].c).toBe(227);
    expect(prof.rows[0].c).toBeGreaterThanOrEqual(150); // 156 evidence-bearing users
    // idempotent: a second run skips everything (hash match), profiles re-derived
    await runBackfill(new FakeEmbedder());
    const skill2 = await pool.query("SELECT count(*)::int AS c FROM sys.sys_skill_embeddings");
    expect(skill2.rows[0].c).toBe(skill.rows[0].c);
  }, 120_000);
});
```

> **Note:** this test fully populates the embedding tables with *fake* vectors against the live tunneled DB. That is acceptable for CI (the substrate is a derived/regenerable artifact) and it doubles as the integration-seed for Task 9-style assertions. The real Voyage backfill (Task 9) later overwrites these with real vectors (hash differs → re-embed). If you prefer the DB to never hold fake vectors, gate this `describe` behind `process.env.EMBED_FAKE_OK` — but the default keeps CI self-contained.

- [ ] **Step 4: Run the test**

Run: `cd apps/api && pnpm exec vitest run test/semantic-matching-backfill.test.ts`
Expected: PASS (first run embeds, second run skips; counts assert).

- [ ] **Step 5: Commit 1 (pipeline)**

```bash
git add apps/api/src/config/env.ts .env.example \
  packages/shared/src/schemas/semantic-matching.ts packages/shared/src/index.ts packages/shared/package.json packages/shared/dist \
  apps/api/src/modules/semantic-matching/voyage-client.ts \
  apps/api/src/modules/semantic-matching/repository.ts \
  apps/api/src/modules/semantic-matching/backfill.ts \
  apps/api/test/semantic-matching-backfill.test.ts package.json
git commit -m "feat(api): AI ② P1 — embedding pipeline (Voyage client + backfill + env wiring)

Voyage voyage-4-lite embedder (REST) behind an injectable Embedder iface +
deterministic FakeEmbedder for CI. Backfill script (pnpm embeddings:backfill)
embeds skills/occupations/job_roles with sha256 hash-skip + derives person
profiles via SQL avg(vector). Serving never calls Voyage. Substrate = mig 000060.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Service (scope)

**Files:**
- Create: `apps/api/src/modules/semantic-matching/service.ts`

- [ ] **Step 1: Write the service**

Create `apps/api/src/modules/semantic-matching/service.ts`:

```ts
/**
 * apps/api/src/modules/semantic-matching/service.ts
 * Read-only semantic matching. Self-scope (me) + admin scope (any in-tenant user).
 * Skills catalog is largely global → similar-skills is matching:read for any actor.
 */
import { pool } from "../../db/client.js";
import { NotFoundError } from "../../errors/index.js";
import type { RoleCode } from "../../config/constants.js";
import type { MatchQuery } from "@heuresys/shared";
import * as repo from "./repository.js";

export interface ActorContext {
  userId: string;
  tenantId: string | null;
  roles: RoleCode[];
}
const isPlatform = (a: ActorContext): boolean => a.roles.includes("PLATFORM_ADMIN");

export const semanticMatchingService = {
  /** Caller's own person-profile → top-N ESCO occupations. */
  async myOccupations(a: ActorContext, q: MatchQuery) {
    return repo.knnOccupationsForUser(pool, a.userId, q.limit);
  },

  /** Any user in the actor's scope → top-N occupations (admin surface). 404 outside scope. */
  async userOccupations(a: ActorContext, userId: string, q: MatchQuery) {
    const tenant = await repo.findUserTenant(pool, userId);
    if (tenant === null) throw new NotFoundError("User");
    if (!isPlatform(a) && (a.tenantId === null || tenant !== a.tenantId)) throw new NotFoundError("User");
    return repo.knnOccupationsForUser(pool, userId, q.limit);
  },

  /** A skill → top-N similar skills (catalog dedup/discovery). */
  async similarSkills(a: ActorContext, skillId: string, q: MatchQuery) {
    const items = await repo.knnSimilarSkills(pool, skillId, q.limit);
    return { items, total: items.length };
  },
};
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/api && pnpm typecheck`
Expected: PASS.

---

## Task 7: Routes + registration

**Files:**
- Create: `apps/api/src/modules/semantic-matching/routes.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Write the routes**

Create `apps/api/src/modules/semantic-matching/routes.ts`:

```ts
/**
 * apps/api/src/modules/semantic-matching/routes.ts
 * /v1/matching/* — read-only kNN endpoints (no writes → no CSRF). matching:read.
 *   GET /me/occupations           — caller's profile → ESCO occupations (ESS self)
 *   GET /users/:userId/occupations — any in-scope user → occupations (admin)
 *   GET /skills/:skillId/similar   — skill → similar skills (catalog)
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyRequest } from "fastify";

import {
  MatchQuerySchema,
  OccupationMatchListResponseSchema,
  SkillMatchListResponseSchema,
  MatchUserIdParamSchema,
  MatchSkillIdParamSchema,
} from "@heuresys/shared";
import { semanticMatchingService, type ActorContext } from "./service.js";
import { requirePermission } from "../../middleware/rbac.js";
import { UnauthorizedError } from "../../errors/index.js";

function actor(req: FastifyRequest): ActorContext {
  if (!req.user) throw new UnauthorizedError("Authentication required");
  return { userId: req.user.userId, tenantId: req.user.tenantId, roles: req.user.roles };
}

export const semanticMatchingRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/me/occupations", {
    preHandler: [requirePermission("matching:read")],
    schema: { querystring: MatchQuerySchema, response: { 200: OccupationMatchListResponseSchema } },
  }, async (req) => {
    const { items, evidenceCount } = await semanticMatchingService.myOccupations(actor(req), req.query);
    return { items, total: items.length, evidenceCount };
  });

  app.get("/users/:userId/occupations", {
    preHandler: [requirePermission("matching:read")],
    schema: { params: MatchUserIdParamSchema, querystring: MatchQuerySchema, response: { 200: OccupationMatchListResponseSchema } },
  }, async (req) => {
    const { items, evidenceCount } = await semanticMatchingService.userOccupations(actor(req), req.params.userId, req.query);
    return { items, total: items.length, evidenceCount };
  });

  app.get("/skills/:skillId/similar", {
    preHandler: [requirePermission("matching:read")],
    schema: { params: MatchSkillIdParamSchema, querystring: MatchQuerySchema, response: { 200: SkillMatchListResponseSchema } },
  }, async (req) => semanticMatchingService.similarSkills(actor(req), req.params.skillId, req.query));
};
```

- [ ] **Step 2: Register in `app.ts`**

In `apps/api/src/app.ts`, near the other module imports (after the mentorship import at line ~94) add:

```ts
import { semanticMatchingRoutes } from "./modules/semantic-matching/routes.js";
```

And after the mentorship register (line ~290, `await app.register(mentorshipRoutes, { prefix: "/v1/mentorship" });`) add:

```ts
  await app.register(semanticMatchingRoutes, { prefix: "/v1/matching" });
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/api && pnpm typecheck`
Expected: PASS.

---

## Task 8: Integration test

**Files:**
- Create: `apps/api/test/semantic-matching.integration.test.ts`

> **Precondition:** this suite seeds its OWN deterministic vectors directly (no Voyage). It does not depend on the backfill test, but if that ran first the seeded persona/occupation rows it inserts are by fixed UUIDs/URIs it also cleans up.

- [ ] **Step 1: Write the failing integration test**

Create `apps/api/test/semantic-matching.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool } from "../src/db/client.js";
import { toVectorLiteral } from "../src/modules/semantic-matching/repository.js";

const PWD = "<TEST_ADMIN_PASSWORD>";
interface S { cookies: Map<string, string>; csrfToken: string }
const ch = (c: Map<string, string>) => [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
async function login(t: TestApp, email: string): Promise<S> {
  const r = await t.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: PWD } });
  if (r.statusCode !== 200) throw new Error(`login ${email}: ${r.statusCode}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

// 1024-dim unit vector with a 1 at index i (rest 0) — controls cosine ordering deterministically.
const unit = (i: number): number[] => { const v = new Array<number>(1024).fill(0); v[i] = 1; return v; };
const near = (i: number): number[] => { const v = unit(i); v[(i + 1) % 1024] = 0.05; return v; };

const URI_FIN = "http://test/esco/IT_MATCH_finance";
const URI_COOK = "http://test/esco/IT_MATCH_cooking";

let suite: TestApp;
let manager: S;      // paolo.caputo (RTL) — will get a seeded profile near "finance"
let tenantAdmin: S;  // federica (RTL TENANT_ADMIN)
let menteeNoProfile: S; // antonio (RTL) — no seeded profile → empty-state
let paoloId: string, antonioId: string, adminUserId: string, adminTenantId: string;

beforeAll(async () => {
  suite = await buildTestApp();
  manager = await login(suite, "paolo.caputo@rtl-bank.org");
  tenantAdmin = await login(suite, "federica.marchetti@rtl-bank.org");
  menteeNoProfile = await login(suite, "antonio.parisi@rtl-bank.org");

  const ids = await pool.query<{ user_id: string; user_tenant_id: string; user_email: string }>(
    `SELECT user_id, user_tenant_id, user_email FROM sys.sys_users
     WHERE user_email IN ('paolo.caputo@rtl-bank.org','antonio.parisi@rtl-bank.org','admin@heuresys.com')`);
  const by = (e: string) => ids.rows.find((r) => r.user_email === e)!;
  paoloId = by("paolo.caputo@rtl-bank.org").user_id;
  antonioId = by("antonio.parisi@rtl-bank.org").user_id;
  adminUserId = by("admin@heuresys.com").user_id;
  adminTenantId = by("admin@heuresys.com").user_tenant_id;
  const paoloTenant = by("paolo.caputo@rtl-bank.org").user_tenant_id;

  // Seed 2 occupation embeddings (finance @ dim 0, cooking @ dim 10).
  await pool.query(
    `INSERT INTO sys.sys_esco_occupation_embeddings (esco_uri, embedding, label_text, model_id)
     VALUES ($1,$2::vector,'Finance specialist','itmatch'),($3,$4::vector,'Cook','itmatch')
     ON CONFLICT (esco_uri) DO UPDATE SET embedding=EXCLUDED.embedding`,
    [URI_FIN, toVectorLiteral(unit(0)), URI_COOK, toVectorLiteral(unit(10))]);
  // Seed paolo's profile near finance; admin's profile near finance too (cross-tenant scope test).
  await pool.query(
    `INSERT INTO sys.sys_user_profile_embeddings (user_id, tenant_id, embedding, derived_from_evidence_count, model_id)
     VALUES ($1,$2,$3::vector,4,'itmatch'),($4,$5,$6::vector,2,'itmatch')
     ON CONFLICT (user_id) DO UPDATE SET embedding=EXCLUDED.embedding, derived_from_evidence_count=EXCLUDED.derived_from_evidence_count`,
    [paoloId, paoloTenant, toVectorLiteral(near(0)), adminUserId, adminTenantId, toVectorLiteral(near(0))]);
});

afterAll(async () => {
  await pool.query(`DELETE FROM sys.sys_esco_occupation_embeddings WHERE esco_uri IN ($1,$2)`, [URI_FIN, URI_COOK]);
  await pool.query(`DELETE FROM sys.sys_user_profile_embeddings WHERE user_id IN ($1,$2)`, [paoloId, adminUserId]);
  await suite.app.close();
});

describe("semantic-matching API", () => {
  it("GET /me/occupations — seeded profile ranks finance above cooking", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/matching/me/occupations?limit=10", headers: { cookie: ch(manager.cookies) } });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { escoUri: string; score: number }[]; evidenceCount: number };
    const fin = body.items.find((x) => x.escoUri === URI_FIN);
    const cook = body.items.find((x) => x.escoUri === URI_COOK);
    expect(fin).toBeDefined();
    expect(fin!.score).toBeGreaterThan(cook!.score);
    expect(body.evidenceCount).toBe(4);
  });

  it("GET /me/occupations — user without a profile gets an honest empty-state", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/matching/me/occupations", headers: { cookie: ch(menteeNoProfile.cookies) } });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown[]; evidenceCount: number };
    expect(body.items).toHaveLength(0);
    expect(body.evidenceCount).toBe(0);
  });

  it("GET /users/:id/occupations — PLATFORM via TENANT scope is blocked cross-tenant (404)", async () => {
    // federica (RTL TENANT_ADMIN) querying the HEURESYS admin user → 404 (no tenant enumeration).
    const r = await suite.app.inject({ method: "GET", url: `/v1/matching/users/${adminUserId}/occupations`, headers: { cookie: ch(tenantAdmin.cookies) } });
    expect(r.statusCode).toBe(404);
  });

  it("GET /users/:id/occupations — TENANT_ADMIN sees an in-tenant user's matches", async () => {
    const r = await suite.app.inject({ method: "GET", url: `/v1/matching/users/${paoloId}/occupations`, headers: { cookie: ch(tenantAdmin.cookies) } });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { evidenceCount: number }).evidenceCount).toBe(4);
  });

  it("unauthenticated request → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/matching/me/occupations" });
    expect(r.statusCode).toBe(401);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL then PASS**

Run: `cd apps/api && pnpm exec vitest run test/semantic-matching.integration.test.ts`
Expected: PASS once Tasks 6–7 are in place (routes mounted, service scope live). If you wrote the test before the routes, the first run FAILS with 404 on `/v1/matching/*`.

- [ ] **Step 3: Full API suite — no regression**

Run: `cd apps/api && pnpm exec vitest run`
Expected: the whole suite green (686 prior + new file). The backfill test leaves real-ish (fake) vectors in the embedding tables — harmless; Task 9 overwrites with real vectors.

- [ ] **Step 4: Commit 2 (module)**

```bash
git add apps/api/src/modules/semantic-matching/service.ts \
  apps/api/src/modules/semantic-matching/routes.ts apps/api/src/app.ts \
  apps/api/test/semantic-matching.integration.test.ts
git commit -m "feat(api): AI ② P1 — semantic-matching module (/v1/matching/*, 3 endpoints, 6 tests)

GET /me/occupations (ESS self), /users/:id/occupations (admin in-tenant scope,
404 cross-tenant), /skills/:id/similar. kNN cosine over pgvector; matching:read.
Person profile = SQL mean-pool of skill-evidence embeddings. No CSRF (reads).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Operator backfill (real Voyage) + verify

> **Requires** `VOYAGE_API_KEY` in the local `.env`. This is the only manual prerequisite. Run from the dev machine (Windows) — it calls Voyage and writes vectors to the tunneled DB. Token volume ~1.3M (well within the voyage-4-lite 200M free tier → $0).

- [ ] **Step 1: Add the key to `.env` (operator — do NOT paste it into chat)**

Append to the repo-root `.env` (gitignored): `VOYAGE_API_KEY=pa-…your-real-key…`

- [ ] **Step 2: Run the real backfill**

Run: `pnpm embeddings:backfill`
Expected: JSON progress logs; final `user_profiles written: ~156`, then `backfill complete`.

- [ ] **Step 3: Verify counts + a real sanity match**

Run:
```bash
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "
SELECT 'skills='||count(*) FROM sys.sys_skill_embeddings WHERE model_id='voyage-4-lite'
UNION ALL SELECT 'occ='||count(*) FROM sys.sys_esco_occupation_embeddings WHERE model_id='voyage-4-lite'
UNION ALL SELECT 'roles='||count(*) FROM sys.sys_job_role_embeddings WHERE model_id='voyage-4-lite'
UNION ALL SELECT 'profiles='||count(*) FROM sys.sys_user_profile_embeddings;"
```
Expected: skills ≈ 21939, occ ≈ 7645, roles = 227, profiles ≈ 156 (all `voyage-4-lite`).

- [ ] **Step 4: Spot-check a real person→occupation match via the API (dev server)**

Start the dev API if down (`cd apps/api && pnpm dev`), then curl `/v1/matching/users/<a-real-RTL-userId>/occupations` with an admin cookie (or rely on the integration assertions). Confirm the top occupation is plausibly related to the person's skills (qualitative sanity — this is real-data validation, not a CI gate).

- [ ] **Step 5: (optional) Deploy to PROD** — `MSYS_NO_PATHCONV=1 ssh oracle-vm-default 'cd /home/ubuntu/heuresys-advanced && bash scripts/vm-deploy.sh'`. The serving routes go live; the DB already holds the vectors (written via the tunnel). The VM never needs `VOYAGE_API_KEY` unless/until P2 ships a server-side reindex endpoint.

---

## Self-Review (run against the spec `2026-06-03-ai-semantic-matching-design.md`)

**1. Spec coverage:**
- §2 shared substrate (pgvector, 4 entities) → Tasks 4–5 (skills/occupations/roles embedded; person-profile derived). ✅
- §3 Phase 1 (person→occupations, skill dedup) → Tasks 6–8 endpoints `/me/occupations`, `/users/:id/occupations`, `/skills/:id/similar`. ✅ (Phase 2/3 explicitly deferred — see Scope.)
- §4.1 Voyage model → Task 3 `voyage-4-lite`, 1024-dim, document/query input_type. ✅
- §4.2 person profile = mean-pool → Task 4 `deriveUserProfiles` SQL `avg(vector)`. ✅
- §4.3 batch backfill + incremental + hash-skip + model_id versioned → Task 5 (`source_text_hash`, `model_id`). ✅
- §4.4 scoping I5 (FK+middleware, self-scope) → Task 6 `userOccupations` tenant check + `myOccupations` self. ✅
- §6 testing (mean-pool unit + recorded fixture, deterministic top-N, empty-state, tenant isolation, no live API in CI) → Tasks 5+8 (FakeEmbedder; deterministic unit vectors; empty-state; cross-tenant 404). ✅
- §7 risks: Voyage cost/dep (free-tier, key local-only) ✅; match quality (deferred hybrid re-rank — noted, P1 = pure vector) ⚠️ acceptable for P1; pgvector ARM64 (verified live) ✅.

**2. Placeholder scan:** none — every step has real code/commands. (Hybrid lexical re-rank from §7 is intentionally out of P1 scope, stated, not a placeholder.)

**3. Type consistency:** `Embedder.embed(texts, inputType)` consistent across VoyageEmbedder/FakeEmbedder/backfill; `OccupationMatch` fields (`escoUri/label/iscoCode/score`) match schema↔repo mapper↔route; `MatchQuery.limit` default 10 consistent; `toVectorLiteral` used in repo + test; `knnOccupationsForUser` returns `{items, evidenceCount}` consumed identically in service+routes.

**Open decision for the executor / Enzo:** the Task-5 backfill unit test writes fake vectors into the live tunneled DB by default (keeps CI self-contained). If you'd rather the shared DB never hold fake vectors, gate that `describe` behind an env flag (noted in Task 5 Step 3). Real vectors overwrite them in Task 9.
