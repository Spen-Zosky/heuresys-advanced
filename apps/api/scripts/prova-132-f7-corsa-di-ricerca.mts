/**
 * #132 F7 — LA CORSA DI RICERCA VERA, con il fornitore acceso.
 *
 * Il register diceva «blocked-on-Enzo: manca la credenziale del fornitore». Verificato nel
 * codice, il fornitore **non e' un terzo**: e' `apps/agent-gateway`, un servizio del progetto
 * (`POST /research/propose`, header `x-research-token`). Le due variabili sono l'indirizzo di
 * casa nostra e una parola d'ordine condivisa — non una credenziale da procurarsi.
 *
 * Cosa dimostra questa corsa, in ordine:
 *   ① il fascicolo di RTL Bank esiste e ha una versione su cui lavorare;
 *   ② l'API sa dove sta il fornitore (senza le due variabili si rifiuta di partire);
 *   ③ la corsa gira DAVVERO: apre pagine vere, ne prende l'impronta, e produce proposte;
 *   ④ ogni proposta porta le sue fonti — quelle senza impronta il motore le respinge.
 *
 * QUESTA PROVA DEVE POTER FALLIRE: se il fornitore non fosse configurato l'API risponderebbe
 * `SORGENTE_NON_DISPONIBILE`, e lo si vedrebbe qui invece di un verde generico. E se la corsa
 * tornasse **zero proposte** non e' un successo: significa che nessuna pagina ha prodotto
 * nulla di utilizzabile, e va detto.
 *
 * Uso:  cd apps/api && pnpm exec tsx scripts/prova-132-f7-corsa-di-ricerca.mts
 */
import { passwordFor } from "../test/helpers/personas.js";

const API = (process.env.HEURESYS_API ?? "http://localhost:3001").replace(/\/$/, "");
const ATTORE = process.env.ATTORE_RICERCA ?? "piattaforma@collaudo.invalid";

interface Sessione { cookie: string; csrf: string }

async function login(email: string): Promise<Sessione> {
  const r = await fetch(`${API}/v1/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: passwordFor(email) }),
  });
  const b = (await r.json()) as { status: string; csrfToken?: string };
  if (b.status !== "success" || !b.csrfToken) {
    throw new Error(`login non riuscito per ${email}: ${JSON.stringify(b).slice(0, 200)}`);
  }
  const cookie = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  return { cookie, csrf: b.csrfToken };
}

async function get<T>(s: Sessione, rotta: string): Promise<T> {
  const r = await fetch(`${API}${rotta}`, { headers: { cookie: s.cookie } });
  if (!r.ok) throw new Error(`GET ${rotta} → ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return (await r.json()) as T;
}

async function post<T>(s: Sessione, rotta: string, corpo: unknown): Promise<T> {
  const r = await fetch(`${API}${rotta}`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: s.cookie, "x-csrf-token": s.csrf },
    body: JSON.stringify(corpo ?? {}),
  });
  const testo = await r.text();
  if (!r.ok) throw new Error(`POST ${rotta} → ${r.status}: ${testo.slice(0, 400)}`);
  return JSON.parse(testo) as T;
}

async function main(): Promise<void> {
  console.log("=== #132 F7 — la corsa di ricerca vera ===\n");
  const s = await login(ATTORE);
  console.log(`[login] ${ATTORE}`);

  // Il campo si chiama `chiave` (letto in `researchService.domini()`, non indovinato: la prima
  // stesura cercava `codice`/`code` e concludeva «0 domini ricercabili» su un sistema sano).
  const domini = await get<{ items?: Array<{ chiave?: string; etichetta?: string }> }>(s, "/v1/tenant-blueprints/research-domains");
  const elenco = (domini.items ?? []).map((d) => d.chiave).filter(Boolean) as string[];
  console.log(`[domini ricercabili] ${elenco.length}: ${elenco.join(", ") || "(nessuno)"}`);
  if (elenco.length === 0) throw new Error("nessun dominio ricercabile: senza dominio la corsa non ha bersaglio");

  const fascicoli = await get<{ items: Array<{ tenantBlueprintId: string; code: string }> }>(s, "/v1/tenant-blueprints?limit=50");
  const rtl = fascicoli.items.find((f) => f.code.includes("RTL")) ?? fascicoli.items[0];
  if (!rtl) throw new Error("nessun fascicolo: non c'e' niente su cui fare ricerca");
  console.log(`[fascicolo] ${rtl.code} (${rtl.tenantBlueprintId})`);

  // Non esiste una rotta di ELENCO delle versioni: il modulo espone solo la singola per
  // numero (`/versions/:number`) — verificato sulle rotte registrate, dopo che la prima
  // stesura aveva inventato `/versions` e preso un 404. Si parte da v1 e si sale finche'
  // ce n'e' una: poche chiamate, e nessun numero scritto a mano nel codice.
  let v: { number: number; status: string } | null = null;
  for (let n = 1; n <= 20; n += 1) {
    const r = await fetch(`${API}/v1/tenant-blueprints/${rtl.tenantBlueprintId}/versions/${n}`,
      { headers: { cookie: s.cookie } });
    if (!r.ok) break;
    const b = (await r.json()) as { number: number; status: string };
    v = { number: b.number ?? n, status: b.status };
  }
  if (!v) throw new Error("il fascicolo non ha versioni");
  console.log(`[versione] ${v.number} (${v.status})`);

  const dominio = process.env.DOMINIO ?? elenco[0]!;
  console.log(`\n[corsa] dominio «${dominio}» — apre pagine vere, puo' durare minuti...`);
  const corsa = await post<{ corsaId?: string; runId?: string; id?: string }>(
    s, `/v1/tenant-blueprints/${rtl.tenantBlueprintId}/versions/${v.number}/research`, { dominio });
  const corsaId = corsa.corsaId ?? corsa.runId ?? corsa.id;
  console.log(`[corsa] avviata: ${corsaId}`);

  const proposte = await get<{ items?: Array<{ stato?: string; status?: string; fonti?: unknown[] }> }>(
    s, `/v1/seed-acquisition-runs/${corsaId}/candidates`);
  const items = proposte.items ?? [];
  const perStato = items.reduce<Record<string, number>>((acc, p) => {
    const k = (p.stato ?? p.status ?? "?") as string;
    acc[k] = (acc[k] ?? 0) + 1; return acc;
  }, {});
  const conFonti = items.filter((p) => Array.isArray(p.fonti) && p.fonti.length > 0).length;

  console.log(`\n[proposte] ${items.length} — per stato: ${JSON.stringify(perStato)}`);
  console.log(`[proposte] con almeno una fonte con impronta: ${conFonti}`);

  const esiti: Array<[string, boolean]> = [
    ["il fornitore ha risposto (nessun SORGENTE_NON_DISPONIBILE)", true],
    ["la corsa ha prodotto proposte (zero non e' un successo)", items.length > 0],
    ["ogni proposta porta almeno una fonte con impronta", items.length > 0 && conFonti === items.length],
  ];
  let rossi = 0;
  console.log("");
  for (const [che, ok] of esiti) { console.log(`  ${ok ? "[ok]" : "[NO]"} ${che}`); if (!ok) rossi += 1; }
  if (rossi > 0) { console.error(`\nESITO: ${rossi} criteri non soddisfatti.`); process.exitCode = 1; return; }
  console.log("\nESITO: VERDE — la catena della ricerca funziona end-to-end.");
}

await main();
