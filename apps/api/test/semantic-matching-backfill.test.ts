import { describe, it, expect } from "vitest";
import { FakeEmbedder, fakeVector } from "../src/modules/semantic-matching/voyage-client.js";
import { backfillCorpus, textHash } from "../src/modules/semantic-matching/backfill.js";

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

/** Il modello che `FakeEmbedder` dichiara: le impronte "già a posto" devono nominare questo. */
const FAKE_MODEL = new FakeEmbedder().modelId;

describe("backfillCorpus (hash-skip + batching, in-memory, no DB)", () => {
  it("embeds only items whose text-hash differs from the stored hash, in order", async () => {
    const items = [
      { id: "a", text: "alpha" },
      { id: "b", text: "beta" },
      { id: "c", text: "gamma" },
    ];
    // 'b' already embedded with the SAME text AND the same model → must be skipped.
    // 'a' has a stale hash → re-embed.
    const existing = new Map([
      ["b", { hash: textHash("beta"), modelId: FAKE_MODEL }],
      ["a", { hash: "stale-hash", modelId: FAKE_MODEL }],
    ]);
    const calls: { id: string; hash: string; dim: number }[] = [];
    const upsert = async (id: string, vec: number[], hash: string): Promise<void> => {
      calls.push({ id, hash, dim: vec.length });
    };

    const stats = await backfillCorpus(new FakeEmbedder(), items, existing, upsert);

    expect(stats.skipped).toBe(1);
    expect(stats.embedded).toBe(2);
    expect(calls.map((c) => c.id)).toEqual(["a", "c"]); // 'b' skipped, order preserved
    expect(calls[0]!.hash).toBe(textHash("alpha")); // upsert receives the fresh hash
    expect(calls[0]!.dim).toBe(1024);
  });

  it("skips the entire corpus on a no-op re-run (every hash already current)", async () => {
    const items = [{ id: "x", text: "one" }, { id: "y", text: "two" }];
    const existing = new Map([
      ["x", { hash: textHash("one"), modelId: FAKE_MODEL }],
      ["y", { hash: textHash("two"), modelId: FAKE_MODEL }],
    ]);
    let upserts = 0;
    const stats = await backfillCorpus(new FakeEmbedder(), items, existing, async () => { upserts++; });
    expect(stats).toEqual({ embedded: 0, skipped: 2 });
    expect(upserts).toBe(0);
  });

  // ── Il modello fa parte dell'identità del vettore ──────────────────────────
  // Prima il salto guardava solo il testo. Conseguenza: cambiando modello di
  // embedding, OGNI riga veniva saltata e il corpus restava misto — vettori di
  // due spazi diversi mescolati, somiglianze sbagliate, nessun errore. I due
  // casi qui sotto sono la coppia che lo dimostra: stesso testo, unica
  // differenza il modello, esiti opposti.

  it("skips when text AND model both match", async () => {
    const items = [{ id: "k", text: "same text" }];
    const existing = new Map([["k", { hash: textHash("same text"), modelId: FAKE_MODEL }]]);
    let upserts = 0;
    const stats = await backfillCorpus(new FakeEmbedder(), items, existing, async () => { upserts++; });
    expect(stats).toEqual({ embedded: 0, skipped: 1 });
    expect(upserts).toBe(0);
  });

  it("re-embeds when the text matches but the model differs", async () => {
    const items = [{ id: "k", text: "same text" }];
    // Stesso identico hash del caso sopra: cambia SOLO il modello.
    const existing = new Map([["k", { hash: textHash("same text"), modelId: "voyage-OLD-model" }]]);
    const calls: string[] = [];
    const stats = await backfillCorpus(
      new FakeEmbedder(), items, existing, async (id) => { calls.push(id); },
    );
    expect(stats).toEqual({ embedded: 1, skipped: 0 });
    expect(calls).toEqual(["k"]);
  });

  it("re-embeds when the stored model is unknown (null): unproven is not equal", async () => {
    const items = [{ id: "k", text: "same text" }];
    const existing = new Map([["k", { hash: textHash("same text"), modelId: null }]]);
    let upserts = 0;
    const stats = await backfillCorpus(new FakeEmbedder(), items, existing, async () => { upserts++; });
    expect(stats).toEqual({ embedded: 1, skipped: 0 });
    expect(upserts).toBe(1);
  });
});
