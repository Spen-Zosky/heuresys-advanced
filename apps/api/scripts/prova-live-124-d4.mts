/**
 * apps/api/scripts/prova-live-124-d4.mts — prova LIVE di #124 D4 (S1054).
 *
 * Definition of Done del progetto: nessuno step si chiude su green-test. Questa
 * prova non usa `app.inject()`: parla HTTP con l'API in esecuzione, con login
 * reale di due persone (password derivata + secondo fattore), e confronta LA
 * STESSA RIGA letta dai due attori.
 *
 *   pnpm exec tsx scripts/prova-live-124-d4.mts [http://localhost:3001]
 */
import * as OTPAuth from "otpauth";
import { passwordFor } from "../test/helpers/personas.js";
import { FIXTURE_TOTP_SECRETS } from "../test/helpers/mfa-fixture-secrets.js";

const BASE = process.argv[2] ?? "http://localhost:3001";
const PLATFORM = "enzo.spenuso@heuresys.com";
const HR = "federica.marchetti@rtl-bank.org";

function totp(email: string): string {
  const secret = FIXTURE_TOTP_SECRETS[email];
  if (!secret) throw new Error(`nessun secondo fattore di prova per ${email}`);
  return new OTPAuth.TOTP({
    algorithm: "SHA1", digits: 6, period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  }).generate();
}

