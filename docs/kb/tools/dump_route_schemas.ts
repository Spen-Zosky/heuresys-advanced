/**
 * dump_route_schemas.ts — estrae la FORMA dei parametri dagli schemi Zod condivisi.
 *
 * Perche' esiste (ADR-0033 §5.1)
 * ------------------------------
 * L'atlante conosceva metodo, path e permesso di ogni route, ma non i suoi
 * PARAMETRI: sapeva dire «`GET /v1/positions` esiste», non «accetta
 * `?organizationUnitId=&search=&limit=`». Per un agente che deve comporre la
 * chiamata, la differenza e' fra sapere e indovinare — e indovinare su una
 * scrittura e' inaccettabile.
 *
 * Perche' a RUNTIME e non con una regex
 * -------------------------------------
 * Gli schemi compongono: `.optional()`, `.extend()`, riferimenti ad altri
 * schemi, `z.coerce`. Una regex li leggerebbe male proprio nei casi che
 * contano, e sarebbe il quarto limite-da-regex di uno strumento che gia' ne
 * dichiara tre. Qui si importa `@heuresys/shared` e si interroga Zod, che della
 * forma e' l'autorita': quello che esce e' cio' che il server accettera'
 * davvero, non cio' che il sorgente sembra dire.
 *
 * Uso (emette JSON su stdout):
 *   cd apps/api && pnpm exec tsx ../../docs/kb/tools/dump_route_schemas.ts
 * Invocato da build_atlas.py, che unisce l'esito alle route.
 */
import * as Shared from "@heuresys/shared";

interface Campo {
  name: string;
  type: string;
  optional: boolean;
  format?: string;
  values?: string[];
}

/** Srotola i wrapper (optional, nullable, default, coerce…) fino al tipo vero. */
function scava(node: any): { tipo: any; opzionale: boolean } {
  let n = node;
  let opzionale = false;
  // Il limite di 10 giri non e' prudenza generica: impedisce che uno schema
  // ricorsivo faccia girare all'infinito il generatore dell'atlante.
  for (let i = 0; i < 10 && n?.def; i++) {
    const t = n.def.type;
    if (t === "optional" || t === "nullable" || t === "default" || t === "prefault") {
      if (t === "optional" || t === "nullable") opzionale = true;
      n = n.def.innerType;
      continue;
    }
    break;
  }
  return { tipo: n, opzionale };
}

function campiDi(schema: any): Campo[] {
  const shape = schema?.shape;
  if (!shape) return [];
  return Object.entries<any>(shape).map(([name, raw]) => {
    const { tipo, opzionale } = scava(raw);
    const d = tipo?.def ?? {};
    const campo: Campo = { name, type: d.type ?? "unknown", optional: opzionale };
    if (d.format) campo.format = d.format;
    // Gli enum si portano dietro i valori ammessi: e' l'informazione che evita
    // all'agente di inventare uno stato che il server rifiuterebbe.
    if (d.type === "enum" && d.entries) campo.values = Object.keys(d.entries);
    if (d.type === "array") campo.type = "array";
    return campo;
  });
}

const out: Record<string, Campo[]> = {};
let esaminati = 0;
for (const [nome, valore] of Object.entries<any>(Shared)) {
  if (!nome.endsWith("Schema")) continue;
  if (!valore || typeof valore !== "object" || typeof valore.safeParse !== "function") continue;
  esaminati++;
  // Anche gli schemi SENZA campi entrano, purche' abbiano una `shape`: uno
  // schema vuoto (`z.strictObject({})`, come EnrollMfaBodySchema) dice «non
  // mandare nulla», che e' l'opposto di «non so cosa mandare». Scartarli
  // avrebbe fatto passare per irrisolti due schemi perfettamente noti.
  if (valore.shape) out[nome] = campiDi(valore);
}

process.stderr.write(`[dump_route_schemas] schemi esaminati: ${esaminati} · con forma estratta: ${Object.keys(out).length}\n`);
process.stdout.write(JSON.stringify(out));
