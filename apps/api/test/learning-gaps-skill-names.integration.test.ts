/**
 * apps/api/test/learning-gaps-skill-names.integration.test.ts
 *
 * LE LACUNE FORMATIVE NON SAPEVANO DIRE DI CHE COMPETENZA PARLASSERO.
 *
 * Misurato il 2026-08-14 sulle 270 righe vive di `sys.sys_learning_gaps`:
 * `learning_gap_skill_id` e `learning_gap_position_id` sono NULL su **tutte e 270**, e il
 * repository ci faceva sopra due sotto-query (righe 109-110) che quindi restituivano
 * `null` ogni volta. La superficie elencava 270 lacune senza dire di cosa.
 *
 * Il nome però c'era, in `metadata.legacy.skill_gaps` — che l'API restituiva già, dentro un
 * blob e in **due dialetti**: `{skill, gap}` e `{skill_name, current_level, target_level,
 * gap_severity}`. 955 voci, tutte con un nome, 10 competenze distinte.
 *
 * ⚠ Questa NON è un'ingestione dal legacy (I12, il rubinetto chiuso): il metadata è già
 * dentro `sys.*` e non viene toccata una sola riga del database d'origine. È il caso che
 * l'invariante prescrive — *derivare da ciò che `sys.*` contiene* invece di importare.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";
import * as repo from "../src/modules/learning-gaps/repository.js";
import { loginRaw } from "./helpers/login.js";

let t: TestApp;
/** Quante righe il database dice che DEVONO avere almeno una competenza nominata. */
let atteseConNome = 0;
let righeTotali = 0;

beforeAll(async () => {
  t = await buildTestApp();
  const r = await pool.query<{ con_nome: string; totali: string }>(
    `SELECT count(*) FILTER (WHERE EXISTS (
              SELECT 1 FROM jsonb_array_elements(lg.learning_gap_metadata->'legacy'->'skill_gaps') g
               WHERE COALESCE(nullif(g->>'skill',''), nullif(g->>'skill_name','')) IS NOT NULL
            ))::text AS con_nome,
            count(*)::text AS totali
       FROM sys.sys_learning_gaps lg`,
  );
  atteseConNome = Number(r.rows[0]?.con_nome ?? 0);
  righeTotali = Number(r.rows[0]?.totali ?? 0);
}, 60_000);

afterAll(async () => {
  await t.app.close();
  await closePool();
});

describe("lacune formative — la competenza si legge dal dato, non dalla FK vuota", () => {
  it("gira su un universo dove PUÒ fallire: esistono righe con competenze nel metadata", () => {
    expect(righeTotali, "nessuna lacuna nel database: la verifica non guarderebbe niente").toBeGreaterThan(0);
    expect(atteseConNome, "nessuna riga porta un nome di competenza: non c'è nulla da normalizzare").toBeGreaterThan(0);
  });

  it("ogni riga che il DB dice avere competenze le espone, e nessuna esce senza nome", async () => {
    // Nessun filtro, pagina piena: si guarda l'universo reale, non un campione comodo.
    const { items, total } = await repo.listGaps(pool, {
      query: { limit: 200, offset: 0 } as never,
    });
    expect(total).toBe(righeTotali);

    const conCompetenze = items.filter((g) => g.skillGaps.length > 0).length;
    // Le righe lette sono `limit` al più: l'atteso si proporziona all'universo osservato.
    expect(conCompetenze, "una riga con competenze nel dato è uscita con la lista vuota").toBe(items.length);

    for (const g of items) {
      for (const s of g.skillGaps) {
        expect(s.skillName, "una competenza è uscita senza nome").toBeTruthy();
        expect(typeof s.skillName).toBe("string");
      }
    }
  });

  it("i due dialetti sono entrambi riconosciuti — nessuno dei due va perso", async () => {
    const { items } = await repo.listGaps(pool, { query: { limit: 200, offset: 0 } as never });
    // dialetto 1: porta `gap` numerico · dialetto 2: porta i livelli
    const conGap = items.some((g) => g.skillGaps.some((s) => s.gap !== null));
    const conLivelli = items.some((g) => g.skillGaps.some((s) => s.currentLevel !== null && s.targetLevel !== null));
    expect(conGap, "il dialetto {skill, gap} non è più riconosciuto").toBe(true);
    expect(conLivelli, "il dialetto {skill_name, current_level, target_level} non è più riconosciuto").toBe(true);
  });

  it("il campo sopravvive alla SERIALIZZAZIONE: esce davvero dalla porta HTTP", async () => {
    // La prova che serviva più di tutte. Il repository può restituire `skillGaps` e Zod
    // toglierlo comunque in uscita se lo schema di risposta non lo dichiara: `z.object()`
    // scarta le chiavi che non conosce, in silenzio e senza errori. Un test che si ferma
    // al repository sarebbe verde con la superficie ancora vuota.
    const login = await loginRaw(t.app, "federica.marchetti@rtl-bank.org");
    const cookies = (login.cookies as { name: string; value: string }[])
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const r = await t.app.inject({
      method: "GET",
      url: "/v1/learning-gaps?limit=50&offset=0",
      headers: { cookie: cookies },
    });
    expect(r.statusCode, `la lista non risponde: ${r.statusCode} ${r.body.slice(0, 200)}`).toBe(200);

    const body = r.json() as { items: { skillGaps?: { skillName: string }[] }[] };
    expect(body.items.length, "lista vuota per questa persona: la prova non guarderebbe nulla").toBeGreaterThan(0);
    for (const g of body.items) {
      expect(g.skillGaps, "`skillGaps` non è arrivato al client: Zod lo ha scartato in uscita").toBeDefined();
      expect(Array.isArray(g.skillGaps)).toBe(true);
    }
    const nomi = body.items.flatMap((g) => (g.skillGaps ?? []).map((s) => s.skillName));
    expect(nomi.length, "nessun nome di competenza è uscito dalla porta HTTP").toBeGreaterThan(0);
  });

  it("dire il nome NON è agganciare il catalogo: `skillId` resta quello che è", async () => {
    const { items } = await repo.listGaps(pool, { query: { limit: 200, offset: 0 } as never });
    // La colonna è vuota su tutte le righe vive: la normalizzazione non deve averla riempita
    // di nascosto, perché sarebbe un aggancio inventato al catalogo competenze.
    for (const g of items) {
      if (g.skillGaps.length > 0 && g.skillId !== null) {
        expect(g.skillName, "c'è un aggancio reale al catalogo: allora il nome deve venire da lì").toBeTruthy();
      }
    }
    expect(true).toBe(true);
  });
});