/** Login HTTP reale, secondo fattore compreso. Ritorna Cookie + id dell'utente. */
async function login(email: string): Promise<{ cookie: string; userId: string }> {
  const password = passwordFor(email);
  const post = async (payload: Record<string, unknown>) =>
    fetch(`${BASE}/v1/auth/login`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

  type Body = { status?: string; challengeToken?: string; user?: { userId?: string; id?: string } };
  let r = await post({ email, password });
  let body = (await r.json()) as Body;
  if (body.status === "mfa_required") {
    r = await post({ email, password, challengeToken: body.challengeToken, mfaCode: totp(email) });
    body = (await r.json()) as Body;
  }
  if (r.status !== 200 || (body.status !== "success" && body.status !== undefined)) {
    throw new Error(`login ${email}: ${r.status} ${JSON.stringify(body)}`);
  }
  const cookies = (r.headers as unknown as { getSetCookie(): string[] }).getSetCookie();
  return {
    cookie: cookies.map((c) => c.split(";")[0]).join("; "),
    userId: body.user?.userId ?? body.user?.id ?? "",
  };
}

async function get(cookie: string, path: string): Promise<{ raw: string; items: Record<string, unknown>[] }> {
  const r = await fetch(`${BASE}${path}`, { headers: { cookie } });
  const raw = await r.text();
  if (r.status !== 200) throw new Error(`GET ${path}: ${r.status} ${raw.slice(0, 200)}`);
  const j = JSON.parse(raw) as { items?: Record<string, unknown>[] };
  return { raw, items: j.items ?? [] };
}

let difformi = 0;
function verifica(ok: boolean, testo: string): void {
  if (!ok) difformi++;
  console.log(`  [${ok ? "OK " : "DIFFORME"}] ${testo}`);
}

interface Caso {
  path: string; campi: string[]; resta: string; spie: string[];
  /** true = la lista torna ordinata per punteggio e il mask deve neutralizzarla. */
  ordinata?: boolean;
}

const CASI: Caso[] = [
  { path: "/v1/predictions?limit=200", campi: ["confidence", "details", "label", "value"],
    resta: "subjectUserId", spie: ["salary_percentile", "performance_rating", "is_high_potential"] },
  { path: "/v1/talent-review/nine-box?limit=200",
    campi: ["band", "performance", "performanceBand", "potential", "potentialBand"],
    resta: "subjectUserName", spie: [] },
  { path: "/v1/talent-review/fit?limit=200", campi: ["payload", "score"], resta: "dimension", spie: [] },
  { path: "/v1/talent-review/readiness?limit=200", campi: ["payload", "value"], resta: "horizon", spie: [] },
  { path: "/v1/talent-review/succession?limit=200", campi: ["payload", "value"], resta: "positionId", spie: [] },
  // I tre modelli di insights: qui la spiegazione (`features`) porta i valori
  // grezzi, `compBandPct` compreso, e la lista e' ORDINATA per punteggio.
  { path: "/v1/insights/flight-risk", campi: ["band", "features", "score"],
    resta: "displayName", spie: ['"raw"', '"contribution"'], ordinata: true },
  { path: "/v1/insights/succession-readiness", campi: ["features", "horizon", "value"],
    resta: "displayName", spie: ['"raw"'], ordinata: true },
  { path: "/v1/insights/skill-gap", campi: ["features", "segment", "value"],
    resta: "displayName", spie: ['"raw"'], ordinata: true },
];

console.log(`PROVA LIVE #124 D4 — ${BASE} — ${new Date().toISOString()}`);
const platform = await login(PLATFORM);
const hr = await login(HR);
const cPlatform = platform.cookie;
const cHr = hr.cookie;
console.log(`login reali: ${PLATFORM} (mandato piattaforma) · ${HR} (mandato HR)`);
console.log(`id del platform: ${platform.userId || "(non risolto)"} — le SUE righe restano in chiaro per I17\n`);

/** L'id del soggetto su una riga, comunque si chiami nei vari contratti. */
const soggetto = (r: Record<string, unknown>): string =>
  String(r["userId"] ?? r["subjectUserId"] ?? "");

for (const caso of CASI) {
  console.log(`── ${caso.path}`);
  const p = await get(cPlatform, caso.path);
  const h = await get(cHr, caso.path);
  verifica(p.items.length > 0 && h.items.length > 0,
    `righe viste: platform ${p.items.length}, HR ${h.items.length} (la RIGA resta visibile a entrambi)`);

  // I17: le righe SUE il platform le legge in chiaro. Si separano invece di
  // pretendere il mask ovunque — il pavimento ESS batte ogni asse.
  const proprie = platform.userId ? p.items.filter((r) => soggetto(r) === platform.userId) : [];
  const altrui = p.items.filter((r) => soggetto(r) !== platform.userId);
  if (proprie.length > 0) {
    verifica(proprie.every((r) => r["masked"] === undefined),
      `I17 — le ${proprie.length} righe sue restano in chiaro`);
  }

  const senzaMask = altrui.filter((r) => JSON.stringify(r["masked"]) !== JSON.stringify([...caso.campi].sort()));
  verifica(senzaMask.length === 0, `tutte le ${altrui.length} righe altrui dichiarano masked=[${caso.campi.join(", ")}]`);

  const presenti = altrui.filter((r) => caso.campi.some((f) => Object.hasOwn(r, f)));
  verifica(presenti.length === 0, `nessun campo di giudizio presente per il platform (${presenti.length} righe difformi)`);

  verifica(altrui.every((r) => Object.hasOwn(r, caso.resta)), `«${caso.resta}» RESTA per il platform`);
  verifica(h.items.every((r) => r["masked"] === undefined), "l'HR legge in chiaro (I20)");
  verifica(h.items.some((r) => Object.hasOwn(r, caso.campi[0]!)),
    `l'HR vede «${caso.campi[0]}» — senza questo il confronto sarebbe cieco`);

  for (const spia of caso.spie) {
    const attese = spia === '"raw"' || spia === '"contribution"' ? proprie.length : 0;
    const trovate = (p.raw.match(new RegExp(spia.replace(/"/g, '"'), "g")) ?? []).length;
    verifica(attese === 0 ? !p.raw.includes(spia) : trovate <= proprie.length * 12,
      `«${spia}» nel corpo del platform solo dove I17 lo consente (${trovate} occorrenze, ${proprie.length} righe sue)`);
    verifica(h.raw.includes(spia), `«${spia}» presente per l'HR (controprova)`);
  }

  if (caso.ordinata) {
    // Il canale che un controllo sui campi non vedrebbe: la SEQUENZA. Se
    // sopravvivesse, il lettore avrebbe la graduatoria completa delle persone.
    const ids = p.items.map(soggetto);
    const neutro = [...ids].sort((a, b) => a.localeCompare(b));
    verifica(JSON.stringify(ids) === JSON.stringify(neutro),
      "l'ORDINE è neutralizzato per chi è mascherato (niente graduatoria)");
    const valori = h.items.map((r) => Number(r[caso.campi.find((c) => c === "score" || c === "value")!] ?? 0));
    verifica(valori.every((v, i) => i === 0 || valori[i - 1]! >= v),
      "l'HR conserva la classifica vera (il mask non ha danneggiato chi legge in chiaro)");
  }
}

console.log(`\nESITO: ${difformi === 0 ? "VERDE" : `ROSSO (${difformi} difformi)`}`);
process.exit(difformi === 0 ? 0 : 1);
