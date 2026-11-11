#!/usr/bin/env node
/* global process, console, URL, document */
/**
 * apps/web/tests/giro/giro.mjs — il giro di tutte le pagine con tutti i ruoli
 * (docs/piani/PIANO_interfaccia-sistematica_20261111.md, §3).
 *
 * Uso (sul banco di verifica, mai sulla produzione):
 *   GIRO_BASE=http://127.0.0.1:<porta-web> GIRO_PERSONE=<persone.json> GIRO_OUT=<cartella> \
 *     node apps/web/tests/giro/giro.mjs [--solo /rotta,/altra] [--persone chiave1,chiave2]
 *
 * `persone.json` è un elenco di { chiave, email, ruoli, cookie } dove `cookie` è il valore del
 * cookie di accesso firmato con la chiave del banco (`scripts/banco-verifica.sh persone`).
 * Con `GIRO_GETTONE` (vettore JSON di argomenti con `{email}`, lo passa `banco-verifica.sh giro`) il cookie si
 * rifirma prima di ogni persona: la conferma del secondo fattore vale 15 minuti, e un cookie
 * firmato all'inizio del giro (o il giorno prima) farebbe rispondere 403 a ogni dato riservato
 * delle persone visitate dopo, accusando la pagina di un difetto che non ha.
 *
 * Per ogni persona e per ogni rotta di prodotto (dalle cartelle di `src/app/(authenticated)`):
 * apre la pagina, aspetta che le richieste si fermino, salva la schermata intera, misura le classi
 * con `misure.cjs`, registra le richieste `/v1/*` fallite e gli errori di console (C14), e prova la
 * barra laterale (C6: posizione di scorrimento dopo un clic su una voce in basso).
 * Le rotte con un parametro si risolvono seguendo il primo collegamento della pagina madre.
 *
 * Esito in GIRO_OUT: `giro-esito.json`, `rapporto.md` (per classe e per pagina), `provini.html`
 * (tutte le schermate) e le schermate in `schermate/<persona>/`.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const { misuraPagina } = require("./misure.cjs");

const QUI = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(QUI, "..", "..", "src", "app", "(authenticated)");
const BASE = process.env.GIRO_BASE;
const PERSONE = process.env.GIRO_PERSONE;
const OUT = path.resolve(process.env.GIRO_OUT ?? "giro-esito");
if (!BASE || !PERSONE) {
  console.error("servono GIRO_BASE e GIRO_PERSONE");
  process.exit(2);
}
const arg = (n) => {
  const i = process.argv.indexOf(n);
  return i > 0 ? process.argv[i + 1]?.split(",").filter(Boolean) : undefined;
};
const SOLO = arg("--solo");
const SOLO_PERSONE = arg("--persone");

function rotte() {
  const out = [];
  const visita = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) visita(path.join(dir, e.name), rel + (/^\(.*\)$/.test(e.name) ? "" : `/${e.name}`));
      else if (e.name === "page.tsx") out.push(rel === "" ? "/" : rel);
    }
  };
  visita(APP_DIR, "");
  return out.sort();
}

async function risolvi(page, rotta) {
  if (!rotta.includes("[")) return rotta;
  const madre = rotta.slice(0, rotta.indexOf("/["));
  await page.goto(BASE + madre, { waitUntil: "networkidle", timeout: 45_000 }).catch(() => {});
  const re = new RegExp("^" + rotta.replace(/\[[^\]]+\]/g, "[^/?#]+") + "/?$");
  const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
  return hrefs.find((h) => h && re.test(h.split("?")[0])) ?? null;
}

/** GIRO_GETTONE è un vettore JSON di argomenti: nessuna shell, l'email resta un argomento. */
function gettone(email) {
  const argv = JSON.parse(process.env.GIRO_GETTONE ?? "[]").map((a) => String(a).replace("{email}", email));
  const [cmd, ...args] = argv;
  if (!cmd) throw new Error("GIRO_GETTONE vuoto");
  return execFileSync(cmd, args, { encoding: "utf8" }).trim();
}

