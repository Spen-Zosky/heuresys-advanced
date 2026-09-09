/**
 * apps/api/scripts/prova-live-B5-okr-fuori-settore.mts — prova LIVE di B5
 * (bundle 2026-09-09, voce I21).
 *
 * Definition of Done del progetto: nessuno step si chiude su green-test. Questa
 * prova non usa `app.inject()` ne' scrive SQL a mano: parla HTTP con l'API in
 * esecuzione, con login reale (password derivata + secondo fattore) di una
 * persona con mandato HR, e porta i due obiettivi fuori settore a CANCELLED
 * passando dalla logica applicativa (permessi, validazione, tracciamento)
 * invece di scavalcarla — come il file 11_PRONTA_B del bundle chiede come
 * prima scelta, riservando la migrazione SQL al solo caso in cui questa via
 * non fosse praticabile.
 *
 *   pnpm exec tsx scripts/prova-live-B5-okr-fuori-settore.mts [https://www.heuresys.com]
 */
import * as OTPAuth from "otpauth";
import { passwordFor } from "../test/helpers/personas.js";
import { caricaSegretiTotp, totpSecretFor } from "../test/helpers/mfa-fixture-secrets.js";

const BASE = process.argv[2] ?? "http://localhost:3001";
const HR = "federica.marchetti@rtl-bank.org";

// Coppia (id, frammento di testo atteso) — mai un carattere jolly: si tocca solo
// se il testo trovato combacia con quello del reperto del 2026-09-09.
const TARGETS: { id: string; atteso: string }[] = [
  { id: "e54278d2-a4d5-4164-9c34-b9cea418e509", atteso: "organic product line" },
  { id: "e2f4ab73-016f-4f97-bcc3-0506a39342d5", atteso: "food waste" },
];

function totp(email: string): string {
  const secret = totpSecretFor(email);
  return new OTPAuth.TOTP({
    algorithm: "SHA1", digits: 6, period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  }).generate();
}

async function login(email: string): Promise<{ cookie: string; csrf: string; userId: string }> {
  const password = passwordFor(email);
  const post = async (payload: Record<string, unknown>) =>
    fetch(`${BASE}/v1/auth/login`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

  type Body = { status?: string; challengeToken?: string; csrfToken?: string; user?: { userId?: string; id?: string } };
  let r = await post({ email, password });
  let body = (await r.json()) as Body;
  if (body.status === "mfa_required") {
    r = await post({ email, password, challengeToken: body.challengeToken, mfaCode: totp(email) });
    body = (await r.json()) as Body;
  }
  if (r.status !== 200) throw new Error(`login ${email}: ${r.status} ${JSON.stringify(body)}`);
  const cookies = (r.headers as unknown as { getSetCookie(): string[] }).getSetCookie();
  return {
    cookie: cookies.map((c) => c.split(";")[0]).join("; "),
    csrf: body.csrfToken ?? "",
    userId: body.user?.userId ?? body.user?.id ?? "",
  };
}

const main = async (): Promise<void> => {
  console.log(`\n=== PROVA LIVE B5 — OKR fuori settore -> CANCELLED, su ${BASE} ===`);
  console.log(`quando: ${new Date().toISOString()}\n`);

  await caricaSegretiTotp();
  const hr = await login(HR);
  console.log(`login reale: ${HR} -> ok`);

  for (const t of TARGETS) {
    const before = await fetch(`${BASE}/v1/okrs/${t.id}`, { headers: { cookie: hr.cookie } });
    const beforeRaw = await before.text();
    if (before.status !== 200) throw new Error(`GET /v1/okrs/${t.id}: ${before.status} ${beforeRaw.slice(0, 200)}`);
    const beforeBody = JSON.parse(beforeRaw) as { objective?: string; status?: string };

    if (!beforeBody.objective || !beforeBody.objective.toLowerCase().includes(t.atteso)) {
      throw new Error(`${t.id}: il testo non combacia con l'atteso ("${t.atteso}") — trovato "${beforeBody.objective}". Non si procede alla cieca.`);
    }
    if (beforeBody.status === "CANCELLED" || beforeBody.status === "ARCHIVED") {
      throw new Error(`${t.id}: gia' in stato terminale (${beforeBody.status}). Qualcuno e' gia' intervenuto.`);
    }
    console.log(`  prima: ${t.id} — status=${beforeBody.status} — "${beforeBody.objective}"`);

    const patch = await fetch(`${BASE}/v1/okrs/${t.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: hr.cookie, "x-csrf-token": hr.csrf },
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    const patchRaw = await patch.text();
    if (patch.status !== 200) throw new Error(`PATCH /v1/okrs/${t.id}: ${patch.status} ${patchRaw.slice(0, 300)}`);
    const patched = JSON.parse(patchRaw) as { status?: string };
    if (patched.status !== "CANCELLED") {
      throw new Error(`${t.id}: risposta 200 ma status="${patched.status}" invece di CANCELLED`);
    }
    console.log(`  dopo:  ${t.id} — status=${patched.status} — CANCELLED via API reale (permessi + CSRF + tracciamento inclusi)`);
  }

  console.log(`\n=== ESITO: VERDE — 2/2 obiettivi portati a CANCELLED via PATCH /v1/okrs/:id (non SQL) ===`);
};

main().catch((e: unknown) => {
  console.error(`\n=== ESITO: ROSSO — ${e instanceof Error ? e.message : String(e)} ===`);
  process.exitCode = 1;
});
