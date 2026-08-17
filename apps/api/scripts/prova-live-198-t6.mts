/**
 * apps/api/scripts/prova-live-198-t6.mts — prova LIVE del T6 di #198, S1067.
 *
 * Che cosa dimostra, con login reale sull'API vera: **l'interruttore c'è**. Fino a ieri il
 * motore che costruisce un'azienda esisteva ma nessuna rotta lo raggiungeva.
 *
 * ⚠ COSA QUESTA PROVA NON FA, ed è dichiarato invece che taciuto: **non chiama `apply` su
 * un fascicolo di produzione**. `apply` apre una richiesta di approvazione vera, e farlo su
 * `RTL-BANK-CONFIG` metterebbe una firma da dare in coda a delle persone per un esperimento.
 * Che `apply` non costruisca è provato dalla batteria di integrazione su un'azienda usa e
 * getta rollbackata; qui si misura ciò che si può misurare **senza scrivere**: il piano e il
 * registro. Il ciclo intero è il T9, e per decisione E27 si fa prima sul gemello.
 *
 *   cd apps/api && pnpm exec tsx scripts/prova-live-198-t6.mts [http://localhost:3001]
 */
import * as OTPAuth from "otpauth";
import { passwordFor } from "../test/helpers/personas.js";
import { FIXTURE_TOTP_SECRETS } from "../test/helpers/mfa-fixture-secrets.js";

const BASE = process.argv[2] ?? "http://localhost:3001";
const ATTORE = "enzo.spenuso@heuresys.com";

function totp(email: string): string | null {
  const s = FIXTURE_TOTP_SECRETS[email];
  return s ? new OTPAuth.TOTP({ algorithm: "SHA1", digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(s) }).generate() : null;
}

async function accedi(email: string): Promise<{ cookie: string; csrf: string }> {
  const password = passwordFor(email);
  const post = (p: Record<string, unknown>) =>
    fetch(`${BASE}/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(p) });
  type B = { status?: string; challengeToken?: string; csrfToken?: string };
  let r = await post({ email, password });
  let b = (await r.json()) as B;
  if (b.status === "mfa_required") {
    r = await post({ email, password, challengeToken: b.challengeToken, mfaCode: totp(email) });
    b = (await r.json()) as B;
  }
  if (!b.csrfToken) throw new Error(`login fallito: ${JSON.stringify(b)}`);
  return { cookie: (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; "), csrf: b.csrfToken };
}

async function main(): Promise<void> {
  const { cookie, csrf } = await accedi(ATTORE);
  console.log(`# prova LIVE #198 T6 — ${BASE} — ${new Date().toISOString()}\n`);

  const el = await (await fetch(`${BASE}/v1/tenant-blueprints?limit=20`, { headers: { cookie } })).json() as {
    items: Array<{ tenantBlueprintId: string; code: string; tenantId: string | null }>;
  };
  const f = el.items.find((x) => x.tenantId);
  if (!f) throw new Error("nessun fascicolo legato a un'azienda su cui misurare il piano");
  console.log(`  fascicolo: ${f.code} (legato a un'azienda)`);

  // --- il PIANO, che e' di sola lettura
  const rp = await fetch(`${BASE}/v1/tenant-blueprints/${f.tenantBlueprintId}/versions/1/build-plan`, {
    method: "POST", headers: { cookie, "x-csrf-token": csrf },
  });
  const piano = (await rp.json()) as {
    sourceKey?: string; label?: string;
    willCreate?: Record<string, number>; alreadyThere?: Record<string, number>;
    error?: { code: string };
  };
  console.log(`\n  POST …/versions/1/build-plan → HTTP ${rp.status}`);
  if (piano.error) console.log(`    ${piano.error.code}`);
  else {
    console.log(`    sorgente     : ${piano.sourceKey} — ${piano.label}`);
    console.log(`    nascerebbero : ${JSON.stringify(piano.willCreate)}`);
    console.log(`    esistono gia': ${JSON.stringify(piano.alreadyThere)}`);
  }

  // --- il REGISTRO
  const rl = await fetch(`${BASE}/v1/generated-origins?limit=5`, { headers: { cookie } });
  const lista = (await rl.json()) as { items?: unknown[]; total?: number };
  const rs = await fetch(`${BASE}/v1/generated-origins/summary`, { headers: { cookie } });
  const somma = (await rs.json()) as { byTable?: Array<{ targetTable: string; total: number }>; totals?: { total: number } };
  console.log(`\n  GET  /v1/generated-origins          → HTTP ${rl.status} · ${lista.total ?? "?"} righe`);
  console.log(`  GET  /v1/generated-origins/summary  → HTTP ${rs.status} · ${somma.totals?.total ?? "?"} in totale`);
  if ((somma.totals?.total ?? 0) === 0) {
    console.log("    ⚠ il registro e' VUOTO — atteso: nessuna azienda e' ancora stata costruita da un fascicolo.");
    console.log("      Uno zero qui NON dice che il registro funziona: lo dira' il T9.");
  }

  const esiti: Array<[string, boolean]> = [
    ["il piano risponde 200", rp.status === 200],
    ["il piano dichiara la sorgente", Boolean(piano.sourceKey)],
    ["il piano distingue cosa nascerebbe da cosa esiste già", Boolean(piano.willCreate && piano.alreadyThere)],
    ["il registro risponde 200 su entrambe le rotte", rl.status === 200 && rs.status === 200],
    ["il riassunto è coerente con sé stesso",
      (somma.totals?.total ?? 0) === (somma.byTable ?? []).reduce((n, x) => n + x.total, 0)],
  ];
  console.log("");
  for (const [n, ok] of esiti) console.log(`  ${ok ? "OK  " : "NO  "} ${n}`);
  const ok = esiti.every(([, v]) => v);
  console.log(`\nVERDETTO: ${ok ? "la superficie di costruzione risponde sul sistema vivo" : "NON dimostrato — vedi sopra"}`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error("ERRORE:", e instanceof Error ? e.message : e);
  process.exit(2);
});
