/**
 * #205 F2 / #198 T9b — PERCORRERE UN DOMINIO RICERCABILE, dalla corsa al modello.
 *
 * Il piano di #205 dice che 2b «non e' una scelta di domini: e' una CODA», e che percorrere il
 * primo «deve produrre proposte approvate, non solo comparire in cima a una lista». Questo
 * script fa esattamente quel percorso, per UN dominio, e si ferma a ogni passo che puo' fallire:
 *
 *   ① il fascicolo esiste (o nasce) e ha la carta d'identita' — senza, la corsa risponde
 *      422 RESEARCH_PARAMETERS_MISSING, e ha ragione;
 *   ② la corsa gira davvero sul gateway (apre pagine vere; puo' durare minuti);
 *   ③ le proposte PASSED vengono DECISE una per una, con la motivazione obbligatoria,
 *      sulla rotta del candidato (`/seed-candidate-records/:id/decision`) — NON sul ledger,
 *      che registra e non promuove (trappola di #132 F7);
 *   ④ `apply-research` porta le approvate nel modello, e la risposta dice quante proposte
 *      sono state applicate e i conteggi del contenuto — zero applicate con proposte approvate
 *      NON e' un verde.
 *
 * L'approvazione e' delegata a Claude dal mandato di Enzo del 2026-09-12 («prendendo decisioni
 * per mio conto»), e ogni decisione porta quella motivazione, con data e sessione: chi rilegge
 * il ledger sa da dove viene. Le proposte WARNING/FAILED NON si approvano a mano: la regola di
 * #132 F4g dice che si corregge la proposta o la regola, mai il verdetto.
 *
 * Uso (dal gemello, o con HEURESYS_API puntata dove serve):
 *   cd apps/api && DOMINIO=positions CODE_FASCICOLO=PROVA-F7-ALFA pnpm exec tsx scripts/percorri-dominio.mts
 * Variabili: DOMINIO (obbligatoria) · CODE_FASCICOLO (default PROVA-F7-ALFA) · NOME_FASCICOLO ·
 *            CORSA_ID (rilegge una corsa gia' fatta: nessuna spesa) · SOLO_CORSA=1 (niente decisioni)
 *            ATECO_ID · BAND_ID · MODEL_ID (default: consulenza 70.20 · M · B2B_SERVICES, letti dal DB il 2026-08-31)
 */
// #169 F2: le utenze di collaudo hanno una chiave PROPRIA (.secrets/collaudo-access.key), non la
// chiave madre delle persone: `passwordFor` qui risponderebbe LOGIN_INVALID, ed e' giusto cosi'.
import { readCollaudoKey, deriveCollaudoPassword } from "./collaudo-access.mjs";

const API = (process.env.HEURESYS_API ?? "http://localhost:3001").replace(/\/$/, "");
const ATTORE = process.env.ATTORE_RICERCA ?? "piattaforma@collaudo.invalid";
const DOMINIO = process.env.DOMINIO;
const CODE = process.env.CODE_FASCICOLO ?? "PROVA-F7-ALFA";
const NOME = process.env.NOME_FASCICOLO ?? "Alfa S.p.A.";
const SESSIONE = process.env.SESSIONE_ID ?? "S1096";
const OGGI = new Date().toISOString().slice(0, 10);

if (!DOMINIO) { console.error("DOMINIO mancante"); process.exit(2); }

interface S { cookie: string; csrf: string }

