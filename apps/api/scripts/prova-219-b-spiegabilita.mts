/**
 * #219 F2/B — RIPRODUZIONE della firma, prima di correggerla.
 *
 * LA FIRMA: su `/insights/skill-gap` e `/insights/succession-readiness` il pannello di
 * spiegabilità per-feature non rende — `skillgap-feature` / `readiness-feature` con
 * `count > 1` fallisce. Due pagine, una firma sola.
 *
 * L'IPOTESI DA VERIFICARE, e che si verifica sul dato invece che sulla pagina: entrambe
 * renderizzano `(selected.features ?? []).map(...)`, quindi il sintomo è compatibile sia
 * con «il frontend non le mostra» sia con «l'API non le manda». E l'API le toglie DAVVERO,
 * ma per progetto: ADR-0032 / #124 D4 mascherano `features` a chi legge sotto il SOLO
 * mandato di piattaforma, perché il modello è deterministico e `features[].raw` porta
 * `compBandPct` — cioè la spiegazione di un punteggio EVALUATION farebbe passare dati
 * COMPENSATION dalla porta di servizio.
 *
 * Entrambi gli spec fanno `storageStateFor("platformAdmin")`: PROVANO UN MONDO CHE
 * L'ARCHITETTURA VIETA. È il gemello esatto del caso F1/A (i due casi MFA che provavano
 * una configurazione che la produzione non ha).
 *
 * QUESTA PROVA DEVE POTER FALLIRE, e fallisce in due modi diversi:
 *   · se il mandato HR NON vedesse le features, l'ipotesi sarebbe sbagliata e il guasto
 *     sarebbe del prodotto (la spiegabilità non funzionerebbe per nessuno);
 *   · se il mandato di piattaforma LE VEDESSE, il mask di ADR-0032 sarebbe rotto — un
 *     guasto ben peggiore del test rosso da cui siamo partiti.
 *
 * Uso (con l'API su :3001):  cd apps/api && pnpm exec tsx scripts/prova-219-b-spiegabilita.mts
 */
import { createHmac } from "node:crypto";
import { FIXTURE_TOTP_SECRETS } from "../test/helpers/mfa-fixture-secrets.js";
import { passwordFor } from "../test/helpers/personas.js";

const API = (process.env.HEURESYS_API ?? "http://localhost:3001").replace(/\/$/, "");
const MANDATO_TECNICO = process.env.ATTORE_PIATTAFORMA ?? "enzo.spenuso@heuresys.com";
const MANDATO_HR = process.env.ATTORE_HR ?? "federica.marchetti@rtl-bank.org";

function base32Decode(s: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of s.replace(/=+$/, "").toUpperCase()) {
    const v = alphabet.indexOf(ch);
    if (v < 0) continue;
    bits += v.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function totp(secretBase32: string): string {
  const key = base32Decode(secretBase32);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30)));
  const h = createHmac("sha1", key).update(buf).digest();
  const o = h[h.length - 1]! & 0x0f;
  const code = ((h[o]! & 0x7f) << 24) | ((h[o + 1]! & 0xff) << 16) |
    ((h[o + 2]! & 0xff) << 8) | (h[o + 3]! & 0xff);
  return (code % 1_000_000).toString().padStart(6, "0");
}

async function login(email: string): Promise<string> {
  const password = passwordFor(email);
  const cookiesFrom = (r: Response) =>
    (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  const r1 = await fetch(`${API}/v1/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const j1 = (await r1.json()) as { status: string; challengeToken?: string };
  if (j1.status === "success") return cookiesFrom(r1);
  const secret = FIXTURE_TOTP_SECRETS[email];
  if (j1.status !== "mfa_required" || !j1.challengeToken || !secret) {
    throw new Error(`login inatteso per ${email}: ${JSON.stringify(j1)}`);
  }
  const r2 = await fetch(`${API}/v1/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, challengeToken: j1.challengeToken, mfaCode: totp(secret) }),
  });
  const j2 = (await r2.json()) as { status: string };
  if (j2.status !== "success") throw new Error(`secondo fattore fallito per ${email}: ${JSON.stringify(j2)}`);
  return cookiesFrom(r2);
}

type Voce = { features?: unknown[]; masked?: unknown };
type Lista = { items?: Voce[]; total?: number };

async function misura(cookies: string, rotta: string): Promise<{ voci: number; conFeatures: number; primo: number; mascherate: number }> {
  const r = await fetch(`${API}${rotta}`, { headers: { cookie: cookies } });
  if (!r.ok) throw new Error(`${rotta} → HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const b = (await r.json()) as Lista;
  const items = b.items ?? [];
  return {
    voci: items.length,
    conFeatures: items.filter((i) => Array.isArray(i.features) && i.features.length > 0).length,
    primo: Array.isArray(items[0]?.features) ? items[0]!.features!.length : 0,
    mascherate: items.filter((i) => i.masked !== undefined).length,
  };
}

const ROTTE = ["/v1/insights/skill-gap", "/v1/insights/succession-readiness"];

async function main(): Promise<void> {
  console.log("=== #219 F2/B — la spiegabilità per-feature, misurata sul dato ===\n");
  const esiti: Array<[string, boolean]> = [];

  const cookTecnico = await login(MANDATO_TECNICO);
  console.log(`[login] mandato di PIATTAFORMA — ${MANDATO_TECNICO}`);
  const cookHr = await login(MANDATO_HR);
  console.log(`[login] mandato HR            — ${MANDATO_HR}\n`);

  for (const rotta of ROTTE) {
    const t = await misura(cookTecnico, rotta);
    const h = await misura(cookHr, rotta);
    console.log(`${rotta}`);
    console.log(`   piattaforma : ${t.voci} voci · con features: ${t.conFeatures} · sul primo: ${t.primo} · con campo 'masked': ${t.mascherate}`);
    console.log(`   mandato HR  : ${h.voci} voci · con features: ${h.conFeatures} · sul primo: ${h.primo} · con campo 'masked': ${h.mascherate}`);
    // Se non ci sono dati, la misura non dice niente e non deve fingere di dirlo.
    esiti.push([`${rotta}: ci sono dati da spiegare`, h.voci > 0 && t.voci > 0]);
    esiti.push([`${rotta}: il mandato HR VEDE la spiegazione (>1 fattore)`, h.primo > 1]);
    esiti.push([`${rotta}: il mandato di piattaforma NON la vede (ADR-0032)`, t.conFeatures === 0]);
  }

  console.log("");
  let rossi = 0;
  for (const [che, ok] of esiti) {
    console.log(`  ${ok ? "[ok]" : "[NO]"} ${che}`);
    if (!ok) rossi += 1;
  }
  if (rossi > 0) {
    console.error(`\nESITO: ${rossi} criteri non soddisfatti — l'ipotesi su B NON regge come scritta.`);
    process.exit(1);
  }
  console.log("\nESITO: l'ipotesi REGGE — la firma B non è un guasto del prodotto: gli spec");
  console.log("provano la spiegabilità con l'attore a cui l'architettura la nega.");
}

main().catch((e) => { console.error(`ERRORE: ${e instanceof Error ? e.message : String(e)}`); process.exit(1); });
