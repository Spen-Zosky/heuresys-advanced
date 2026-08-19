/**
 * apps/api/scripts/prova-live-142-f3b.mts — #142 F3b, la dimostrazione LIVE.
 *
 * F3a ha aperto il catalogo e ha mostrato che persone diverse vedono viste diverse. F3b
 * mette i **dati** dentro quelle viste, quindi ciò che va mostrato dal vivo è un'altra cosa,
 * e più severa: che i valori ci siano dove la vista è `open`, che **non** ci siano dove è
 * `masked`, e che il perché sia scritto invece di essere taciuto.
 *
 * TRE SOGGETTI AGLI ESTREMI, gli stessi di F3a perché la separazione è la stessa:
 *   · enzo.spenuso     PLATFORM_ADMIN — mandato TECNICO: la vista economica esce `masked`,
 *                      e con essa NIENTE valori (ADR-0032). È il caso che deve fallire se
 *                      qualcuno un giorno riempisse anche le mascherate.
 *   · valentina.conti  HRMS_MANAGER   — mandato HR: la stessa vista, con i numeri
 *   · antonio.parisi   nessun dominio — Self-Service e basta, 403 sul resto
 *
 * ⚠ LA PROVA CHE CONTA È NEGATIVA. «La vista si è riempita» lo dicono già i test. Qui si
 * verifica che una vista `masked` porti `content: null` **e** una ragione non vuota: se
 * uscisse con i valori, questo script deve diventare rosso, altrimenti misura sé stesso.
 *
 *   npx tsx apps/api/scripts/prova-live-142-f3b.mts [http://localhost:3001]
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

interface Contenuto {
  kind: "counters" | "series" | "list";
  counters?: { key: string; label: string; value: number }[];
  points?: { bucket: string; value: number }[];
  rows?: { id: string; label: string }[];
}
interface Vista {
  code: string;
  dataClasses: string[];
  access: "open" | "masked" | "denied";
  content: Contenuto | null;
  withheldReason: string | null;
}
interface Dati { code: string; blocks: Vista[]; scope: { kind: string } }
interface Catalogo { dashboards: { code: string }[] }

let esiti = 0;
let falliti = 0;
function prova(nome: string, ok: boolean, dettaglio = ""): void {
  esiti++;
  if (!ok) falliti++;
  console.log(`    ${ok ? "OK  " : "ROSSO"} ${nome}${dettaglio ? ` — ${dettaglio}` : ""}`);
}

/** Quanti elementi porta un contenuto, qualunque forma abbia. */
function quanti(c: Contenuto | null): number {
  if (!c) return 0;
  if (c.kind === "counters") return c.counters?.length ?? 0;
  if (c.kind === "series") return c.points?.length ?? 0;
  return c.rows?.length ?? 0;
}

async function main(): Promise<void> {
  console.log(`\n#142 F3b — dimostrazione LIVE su dati reali · ${new Date().toISOString()}`);
  console.log(`API: ${BASE}\n`);

  for (const email of SOGGETTI) {
    const cookie = await login(email);
    console.log(`  ${email}`);

    const rc = await fetch(`${BASE}/v1/dashboard/catalog`, { headers: { cookie } });
    if (rc.status !== 200) throw new Error(`catalog per ${email}: ${rc.status}`);
    const cat = (await rc.json()) as Catalogo;

    let visteAperteConDati = 0;
    let visteAperteVuote = 0;

    for (const d of cat.dashboards) {
      const rd = await fetch(`${BASE}/v1/dashboard/catalog/${d.code}/data`, { headers: { cookie } });
      if (rd.status !== 200) {
        prova(`${d.code}: risposta`, false, `HTTP ${rd.status}`);
        continue;
      }
      const dati = (await rd.json()) as Dati;

      for (const v of dati.blocks) {
        if (v.access === "open") {
          // Una vista aperta DEVE portare un contenuto, anche se l'elenco è vuoto: `null`
          // qui significherebbe che il fornitore manca, ed è un difetto di allineamento.
          if (v.content === null) {
            prova(`${d.code}/${v.code}: aperta senza contenuto`, false, v.withheldReason ?? "");
          } else if (quanti(v.content) > 0) visteAperteConDati++;
          else visteAperteVuote++;
        } else {
          // ⚠ IL CASO CHE DEVE POTER FALLIRE: mascherata o negata → nessun valore, e una
          // ragione scritta. Se un giorno `content` uscisse valorizzato qui, questa riga
          // diventa rossa — che è l'unico motivo per cui vale la pena eseguirla.
          prova(
            `${d.code}/${v.code}: ${v.access} senza valori`,
            v.content === null && (v.withheldReason ?? "").length > 0,
            v.content !== null ? "CONTENUTO PRESENTE su vista non aperta" : "",
          );
        }
      }
    }

    console.log(`    viste aperte con dati: ${visteAperteConDati} · aperte ma vuote: ${visteAperteVuote}`);

    // Il cruscotto HR è dove i due mandati si separano: si guarda la vista economica.
    const rh = await fetch(`${BASE}/v1/dashboard/catalog/hr/data`, { headers: { cookie } });
    if (rh.status === 200) {
      const hr = (await rh.json()) as Dati;
      const eco = hr.blocks.find((b) => b.dataClasses.includes("COMPENSATION"));
      if (!eco) {
        prova("HR: la vista economica esiste", false, "assente dal cruscotto");
      } else {
        console.log(
          `    HR/vista economica: ${eco.access} · ` +
            (eco.content ? `${quanti(eco.content)} valori` : `nessun valore — «${eco.withheldReason}»`),
        );
        prova(
          "HR: i valori economici seguono la modalità",
          eco.access === "open" ? eco.content !== null : eco.content === null,
        );
      }
    } else {
      console.log(`    cruscotto HR: NEGATO ${rh.status}`);
    }
    console.log();
  }

  await closePool();
  console.log(`${esiti - falliti}/${esiti} verdi — ${falliti === 0 ? "PROVA VERDE" : "PROVA ROSSA"}\n`);
  if (falliti > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await closePool();
  process.exit(1);
});
