/**
 * Il risolutore delle operazioni, COSTRUITO DALL'ATLANTE (#156, ADR-0033 §5.2).
 *
 * Fino a qui `OperationResolver` era **solo un'interfaccia**: `write-gate.ts` la dichiarava
 * e nessuno la implementava, quindi ogni chiamata parametrica usciva `unresolved` — cioè
 * negata. Era il default sicuro, non una svista; ma finché resta così, `hrx_entity_query`
 * non può essere collegato a nulla.
 *
 * DA DOVE VIENE LA MAPPA, e perché non è scritta qui dentro. Il file
 * `docs/kb/atlas/agent-operations.json` è **generato** da
 * `docs/kb/tools/build_agent_operations.py` a partire da due fonti: l'atlante — che si
 * rigenera dal codice e dal database vivo — e `docs/kb/agent-perimetri.json`, dove una
 * decisione dichiara quali concetti sono aperti. Conseguenza voluta: quando nasce un
 * endpoint, l'agente lo vede senza che nessuno ricopi nulla; e quando un perimetro viene
 * aperto, non si tocca questo file.
 *
 * TRE PROPRIETÀ FAIL-CLOSED, e nessuna è un dettaglio implementativo:
 *
 *  1. **L'ignoto non è una lettura.** Concetto sconosciuto, operazione sconosciuta, file
 *     assente o illeggibile → `undefined`. Il gate lo traduce in `unresolved` → negato.
 *     Non sapere cosa fa una chiamata è una ragione per fermarla, mai per lasciarla passare.
 *  2. **Il metodo non si prende dall'input.** Lo dice la mappa. Se l'agente potesse
 *     dichiarare `method: GET` mentre chiede una DELETE, la guardia sarebbe una formalità.
 *  3. **Il perimetro in sola lettura non contiene affatto le scritture.** Non sono filtrate
 *     a valle: il generatore non le emette. Una POST su `organization-units` non è
 *     «bloccata», è **inesistente** — e ciò che non esiste non può essere aggirato.
 *
 * ⚠ Il file si carica UNA volta e si tiene in memoria. Un processo lungo che vedesse la
 * mappa cambiare sotto i piedi risolverebbe due chiamate identiche in modo diverso, e la
 * decisione del gate diventerebbe dipendente dall'istante. Per ricaricare si riavvia, che
 * è anche il momento in cui il codice nuovo arriva.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import type { OperationResolver } from "./write-gate.js";

/**
 * La radice del repo, RISALITA dalla posizione di questo modulo — non dalla cwd.
 *
 * Non è pedanteria: il gateway parte dalla radice, i test partono da `apps/agent-gateway`,
 * e un percorso relativo alla cwd si legge in un caso e non nell'altro. Il resolver
 * risponderebbe correttamente in produzione e vuoto nei test (o viceversa), che è il modo
 * peggiore di sbagliare — perché la batteria resta verde mentre misura un oggetto diverso.
 * Trovato eseguendo il test, non ragionandoci.
 */
function repoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const su = dirname(dir);
    if (su === dir) break;
    dir = su;
  }
  return process.cwd();  // ripiego dichiarato: meglio la cwd che un percorso inventato
}

export interface AtlasOperation {
  method: string;
  path: string;
  permission: string | null;
}

interface ConceptEntry {
  solaLettura: boolean;
  data: string;
  decisione: string;
  operations: Record<string, AtlasOperation>;
}

interface OperationsFile {
  concepts: Record<string, ConceptEntry>;
}

/** Il percorso di default, relativo alla radice del repo. */
export const DEFAULT_OPERATIONS_PATH = "docs/kb/atlas/agent-operations.json";

export class AtlasOperationResolver implements OperationResolver {
  private readonly concepts: Record<string, ConceptEntry>;

  private constructor(concepts: Record<string, ConceptEntry>) {
    this.concepts = concepts;
  }

  /**
   * Carica la mappa. **Non lancia**: un file assente produce un resolver VUOTO, che nega
   * tutto — un'eccezione al boot spegnerebbe il gateway per un file di dati, e un gateway
   * spento non è più sicuro di uno che nega. Il chiamante può distinguere i due casi con
   * `isEmpty()`, e deve dirlo nei log invece di tacerlo.
   */
  static load(path: string = DEFAULT_OPERATIONS_PATH): AtlasOperationResolver {
    try {
      const p = isAbsolute(path) ? path : resolvePath(repoRoot(), path);
      const raw = readFileSync(p, "utf8");
      const parsed = JSON.parse(raw) as OperationsFile;
      return new AtlasOperationResolver(parsed.concepts ?? {});
    } catch {
      return new AtlasOperationResolver({});
    }
  }

  /** Per i test e per chi vuole costruirla in memoria senza toccare il disco. */
  static fromConcepts(concepts: Record<string, ConceptEntry>): AtlasOperationResolver {
    return new AtlasOperationResolver(concepts);
  }

  /** Vero se la mappa è vuota: nessun perimetro aperto, oppure il file non si è letto. */
  isEmpty(): boolean {
    return Object.keys(this.concepts).length === 0;
  }

  /** I concetti aperti, in ordine. Serve a dichiarare nei log cosa è stato caricato. */
  conceptIds(): string[] {
    return Object.keys(this.concepts).sort();
  }

  /** L'elenco CHIUSO delle operazioni di un concetto (ADR-0033 §2: `describe`). */
  operationsOf(conceptId: string): Record<string, AtlasOperation> {
    return this.concepts[conceptId]?.operations ?? {};
  }

  /** Il metodo, o `undefined` se la coppia non esiste. L'ignoto non è una lettura. */
  methodOf(conceptId: string, operationId: string): string | undefined {
    return this.concepts[conceptId]?.operations[operationId]?.method;
  }
}
