/**
 * apps/api/scripts/genera-corpi-scritture-agente.mts — ADR-0061 passo 10, difetto del 2026-11-22.
 *
 * IL DIFETTO. L'assistente scriveva il corpo di una scrittura indovinandone la forma
 * (`{ code }` invece di `{ codes, criterion }`): la PUT approvata dalla persona tornava 400. La
 * prima correzione (#412) leggeva lo schema da `GET /openapi.json`, che in produzione non esiste
 * di proposito (`API_DOCS_ENABLED=false`, env.ts): la mappa tornava vuota senza errori.
 *
 * LA CORREZIONE. La forma del corpo si ricava qui, in fase di generazione, dai contratti Zod
 * condivisi: per ogni scrittura aperta all'agente in `docs/kb/atlas/agent-operations.json` si
 * legge nel `routes.ts` del modulo quale schema la rotta dichiara come `body`, e lo si traduce in
 * JSON Schema. Il risultato, `docs/kb/atlas/agent-write-bodies.json`, viaggia con il repository
 * come il catalogo delle operazioni; il gateway lo legge accanto a quello.
 *
 * FAIL-LOUD. Una scrittura del catalogo senza corpo dichiarato, con un corpo scritto sul posto
 * (non nel contratto condiviso) o con uno schema che il contratto non esporta ferma il generatore
 * con exit 1: un corpo che manca è il difetto di partenza, e un file vuoto non deve sembrare verde.
 *
 * USO (dalla radice del repository):
 *   pnpm --filter @heuresys/api exec tsx --conditions heuresys-source scripts/genera-corpi-scritture-agente.mts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import * as contratti from "@heuresys/shared";

const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const CATALOGO = join(RADICE, "docs/kb/atlas/agent-operations.json");
const USCITA = join(RADICE, "docs/kb/atlas/agent-write-bodies.json");

interface Operazione { method: string; path: string; permission: string }
interface Catalogo { concepts: Record<string, { base: string; modulo?: string; operations: Record<string, Operazione> }> }

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Il nome dello schema del corpo dichiarato dalla rotta `metodo percorso` nel routes.ts del modulo,
 * oppure `null` se la rotta non dichiara affatto un corpo (F1, 2026-11-26: le rotte d'azione come
 * `POST /:id/publish` non ne hanno). Un `body:` scritto sul posto resta un errore.
 */
function schemaDelCorpo(modulo: string, metodo: string, percorso: string): string | null {
  const file = join(RADICE, "apps/api/src/modules", modulo, "routes.ts");
  const testo = readFileSync(file, "utf8");
  const inizio = new RegExp(`app\\.${metodo.toLowerCase()}\\(\\s*["']${escapeRe(percorso)}["']`).exec(testo);
  if (!inizio) throw new Error(`${modulo}: nessuna rotta ${metodo} ${percorso} in ${file}`);
  const dopo = testo.slice(inizio.index + inizio[0].length);
  const fine = dopo.search(/\n\s*app\.(get|post|put|patch|delete)\(/);
  const blocco = fine === -1 ? dopo : dopo.slice(0, fine);
  const opzioni = blocco.slice(0, Math.max(0, blocco.search(/\basync\b/)) || blocco.length);
  if (!/\bbody:/.test(opzioni)) return null;
  const m = /\bbody:\s*([A-Za-z_][A-Za-z0-9_]*)\b/.exec(blocco);
  if (!m?.[1]) throw new Error(`${modulo}: la rotta ${metodo} ${percorso} non dichiara un corpo dal contratto condiviso`);
  return m[1];
}

const catalogo = JSON.parse(readFileSync(CATALOGO, "utf8")) as Catalogo;
const corpi: Record<string, Record<string, { schema: string; body: unknown }>> = {};
const errori: string[] = [];
for (const [concetto, voce] of Object.entries(catalogo.concepts)) {
  for (const [id, op] of Object.entries(voce.operations)) {
    if (op.method.toUpperCase() === "GET" || op.method.toUpperCase() === "DELETE") continue;
    try {
      // Un concetto aperto da un modulo con più prefissi (F1, consolidamento) porta `modulo`.
      const nome = schemaDelCorpo(voce.modulo ?? concetto, op.method, op.path);
      if (nome === null) {
        (corpi[concetto] ??= {})[id] = { schema: "(nessun corpo)", body: { type: "object", properties: {}, additionalProperties: false } };
        continue;
      }
      const schema = (contratti as Record<string, unknown>)[nome];
      if (!(schema instanceof z.ZodType)) throw new Error(`${concetto}.${id}: @heuresys/shared non esporta lo schema ${nome}`);
      (corpi[concetto] ??= {})[id] = { schema: nome, body: z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) };
    } catch (e) {
      errori.push((e as Error).message);
    }
  }
}
if (errori.length > 0) {
  console.error(`agent-write-bodies: ${errori.length} scritture senza corpo dichiarato:\n  ${errori.join("\n  ")}`);
  process.exit(1);
}
const conteggio = Object.values(corpi).reduce((n, ops) => n + Object.keys(ops).length, 0);
if (conteggio === 0) {
  console.error("agent-write-bodies: nessuna scrittura nel catalogo; un file vuoto qui sarebbe un falso verde");
  process.exit(1);
}
const ordinato = Object.fromEntries(
  Object.keys(corpi).sort().map((c) => [c, Object.fromEntries(Object.keys(corpi[c]!).sort().map((o) => [o, corpi[c]![o]]))]),
);
writeFileSync(
  USCITA,
  JSON.stringify(
    {
      _cosa: "Lo schema del corpo di ogni scrittura aperta all'agente, dai contratti Zod condivisi. Lo legge il gateway accanto a agent-operations.json.",
      _generato_da: "apps/api/scripts/genera-corpi-scritture-agente.mts",
      corpi: ordinato,
    },
    null,
    1,
  ) + "\n",
);
console.log(`agent-write-bodies: ${conteggio} scritture -> ${USCITA}`);
