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
import type { EmbeddingFingerprint } from "./repository.js";

export const textHash = (s: string): string => createHash("sha256").update(s).digest("hex");

export interface BackfillStats { embedded: number; skipped: number }

/**
 * Embed a corpus with hash-skip, in batches, calling `upsert` per item.
 * Pure orchestration: `embedder` and `upsert` are injected so this is unit-testable
 * with no network and no DB.
 *
 * Si salta un elemento solo quando coincidono **testo E modello**. Il modello si
 * legge da `embedder.modelId`, che è già iniettato: nessun parametro nuovo,
 * nessuna rete e nessun database, quindi la funzione resta provabile in memoria
 * com'era. Confrontare il solo testo — com'era prima — significa che al cambio
 * di modello di embedding ogni riga viene saltata e il corpus resta misto:
 * vettori vecchi e nuovi mescolati, in spazi diversi, con somiglianze sbagliate
 * e **nessun errore** a segnalarlo. Un `modelId` sconosciuto (`null`) non è
 * "uguale": si ri-embedda, perché non poter dimostrare che è lo stesso modello
 * è una ragione per rifare, non per fidarsi.
 */
export async function backfillCorpus(
  embedder: Embedder,
  items: { id: string; text: string }[],
  existing: Map<string, EmbeddingFingerprint>,
  upsert: (id: string, vec: number[], hash: string) => Promise<void>,
  onBatch?: (done: number, total: number) => void,
): Promise<BackfillStats> {
  const stats: BackfillStats = { embedded: 0, skipped: 0 };
  const pending = items.filter((it) => {
    const prev = existing.get(it.id);
    if (prev && prev.hash === textHash(it.text) && prev.modelId === embedder.modelId) {
      stats.skipped++; return false;
    }
    return true;
  });
  const BATCH = 500;
  for (let i = 0; i < pending.length; i += BATCH) {
    const slice = pending.slice(i, i + BATCH);
    const vectors = await embedder.embed(slice.map((s) => s.text), "document");
    for (let j = 0; j < slice.length; j++) {
      await upsert(slice[j]!.id, vectors[j]!, textHash(slice[j]!.text));
      stats.embedded++;
    }
    onBatch?.(i + slice.length, pending.length);
  }
  return stats;
}

const log = (o: Record<string, unknown>): void => console.log(JSON.stringify(o));

/** Per-corpus + profile totals returned by a backfill run (also used to shape the reindex API response). */
export interface BackfillSummary {
  skills: BackfillStats;
  jobRoles: BackfillStats;
  occupations: BackfillStats;
  profilesWritten: number;
}

export async function runBackfill(embedder: Embedder = makeEmbedder()): Promise<BackfillSummary> {
  const modelId = embedder.modelId;
  const onBatch = (phase: string) => (done: number, total: number) => log({ phase: "backfill", target: phase, progress: `${done}/${total}` });

  const skills = await repo.readSkillCorpus(pool);
  const s1 = await backfillCorpus(embedder, skills, await repo.readSkillHashes(pool),
    (id, vec, hash) => repo.upsertSkillEmbedding(pool, id, vec, modelId, hash), onBatch("skills"));
  log({ phase: "skills", ...s1 });

  const roles = await repo.readJobRoleCorpus(pool);
  const s2 = await backfillCorpus(embedder, roles, await repo.readJobRoleHashes(pool),
    (id, vec, hash) => repo.upsertJobRoleEmbedding(pool, id, vec, modelId, hash), onBatch("job_roles"));
  log({ phase: "job_roles", ...s2 });

  const occ = await repo.readOccupationCorpus(pool);
  const occByUri = new Map(occ.map((o) => [o.uri, o]));
  const s3 = await backfillCorpus(
    embedder, occ.map((o) => ({ id: o.uri, text: o.text })), await repo.readOccupationHashes(pool),
    (uri, vec, hash) => { const o = occByUri.get(uri)!; return repo.upsertOccupationEmbedding(pool, uri, vec, o.label, o.isco, modelId, hash); },
    onBatch("occupations"));
  log({ phase: "occupations", ...s3 });

  const profiles = await repo.deriveUserProfiles(pool, modelId);
  log({ phase: "user_profiles", written: profiles });

  return { skills: s1, jobRoles: s2, occupations: s3, profilesWritten: profiles };
}

// Run when invoked directly (tsx). Closes the pool so the process exits.
const invoked = process.argv[1] ?? "";
if (invoked.endsWith("backfill.ts") || invoked.endsWith("backfill.js")) {
  runBackfill()
    .then(() => { log({ phase: "done" }); return pool.end(); })
    .then(() => process.exit(0))
    .catch((err: unknown) => { console.error("backfill FAILED:", err); void pool.end().finally(() => process.exit(1)); });
}
