/**
 * Il campione per la correzione a mano: 30 domande a caso con seme fisso, con la risposta attesa,
 * quella data e il giudizio del confronto.
 *
 *   pnpm exec tsx scripts/batteria-campione.ts --registro <file.jsonl> --esci <file.md> [--domande <file>] [--seme 20261126] [--quante 30]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { confronta } from "../test/batteria/confronto.js";
import { PROFILI } from "../test/batteria/profili.js";
import type { Atteso, Batteria } from "../test/batteria/tipi.js";
import { BATTERIA } from "./batteria-db.js";
import type { Riga } from "./batteria-esito.js";

const opzione = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const registro = opzione("registro");
const uscita = opzione("esci");
if (!registro || !uscita) throw new Error("servono --registro e --esci");
const seme = Number(opzione("seme") ?? 20261126);
const quante = Number(opzione("quante") ?? 30);

/** mulberry32: lo stesso seme dà lo stesso campione. */
let a = seme >>> 0;
const caso = () => {
  a = (a + 0x6d2b79f5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const b = JSON.parse(readFileSync(opzione("domande") ?? BATTERIA, "utf8")) as Batteria;
const ultime = new Map<string, Riga>();
for (const l of readFileSync(registro, "utf8").split("\n").filter(Boolean)) {
  const r = JSON.parse(l) as Riga;
  ultime.set(r.id, r);
}
const mazzo = b.domande.filter((d) => ultime.has(d.id));
for (let i = mazzo.length - 1; i > 0; i--) {
  const j = Math.floor(caso() * (i + 1));
  [mazzo[i], mazzo[j]] = [mazzo[j]!, mazzo[i]!];
}

function inParole(x: Atteso): string {
  const nomi = (x.voci ?? []).map((v) => v.nome).join("; ");
  switch (x.confronto) {
    case "numero": return String(x.numero);
    case "veroFalso": return x.vero ? "Sì" : "No";
    case "etichetta": return x.etichetta!.nome;
    case "coppie": return x.coppie!.map((c) => `${c.voce.nome}: ${c.etichetta.nome}`).join("; ");
    case "ordine": return `in ordine: ${nomi}`;
    case "rifiuto": return "«Non hai le autorizzazioni necessarie…» oppure {omissis}, senza alcun dato";
    case "fuoriPerimetro": return "dire che il dato non è visibile (fuori dal perimetro), senza alcun dato";
    default: return nomi;
  }
}
const cella = (s: string) => s.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r?\n+/g, " <br> ");

const scelte = mazzo.slice(0, quante);
const righe = scelte.map((d, i) => {
  const r = ultime.get(d.id)!;
  const e = r.guasto ? { giusta: false, motivo: r.motivo } : confronta(d.atteso, r.risposta);
  return `| ${i + 1} | ${d.id} | ${cella(PROFILI[d.profilo]!.chi)} | ${cella(d.testo)} | ${cella(inParole(d.atteso))} | ${cella(r.risposta.slice(0, 1500))} | ${e.giusta ? "giusta" : `sbagliata (${cella(e.motivo)})`} |`;
});
const testo = [
  `# Campione di ${scelte.length} domande, batteria della qualità (seme ${seme})`,
  "",
  `Risposte attese misurate il ${b.generataIl} su ${b.database}. Risposte dell'assistente della corsa registrata in ${registro.split("/").pop()}.`,
  "",
  "| n. | id | chi chiede | domanda | attesa | risposta data | secondo il confronto |",
  "|---|---|---|---|---|---|---|",
  ...righe,
  "",
].join("\r\n");
writeFileSync(uscita, testo);
console.log(`campione di ${scelte.length} scritto in ${uscita}`);
