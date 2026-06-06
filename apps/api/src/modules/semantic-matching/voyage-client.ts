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
      if (ordered.length !== batch.length) {
        throw new Error(`Voyage returned ${ordered.length}/${batch.length} embeddings for the batch at offset ${i}`);
      }
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
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
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
