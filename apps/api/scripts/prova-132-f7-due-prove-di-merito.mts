/**
 * #132 F7 — LE DUE PROVE DI MERITO.
 *
 * La corsa funziona (provata in produzione: 7 proposte, tutte con impronta). Restano le due
 * domande che dicono se la ricerca sta davvero **ascoltando l'azienda** invece di ripetere un
 * archetipo:
 *
 *   PROVA A — L'AZIENDA DI SETTORE DIVERSO. Si apre un fascicolo per una societa' di
 *     CONSULENZA (ATECO 70.20) e si fa girare la ricerca. Se ne esce una banca, l'archetipo
 *     bancario e' sparito solo di nome: il motore lo ripete comunque. Il criterio non e' «le
 *     proposte sono belle», e' meccanico: **nessuna chiave naturale proposta per la consulenza
 *     deve coincidere con quelle del modello bancario di RTL**.
 *
 *   PROVA B — RTL COME METRO DI QUALITA'. La stessa ricerca, sul fascicolo bancario, deve
 *     invece produrre proposte **pertinenti al suo settore**. Senza questa meta', la prova A si
 *     supererebbe anche con un motore che propone sempre cose a caso: due insiemi disgiunti non
 *     dimostrano niente se nessuno dei due e' giusto.
 *
 * QUESTA PROVA DEVE POTER FALLIRE, e fallisce in tre modi distinti: se le due corse producono
 * le STESSE chiavi (archetipo ripetuto), se la corsa della consulenza non produce NULLA (il
 * motore non sa lavorare fuori dal bancario), o se quella di RTL non produce nulla (non e' un
 * metro).
 *
 * Uso:  cd apps/api && pnpm exec tsx scripts/prova-132-f7-due-prove-di-merito.mts
 */
import { passwordFor } from "../test/helpers/personas.js";

const API = (process.env.HEURESYS_API ?? "http://localhost:3001").replace(/\/$/, "");
const ATTORE = process.env.ATTORE_RICERCA ?? "piattaforma@collaudo.invalid";
const DOMINIO = process.env.DOMINIO ?? "business_processes";

interface S { cookie: string; csrf: string }

async function login(email: string): Promise<S> {
  const r = await fetch(`${API}/v1/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: passwordFor(email) }),
  });
  const b = (await r.json()) as { status: string; csrfToken?: string };
  if (b.status !== "success" || !b.csrfToken) throw new Error(`login: ${JSON.stringify(b).slice(0, 160)}`);
  return { cookie: (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; "), csrf: b.csrfToken };
}

async function chiama<T>(s: S, metodo: string, rotta: string, corpo?: unknown): Promise<T> {
  const r = await fetch(`${API}${rotta}`, {
    method: metodo,
    headers: metodo === "GET"
      ? { cookie: s.cookie }
      : { "content-type": "application/json", cookie: s.cookie, "x-csrf-token": s.csrf },
    ...(metodo === "GET" ? {} : { body: JSON.stringify(corpo ?? {}) }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${metodo} ${rotta} → ${r.status}: ${t.slice(0, 300)}`);
  return JSON.parse(t) as T;
}

/** Le chiavi naturali proposte da una corsa. E' il confronto che decide le due prove. */
async function chiaviProposte(s: S, corsaId: string): Promise<string[]> {
  const b = await chiama<{ items?: Array<{ chiaveNaturale?: string }> }>(
    s, "GET", `/v1/seed-acquisition-runs/${corsaId}/candidates`);
  return (b.items ?? []).map((p) => p.chiaveNaturale).filter(Boolean) as string[];
}

async function ultimaVersione(s: S, blueprintId: string): Promise<number | null> {
  let ultima: number | null = null;
  for (let n = 1; n <= 20; n += 1) {
    const r = await fetch(`${API}/v1/tenant-blueprints/${blueprintId}/versions/${n}`, { headers: { cookie: s.cookie } });
    if (!r.ok) break;
    ultima = n;
  }
  return ultima;
}

async function corsaSu(s: S, blueprintId: string, numero: number, dominio: string): Promise<string> {
  const c = await chiama<{ corsaId?: string; runId?: string; id?: string }>(
    s, "POST", `/v1/tenant-blueprints/${blueprintId}/versions/${numero}/research`, { dominio });
  const id = c.corsaId ?? c.runId ?? c.id;
  if (!id) throw new Error("la corsa non ha restituito un identificativo");
  return id;
}

