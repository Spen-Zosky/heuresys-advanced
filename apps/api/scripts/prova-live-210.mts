/**
 * apps/api/scripts/prova-live-210.mts — prova LIVE di #210 (S1067).
 *
 * Che cosa dimostra: `/learning` mostrava «92 moduli» e il pannello dei percorsi un
 * numero nudo. In tutte e due le liste le due specie — DI PIATTAFORMA (catalogo comune)
 * e DELL'AZIENDA — convivono GIA', da prima che qualcuno se ne accorgesse. A differenza
 * di #196 su `/kpis`, qui la prova NON e' cieca: la seconda specie ha esemplari, quindi
 * un conteggio che le somma si vede subito che mente.
 *
 * Si misura con DUE attori, e non e' un dettaglio: la lista filtra
 * `(is_global = true OR tenant_id = $1)`, quindi una riga senza tenant e non globale e'
 * INVISIBILE a chi ha un tenant e visibile al platform. Se i due totali non si spiegano
 * a vicenda, c'e' un terzo stato che nessuna delle due viste dichiara.
 *
 *   cd apps/api && pnpm exec tsx scripts/prova-live-210.mts [http://localhost:3001]
 */
import * as OTPAuth from "otpauth";
import { passwordFor } from "../test/helpers/personas.js";
import { FIXTURE_TOTP_SECRETS } from "../test/helpers/mfa-fixture-secrets.js";

const BASE = process.argv[2] ?? "http://localhost:3001";
const PLATFORM = "enzo.spenuso@heuresys.com";
const AZIENDA = "federica.marchetti@rtl-bank.org";

function totp(email: string): string | null {
  const secret = FIXTURE_TOTP_SECRETS[email];
  if (!secret) return null;
  return new OTPAuth.TOTP({
    algorithm: "SHA1", digits: 6, period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  }).generate();
}

const post = (payload: Record<string, unknown>): Promise<Response> =>
  fetch(`${BASE}/v1/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

async function accedi(email: string): Promise<string> {
  const password = passwordFor(email);
  type Body = { status?: string; challengeToken?: string; csrfToken?: string };
  let r = await post({ email, password });
  let b = (await r.json()) as Body;
  if (b.status === "mfa_required") {
    const code = totp(email);
    if (!code) throw new Error(`${email} chiede il secondo fattore e non ho il suo segreto di prova`);
    r = await post({ email, password, challengeToken: b.challengeToken, mfaCode: code });
    b = (await r.json()) as Body;
  }
  if (!b.csrfToken) throw new Error(`login fallito per ${email}: ${JSON.stringify(b)}`);
  return (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
}

type Riga = { risorsa: string; attore: string; tot: number; piatt: number; azi: number };

async function misura(cookie: string, attore: string, risorsa: string): Promise<Riga> {
  const totale = async (q: string): Promise<number> =>
    ((await (await fetch(`${BASE}/v1/${risorsa}?${q}`, { headers: { cookie } })).json()) as {
      total: number;
    }).total;
  return {
    risorsa, attore,
    tot: await totale("limit=1"),
    piatt: await totale("isGlobal=true&limit=1"),
    azi: await totale("isGlobal=false&limit=1"),
  };
}

async function main(): Promise<void> {
  const cPlat = await accedi(PLATFORM);
  const cAzi = await accedi(AZIENDA);

  const righe: Riga[] = [];
  for (const risorsa of ["learning-modules", "learning-paths"]) {
    righe.push(await misura(cPlat, "platform", risorsa));
    righe.push(await misura(cAzi, "azienda", risorsa));
  }

  console.log(`# prova LIVE #210 — ${BASE} — ${new Date().toISOString()}`);
  for (const r of righe) {
    console.log(
      `  ${r.risorsa.padEnd(17)} ${r.attore.padEnd(9)} totale ${String(r.tot).padStart(3)} = ` +
        `${String(r.piatt).padStart(3)} di piattaforma + ${String(r.azi).padStart(3)} dell'azienda`,
    );
  }

  // (1) LA PROVA CHE PUO' FALLIRE: piattaforma + azienda deve fare il totale, o uno dei
  //     tre filtri mente. E' la stessa di #196, e vale per ogni riga misurata.
  const incoerenti = righe.filter((r) => r.piatt + r.azi !== r.tot);
  console.log(
    `\n  coerenza piattaforma+azienda = totale : ${
      incoerenti.length === 0 ? "SI su tutte e 4 le misure" : incoerenti.map((r) => `${r.risorsa}/${r.attore}`).join(", ")
    }`,
  );

  // (2) la seconda specie ha esemplari? Se no, il caso e' cieco come lo era #196.
  const cieche = righe.filter((r) => r.azi === 0 || r.piatt === 0);
  for (const r of cieche) {
    console.log(`  ⚠ ${r.risorsa}/${r.attore}: una delle due specie ha ZERO esemplari — qui il conteggio non puo' ancora sbagliare`);
  }

  const ok = incoerenti.length === 0;
  console.log(`\nVERDETTO: ${ok ? "le due specie sono dichiarate e ogni somma torna" : "INCOERENTE — un filtro mente"}`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error("ERRORE:", e instanceof Error ? e.message : e);
  process.exit(2);
});
