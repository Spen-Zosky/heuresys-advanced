/**
 * Cache degli embedding di query — unit, in memoria, senza rete ne' database.
 *
 * Il punto misurato non e' "la cache restituisce lo stesso vettore": e' che
 * l'embedder sottostante viene chiamato UNA VOLTA SOLA. Ogni chiamata in piu' e'
 * una chiamata Voyage a pagamento, quindi si conta l'effetto, non l'apparenza.
 */
import { describe, it, expect } from "vitest";
import { QueryEmbeddingCache, withQueryCache } from "../src/modules/semantic-matching/query-embedding-cache.js";
import type { Embedder } from "../src/modules/semantic-matching/voyage-client.js";

/** Embedder che CONTA quante volte e' stato chiamato e quanti testi ha ricevuto. */
function contatore(modelId = "modello-di-prova"): Embedder & { chiamate: number; testiVisti: string[] } {
  const e = {
    modelId,
    chiamate: 0,
    testiVisti: [] as string[],
    async embed(texts: string[]): Promise<number[][]> {
      e.chiamate++;
      e.testiVisti.push(...texts);
      // vettore deterministico per testo, cosi' si puo' asserire l'ordine
      return texts.map((t) => [t.length, t.charCodeAt(0) || 0]);
    },
  };
  return e;
}

describe("QueryEmbeddingCache", () => {
  it("stessa query due volte = UNA sola chiamata all'embedder", async () => {
    const inner = contatore();
    const cached = withQueryCache(inner, new QueryEmbeddingCache());

    const a = await cached.embed(["quali competenze mancano"], "query");
    const b = await cached.embed(["quali competenze mancano"], "query");

    expect(inner.chiamate).toBe(1);
    expect(b).toEqual(a);
  });

  it("query diverse = due chiamate: la cache non risponde a caso", async () => {
    const inner = contatore();
    const cached = withQueryCache(inner, new QueryEmbeddingCache());
    await cached.embed(["prima domanda"], "query");
    await cached.embed(["seconda domanda"], "query");
    expect(inner.chiamate).toBe(2);
  });

  it("lo stesso testo come query e come document NON condivide la voce", async () => {
    // Voyage produce vettori diversi secondo input_type: confonderli darebbe
    // risposte sbagliate senza alcun errore.
    const inner = contatore();
    const cached = withQueryCache(inner, new QueryEmbeddingCache());
    await cached.embed(["stesso testo"], "query");
    await cached.embed(["stesso testo"], "document");
    expect(inner.chiamate).toBe(2);
  });

  it("un modello diverso invalida la voce (stessa dottrina dei corpus)", async () => {
    const cache = new QueryEmbeddingCache();
    const vecchio = contatore("voyage-VECCHIO");
    const nuovo = contatore("voyage-NUOVO");
    await withQueryCache(vecchio, cache).embed(["domanda"], "query");
    await withQueryCache(nuovo, cache).embed(["domanda"], "query");
    expect(nuovo.chiamate).toBe(1); // non ha riusato il vettore dell'altro modello
  });

  it("chiede all'embedder SOLO i testi mancanti, e ricompone l'ordine", async () => {
    const inner = contatore();
    const cache = new QueryEmbeddingCache();
    const cached = withQueryCache(inner, cache);

    await cached.embed(["alfa"], "query");          // 1a chiamata: solo "alfa"
    inner.testiVisti.length = 0;
    const out = await cached.embed(["alfa", "beta"], "query"); // deve chiedere solo "beta"

    expect(inner.chiamate).toBe(2);
    expect(inner.testiVisti).toEqual(["beta"]);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual([4, "a".charCodeAt(0)]); // "alfa" dalla cache, al suo posto
    expect(out[1]).toEqual([4, "b".charCodeAt(0)]); // "beta" fresco, al suo posto
  });

  it("una voce scaduta non serve piu': si torna all'embedder", async () => {
    const inner = contatore();
    const cached = withQueryCache(inner, new QueryEmbeddingCache({ ttlMs: -1 }));
    await cached.embed(["domanda"], "query");
    await cached.embed(["domanda"], "query");
    expect(inner.chiamate).toBe(2);
  });

  it("il tetto sfratta la voce piu' vecchia, non una a caso", async () => {
    const inner = contatore();
    const cache = new QueryEmbeddingCache({ maxEntries: 2 });
    const cached = withQueryCache(inner, cache);

    await cached.embed(["prima"], "query");
    await cached.embed(["seconda"], "query");
    await cached.embed(["terza"], "query");   // sfratta "prima"
    expect(cache.stats().size).toBe(2);

    inner.chiamate = 0;
    await cached.embed(["seconda"], "query"); // ancora in cache
    expect(inner.chiamate).toBe(0);
    await cached.embed(["prima"], "query");   // sfrattata: si ri-chiama
    expect(inner.chiamate).toBe(1);
  });

  it("conta accessi utili e mancati, cosi' l'effetto e' misurabile e non creduto", async () => {
    const cache = new QueryEmbeddingCache();
    const cached = withQueryCache(contatore(), cache);
    await cached.embed(["x"], "query");
    await cached.embed(["x"], "query");
    await cached.embed(["y"], "query");
    expect(cache.stats()).toEqual({ hits: 1, misses: 2, size: 2 });
  });
});
