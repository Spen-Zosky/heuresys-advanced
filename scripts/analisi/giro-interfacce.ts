/**
 * scripts/analisi/giro-interfacce.ts
 *
 * Giro dal vivo delle interfacce di advanced, versione corretta dopo la controvalutazione
 * del 2026-11-01 (analisi-interfacce/V11_controvalutazione nella cartella del progetto).
 *
 * Che cosa fa: entra come una persona vera per ogni ruolo assegnato nel tenant RTL Bank
 * (più i capi di due catene sorelle, più l'anonimo), apre ogni pagina di apps/web e registra
 * che cosa vede. Rispetto al giro del 31/10 cambia il modo di giudicare:
 *
 *   - l'esito di una visita viene dalle risposte HTTP della pagina e dalle sue chiamate /v1,
 *     non da parole cercate nel testo (il 31/10 «riservato» faceva dire «negata» a
 *     /whistleblowing);
 *   - le chiamate del layout (auth/me, me/interfaces, me/permissions, me/preferences) non
 *     decidono l'esito della pagina (il 31/10 un solo 403 su me/preferences rendeva «negata»
 *     ogni pagina di due ruoli);
 *   - i cruscotti si visitano agli indirizzi veri, letti da sys_dashboards;
 *   - le pagine di dettaglio si aprono seguendo i collegamenti della pagina elenco, come fa
 *     una persona, quindi con identificativi che quella persona vede davvero;
 *   - il perimetro si misura: ogni identificativo di persona che arriva in una risposta
 *     viene confrontato con l'insieme che la persona può vedere, ricavato dal database in
 *     modo indipendente dal codice dell'API (unità dirette dalla persona e loro discendenti);
 *   - i confini fra catene sorelle si provano aprendo il dossier di un sottoposto e quello
 *     di una persona della catena sorella;
 *   - i totali delle pagine elenco si confrontano con il database per chi vede tutto il tenant;
 *   - si registra il tempo di ogni chiamata.
 *
 * Sicurezza: il database si legge solo in transazioni READ ONLY. Nel browser ogni richiesta
 * che non sia GET viene bloccata, salvo il login. L'unica scrittura in produzione è quella
 * normale di un accesso (sessione, riga di login). Nessuna password, nessun segreto e nessun
 * codice finisce nei file di uscita o a schermo. Le password si derivano dalla chiave madre
 * come fa la suite di prova (apps/api/scripts/derive-access.mjs); il secondo fattore si legge
 * cifrato dal database e si decifra con la chiave del server, come fa
 * apps/api/test/helpers/mfa-fixture-secrets.ts: solo i fattori con etichetta derived-access.
 *
 * Uso, sulla VM, dalla radice del repository:
 *   cd apps/api && npx tsx ../../scripts/analisi/giro-interfacce.ts --prova      # solo anonimo e scelta persone
 *   cd apps/api && npx tsx ../../scripts/analisi/giro-interfacce.ts               # giro intero
 * Fuori dal repository: GIRO_REPO=~/heuresys-advanced npx tsx <percorso dello script> (dalla cartella apps/api).
 * Opzioni: --base https://www.heuresys.com  --uscita <cartella>  --pausa-ms 1200
 *          --solo <sigla,sigla>  --senza-db (niente database: solo anonimo)
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, appendFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const REPO = resolve(process.env.GIRO_REPO ?? resolve(dirname(fileURLToPath(import.meta.url)), "..", ".."));
const args = process.argv.slice(2);
const opt = (name: string, def?: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1] ?? "") : def;
};
const flag = (name: string) => args.includes(`--${name}`);

const BASE = (opt("base", "https://www.heuresys.com") ?? "").replace(/\/$/, "");
const PAUSA = Number(opt("pausa-ms", "1200"));
const ORA = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
const USCITA = resolve(opt("uscita", join(process.env.HOME ?? REPO, `analisi-interfacce-giro2-${ORA}`)) ?? "");
const PROVA = flag("prova");
const SENZA_DB = flag("senza-db");
const SOLO = (opt("solo", "") ?? "").split(",").filter(Boolean);

const reqApi = createRequire(join(REPO, "apps/api/package.json"));
const reqRoot = createRequire(join(REPO, "package.json"));
const otp = () => reqApi("otpauth");
const { chromium } = (() => {
  try { return reqRoot("playwright"); } catch { return createRequire(import.meta.url)("playwright"); }
})();

mkdirSync(USCITA, { recursive: true });
mkdirSync(join(USCITA, "schermate"), { recursive: true });

const ts = () => new Date().toISOString();
const log = (m: string) => {
  const r = `${ts()} ${m}`;
  console.log(r);
  appendFileSync(join(USCITA, "registro.log"), r + "\n");
};
const tsv = (file: string, cols: string[]) => {
  const p = join(USCITA, file);
  writeFileSync(p, cols.join("\t") + "\n");
  return (vals: unknown[]) =>
    appendFileSync(p, vals.map((v) => String(v ?? "").replace(/[\t\r\n]+/g, " ")).join("\t") + "\n");
};
const dorme = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- pagine di apps/web
type Pagina = { modello: string; dinamica: boolean; pubblica: boolean };
function elencaPagine(): Pagina[] {
  const radice = join(REPO, "apps/web/src/app");
  const out: Pagina[] = [];
  const giro = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) giro(p);
      else if (n === "page.tsx") {
        const rel = relative(radice, dirname(p)).split(sep).filter((s) => !/^\(.*\)$/.test(s));
        const modello = "/" + rel.join("/");
        out.push({
          modello: modello === "/" ? "/" : modello,
          dinamica: /\[/.test(modello),
          pubblica: !relative(radice, p).startsWith("(authenticated)"),
        });
      }
    }
  };
  giro(radice);
  return out.sort((a, b) => a.modello.localeCompare(b.modello));
}

// ---------------------------------------------------------------- database, sola lettura
type Db = { q: <T = Record<string, unknown>>(sql: string, p?: unknown[]) => Promise<T[]>; fine: () => Promise<void> };
async function apriDb(): Promise<Db> {
  const { pool } = await import(pathToFileURL(join(REPO, "apps/api/src/db/client.ts")).href);
  return {
    q: async (sql, p = []) => {
      const c = await pool.connect();
      try {
        await c.query("BEGIN READ ONLY");
        const r = await c.query(sql, p);
        await c.query("ROLLBACK");
        return r.rows;
      } catch (e) {
        await c.query("ROLLBACK").catch(() => undefined);
        throw e;
      } finally {
        c.release();
      }
    },
    fine: () => pool.end(),
  };
}

type Persona = {
  sigla: string;
  ruolo: string;
  email: string | null;
  userId: string | null;
  tenantId: string | null;
  nota: string;
  ruoli: string[];
  visibili: Set<string> | "tenant" | "tenant-mascherato" | null;
  sottoposto: string | null;
  sorella: string | null;
};

async function scegliPersone(db: Db, hr: Set<string>, mascherati: Set<string>): Promise<Persona[]> {
  const [rtl] = await db.q<{ tenant_id: string }>(
    `select tenant_id from sys.sys_tenancies where tenant_code = 'RTL_BANK'`,
  );
  if (!rtl) throw new Error("tenant RTL_BANK non trovato");
  const reali = (await import(pathToFileURL(join(REPO, "apps/api/scripts/derive-access.mjs")).href))
    .REAL_PERSON_EMAILS as string[];
  const escluse = reali.map((e) => e.toLowerCase());

  // Una persona per ruolo: attiva, STANDARD, con un fattore derived-access, preferendo chi ha
  // un incarico attivo e dirige un'unità (così il perimetro di catena si vede davvero).
  const righe = await db.q<{ ruolo: string; email: string; user_id: string; tenant_id: string; incarico: boolean; dirige: boolean; fattore: boolean }>(
    `with base as (
       select r.auth_role_code ruolo, u.user_email email, u.user_id, u.user_tenant_id tenant_id,
              exists(select 1 from sys.sys_user_position_assignments a
                      where a.user_position_assignment_user_id = u.user_id
                        and a.user_position_assignment_status = 'ACTIVE') incarico,
              exists(select 1 from sys.sys_organization_units o
                      where o.organization_unit_manager_user_id = u.user_id
                        and o.organization_unit_is_active) dirige,
              exists(select 1 from sys.sys_auth_mfa_factors f
                      where f.auth_mfa_factor_user_id = u.user_id and f.auth_mfa_factor_kind = 'TOTP'
                        and f.auth_mfa_factor_metadata->>'label' = 'derived-access') fattore
         from sys.sys_user_auth_roles uar
         join sys.sys_auth_roles r on r.auth_role_id = uar.user_auth_role_role_id
         join sys.sys_users u on u.user_id = uar.user_auth_role_user_id
        where uar.user_auth_role_revoked_at is null
          and u.user_status = 'ACTIVE' and u.user_type = 'STANDARD'
          and lower(u.user_email) <> all($1::text[]))
     select distinct on (ruolo, tenant_id) * from base
      order by ruolo, tenant_id, fattore desc, dirige desc, incarico desc, email`,
    [escluse],
  );

  // Capi delle due catene sorelle.
  const capi = await db.q<{ codice: string; email: string; user_id: string; tenant_id: string }>(
    `select o.organization_unit_code codice, u.user_email email, u.user_id, u.user_tenant_id tenant_id
       from sys.sys_organization_units o join sys.sys_users u on u.user_id = o.organization_unit_manager_user_id
      where o.organization_unit_tenant_id = $1 and o.organization_unit_code in ('DIV-CRED','DIV-RETAIL')
        and o.organization_unit_is_active order by 1`,
    [rtl.tenant_id],
  );

  const persone: Persona[] = [
    { sigla: "ANON", ruolo: "(anonimo)", email: null, userId: null, tenantId: null, nota: "", ruoli: [], visibili: null, sottoposto: null, sorella: null },
  ];
  for (const r of righe) {
    const tenant = r.tenant_id === rtl.tenant_id ? "RTL" : "SYS";
    persone.push({
      sigla: `${tenant}-${r.ruolo}`, ruolo: r.ruolo, email: r.email, userId: r.user_id, tenantId: r.tenant_id,
      nota: `incarico=${r.incarico} dirige=${r.dirige} fattore=${r.fattore}`, ruoli: [], visibili: null, sottoposto: null, sorella: null,
    });
  }
  for (const c of capi) {
    persone.push({
      sigla: `CAPO-${c.codice}`, ruolo: `capo ${c.codice}`, email: c.email, userId: c.user_id, tenantId: c.tenant_id,
      nota: "capo di catena", ruoli: [], visibili: null, sottoposto: null, sorella: null,
    });
  }

  // Ruoli effettivi e perimetro atteso, ricavati dal database e non dal codice dell'API.
  for (const p of persone) {
    if (!p.userId) continue;
    const ru = await db.q<{ c: string }>(
      `select r.auth_role_code c from sys.sys_user_auth_roles uar join sys.sys_auth_roles r on r.auth_role_id = uar.user_auth_role_role_id
        where uar.user_auth_role_user_id = $1 and uar.user_auth_role_revoked_at is null`,
      [p.userId],
    );
    p.ruoli = [...new Set(["USER", ...ru.map((x) => x.c)])];
    if (p.ruoli.some((r) => hr.has(r))) p.visibili = "tenant";
    else if (p.ruoli.some((r) => mascherati.has(r))) p.visibili = "tenant-mascherato";
    else {
      const vis = await db.q<{ u: string }>(
        `with recursive alb as (
           select organization_unit_id id from sys.sys_organization_units
            where organization_unit_manager_user_id = $1 and organization_unit_is_active
           union select o.organization_unit_id from sys.sys_organization_units o join alb on o.organization_unit_parent_id = alb.id
            where o.organization_unit_is_active)
         select distinct a.user_position_assignment_user_id u
           from sys.sys_user_position_assignments a join sys.sys_positions po on po.position_id = a.user_position_assignment_position_id
          where po.position_organization_unit_id in (select id from alb) and a.user_position_assignment_status = 'ACTIVE'`,
        [p.userId],
      );
      p.visibili = new Set([p.userId, ...vis.map((x) => x.u)]);
    }
  }
  // Per i capi: un sottoposto e una persona della catena sorella, per provare il confine.
  const capiP = persone.filter((p) => p.sigla.startsWith("CAPO-"));
  for (const c of capiP) {
    const altro = capiP.find((x) => x !== c);
    if (c.visibili instanceof Set) c.sottoposto = [...c.visibili].find((u) => u !== c.userId) ?? null;
    if (altro?.visibili instanceof Set) c.sorella = [...altro.visibili].find((u) => u !== altro.userId) ?? null;
  }
  return SOLO.length ? persone.filter((p) => SOLO.includes(p.sigla) || p.sigla === "ANON") : persone;
}

// ---------------------------------------------------------------- accesso
async function entra(db: Db, ctx: any, p: Persona): Promise<string> {
  const { readMaster, derivePassword } = await import(pathToFileURL(join(REPO, "apps/api/scripts/derive-access.mjs")).href);
  const password = derivePassword(readMaster(), p.email!);
  const r1 = await ctx.request.post(`${BASE}/api/v1/auth/login`, { data: { email: p.email, password } });
  if (r1.status() !== 200) return `rifiutato al primo passo (${r1.status()})`;
  const b1 = await r1.json();
  if (b1.status === "success" || b1.status === undefined) return "ok";
  if (b1.status !== "mfa_required") return `stato inatteso ${b1.status}`;
  const [f] = await db.q<{ s: string }>(
    `select f.auth_mfa_factor_secret s from sys.sys_auth_mfa_factors f
      where f.auth_mfa_factor_user_id = $1 and f.auth_mfa_factor_kind = 'TOTP'
        and f.auth_mfa_factor_metadata->>'label' = 'derived-access' limit 1`,
    [p.userId],
  );
  if (!f) return "secondo fattore richiesto e nessun fattore derived-access";
  const { decryptSecret } = await import(pathToFileURL(join(REPO, "apps/api/src/modules/auth/secret-crypto.ts")).href);
  const codice = new (otp().TOTP)({ algorithm: "SHA1", digits: 6, period: 30, secret: otp().Secret.fromBase32(decryptSecret(f.s)) }).generate();
  const r2 = await ctx.request.post(`${BASE}/api/v1/auth/login`, {
    data: { email: p.email, password, challengeToken: b1.challengeToken, mfaCode: codice },
  });
  const b2 = await r2.json().catch(() => ({}));
  return r2.status() === 200 && b2.status === "success" ? "ok (secondo fattore)" : `rifiutato al secondo passo (${r2.status()})`;
}

// ---------------------------------------------------------------- classificazione
const LAYOUT = /^\/api\/v1\/(auth\/me|auth\/refresh|me\/interfaces|me\/permissions|me\/preferences)(\?|$)/;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const SENSIBILI = /(salary|amount|eur$|compensation|bonus|pay|score|rating|performance|potential|nine|band|iban|birth|fiscal|tax|health|sick|disciplin|whistle)/i;
const normalizza = (path: string) => path.replace(UUID, ":id").replace(/\/\d+(?=\/|$|\?)/g, "/:n").replace(/\?.*$/, "");

type Chiamata = { metodo: string; path: string; stato: number; ms: number; byte: number; corpo: unknown };

function esito(finale: string, docStato: number, chiamate: Chiamata[], erroreUi: boolean, modello: string) {
  const fp = new URL(finale).pathname;
  if (fp === "/login" && modello !== "/login") return "L";
  const pag = chiamate.filter((c) => !LAYOUT.test(c.path));
  if (docStato >= 500 || pag.some((c) => c.stato >= 500)) return "5";
  const ok = pag.filter((c) => c.stato >= 200 && c.stato < 300).length;
  const n403 = pag.filter((c) => c.stato === 403 || c.stato === 401).length;
  const n404 = pag.filter((c) => c.stato === 404).length;
  if (docStato === 404) return "4";
  if (!ok && n403) return "N";
  if (!ok && n404) return "4";
  if (ok && n403) return "P";
  if (erroreUi) return "e";
  return "o";
}

// ---------------------------------------------------------------- giro
async function main() {
  log(`uscita ${USCITA}; base ${BASE}; prova=${PROVA}`);
  try {
    const dep = execFileSync("bash", [join(REPO, "scripts/verifica-deploy.sh")], { encoding: "utf8", timeout: 60_000 });
    log(`verifica-deploy: ${dep.trim().split("\n").slice(-1)[0]}`);
  } catch (e: any) {
    log(`verifica-deploy non riuscita: ${String(e.stdout ?? e.message).trim().split("\n").slice(-1)[0]}`);
  }
  log(`commit: ${execFileSync("git", ["-C", REPO, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim()}`);

  const pagine = elencaPagine();
  log(`pagine di apps/web: ${pagine.length}`);

  let db: Db | null = null;
  let persone: Persona[] = [{ sigla: "ANON", ruolo: "(anonimo)", email: null, userId: null, tenantId: null, nota: "", ruoli: [], visibili: null, sottoposto: null, sorella: null }];
  let cruscotti: string[] = [];
  if (!SENZA_DB) {
    db = await apriDb();
    const sc = await import(pathToFileURL(join(REPO, "apps/api/src/lib/scope/resolver.ts")).href);
    const hr = new Set<string>(sc.HR_MANDATED_ROLES);
    const masch = new Set<string>(sc.TENANT_WIDE_MASKED_ROLES ?? []);
    persone = await scegliPersone(db, hr, masch);
    cruscotti = (await db.q<{ r: string }>(`select distinct dashboard_route r from sys.sys_dashboards order by 1`)).map((x) => x.r);
  }
  const wP = tsv("persone.tsv", ["sigla", "ruolo", "ruoli_effettivi", "perimetro_atteso", "nota", "accesso"]);
  const wV = tsv("visite.tsv", ["sigla", "modello", "url", "esito", "http_doc", "url_finale", "chiamate", "c_2xx", "c_403", "c_404", "c_5xx", "ms_pagina", "ms_chiamata_max", "errore_ui", "nel_menu"]);
  const wC = tsv("chiamate.tsv", ["sigla", "modello", "metodo", "percorso", "stato", "ms", "byte"]);
  const wM = tsv("menu.tsv", ["sigla", "route", "etichetta"]);
  const wF = tsv("perimetro.tsv", ["sigla", "modello", "percorso", "persone_fuori_perimetro", "campi_sensibili_nella_risposta", "giudizio"]);
  const wK = tsv("confini.tsv", ["sigla", "caso", "url_modello", "esito", "stato_dossier"]);
  const wA = tsv("accuratezza.tsv", ["sigla", "endpoint", "totale_api", "conteggio_db", "esito"]);
  const wB = tsv("scritture-bloccate.tsv", ["sigla", "modello", "metodo", "percorso"]);

  const utentiTenant = new Set<string>();
  if (db) for (const r of await db.q<{ u: string }>(`select user_id u from sys.sys_users`)) utentiTenant.add(r.u);

  // Un Chromium già presente sulla macchina si usa così: GIRO_CHROMIUM=<percorso dell'eseguibile>.
  // Senza, Playwright cerca la sua build, che va installata con «npx playwright install chromium».
  const browser = await chromium.launch(
    process.env.GIRO_CHROMIUM ? { executablePath: process.env.GIRO_CHROMIUM, args: ["--headless=new", "--no-sandbox"] } : {},
  );
  for (const p of persone) {
    if (PROVA && p.sigla !== "ANON") {
      wP([p.sigla, p.ruolo, p.ruoli.join(" "), p.visibili instanceof Set ? `${p.visibili.size} persone` : (p.visibili ?? ""), p.nota, "non provato (--prova)"]);
      continue;
    }
    const ctx = await browser.newContext({ baseURL: BASE, locale: "it-IT" });
    let accesso = "anonimo";
    if (p.email && db) {
      accesso = await entra(db, ctx, p).catch((e) => `errore ${String(e.message).slice(0, 80)}`);
      if (!accesso.startsWith("ok")) {
        wP([p.sigla, p.ruolo, p.ruoli.join(" "), "", p.nota, accesso]);
        log(`${p.sigla}: accesso ${accesso}; persona saltata`);
        await ctx.close();
        continue;
      }
    }
    wP([p.sigla, p.ruolo, p.ruoli.join(" "), p.visibili instanceof Set ? `${p.visibili.size} persone` : (p.visibili ?? ""), p.nota, accesso]);
    log(`${p.sigla}: accesso ${accesso}`);

    const menu = new Set<string>();
    if (p.email) {
      const r = await ctx.request.get(`${BASE}/api/v1/me/interfaces`);
      if (r.ok()) for (const per of (await r.json()).perspectives ?? []) for (const i of per.interfaces ?? []) { menu.add(i.route); wM([p.sigla, i.route, i.label]); }
    }

    const page = await ctx.newPage();
    let correnti: Chiamata[] = [];
    let modelloCorrente = "";
    const inizio = new Map<any, number>();
    await page.route("**/*", (route: any) => {
      const r = route.request();
      const u = new URL(r.url());
      const login = u.pathname === "/api/v1/auth/login" || u.pathname === "/api/v1/auth/refresh";
      if (r.method() !== "GET" && r.method() !== "HEAD" && r.method() !== "OPTIONS" && !login) {
        wB([p.sigla, modelloCorrente, r.method(), normalizza(u.pathname)]);
        return route.abort();
      }
      return route.continue();
    });
    page.on("request", (r: any) => inizio.set(r, Date.now()));
    page.on("response", async (res: any) => {
      const u = new URL(res.url());
      if (!u.pathname.startsWith("/api/v1/")) return;
      const req = res.request();
      const ms = Date.now() - (inizio.get(req) ?? Date.now());
      let corpo: unknown = null;
      let byte = 0;
      try {
        const b = await res.body();
        byte = b.length;
        if ((res.headers()["content-type"] ?? "").includes("json")) corpo = JSON.parse(b.toString("utf8"));
      } catch { /* corpo non leggibile: resta null */ }
      correnti.push({ metodo: req.method(), path: u.pathname + u.search, stato: res.status(), ms, byte, corpo });
    });

    const visita = async (modello: string, url: string) => {
      correnti = [];
      modelloCorrente = modello;
      const t0 = Date.now();
      let docStato = 0;
      try {
        const r = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
        docStato = r?.status() ?? 0;
        await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
      } catch { docStato = -1; }
      const msPagina = Date.now() - t0;
      const erroreUi = await page.locator('[data-testid$="-error"]:visible').count().catch(() => 0);
      const e = esito(page.url(), docStato, correnti, erroreUi > 0, modello);
      const pag = correnti.filter((c) => !LAYOUT.test(c.path));
      wV([p.sigla, modello, url, e, docStato, new URL(page.url()).pathname, pag.length,
        pag.filter((c) => c.stato < 300).length, pag.filter((c) => c.stato === 403).length,
        pag.filter((c) => c.stato === 404).length, pag.filter((c) => c.stato >= 500).length,
        msPagina, Math.max(0, ...correnti.map((c) => c.ms)), erroreUi > 0 ? "sì" : "", menu.has(url) ? "sì" : ""]);
      for (const c of correnti) wC([p.sigla, modello, c.metodo, normalizza(c.path), c.stato, c.ms, c.byte]);
      // Perimetro: persone che arrivano nelle risposte e che la persona non dovrebbe vedere.
      if (p.visibili instanceof Set) {
        for (const c of pag) {
          if (c.stato >= 300 || !c.corpo) continue;
          const testo = JSON.stringify(c.corpo);
          const fuori = [...new Set(testo.match(UUID) ?? [])].filter((u) => utentiTenant.has(u) && !(p.visibili as Set<string>).has(u));
          if (!fuori.length) continue;
          const campi = [...new Set([...testo.matchAll(/"([A-Za-z_]+)":/g)].map((m) => m[1]!).filter((k) => SENSIBILI.test(k)))];
          wF([p.sigla, modello, normalizza(c.path), fuori.length, campi.join(" "), campi.length ? "DA GUARDARE: dati sensibili di persone fuori catena" : "solo dati non sensibili (rubrica, organigramma)"]);
        }
      }
      if (p.visibili === "tenant" && db) await accuratezza(db, p, pag, wA);
      if (modello.split("/").length <= 3) await page.screenshot({ path: join(USCITA, "schermate", `${p.sigla}${modello.replace(/[\/\[\]:]/g, "_")}.jpg`), type: "jpeg", quality: 50 }).catch(() => undefined);
      await dorme(PAUSA);
      return e;
    };

    // 1. pagine statiche; 2. cruscotti agli indirizzi veri; 3. dettagli seguendo i collegamenti.
    const statiche = pagine.filter((x) => !x.dinamica && !x.modello.startsWith("/showcase"));
    for (const x of statiche) await visita(x.modello, x.modello);
    for (const r of cruscotti) await visita("/dashboard/[famiglia]", r);
    const elenchi: Record<string, string[]> = {
      "/approvals/[id]": ["/approvals"], "/blueprints/[variantId]": ["/blueprints"], "/content/[id]": ["/content"],
      "/engagement/[surveyId]": ["/engagement"], "/me/handbook/[id]": ["/me/handbook"], "/me/surveys/[surveyId]": ["/me/surveys"],
      "/positions/[positionId]": ["/positions"], "/projects/[id]": ["/projects"], "/recruiting/applications/[id]": ["/recruiting/applications", "/recruiting"],
      "/tenant-blueprints/[id]": ["/tenant-blueprints"], "/tenants/[tenantId]": ["/tenants"], "/users/[userId]": ["/users"],
      "/visualizations/[graphId]": ["/visualizations"], "/tenants/[tenantId]/enterprise-typing": ["/tenants"],
    };
    const trovato = new Map<string, string>();
    for (const [modello, sorgenti] of Object.entries(elenchi)) {
      const re = new RegExp("^" + modello.replace(/\[[^\]]+\]/g, "[^/?#]+") + "$");
      let url: string | null = null;
      for (const s of sorgenti) {
        await page.goto(s, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => undefined);
        await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
        const hrefs: string[] = await page.$$eval("a[href]", (as: any[]) => as.map((a) => a.getAttribute("href"))).catch(() => []);
        url = hrefs.find((h) => h && re.test(h.split(/[?#]/)[0]!)) ?? null;
        if (url) break;
        await dorme(PAUSA);
      }
      if (!url) { wV([p.sigla, modello, "", "nessun collegamento nella pagina elenco", "", "", "", "", "", "", "", "", "", "", ""]); continue; }
      trovato.set(modello, url);
      await visita(modello, url);
    }
    // Sottopagine raggiunte dai dettagli.
    const sotto: Array<[string, string, RegExp]> = [
      ["/positions/[positionId]/kpis", "/positions/[positionId]", /^\/positions\/[^/]+\/kpis$/],
      ["/positions/[positionId]/learning", "/positions/[positionId]", /^\/positions\/[^/]+\/learning$/],
      ["/positions/[positionId]/skills", "/positions/[positionId]", /^\/positions\/[^/]+\/skills$/],
      ["/tenant-blueprints/[id]/versions/[n]/build", "/tenant-blueprints/[id]", /^\/tenant-blueprints\/[^/]+\/versions\/[^/]+\/build$/],
      ["/tenant-blueprints/[id]/versions/[n]/diff", "/tenant-blueprints/[id]", /^\/tenant-blueprints\/[^/]+\/versions\/[^/]+\/diff$/],
    ];
    for (const [modello, padre, re] of sotto) {
      const u = trovato.get(padre);
      if (!u) { wV([p.sigla, modello, "", "pagina madre non raggiunta", "", "", "", "", "", "", "", "", "", "", ""]); continue; }
      await page.goto(u, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => undefined);
      await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
      const hrefs: string[] = await page.$$eval("a[href]", (as: any[]) => as.map((a) => a.getAttribute("href"))).catch(() => []);
      const h = hrefs.find((x) => x && re.test(x.split(/[?#]/)[0]!));
      if (!h) { wV([p.sigla, modello, "", "nessun collegamento nella pagina madre", "", "", "", "", "", "", "", "", "", "", ""]); continue; }
      await visita(modello, h);
    }
    // Confini fra catene sorelle: dossier di un sottoposto (atteso aperto) e della catena sorella (atteso chiuso).
    for (const [caso, uid] of [["sottoposto", p.sottoposto], ["catena sorella", p.sorella]] as const) {
      if (!uid) continue;
      const e = await visita("/users/[userId]", `/users/${uid}`);
      const dossier = correnti.find((c) => /\/api\/v1\/users\/[^/]+/.test(c.path) && !LAYOUT.test(c.path));
      wK([p.sigla, caso, "/users/[userId]", e, dossier?.stato ?? ""]);
    }
    await ctx.close();
  }
  await browser.close();
  await db?.fine();
  log("fine del giro");
}

// Totali delle pagine elenco contro il database, per chi vede tutto il tenant.
const TOTALI: Array<[RegExp, string]> = [
  [/^\/api\/v1\/users(\?|$)/, "sys_users|user_tenant_id"],
  [/^\/api\/v1\/positions(\?|$)/, "sys_positions|position_tenant_id"],
  [/^\/api\/v1\/organization-units(\?|$)/, "sys_organization_units|organization_unit_tenant_id"],
  [/^\/api\/v1\/okrs(\?|$)/, "sys_okrs|okr_tenant_id"],
  [/^\/api\/v1\/content(\?|$)/, "sys_content_documents|document_tenant_id"],
  [/^\/api\/v1\/training-initiatives(\?|$)/, "sys_training_initiatives|training_initiative_tenant_id"],
  [/^\/api\/v1\/performance-reviews(\?|$)/, "sys_performance_reviews|review_tenant_id"],
  [/^\/api\/v1\/goals(\?|$)/, "sys_goals|goal_tenant_id"],
  [/^\/api\/v1\/approvals(\?|$)/, "sys_approval_requests|approval_request_tenant_id"],
  [/^\/api\/v1\/projects(\?|$)/, "sys_projects|project_tenant_id"],
  [/^\/api\/v1\/kpi-definitions(\?|$)/, "sys_kpi_definitions|kpi_definition_tenant_id"],
  [/^\/api\/v1\/time-off\/requests(\?|$)/, "sys_time_off_requests|request_tenant_id"],
];
const giaContati = new Set<string>();
async function accuratezza(db: Db, p: Persona, chiamate: Chiamata[], w: (v: unknown[]) => void) {
  for (const c of chiamate) {
    const voce = TOTALI.find(([re]) => re.test(c.path));
    if (!voce || c.stato !== 200 || /[?&](q|search|status|filter)=/.test(c.path)) continue;
    const chiave = `${p.sigla}|${voce[1]}`;
    if (giaContati.has(chiave)) continue;
    giaContati.add(chiave);
    const totale = (c.corpo as { total?: number } | null)?.total;
    const [tab, col] = voce[1].split("|");
    let n: number | string = "";
    try {
      n = Number((await db.q<{ n: string }>(`select count(*) n from sys.${tab} where ${col} = $1`, [p.tenantId]))[0]!.n);
    } catch (e: any) { n = `query non riuscita: ${String(e.message).slice(0, 60)}`; }
    w([p.sigla, normalizza(c.path), totale ?? "(nessun total)", n, typeof totale === "number" && typeof n === "number" ? (totale === n ? "uguale" : "DIVERSO") : "non confrontabile"]);
  }
}

main().catch((e) => {
  log(`errore: ${e?.stack ?? e}`);
  process.exit(1);
});
