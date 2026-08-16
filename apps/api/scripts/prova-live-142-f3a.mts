/**
 * apps/api/scripts/prova-live-142-f3a.mts — #142 F3a, la dimostrazione LIVE.
 *
 * F3a apre il catalogo dei cruscotti in lettura. Ciò che va mostrato dal vivo non è che
 * l'endpoint risponda — lo dicono i test — ma che **risponda cose diverse a persone diverse**,
 * e che il diniego sia un diniego: la chiusura dichiarata di `#142` chiede che nessuna pagina
 * sia raggiungibile da chi non può vederne il contenuto.
 *
 * Tre soggetti scelti per essere agli estremi, perché interrogare tre persone equivalenti
 * non dimostra un filtro:
 *   · enzo.spenuso     PLATFORM_ADMIN — le vede tutte (tappeto di `000005`), ma il suo
 *                      mandato è TECNICO: la vista economica gli esce MASCHERATA (ADR-0032)
 *   · valentina.conti  HRMS_MANAGER   — mandato HR: la stessa vista, in chiaro
 *   · antonio.parisi   nessun dominio — solo il Self-Service, e un 403 sul resto
 *
 *   npx tsx apps/api/scripts/prova-live-142-f3a.mts [http://localhost:3001]
 */
import * as OTPAuth from "otpauth";
import { readMaster, derivePassword, deriveTotpSecret } from "./derive-access.mjs";
import { closePool } from "../src/db/client.js";

const BASE = process.argv[2] ?? "http://localhost:3001";
const master = readMaster();

const SOGGETTI = [
  "enzo.spenuso@heuresys.com",
  "valentina.conti@rtl-bank.org",
  "antonio.parisi@rtl-bank.org",
];

function totp(email: string): string {
  return new OTPAuth.TOTP({
    algorithm: "SHA1", digits: 6, period: 30,
    secret: OTPAuth.Secret.fromBase32(deriveTotpSecret(master, email)),
  }).generate();
}

async function login(email: string): Promise<string> {
  const password = derivePassword(master, email);
  const post = async (p: Record<string, unknown>) =>
    fetch(`${BASE}/v1/auth/login`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(p),
    });
  type Body = { status?: string; challengeToken?: string };
  let r = await post({ email, password });
  let body = (await r.json()) as Body;
  if (body.status === "mfa_required") {
    r = await post({ email, password, challengeToken: body.challengeToken, mfaCode: totp(email) });
    body = (await r.json()) as Body;
  }
  if (r.status !== 200) throw new Error(`login ${email}: ${r.status} ${JSON.stringify(body)}`);
  const cookies = (r.headers as unknown as { getSetCookie(): string[] }).getSetCookie();
  return cookies.map((c) => c.split(";")[0]).join("; ");
}

interface Catalogo {
  dashboards: { code: string; blockCount: number; maskedBlockCount: number }[];
}
interface Dettaglio { blocks: { code: string; dataClasses: string[]; access: string }[] }

async function main(): Promise<void> {
  console.log(`\n#142 F3a — dimostrazione LIVE su dati reali · ${new Date().toISOString()}`);
  console.log(`API: ${BASE}\n`);

  for (const email of SOGGETTI) {
    const cookie = await login(email);

    const rc = await fetch(`${BASE}/v1/dashboard/catalog`, { headers: { cookie } });
    if (rc.status !== 200) throw new Error(`catalog per ${email}: ${rc.status}`);
    const cat = (await rc.json()) as Catalogo;

    console.log(`  ${email}`);
    console.log(`    famiglie visibili : ${cat.dashboards.length}`);
    for (const d of cat.dashboards) {
      const m = d.maskedBlockCount > 0 ? ` · ${d.maskedBlockCount} mascherate` : "";
      console.log(`      ${d.code.padEnd(9)} ${d.blockCount} viste${m}`);
    }

    // Il dettaglio del cruscotto HR: e' li' che i due mandati si separano.
    const rd = await fetch(`${BASE}/v1/dashboard/catalog/hr`, { headers: { cookie } });
    if (rd.status === 200) {
      const det = (await rd.json()) as Dettaglio;
      const eco = det.blocks.find((b) => b.dataClasses.includes("COMPENSATION"));
      // ⚠ Si legge `access`, e se mancasse si DICHIARA invece di cadere sul ramo rassicurante:
      // la prima stesura leggeva un booleano `masked` che il modello non ha piu', quindi
      // trovava `undefined` e stampava «in chiaro» — un falso verde prodotto dallo strumento
      // di misura, non dal sistema misurato. E' la stessa specie dei tre falsi verdi di S1049.
      const stato = eco ? (eco.access ?? "CAMPO ASSENTE — strumento disallineato") : "assente";
      console.log(`    cruscotto HR      : vista economica ${stato}`);
    } else {
      const body = (await rd.json()) as { error?: { code?: string } };
      console.log(`    cruscotto HR      : NEGATO ${rd.status} ${body.error?.code ?? ""}`);
    }
    console.log();
  }

  await closePool();
  console.log("fine.\n");
}

main().catch(async (e) => {
  console.error(e);
  await closePool();
  process.exit(1);
});
