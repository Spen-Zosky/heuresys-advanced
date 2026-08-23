/**
 * #219 F2/C — RIPRODUZIONE della firma, prima di correggerla.
 *
 * LA FIRMA: `organization-editing:41` e `:128` — `orgunit-editor` non visibile dopo 30 s.
 * Due casi, una causa sola secondo il triage di #211 F4.
 *
 * DOVE GUARDARE, letto nel codice e non indovinato: `OrgUnitEditor` esce con
 * `if (ou.isLoading || ou.isError) return null` (org-unit-forms.tsx:280). Se la query
 * `GET /v1/organization-units/:id` fallisce, l'editor NON COMPARE MAI — e il test aspetta
 * trenta secondi una `Card` che nessuno renderà. Il sintomo «non si apre» è quindi
 * compatibile sia con un guasto dell'API sia con un permesso mancante all'attore.
 * Lo spec usa `tenantAdmin`.
 *
 * QUESTA PROVA DEVE POTER FALLIRE: se la rotta rispondesse 200 per quell'attore,
 * l'ipotesi sarebbe sbagliata e la causa starebbe altrove (nel click, nel testid, nel
 * rendering) — e andrebbe cercata lì invece che nell'API.
 *
 * Uso (con l'API su :3001):  cd apps/api && pnpm exec tsx scripts/prova-219-c-editor.mts
 */
import { createHmac } from "node:crypto";
import { FIXTURE_TOTP_SECRETS } from "../test/helpers/mfa-fixture-secrets.js";
import { passwordFor } from "../test/helpers/personas.js";

const API = (process.env.HEURESYS_API ?? "http://localhost:3001").replace(/\/$/, "");
const ATTORE = process.env.ATTORE ?? "federica.marchetti@rtl-bank.org";   // `tenantAdmin`

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
function totp(s: string): string {
  const key = base32Decode(s);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30)));
  const h = createHmac("sha1", key).update(buf).digest();
  const o = h[h.length - 1]! & 0x0f;
  const code = ((h[o]! & 0x7f) << 24) | ((h[o + 1]! & 0xff) << 16) | ((h[o + 2]! & 0xff) << 8) | (h[o + 3]! & 0xff);
  return (code % 1_000_000).toString().padStart(6, "0");
}
async function login(email: string): Promise<string> {
  const password = passwordFor(email);
  const ck = (r: Response) => (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  const r1 = await fetch(`${API}/v1/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const j1 = (await r1.json()) as { status: string; challengeToken?: string };
  if (j1.status === "success") return ck(r1);
  const secret = FIXTURE_TOTP_SECRETS[email];
  if (j1.status !== "mfa_required" || !j1.challengeToken || !secret) {
    throw new Error(`login inatteso: ${JSON.stringify(j1)}`);
  }
  const r2 = await fetch(`${API}/v1/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, challengeToken: j1.challengeToken, mfaCode: totp(secret) }),
  });
  const j2 = (await r2.json()) as { status: string };
  if (j2.status !== "success") throw new Error(`secondo fattore fallito: ${JSON.stringify(j2)}`);
  return ck(r2);
}

async function main(): Promise<void> {
  console.log(`=== #219 F2/C — la chiamata che alimenta l'editor dell'organigramma ===\n`);
  const cookies = await login(ATTORE);
  console.log(`[login] ${ATTORE}\n`);

  // 1. l'elenco: è quello che riempie la tabella, e il test ci clicca sopra
  const rl = await fetch(`${API}/v1/organization-units`, { headers: { cookie: cookies } });
  const lista = rl.ok ? ((await rl.json()) as { items?: Array<{ organizationUnitId: string; code: string }> }) : null;
  const unita = lista?.items ?? [];
  console.log(`GET /v1/organization-units            → HTTP ${rl.status} · ${unita.length} unità`);

  // 2. il dettaglio: è QUESTO che l'editor aspetta, ed è dove il rendering si ferma
  let dettaglio = 0;
  let corpo = "";
  if (unita[0]) {
    const rd = await fetch(`${API}/v1/organization-units/${unita[0].organizationUnitId}`, { headers: { cookie: cookies } });
    dettaglio = rd.status;
    corpo = (await rd.text()).slice(0, 300);
    console.log(`GET /v1/organization-units/:id        → HTTP ${dettaglio}  (${unita[0].code})`);
    if (!rd.ok) console.log(`   corpo: ${corpo}`);
  }

  // 3. il permesso che l'editor legge per decidere se abilitare il salvataggio
  const rp = await fetch(`${API}/v1/me/permissions`, { headers: { cookie: cookies } });
  const perms = rp.ok ? ((await rp.json()) as { permissions?: string[] }) : { permissions: [] };
  const ha = (p: string) => (perms.permissions ?? []).includes(p);
  console.log(`GET /v1/me/permissions                → HTTP ${rp.status} · ${(perms.permissions ?? []).length} permessi`);
  console.log(`   organization_unit:read   = ${ha("organization_unit:read")}`);
  console.log(`   organization_unit:update = ${ha("organization_unit:update")}`);

  const esiti: Array<[string, boolean]> = [
    ["l'elenco risponde e ha unità (il test ci clicca sopra)", rl.ok && unita.length > 0],
    ["il DETTAGLIO risponde 200 — se no, `OrgUnitEditor` esce con `return null` e la Card non compare mai", dettaglio === 200],
    ["l'attore può aggiornare (o l'editor comparirebbe in sola lettura)", ha("organization_unit:update")],
  ];
  console.log("");
  let rossi = 0;
  for (const [che, ok] of esiti) { console.log(`  ${ok ? "[ok]" : "[NO]"} ${che}`); if (!ok) rossi += 1; }
  if (rossi > 0) {
    console.error(`\nESITO: ${rossi} criteri rossi — la causa di C sta QUI, nel dato che alimenta l'editor.`);
    process.exit(1);
  }
  console.log("\nESITO: l'API dà all'editor tutto ciò che gli serve — la causa di C NON è qui,");
  console.log("e va cercata nel percorso della pagina (click, testid, rendering).");
}

main().catch((e) => { console.error(`ERRORE: ${e instanceof Error ? e.message : String(e)}`); process.exit(1); });
