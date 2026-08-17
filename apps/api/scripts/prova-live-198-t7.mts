/**
 * apps/api/scripts/prova-live-198-t7.mts — prova LIVE di #198 T7 (S1068).
 *
 * IL CRITERIO CHE IL PIANO CHIEDE, e che nessun test di unità può dare: *«navigazione
 * reale con login `PLATFORM_ADMIN`; e la stessa con un `TENANT_ADMIN` di RTL, che DEVE
 * vedere il registro della propria azienda e NON deve poter applicare»*.
 *
 * Perché questa prova esiste separata dall'E2E. L'E2E entra come `platformAdmin` e
 * verifica che le pagine mostrino dati veri. Qui si misura la cosa opposta e più
 * importante: **il confine**. Le due pagine hanno due permessi diversi —
 * `tenant_blueprint:read` (solo `PLATFORM_ADMIN`) e `provenance:read` (anche
 * `TENANT_ADMIN`) — e quella differenza è la ragione per cui il registro NON è stato
 * annidato nel fascicolo come diceva il piano: là dentro sarebbe stato irraggiungibile
 * proprio dal ruolo con cui il piano chiede di provarlo.
 *
 * Le tre domande, e la seconda e la terza devono FALLIRE:
 *   (1) federica (TENANT_ADMIN di RTL) legge `/v1/generated-origins`   → 200
 *   (2) federica legge `/v1/tenant-blueprints`                          → 403
 *   (3) federica chiama `apply` sul fascicolo di RTL                    → 403
 * Più due controlli sul lato platform, che dicono che le negazioni di (2) e (3) non
 * sono un guasto dell'endpoint:
 *   (4) enzo (PLATFORM_ADMIN) legge `/v1/tenant-blueprints`             → 200
 *   (5) enzo chiede il PIANO (build-plan, sola lettura)                 → 200 + numeri
 *
 * ⚠ `apply` NON viene chiamato dal lato platform, e non è una dimenticanza: aprirebbe
 * una richiesta di firma vera a delle persone reali per un esperimento. È lo stesso
 * limite che la prova di T6 ha dichiarato per sé.
 *
 *   cd apps/api && pnpm exec tsx scripts/prova-live-198-t7.mts [http://localhost:3001]
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
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  }).generate();
}

const post = (payload: Record<string, unknown>): Promise<Response> =>
  fetch(`${BASE}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

type Sessione = { cookie: string; csrf: string };

async function accedi(email: string): Promise<Sessione> {
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
  return {
    cookie: (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; "),
    csrf: b.csrfToken,
  };
}

async function chiama(
  s: Sessione,
  metodo: "GET" | "POST",
  percorso: string,
): Promise<{ stato: number; corpo: unknown }> {
  const headers: Record<string, string> = { cookie: s.cookie };
  if (metodo !== "GET") headers["x-csrf-token"] = s.csrf;
  const r = await fetch(`${BASE}${percorso}`, { method: metodo, headers });
  let corpo: unknown = null;
  try {
    corpo = await r.json();
  } catch {
    corpo = null;
  }
  return { stato: r.status, corpo };
}

async function main(): Promise<void> {
  console.log(`# prova LIVE #198 T7 — ${BASE} — ${new Date().toISOString()}`);
  const platform = await accedi(PLATFORM);
  const azienda = await accedi(AZIENDA);
  console.log(`  login reali acquisiti: ${PLATFORM} (platform) · ${AZIENDA} (tenant-admin RTL)`);

  // Il fascicolo su cui misurare si LEGGE, non si scrive qui: un id fisso in questo
  // file sarebbe vero il giorno in cui lo scrivo e falso poco dopo.
  const elenco = await chiama(platform, "GET", "/v1/tenant-blueprints?limit=50");
  const items = ((elenco.corpo as { items?: Array<{ tenantBlueprintId: string; code: string }> })?.items ?? []);
  const rtl = items.find((b) => b.code === "RTL-BANK-CONFIG");
  if (!rtl) throw new Error("RTL-BANK-CONFIG non trovato: senza un fascicolo vero questa prova non misura niente");

  const esiti: Array<[string, boolean, string]> = [];

  // (1) il registro: federica DEVE vederlo
  const r1 = await chiama(azienda, "GET", "/v1/generated-origins?limit=5");
  const tot1 = (r1.corpo as { total?: number })?.total;
  esiti.push([
    "il TENANT_ADMIN di RTL legge il registro della propria azienda",
    r1.stato === 200,
    `HTTP ${r1.stato}${tot1 === undefined ? "" : ` · total=${tot1}`}`,
  ]);

  // e anche il sommario, che è l'altra metà della pagina
  const r1b = await chiama(azienda, "GET", "/v1/generated-origins/summary");
  esiti.push([
    "…e il suo sommario per tabella",
    r1b.stato === 200,
    `HTTP ${r1b.stato}`,
  ]);

  // (2) il fascicolo: federica NON deve vederlo — è ciò che rendeva impossibile
  //     annidare il registro là dentro
  const r2 = await chiama(azienda, "GET", "/v1/tenant-blueprints?limit=1");
  esiti.push([
    "lo stesso attore NON legge i fascicoli (è la ragione della collocazione)",
    r2.stato === 403,
    `HTTP ${r2.stato}`,
  ]);

  // (3) l'applicazione: federica NON deve poterla chiedere
  const r3 = await chiama(azienda, "POST", `/v1/tenant-blueprints/${rtl.tenantBlueprintId}/versions/1/apply`);
  esiti.push([
    "lo stesso attore NON può applicare",
    r3.stato === 403,
    `HTTP ${r3.stato}`,
  ]);

  // (4) controprova: il platform sì — altrimenti (2) e (3) sarebbero un endpoint rotto
  esiti.push([
    "controprova: il PLATFORM_ADMIN legge i fascicoli (quindi 403 sopra non è un guasto)",
    elenco.stato === 200,
    `HTTP ${elenco.stato} · ${items.length} fascicoli`,
  ]);

  // (5) il piano, in sola lettura, coi numeri veri
  const r5 = await chiama(platform, "POST", `/v1/tenant-blueprints/${rtl.tenantBlueprintId}/versions/1/build-plan`);
  const piano = r5.corpo as
    | { sourceKey?: string; willCreate?: Record<string, number>; alreadyThere?: Record<string, number> }
    | null;
  const somma = (o?: Record<string, number>): number =>
    Object.values(o ?? {}).reduce((a, b) => a + b, 0);
  esiti.push([
    "il piano è calcolabile e porta numeri, non zeri",
    r5.stato === 200 && somma(piano?.willCreate) > 0,
    `HTTP ${r5.stato} · sorgente=${piano?.sourceKey ?? "—"} · nascerebbero=${somma(piano?.willCreate)} · ci sono già=${somma(piano?.alreadyThere)}`,
  ]);

  console.log("");
  let rossi = 0;
  for (const [che, ok, dettaglio] of esiti) {
    console.log(`  ${ok ? "[ok]" : "[NO]"} ${che}\n         ${dettaglio}`);
    if (!ok) rossi += 1;
  }

  if (piano?.willCreate) {
    console.log(`\n  il piano, voce per voce (nascerebbero / ci sono già):`);
    for (const k of Object.keys(piano.willCreate)) {
      console.log(
        `    ${k.padEnd(14)} ${String(piano.willCreate[k]).padStart(4)} / ${String(piano.alreadyThere?.[k] ?? 0).padStart(4)}`,
      );
    }
  }

  if (rossi > 0) {
    console.error(`\nVERDETTO: ROSSO — ${rossi} criteri su ${esiti.length} non soddisfatti.`);
    process.exit(1);
  }
  console.log(
    `\nVERDETTO: VERDE — il registro è raggiungibile da chi ne ha il permesso, il fascicolo no, e la firma resta al solo platform.`,
  );
}

main().catch((e) => {
  console.error(`ERRORE: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
