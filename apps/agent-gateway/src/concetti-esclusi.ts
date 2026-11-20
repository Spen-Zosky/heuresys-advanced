/**
 * I concetti che esistono ma che l'agente non legge mai, e come si trovano anche cercandoli in
 * italiano (prova dal vivo del 2026-11-20).
 *
 * Due difetti visti dal vivo con l'utenza di una HRMS_MANAGER:
 *  - «Mostrami il testo delle segnalazioni whistleblowing»: il modello cercava il concetto, non lo
 *    trovava e rispondeva «nel catalogo non c'è», invece del messaggio fisso di rifiuto. Il concetto
 *    esiste ed è vietato (FUORI_DALLE_LETTURE in `docs/kb/tools/build_agent_operations.py`, scritto
 *    in `esclusi` della mappa): la ricerca deve dirlo, e il gateway deve contarlo come lettura negata;
 *  - «retribuzione, IBAN, malattia»: il modello cercava in italiano, la ricerca confrontava solo gli
 *    identificativi in inglese, e concludeva che quei dati «non si possono leggere».
 *
 * Il file della mappa è lo stesso del risolutore; qui se ne legge solo `esclusi`.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

const MAPPA = "docs/kb/atlas/agent-operations.json";

function radice(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const su = dirname(dir);
    if (su === dir) break;
    dir = su;
  }
  return process.cwd();
}

/** I concetti vietati con il loro motivo. Non lancia: senza file, nessun escluso dichiarato. */
export function caricaEsclusi(percorso: string = MAPPA): Record<string, string> {
  try {
    const p = isAbsolute(percorso) ? percorso : resolvePath(radice(), percorso);
    const dati = JSON.parse(readFileSync(p, "utf8")) as { esclusi?: Record<string, string> };
    return dati.esclusi ?? {};
  } catch {
    return {};
  }
}

/**
 * Le parole italiane (e qualche sinonimo inglese) che portano ai concetti. Una radice per riga: il
 * confronto è «la domanda contiene la radice». I concetti sono quelli della mappa; una voce che
 * nomina un concetto assente non trova niente e non fa danno.
 */
export const SINONIMI: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["segnalazion", ["whistleblowing"]],
  ["whistleblow", ["whistleblowing"]],
  ["illecit", ["whistleblowing"]],
  ["password", ["auth"]],
  ["credenzial", ["auth"]],
  ["retribu", ["compensation", "analytics"]],
  ["stipend", ["compensation", "analytics"]],
  ["salar", ["compensation", "analytics"]],
  ["paga", ["compensation"]],
  ["iban", ["users", "me"]],
  ["malatti", ["time-off"]],
  ["certificat", ["time-off"]],
  ["assenz", ["time-off", "analytics"]],
  ["ferie", ["time-off"]],
  ["permess", ["time-off"]],
  ["presenz", ["analytics"]],
  ["straordinar", ["analytics"]],
  ["person", ["users", "user-position-assignments"]],
  ["dipendent", ["users", "user-position-assignments"]],
  ["utent", ["users"]],
  ["anagraf", ["users"]],
  ["responsabil", ["organization-units", "users"]],
  ["unità", ["organization-units"]],
  ["unita", ["organization-units"]],
  ["organigramm", ["organization-units", "organization-unit-history"]],
  ["posizion", ["positions", "user-position-assignments"]],
  ["ruol", ["job-roles"]],
  ["competenz", ["skills", "skill-categories"]],
  ["valutazion", ["performance-reviews", "assessments", "review-cycles"]],
  ["obiettiv", ["goals", "okrs"]],
  ["formazion", ["learning-paths", "learning-modules", "training-initiatives"]],
  ["processi", ["organization-unit-processes", "blueprint-processes"]],
  ["progett", ["projects", "teams"]],
  ["sondagg", ["surveys", "engagement"]],
  ["successi", ["successor-candidates", "succession-pools", "position-succession-relevance"]],
  ["carrier", ["career-paths", "user-career-plans"]],
  ["candidat", ["candidates", "candidate-applications"]],
  ["approvazion", ["approvals"]],
];

/**
 * I concetti che rispondono a una ricerca: per identificativo, per percorso o permesso delle sue
 * operazioni, oppure per una radice italiana di `SINONIMI`. Vuota la domanda, tutti.
 */
export function concettiPer(
  domanda: string,
  candidati: readonly string[],
  testoDi: (id: string) => string = () => "",
): string[] {
  const q = domanda.trim().toLowerCase();
  if (!q) return [...candidati];
  const parole = q.split(/[\s,;:/]+/).filter((p) => p.length >= 5);
  const daSinonimi = new Set<string>();
  for (const [radice, concetti] of SINONIMI) if (q.includes(radice)) for (const c of concetti) daSinonimi.add(c);
  return candidati.filter((id) => {
    const testo = `${id} ${testoDi(id)}`.toLowerCase();
    return daSinonimi.has(id) || testo.includes(q) || parole.some((p) => testo.includes(p));
  });
}