const persone = JSON.parse(fs.readFileSync(PERSONE, "utf8")).filter((p) => !SOLO_PERSONE || SOLO_PERSONE.includes(p.chiave));
const tutte = rotte().filter((r) => !SOLO || SOLO.includes(r));
fs.mkdirSync(OUT, { recursive: true });
const host = new URL(BASE).hostname;
const browser = await chromium.launch(process.env.GIRO_CHROMIUM ? { executablePath: process.env.GIRO_CHROMIUM } : {});
const esiti = [];

for (const p of persone) {
  const dir = path.join(OUT, "schermate", p.chiave);
  fs.mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "it-IT" });
  const cookie = process.env.GIRO_GETTONE
    ? gettone(p.email)
    : p.cookie;
  await ctx.addCookies([{ name: "hrx_access", value: cookie, domain: host, path: "/", httpOnly: true, sameSite: "Lax" }]);
  const page = await ctx.newPage();
  let console_ = [];
  let rete = [];
  page.on("console", (m) => { if (m.type() === "error") console_.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => console_.push(String(e).slice(0, 200)));
  page.on("response", (r) => {
    const u = r.url();
    if (u.includes("/v1/") && r.status() >= 400) rete.push(`${r.status()} ${new URL(u).pathname}`);
  });

  for (const rotta of tutte) {
    console_ = [];
    rete = [];
    const e = { persona: p.chiave, ruoli: p.ruoli, rotta };
    try {
      const url = await risolvi(page, rotta);
      if (!url) { e.stato = "non-risolta"; esiti.push(e); continue; }
      e.aperta = url;
      console_ = []; rete = [];
      await page.goto(BASE + url, { waitUntil: "networkidle", timeout: 60_000 });
      await page.waitForTimeout(600);
      if (page.url().includes("/login")) { e.stato = "sessione-persa"; esiti.push(e); continue; }
      if (await page.getByTestId("page-no-access").isVisible().catch(() => false)) { e.stato = "negata"; esiti.push(e); continue; }
      e.stato = "ok";
      /* C14-caricamento: una pagina che resta su "Caricamento…" oltre 15 secondi e' rossa */
      // Lo stato di attesa, non la parola: «ultimo caricamento 3 minuti fa» e' un dato, non un'attesa.
      const IN_ATTESA = () => {
        const radice = document.querySelector("main") ?? document.body;
        if (radice.querySelector("[aria-busy=true]")) return true;
        return /(^|\n)\s*Caricamento\s*(…|\.\.\.)?\s*(\n|$)/i.test(radice.innerText);
      };
      const ancoraCaricamento = () => page.evaluate(IN_ATTESA);
      let bloccata = false;
      if (await ancoraCaricamento()) {
        const FINITO = () => {
          const radice = document.querySelector("main") ?? document.body;
          if (radice.querySelector("[aria-busy=true]")) return false;
          return !/(^|\n)\s*Caricamento\s*(…|\.\.\.)?\s*(\n|$)/i.test(radice.innerText);
        };
        bloccata = await page.waitForFunction(FINITO, null, { timeout: 15_000 }).then(() => false, () => true);
      }
      e.misura = await page.evaluate(misuraPagina);
      if (bloccata) (e.misura.esito ??= {})["C14-caricamento"] = { n: 1, esempi: ["resta su 'Caricamento…' oltre 15 secondi"] };
      const file = `${rotta.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "radice"}.png`;
      await page.screenshot({ path: path.join(dir, file), fullPage: true });
      e.schermata = path.join("schermate", p.chiave, file);
    } catch (err) {
      e.stato = "errore-navigazione";
      e.nota = String(err).slice(0, 200);
    }
    if (rete.length) (e.misura ??= { esito: {} }).esito["C14-rete"] = { n: rete.length, esempi: [...new Set(rete)].slice(0, 8) };
    if (console_.length) (e.misura ??= { esito: {} }).esito["C14-console"] = { n: console_.length, esempi: [...new Set(console_)].slice(0, 5) };
    esiti.push(e);
    process.stdout.write(`${p.chiave} ${rotta} ${e.stato}\n`);
  }

  /* C6: la barra laterale conserva la posizione dopo un clic su una voce in basso? */
  try {
    await page.goto(BASE + "/me", { waitUntil: "networkidle" });
    const nav = page.locator("aside nav").first();
    await nav.evaluate((n) => { n.scrollTop = n.scrollHeight; });
    const prima = await nav.evaluate((n) => n.scrollTop);
    const ultima = nav.locator("a[href]").last();
    await ultima.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(800);
    const dopo = await page.locator("aside nav").first().evaluate((n) => n.scrollTop);
    esiti.push({ persona: p.chiave, rotta: "(barra laterale)", stato: "ok", misura: { esito: dopo + 20 < prima ? { "C6-scorrimento-perso": { n: 1, esempi: [`prima ${prima}px, dopo ${dopo}px`] } } : {} } });
  } catch (err) {
    esiti.push({ persona: p.chiave, rotta: "(barra laterale)", stato: "errore-navigazione", nota: String(err).slice(0, 200) });
  }
  await ctx.close();
}
await browser.close();

