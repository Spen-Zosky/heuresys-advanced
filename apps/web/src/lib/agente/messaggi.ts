/**
 * apps/web/src/lib/agente/messaggi.ts — dalla corsa dell'assistente ai messaggi che la persona legge
 * (richiesta di Enzo del 2026-11-18: la finestra come Claude Desktop, senza dati tecnici).
 *
 * Funzioni pure, perché sono la parte che può sbagliare in silenzio: quali righe dello stream
 * diventano un messaggio, come si fondono i pezzi di una risposta, e come il rifiuto deciso dal
 * gateway prende il posto del testo del modello. Gli strumenti usati, i comandi della pagina e gli
 * identificativi non diventano mai un messaggio.
 */
import type { StreamLine } from "@/lib/use-agent-stream";

export interface Messaggio {
  id: number;
  ruolo: "persona" | "assistente" | "avviso";
  testo: string;
  /** Vero quando è il messaggio fisso di una domanda tutta su dati vietati (deciso dal gateway). */
  rifiuto?: boolean;
}

/**
 * Le righe dello stream, nell'ordine, diventano messaggi: la domanda della persona, la risposta
 * dell'assistente (i pezzi consecutivi in un messaggio solo) e gli avvisi. Un `rifiuto` sostituisce
 * la risposta della domanda a cui si riferisce.
 *
 * La risposta è solo il testo scritto DOPO l'ultima consultazione dei dati. Ciò che il modello
 * scrive prima di uno strumento o di un comando di pagina («Leggo le assegnazioni…», «Guardo i
 * filtri di analytics get_kpi») è un messaggio di lavorazione: non resta nel testo finale
 * (prova dal vivo del 27/11, F6c: 4 risposte su 4 con messaggi di lavorazione, 1 su 4 con un nome
 * tecnico). Lo stato di lavoro lo racconta `fase()`, non il testo.
 */
export function messaggiDaRighe(righe: readonly StreamLine[]): Messaggio[] {
  const out: Messaggio[] = [];
  let inizioRisposta = 0;
  for (const r of righe) {
    if (r.kind === "prompt") {
      out.push({ id: r.id, ruolo: "persona", testo: r.text });
      inizioRisposta = out.length;
    } else if (r.kind === "message") {
      if (!r.text.trim()) continue;
      const ultimo = out[out.length - 1];
      if (ultimo && ultimo.ruolo === "assistente" && !ultimo.rifiuto) ultimo.testo = `${ultimo.testo}\n\n${r.text}`;
      else out.push({ id: r.id, ruolo: "assistente", testo: r.text });
    } else if (r.kind === "tool" || r.kind === "page_command") {
      for (let i = out.length - 1; i >= inizioRisposta; i -= 1) {
        const m = out[i];
        if (m && m.ruolo === "assistente" && !m.rifiuto) out.splice(i, 1);
      }
    } else if (r.kind === "rifiuto") {
      out.splice(inizioRisposta);
      out.push({ id: r.id, ruolo: "assistente", testo: r.text, rifiuto: true });
    } else if (r.kind === "error") {
      out.push({ id: r.id, ruolo: "avviso", testo: "errore" });
    } else if (r.kind === "limit") {
      out.push({ id: r.id, ruolo: "avviso", testo: "limite" });
    }
  }
  return out;
}

/** Che cosa sta facendo l'assistente, in parole: consulta i dati o scrive la risposta. */
export function fase(righe: readonly StreamLine[]): "consulta" | "scrive" | "pensa" {
  for (let i = righe.length - 1; i >= 0; i -= 1) {
    const k = righe[i]?.kind;
    if (k === "prompt") return "pensa";
    if (k === "tool" || k === "page_command") return "consulta";
    if (k === "message") return "scrive";
  }
  return "pensa";
}

/**
 * Una tabella in CSV con il separatore «;» (quello che Excel in italiano apre senza chiedere) e le
 * virgolette solo dove servono.
 */