async function login(email: string): Promise<S> {
  const r = await fetch(`${API}/v1/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: deriveCollaudoPassword(readCollaudoKey(), email) }),
  });
  const b = (await r.json()) as { status: string; csrfToken?: string };
  if (b.status !== "success" || !b.csrfToken) throw new Error(`login non riuscito per ${email}: ${JSON.stringify(b).slice(0, 200)}`);
  const cookie = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  return { cookie, csrf: b.csrfToken };
}

async function chiama<T>(s: S, metodo: string, rotta: string, corpo?: unknown): Promise<T> {
  const r = await fetch(`${API}${rotta}`, {
    method: metodo,
    headers: { "content-type": "application/json", cookie: s.cookie, "x-csrf-token": s.csrf },
    body: metodo === "GET" ? undefined : JSON.stringify(corpo ?? {}),
  });
  const testo = await r.text();
  if (!r.ok) throw new Error(`${metodo} ${rotta} → ${r.status}: ${testo.slice(0, 500)}`);
  return (testo ? JSON.parse(testo) : {}) as T;
}

async function ultimaVersione(s: S, id: string): Promise<{ number: number; status: string } | null> {
  let v: { number: number; status: string } | null = null;
  for (let n = 1; n <= 20; n += 1) {
    const r = await fetch(`${API}/v1/tenant-blueprints/${id}/versions/${n}`, { headers: { cookie: s.cookie } });
    if (!r.ok) break;
    const b = (await r.json()) as { number: number; status: string };
    v = { number: b.number ?? n, status: b.status };
  }
  return v;
}

interface Proposta { candidateId: string; dominio: string; chiaveNaturale: string; stato: string; evidenze: unknown[]; decisione: { stato: string } | null }

async function main(): Promise<void> {
  console.log(`=== percorri-dominio · «${DOMINIO}» · fascicolo ${CODE} · ${API} ===\n`);
  const s = await login(ATTORE);

  // ① il fascicolo e la sua carta d'identita'
  const fascicoli = await chiama<{ items: Array<{ tenantBlueprintId: string; code: string }> }>(s, "GET", "/v1/tenant-blueprints?limit=50");
  let f = fascicoli.items.find((x) => x.code === CODE);
  if (!f) {
    f = await chiama(s, "POST", "/v1/tenant-blueprints", { code: CODE, name: NOME });
    console.log(`[fascicolo] creato: ${CODE}`);
  } else console.log(`[fascicolo] presente: ${CODE}`);
  let v = await ultimaVersione(s, f.tenantBlueprintId);
  if (!v) {
    const c = await chiama<{ number: number }>(s, "POST", `/v1/tenant-blueprints/${f.tenantBlueprintId}/versions`, {});
    v = { number: c.number, status: "DRAFT" };
    console.log(`[versione] creata: ${v.number}`);
  } else console.log(`[versione] ${v.number} (${v.status})`);
  if (v.status === "DRAFT") {
    await chiama(s, "PATCH", `/v1/tenant-blueprints/${f.tenantBlueprintId}/versions/${v.number}/identity`, {
      industryClassId: process.env.ATECO_ID ?? "2abd937d-8614-4960-b643-2f3f6cb6e6de",
      sizeBandId: process.env.BAND_ID ?? "0d9a077a-7b86-4ff7-b3fd-bc2233f7db8c",
      operatingModelId: process.env.MODEL_ID ?? "7e25fbc3-2f3c-4f2e-afac-769827ad0eea",
      countryCode: "IT", employeeCount: Number(process.env.ADDETTI ?? 120), regulatoryIntensity: "LOW",
    });
    console.log("[identita'] compilata (ATECO 70.20 · M · B2B_SERVICES · IT · LOW, salvo variabili)");
  }

  // ② la corsa
  let corsaId = process.env.CORSA_ID;
  if (corsaId) console.log(`\n[corsa] rileggo ${corsaId} (nessuna spesa)`);
  else {
    console.log(`\n[corsa] «${DOMINIO}» — apre pagine vere, puo' durare minuti...`);
    const t0 = Date.now();
    const c = await chiama<{ corsaId?: string; runId?: string; id?: string }>(s, "POST",
      `/v1/tenant-blueprints/${f.tenantBlueprintId}/versions/${v.number}/research`, { dominio: DOMINIO });
    corsaId = c.corsaId ?? c.runId ?? c.id;
    console.log(`[corsa] ${corsaId} · ${Math.round((Date.now() - t0) / 1000)} s`);
  }
  const lista = await chiama<{ items?: Proposta[] }>(s, "GET", `/v1/seed-acquisition-runs/${corsaId}/candidates`);
  const proposte = lista.items ?? [];
  const perStato = proposte.reduce<Record<string, number>>((a, p) => { a[p.stato] = (a[p.stato] ?? 0) + 1; return a; }, {});
  console.log(`[proposte] ${proposte.length} — ${JSON.stringify(perStato)}`);
  for (const p of proposte) console.log(`   ${p.stato.padEnd(8)} ${p.chiaveNaturale}  (${p.evidenze?.length ?? 0} evidenze)${p.decisione ? " · " + p.decisione.stato : ""}`);
  if (proposte.length === 0) { console.error("\nESITO: ROSSO — zero proposte non e' un successo"); process.exitCode = 1; return; }
  if (process.env.SOLO_CORSA) return;

  // ③ le decisioni, una per una, sulla rotta del candidato
  const daDecidere = proposte.filter((p) => p.stato === "PASSED" && !p.decisione);
  let approvate = 0;
  for (const p of daDecidere) {
    await chiama(s, "POST", `/v1/seed-candidate-records/${p.candidateId}/decision`, {
      decisione: "APPROVED",
      motivazione: `Approvata da Claude per delega esplicita di Enzo (${SESSIONE}, ${OGGI}: «prendendo decisioni per mio conto»). ` +
        `Dominio «${DOMINIO}», proposta ${p.chiaveNaturale}: superati tutti i controlli del motore (PASSED) con ${p.evidenze?.length ?? 0} evidenze con impronta.`,
    });
    approvate += 1;
  }
  console.log(`\n[decisioni] approvate ${approvate} su ${daDecidere.length} PASSED senza decisione (WARNING/FAILED non si approvano a mano)`);

  // ④ il ponte
  const esito = await chiama<Record<string, unknown>>(s, "POST", `/v1/tenant-blueprints/${f.tenantBlueprintId}/versions/${v.number}/apply-research`, {});
  console.log(`[apply-research] ${JSON.stringify(esito)}`);

  const applicate = Number((esito as { proposteApplicate?: number }).proposteApplicate ?? 0);
  const ok = applicate > 0 || approvate === 0;
  console.log(`\nESITO: ${ok ? "VERDE" : "ROSSO"} — ${applicate} proposte applicate al modello`);
  if (!ok) process.exitCode = 1;
}

await main();