/* Rapporto */
fs.writeFileSync(path.join(OUT, "giro-esito.json"), JSON.stringify(esiti, null, 2));
const perClasse = new Map();
for (const e of esiti) for (const [c, v] of Object.entries(e.misura?.esito ?? {})) {
  const x = perClasse.get(c) ?? { pagine: new Set(), n: 0, esempi: [] };
  x.pagine.add(e.rotta); x.n += v.n;
  for (const s of v.esempi) if (x.esempi.length < 12 && !x.esempi.includes(`${e.rotta}: ${s}`)) x.esempi.push(`${e.rotta}: ${s}`);
  perClasse.set(c, x);
}
const stati = esiti.reduce((a, e) => ((a[e.stato] = (a[e.stato] ?? 0) + 1), a), {});
let md = `# Giro delle interfacce\n\nBase ${BASE}, ${persone.length} persone, ${tutte.length} rotte, ${new Date().toISOString()}.\n\nStati: ${Object.entries(stati).map(([k, v]) => `${k} ${v}`).join(", ")}.\n\n## Per classe\n\n| classe | pagine | occorrenze | esempi |\n|---|---|---|---|\n`;
for (const [c, x] of [...perClasse.entries()].sort()) md += `| ${c} | ${x.pagine.size} | ${x.n} | ${x.esempi.slice(0, 4).join(" · ").replace(/\|/g, "/")} |\n`;
md += `\n## Per pagina (prima persona che la vede)\n\n| rotta | persona | classi |\n|---|---|---|\n`;
const viste = new Set();
for (const e of esiti) {
  if (e.stato !== "ok" || viste.has(e.rotta)) continue;
  viste.add(e.rotta);
  md += `| ${e.rotta} | ${e.persona} | ${Object.entries(e.misura?.esito ?? {}).map(([c, v]) => `${c} ${v.n}`).join(", ") || "pulita"} |\n`;
}
fs.writeFileSync(path.join(OUT, "rapporto.md"), md);
let html = `<!doctype html><meta charset="utf-8"><title>Provini del giro</title><style>body{font:13px system-ui;background:#111;color:#ddd}figure{display:inline-block;margin:6px;width:360px;vertical-align:top}img{width:360px;border:1px solid #333}</style>`;
for (const e of esiti) if (e.schermata) html += `<figure><a href="${e.schermata}"><img loading="lazy" src="${e.schermata}"></a><figcaption>${e.persona} · ${e.rotta}<br>${Object.keys(e.misura?.esito ?? {}).join(" ")}</figcaption></figure>`;
fs.writeFileSync(path.join(OUT, "provini.html"), html);
console.log(`fatto: ${esiti.length} esiti in ${OUT}`);
