// Conta le righe di una versione caricata e le confronta con quelle che il JSON del pacchetto dice di avere (O2-02, prova di chiusura).
// Il conto atteso si ricava dal JSON con l'aritmetica piu' semplice possibile, SENZA passare da definizione-pacchetto.mjs: un errore della definizione
// non puo' coprire se stesso. Uso:
//   node conta-righe-v03.mjs <database> <pacchetto.json> <versione_uuid>   conteggio per versione contro il JSON
//   node conta-righe-v03.mjs <database> <pacchetto.json> snap:<file>       salva i conteggi di tabella intera (prima di caricare)
//   node conta-righe-v03.mjs <database> <pacchetto.json> cmp:<file>        dopo lo scarico: ogni tabella torna al conteggio salvato
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const pg = createRequire(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../apps/api/package.json"))("pg");
const [DB, FILE, VER] = process.argv.slice(2);
if (!/_prova\d*$/.test(DB)) throw new Error("rifiuto: " + DB + " non è una copia di prova");
const P = JSON.parse(fs.readFileSync(FILE, "utf8"));
const n = (x) => (Array.isArray(x) ? x.length : 0);
const somma = (xs, f) => (xs ?? []).reduce((t, x) => t + f(x), 0);
const S = P.strategia;
const coppie = new Set();
for (const c of P.capability ?? []) for (const p of c.processiCodici) coppie.add(`${c.codice}|${p}`);
for (const p of P.processi) for (const c of p.capabilityCodici ?? []) coppie.add(`${c}|${p.codice}`);
const posProc = new Set();
for (const x of P.posizioni) { for (const p of x.processiCodici) posProc.add(`${x.codice}|${p}`); for (const o of x.oreProcessi ?? []) posProc.add(`${x.codice}|${o.processoCodice}`); }
const legami = new Set();
for (const x of P.commesse) { for (const c of x.unitaCodici) legami.add(`${x.codice}|UNIT|${c}`); for (const c of x.posizioniCodici) legami.add(`${x.codice}|POSITION|${c}`); for (const a of x.composizione ?? []) legami.add(`${x.codice}|${{ POSIZIONE: "POSITION", RUOLO: "ROLE", AGENTE: "AGENT" }[a.attore.tipo]}|${a.attore.codice}`); for (const c of x.obiettiviCodici ?? []) legami.add(`${x.codice}|GOAL|${c}`); }
const voci = Object.values(P.perimetro?.voci ?? {}).reduce((t, l) => t + l.length, 0);
const ATTESE = {
  strategies: S ? 1 : 0,
  strategy_items: S ? n(S.segmenti) + n(S.lineeOfferta) + n(S.competenzeScarse) + n(S.dipendenze) + n(S.priorita) : 0,
  capabilities: n(P.capability),
  capability_links: coppie.size + somma(P.capability, (c) => n(c.competenzeCodici) + n(c.strumentiDati)),
  job_roles: n(P.ruoli),
  job_role_links: somma(P.ruoli, (r) => n(r.attivita) + n(r.competenze)),
  decisions: n(P.decisioni),
  decision_rights: somma(P.decisioni, (d) => n(d.diritti)),
  legal_entities: n(P.entita),
  agents: n(P.agenti),
  agent_links: somma(P.agenti, (a) => n(a.attivita) + n(a.misure)),
  design_principles: n(P.principi),
  perimeters: voci,
  process_steps: somma(P.processi, (p) => n(p.fasi)),
  position_responsibilities: somma(P.posizioni, (x) => n(x.tipiResponsabilita)),
  position_processes: posProc.size,
  engagement_links: legami.size,
};
const SINGOLARE = { strategies: "strategy", strategy_items: "strategy_item", capabilities: "capability", capability_links: "capability_link", job_roles: "job_role", job_role_links: "job_role_link", decisions: "decision", decision_rights: "decision_right", legal_entities: "legal_entity", agents: "agent", agent_links: "agent_link", design_principles: "design_principle", perimeters: "perimeter", process_steps: "process_step", position_responsibilities: "position_responsibility", position_processes: "position_process", engagement_links: "engagement_link" };
const cli = new pg.Client({ host: process.env.PGHOST ?? "localhost", port: Number(process.env.PGPORT ?? 5432), user: process.env.PGUSER ?? "postgres", database: DB, application_name: "conta_righe_v03" });
await cli.connect();
let rossi = 0;
const intera = async (t) => Number((await cli.query(`SELECT count(*) n FROM sys.sys_blueprint_content_${t}`)).rows[0].n);
if (VER.startsWith("snap:")) {
  const snap = {}; for (const t of Object.keys(ATTESE)) snap[t] = await intera(t);
  fs.writeFileSync(VER.slice(5), JSON.stringify(snap)); await cli.end(); console.log("  snapshot salvato"); process.exit(0);
}
const riga = (nome, atteso, letto) => { const ok = atteso === letto; if (!ok) rossi++; console.log(`  ${ok ? "OK  " : "ROSSO"} ${nome.padEnd(28)} atteso ${String(atteso).padStart(5)}  letto ${String(letto).padStart(5)}`); };
const snap = VER.startsWith("cmp:") ? JSON.parse(fs.readFileSync(VER.slice(4), "utf8")) : null;
for (const [t, atteso] of Object.entries(ATTESE)) {
  const s = SINGOLARE[t];
  if (snap) { riga(t, snap[t], await intera(t)); continue; }
  riga(t, atteso, Number((await cli.query(`SELECT count(*) n FROM sys.sys_blueprint_content_${t} WHERE blueprint_content_${s}_version_id = $1`, [VER])).rows[0].n));
}
if (!snap) {
  const st = (await cli.query("SELECT blueprint_content_package_perimeter_status s FROM sys.sys_blueprint_content_packages WHERE blueprint_content_package_version_id = $1", [VER])).rows[0]?.s;
  const atteso = voci > 0 ? "DICHIARATO" : "NON_RILASCIATO";
  riga("perimeter_status", atteso, st);
}
await cli.end();
console.log(rossi ? `  -> ${rossi} conteggi diversi` : "  -> conteggi tutti uguali");
process.exitCode = rossi ? 1 : 0;