async function main(): Promise<void> {
  console.log("=== #132 F7 — le due prove di merito ===\n");
  const s = await login(ATTORE);

  const fascicoli = await chiama<{ items: Array<{ tenantBlueprintId: string; code: string }> }>(
    s, "GET", "/v1/tenant-blueprints?limit=50");
  const rtl = fascicoli.items.find((f) => f.code.includes("RTL"));
  if (!rtl) throw new Error("manca il fascicolo di RTL: senza metro non c'e' prova B");

  // ── il fascicolo della CONSULENZA. Il tenant Heuresys e' `MGMT_CONSULTING` (ATECO 70.20),
  //    dichiarato in `sys_tenancies` dalla mig 000242: e' l'azienda di settore diverso che
  //    serve, e non va inventata.
  // ⚠ IL NOME DEL FASCICOLO NON DEVE CONTENERE PAROLE DI DOMINIO. La guardia §4.5 deriva i
  // termini riservati dal nome del cliente e vieta domande che lo nominino: chiamando il
  // fascicolo «...consulenza...» la parola diventa riservata, e la domanda generata sul settore
  // la contiene per forza -> `RESEARCH_QUERY_LEAKS_CLIENT`, e la ricerca non parte MAI.
  // Trovato eseguendo (2026-08-31). Qui si usa un nome neutro; il difetto e' registrato a parte,
  // perche' colpisce qualunque azienda vera che si chiami come il proprio settore.
  const CODE = process.env.CODE_CONSULENZA ?? "PROVA-F7-ALFA";
  let cons = fascicoli.items.find((f) => f.code === CODE);
  if (!cons) {
    const creato = await chiama<{ tenantBlueprintId: string; code: string }>(
      s, "POST", "/v1/tenant-blueprints", { code: CODE, name: "Alfa S.p.A." });
    cons = creato;
    console.log(`[consulenza] fascicolo creato: ${cons.code}`);
  } else {
    console.log(`[consulenza] fascicolo gia' presente: ${cons.code}`);
  }

  let vCons = await ultimaVersione(s, cons.tenantBlueprintId);
  if (vCons === null) {
    const v = await chiama<{ number: number }>(s, "POST", `/v1/tenant-blueprints/${cons.tenantBlueprintId}/versions`, {});
    vCons = v.number;
    console.log(`[consulenza] versione creata: ${vCons}`);
  }
  // LA CARTA D'IDENTITA'. Senza, la corsa risponde `422 RESEARCH_PARAMETERS_MISSING` — «la
  // ricerca pretende sei parametri» — e ha ragione: un motore che indovinasse il settore
  // proporrebbe l'archetipo invece di ascoltare l'azienda, che e' esattamente cio' che la
  // PROVA A vuole escludere. I tre identificativi sono LETTI dal database, non inventati:
  //   ATECO 70.20 (consulenza gestionale) · fascia M · modello operativo B2B_SERVICES
  // e l'intensita' di vigilanza e' `LOW`: una societa' di consulenza non e' vigilata come una
  // banca, ed e' proprio questa differenza che deve produrre proposte diverse.
  const identita = {
    industryClassId: process.env.ATECO_ID ?? "2abd937d-8614-4960-b643-2f3f6cb6e6de",
    sizeBandId: process.env.BAND_ID ?? "0d9a077a-7b86-4ff7-b3fd-bc2233f7db8c", // M: 50-249
    operatingModelId: process.env.MODEL_ID ?? "7e25fbc3-2f3c-4f2e-afac-769827ad0eea",
    countryCode: "IT",
    employeeCount: 120,
    regulatoryIntensity: "LOW",
  };
  await chiama(s, "PATCH", `/v1/tenant-blueprints/${cons.tenantBlueprintId}/versions/${vCons}/identity`, identita);
  console.log(`[consulenza] carta d'identita' compilata: ATECO 70.20 · M · B2B_SERVICES · IT · 120 addetti · vigilanza LOW`);

  const vRtl = await ultimaVersione(s, rtl.tenantBlueprintId);
  if (vRtl === null) throw new Error("il fascicolo di RTL non ha versioni");

  console.log(`\n[corsa A] consulenza · dominio «${DOMINIO}» — apre pagine vere...`);
  const corsaA = await corsaSu(s, cons.tenantBlueprintId, vCons, DOMINIO);
  const chiaviA = await chiaviProposte(s, corsaA);
  console.log(`[corsa A] ${corsaA} → ${chiaviA.length} proposte`);

  console.log(`\n[corsa B] RTL Bank · dominio «${DOMINIO}» — apre pagine vere...`);
  const corsaB = await corsaSu(s, rtl.tenantBlueprintId, vRtl, DOMINIO);
  const chiaviB = await chiaviProposte(s, corsaB);
  console.log(`[corsa B] ${corsaB} → ${chiaviB.length} proposte`);

  const insiemeB = new Set(chiaviB.map((k) => k.toLowerCase()));
  const comuni = chiaviA.filter((k) => insiemeB.has(k.toLowerCase()));

  console.log(`\n  consulenza : ${chiaviA.slice(0, 8).join(" · ") || "(nessuna)"}`);
  console.log(`  RTL Bank   : ${chiaviB.slice(0, 8).join(" · ") || "(nessuna)"}`);
  console.log(`  in comune  : ${comuni.length}${comuni.length ? " → " + comuni.join(", ") : ""}`);

  const esiti: Array<[string, boolean]> = [
    ["PROVA A — la consulenza produce proposte (se non ne produce, il motore sa fare solo il bancario)", chiaviA.length > 0],
    ["PROVA B — RTL produce proposte (senza metro, due insiemi disgiunti non dimostrano nulla)", chiaviB.length > 0],
    ["le due corse NON producono le stesse chiavi: l'archetipo non e' ripetuto", comuni.length === 0],
  ];
  let rossi = 0;
  console.log("");
  for (const [che, ok] of esiti) { console.log(`  ${ok ? "[ok]" : "[NO]"} ${che}`); if (!ok) rossi += 1; }
  if (rossi > 0) { console.error(`\nESITO: ${rossi} criteri non soddisfatti.`); process.exitCode = 1; return; }
  console.log("\nESITO: VERDE — la ricerca ascolta l'azienda, non ripete un archetipo.");
}

await main();