export function csvDa(righe: readonly (readonly string[])[]): string {
  const cella = (grezzo: string) => {
    const v = disinnesca(grezzo);
    return /[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  return righe.map((r) => r.map(cella).join(";")).join("\r\n");
}

/** Una tabella in testo separato da tabulazioni, per incollarla in un foglio di calcolo. */
export function tsvDa(righe: readonly (readonly string[])[]): string {
  return righe.map((r) => r.map((v) => disinnesca(v).replace(/[\t\n\r]+/g, " ")).join("\t")).join("\n");
}

/**
 * Una cella che il foglio di calcolo leggerebbe come formula (=, +, -, @, tabulazione, a capo in
 * testa) prende un apostrofo davanti: il testo resta quello, ma non si esegue. I numeri restano numeri.
 */
export function disinnesca(v: string): string {
  if (/^[-+]?\d[\d.,]*%?$/.test(v.trim())) return v;
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

/**
 * Che cosa farebbe una scrittura proposta, in parole: l'azione, l'oggetto e i campi che cambia.
 * Prova dal vivo di F1 del 2026-11-26 (Valentina Conti, KPI TJB-M003): la scheda in italiano
 * mostrava «kpi defs», «id», «description» e l'identificativo grezzo. Qui restano solo chiavi
 * (concetto, campo, riferimento): le parole le mette la lingua scelta (`agente.concetti.*`,
 * `agente.campi.*`), e i nomi degli oggetti collegati li legge la finestra dall'API.
 */
export type AzioneProposta = "crea" | "aggiorna" | "elimina" | "costruisci" | "altro";

export interface CampoProposto {
  /** Il nome del campo nel contratto (`description`, `ownerUserId`): è una chiave, non un testo. */
  campo: string;
  valore: string;
  /** Il concetto a cui punta il valore, quando il campo è un riferimento (`users`, `positions`). */
  riferimento?: string;
  /** Vero quando il valore è un identificativo che non va mostrato com'è. */
  identificativo?: boolean;
}

export interface RiepilogoProposta {
  azione: AzioneProposta;
  /** Il concetto dell'API (`kpi-definitions`): la sua etichetta sta in `agente.concetti.*`. */
  concetto: string | null;
  /** L'identificativo dell'oggetto che cambia, se esiste già: la finestra ne legge il nome. */
  id: string | null;
  campi: CampoProposto[];
}

/** Gli strumenti con nome del gateway (`apps/agent-gateway/src/mcp-tools.ts`) e il loro concetto. */
const STRUMENTI_NOMINATI: Record<string, string> = {
  hrx_org_units: "organization-units",
  hrx_positions: "positions",
  hrx_job_roles: "job-roles",
  hrx_skills: "skills",
  hrx_kpi_defs: "kpi-definitions",
  hrx_process_kpi_template: "process-kpi-templates",
  hrx_orgunit_kpi_template: "organization-unit-kpi-templates",
  hrx_typing_profile: "enterprise-typing-profiles",
  hrx_blueprint_activation: "blueprint-activations",
  hrx_blueprint_override: "blueprint-overrides",
  hrx_job_families: "job-families",
  hrx_blueprint_families: "blueprint-families",
  hrx_blueprint_variants: "blueprint-variants",
  hrx_blueprint_processes: "blueprint-processes",
  hrx_tenant: "tenant-materialization",
};

/** I campi che puntano a un oggetto di cui la finestra sa leggere il nome. */
const RIFERIMENTI: Record<string, string> = {
  organizationUnitId: "organization-units",
  ouId: "organization-units",
  unitId: "organization-units",
  jobRoleId: "job-roles",
  skillId: "skills",
  parentSkillId: "skills",
  childSkillId: "skills",
  kpiId: "kpi-definitions",
  kpiDefinitionId: "kpi-definitions",
  jobFamilyId: "job-families",
  careerPathId: "career-paths",
  candidateId: "candidates",
  applicationId: "candidate-applications",
  interviewId: "interviews",
  requisitionId: "job-requisitions",
  postingId: "job-postings",
  assessmentId: "assessments",
  poolId: "succession-pools",
  parentGoalId: "goals",
  parentOkrId: "okrs",
  moduleId: "learning-modules",
  initiativeId: "training-initiatives",
  graphId: "visualization-graphs",
  operatingModelId: "operating-models",
  sizeBandId: "enterprise-size-bands",
  blueprintProcessId: "blueprint-processes",
  variantId: "blueprint-variants",
  activationId: "blueprint-activations",
};

/**
 * I concetti di cui l'API ha la scheda `GET /v1/<concetto>/:id` (verificato contro la mappa
 * dell'agente in `messaggi.test.ts`): solo per questi la finestra chiede il nome.
 */
export const CONCETTI_CON_SCHEDA: ReadonlySet<string> = new Set([
  "activity-classification-mappings", "activity-classifications", "approvals", "assessment-results",
  "assessments", "blueprint-activations", "blueprint-families", "blueprint-overrides",
  "blueprint-processes", "blueprint-variants", "candidate-applications", "candidates",
  "career-path-steps", "career-paths", "content", "engagement-feedback", "enterprise-size-bands",
  "enterprise-typing-profiles", "goals", "interview-feedback", "interviews", "job-families",
  "job-offers", "job-postings", "job-requisitions", "job-roles", "kpi-definitions", "learning-gaps",
  "learning-modules", "learning-path-steps", "learning-paths", "occupation-classifications", "okrs",
  "operating-models", "organization-unit-history", "organization-unit-kpi-templates",
  "organization-units", "position-career-paths", "position-succession-relevance", "positions",
  "process-kpi-templates", "projects", "skill-aliases", "skill-categories", "skill-families",
  "skill-taxonomy-edges", "skills", "succession-pools", "successor-candidates",
  "successor-readiness", "surveys", "teams", "tenant-blueprints", "tenant-processes",
  "training-initiatives", "user-career-plans", "user-position-assignments", "user-target-positions",
  "users", "visualization-edges", "visualization-exports", "visualization-graphs",
  "visualization-layouts", "visualization-node-layouts", "visualization-nodes", "visualization-styles",
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Il concetto a cui punta un campo, se la finestra sa leggerne il nome. */
export function concettoRiferito(campo: string): string | undefined {
  if (/(^u|U)serIds?$/.test(campo)) return "users";
  if (/(^p|P)ositionId$/.test(campo)) return "positions";
  return RIFERIMENTI[campo];
}

/** L'azione di una chiamata del catalogo generico, dal prefisso della sua operazione. */
function azioneDaOperazione(operationId: string, conId: boolean): AzioneProposta {
  if (operationId.startsWith("delete")) return "elimina";
  if (operationId.startsWith("patch") || operationId.startsWith("put")) return "aggiorna";
  if (operationId === "post") return "crea";
  return conId && operationId === "post_by_id" ? "aggiorna" : "altro";
}

/**
 * Dal nome dello strumento e dagli argomenti (già oscurati dal gateway) il riepilogo che la persona
 * legge prima di confermare: non si consente una modifica senza sapere quale. Vale per gli strumenti
 * con nome (`hrx_kpi_defs_upsert`) e per il catalogo generico (`hrx_entity_query`, F1 di ADR-0063).
 */
export function riepilogoProposta(tool: unknown, input: unknown, massimo = 12): RiepilogoProposta {
  const nome = typeof tool === "string" ? (tool.split("__").pop() ?? tool) : "";
  const a = input !== null && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  let azione: AzioneProposta = "altro";
  let concetto: string | null = null;
  let id: string | null = null;
  let corpo: unknown;

  if (nome === "hrx_entity_query") {
    concetto = typeof a.conceptId === "string" ? a.conceptId : null;
    const params = a.params !== null && typeof a.params === "object" ? (a.params as Record<string, unknown>) : {};
    id = typeof params.id === "string" ? params.id : null;
    azione = azioneDaOperazione(typeof a.operationId === "string" ? a.operationId : "", id !== null);
    corpo = a.body ?? {};
  } else {
    const radice = nome.replace(/_(upsert|delete|materialize)$/, "");
    concetto = STRUMENTI_NOMINATI[radice] ?? null;
    id = typeof a.id === "string" && a.id ? a.id : null;
    if (/_delete$/.test(nome)) azione = "elimina";
    else if (/_materialize$/.test(nome)) azione = "costruisci";
    else if (/_upsert$/.test(nome)) azione = id ? "aggiorna" : "crea";
    corpo = "payload" in a ? a.payload : Object.fromEntries(Object.entries(a).filter(([k]) => k !== "id"));
  }

  const campi: CampoProposto[] = [];
  const visita = (v: unknown, campo: string) => {
    if (campi.length >= massimo) return;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) visita(x, k);
      return;
    }
    const testo = typeof v === "string" ? v : v === undefined ? "" : JSON.stringify(v);
    const riferimento = concettoRiferito(campo);
    const identificativo = typeof v === "string" && UUID.test(v);
    campi.push({
      campo: campo || "valore",
      valore: (testo ?? "").slice(0, 200),
      ...(riferimento ? { riferimento } : {}),
      ...(identificativo || (Array.isArray(v) && v.every((x) => typeof x === "string" && UUID.test(x)) && v.length > 0) ? { identificativo: true } : {}),
    });
  };
  visita(corpo, "");
  return { azione, concetto, id, campi };
}

/**
 * Il nome di un oggetto letto dalla sua scheda, come lo legge la persona: «Cognome, Nome» per una
 * persona, altrimenti il nome (o il titolo) con il codice fra parentesi. `null` se non ne ha uno.
 */
export function nomeLeggibile(risposta: unknown): string | null {
  const grezzo = risposta !== null && typeof risposta === "object" ? (risposta as Record<string, unknown>) : null;
  if (!grezzo) return null;
  const o = grezzo.data !== null && typeof grezzo.data === "object" && !Array.isArray(grezzo.data) ? (grezzo.data as Record<string, unknown>) : grezzo;
  const s = (k: string) => (typeof o[k] === "string" && (o[k] as string).trim() ? (o[k] as string).trim() : null);
  const cognome = s("lastName");
  const nomeProprio = s("firstName");
  if (cognome && nomeProprio) return `${cognome}, ${nomeProprio}`;
  const nome = s("name") ?? s("title") ?? s("label") ?? s("displayName") ?? s("objective");
  const codice = s("code");
  if (nome && codice && nome !== codice) return `${nome} (${codice})`;
  return nome ?? codice;
}
