/**
 * Pure write-gate logic for the Agent SDK backend (#9 WI-B).
 *
 * The chokepoint that enforces "no solely-automated consequential write"
 * (GDPR Art. 22 / EU AI Act human oversight). Three layers, in order:
 *   1. ALLOWLIST (M-3, I8 defense-in-depth): deny-by-default — an unknown / unlisted
 *      tool name is denied BEFORE the read/write branch, regardless of model output.
 *   2. READ vs WRITE: allowlisted writes need a human; allowlisted reads auto-allow **fino alla
 *      soglia alta di persone distinte** — oltre quella, e quando il conto non è misurabile, la
 *      lettura si ferma e chiede anche lei (#252, ADR-0040 R2). Non è un tetto: chi conferma
 *      legge tutto il suo tenant (I22), e l'assenso vale per il resto della conversazione.
 *   3. HITL + DENY-BY-DEFAULT (M-2): a write requires a human approval round-trip;
 *      timeout or approver error fails CLOSED.
 *
 * EVERY decision (allow-read, allow-write, deny) is recorded through the injected
 * AuditSink (M-4) — the sink redacts + hashes the args, so no raw PII/secret is logged.
 *
 * Kept SDK-free so it is unit-testable without the live @anthropic-ai/claude-agent-sdk.
 */
import {
  FileAuditSink,
  type AuditPrincipal,
  type AuditSink,
} from "./audit-sink.js";
import { bareToolName, DEFAULT_TOOL_ALLOWLIST } from "./mcp-tool-names.js";
import type { LettoreContatore } from "./persone-distinte.js";
import type { LivelloPersone } from "./soglie-persone.js";

/** Verbs that mutate platform state — the MCP tool naming is `hrx.<domain>.<verb>`
 *  (or snake-case `hrx_<domain>_<verb>`). A tool is a WRITE if its name carries any. */
const WRITE_VERBS =
  /(upsert|create|update|delete|apply|materialize|recommend|handoff|add|remove|activate|override)/i;

export function isWriteTool(name: string): boolean {
  return WRITE_VERBS.test(bareToolName(name));
}

/* ── Strumenti PARAMETRICI: la natura sta nell'input, non nel nome (ADR-0033 §5.2) ──
 *
 * `isWriteTool` decide dal NOME. Va bene finché un nome dice cosa fa: `..._upsert`
 * scrive, `..._list` legge. Smette di andare bene con uno strumento generico:
 * `hrx_entity_query` non contiene alcun verbo, quindi la regex lo direbbe LETTURA e
 * il gate lo auto-approverebbe — **anche quando l'operazione risolta è una DELETE**.
 * Un solo strumento del genere basterebbe ad aggirare l'approvazione umana su ogni
 * scrittura, cioè a svuotare il controllo che questo file esiste per applicare.
 *
 * Per questi strumenti la classificazione si fa sul **metodo HTTP dell'operazione
 * risolta**, e la risoluzione passa da un `OperationResolver` costruito sull'atlante.
 *
 * DUE REGOLE NON NEGOZIABILI, entrambe fail-closed:
 *   · il metodo NON si prende dall'input. Se l'agente potesse dichiarare «method:
 *     GET» mentre chiede una DELETE, la guardia sarebbe una formalità: il metodo lo
 *     dice la mappa, che deriva dal codice, non chi chiama;
 *   · se l'operazione non si risolve — resolver assente, concetto ignoto, operazione
 *     ignota — l'esito è **negare**, non «trattare come lettura». Non sapere cosa fa
 *     una chiamata è una ragione per fermarla, mai per lasciarla passare.
 */
const PARAMETRIC_TOOLS = new Set(["hrx_entity_query"]);

export function isParametricTool(name: string): boolean {
  return PARAMETRIC_TOOLS.has(bareToolName(name));
}

/** Metodo HTTP di un'operazione dichiarata dall'atlante. Iniettato, mai dedotto. */
export interface OperationResolver {
  /** Il metodo, oppure `undefined` se la coppia non esiste: l'ignoto non è una lettura. */
  methodOf(conceptId: string, operationId: string): string | undefined;
}

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export type CallClass = "read" | "write" | "unresolved";

/**
 * Classifica una chiamata. Per gli strumenti col verbo nel nome il comportamento è
 * quello di sempre; per i parametrici si risolve l'operazione e si guarda il metodo.
 */
export function classifyCall(
  name: string, input: unknown, resolver?: OperationResolver,
): CallClass {
  if (!isParametricTool(name)) return isWriteTool(name) ? "write" : "read";

  const a = (input ?? {}) as { conceptId?: unknown; operationId?: unknown };
  if (typeof a.conceptId !== "string" || typeof a.operationId !== "string") return "unresolved";
  if (!resolver) return "unresolved";

  const metodo = resolver.methodOf(a.conceptId, a.operationId);
  if (!metodo) return "unresolved";
  return WRITE_METHODS.has(metodo.toUpperCase()) ? "write" : "read";
}

/**
 * Ciò che il ponte di approvazione umana riceve. `tool` e `input` c'erano già; i tre campi
 * di `#252` dicono **perché** si sta chiedendo, e sono ciò che il pannello mostra in una riga.
 *
 * ⚠ Identificatori e numeri, MAI dati: `personeDistinte` è un conteggio, non un elenco di
 * persone. Il redattore (`redact.ts`) copre `input`; qui non c'è nulla da redigere perché non
 * c'è nulla di personale — e questo è un requisito, non una coincidenza.
 */
export type ApprovalRequest = {
  tool: string;
  input: unknown;
  /** `write` (come sempre) oppure `read` oltre la soglia alta (`#252`). */
  classe?: CallClass;
  /** Quante persone distinte la conversazione ha già toccato quando si è chiesto. */
  personeDistinte?: number;
  /** Il livello in cui cade quel numero, o `non-misurato` se il conto non è affidabile. */
  livello?: LivelloPersone;
};
export type ApproveFn = (req: ApprovalRequest) => Promise<boolean>;

/** Mirrors the SDK PermissionResult: updatedInput must be a Record (not unknown). */
export type ToolDecision =
  | { behavior: "allow"; updatedInput: Record<string, unknown> }
  | { behavior: "deny"; message: string };

/** Who the gate audits the decision under (hybrid auth: forwarded user vs service user). */
export interface GatePrincipal {
  principal: AuditPrincipal;
  /** Opaque subject id (never PII — a user/session id). */
  subject?: string;
  /** Tenant the call runs against (implicit from JWT upstream; "unknown" if unbound). */
  tenant?: string;
}

export interface GateOptions {
  /** Max time to wait for the human approval before denying (default 120s). */
  approvalTimeoutMs?: number;
  /**
   * Audit sink for EVERY decision. Defaults to a FileAuditSink (NOT a silent null sink):
   * production must always leave a trail. Tests inject a MemoryAuditSink.
   */
  audit?: AuditSink;
  /** Deny-by-default allowlist of permitted tool names. Defaults to the catalogue set. */
  allowlist?: ReadonlySet<string>;
  /** Principal context for the audit record. Defaults to the unknown principal. */
  principal?: GatePrincipal;
  /**
   * Risolutore delle operazioni per gli strumenti PARAMETRICI (ADR-0033 §5.2).
   *
   * Assente di proposito nella configurazione attuale: nessuno strumento generico
   * è collegato, e senza risolutore una chiamata parametrica viene **negata**, non
   * lasciata passare. È il default sicuro — la guardia esiste prima dello strumento
   * che dovrà sorvegliare, non dopo.
   */
  operations?: OperationResolver;
  /**
   * Il contatore di persone distinte della conversazione (#251, ADR-0040 R2). Il gate lo LEGGE
   * a ogni decisione, lo scrive nel diario, e da `#252` **ci decide sopra**: oltre la soglia
   * alta una lettura si ferma e chiede (vedi `canUseTool`, ramo 2b).
   *
   * ⚠ ASSENTE NON È «VA BENE» (D7 di `#252`). Il diario non porta il numero — «nessuna persona
   * letta» e «non l'ho misurato» sono due affermazioni diverse, e confonderle è il modo in cui
   * un freno cieco si legge come un freno verde — e **le letture chiedono conferma**, come se
   * il livello fosse `non-misurato`. In produzione il contatore c'è sempre (`sdk-agent.ts` lo
   * costruisce per ogni conversazione): questo ramo copre chi monta il gate a mano.
   */
  persone?: LettoreContatore;
}

const DENY_NOT_APPROVED = "write not approved (compliance gate)";
/**
 * Il messaggio arriva AL MODELLO, non a un registro: dice perché si è fermato e che non è un
 * divieto sul dato. Senza la seconda metà un agente onesto concluderebbe «non ho i permessi» e
 * lo riferirebbe alla persona — cioè racconterebbe una cosa falsa (I22: chi conferma legge
 * tutto il suo tenant).
 */
const DENY_READ_OVER_THRESHOLD =
  "read paused: this conversation has already touched more distinct people than the tenant's " +
  "high threshold (ADR-0040 R2) and the human confirmation was not granted. Not a permission " +
  "denial: ask the person to confirm, then retry.";
const DENY_NOT_ALLOWLISTED = "tool not in allowlist (defense-in-depth)";
const DENY_UNRESOLVED_OPERATION =
  "operation could not be resolved to an HTTP method (ADR-0033 §5.2 fail-closed)";

async function withTimeout<T>(p: Promise<T>, ms: number, onTimeout: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(onTimeout), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Builds the SDK `canUseTool` callback. Unlisted tools are denied (allowlist, M-3);
 * allowlisted writes are routed to `approve` (the webapp HITL round-trip), and so are
 * allowlisted reads **once the conversation has passed the high distinct-people threshold**
 * (#252). Any non-true outcome — explicit refusal, timeout, or a thrown approver — results in
 * DENY (fail-closed). Every outcome is audited (M-4).
 *
 * ⚠ UNA ISTANZA PER CONVERSAZIONE, e non è un'indicazione di stile: il consenso alle letture
 * (D5) vive in questa chiusura. Riusare lo stesso `canUseTool` per due conversazioni
 * porterebbe il consenso di una nell'altra — cioè un umano che approva per sé e sblocca un
 * altro. `sdk-agent.ts` lo costruisce dentro `runHrAgent`, che è il confine giusto.
 */
export function makeCanUseTool(approve: ApproveFn, opts: GateOptions = {}) {
  const timeoutMs = opts.approvalTimeoutMs ?? 120_000;
  const audit: AuditSink = opts.audit ?? new FileAuditSink();
  const allowlist = opts.allowlist ?? DEFAULT_TOOL_ALLOWLIST;
  const who = opts.principal ?? { principal: "unknown" as AuditPrincipal };

  /**
   * #251 — il numero si legge AL MOMENTO della decisione, non a fine corsa: il diario deve dire
   * quante persone erano già state toccate quando questa chiamata è stata consentita. Un totale
   * finale non distinguerebbe la prima lettura dalla trentesima.
   *
   * ⚠ Non deve poter ALZARE (un lettore iniettato da un test potrebbe): un guasto del contatore
   * non è una ragione per far esplodere il gate. Da `#252` questa lettura decide anche, quindi
   * il suo esito vuoto ha un significato preciso — vedi il ramo 2b.
   */
  const leggiPersone = (): { quante?: number; livello?: LivelloPersone } => {
    try {
      return { quante: opts.persone?.conta(), livello: opts.persone?.livello() };
    } catch {
      return {};
    }
  };

  /**
   * #252 — IL CONSENSO VALE PER LA CONVERSAZIONE (D5), e la richiesta è UNA SOLA (D6).
   *
   * Questo stato vive qui e non in un registro globale perché `makeCanUseTool` è costruito
   * **una volta per conversazione** (`sdk-agent.ts`, una `runHrAgent` = una `POST /agent`):
   * lo stesso confine su cui vive il contatore di `#251`. Una mappa per id di conversazione
   * sarebbe infrastruttura in più per coprire esattamente ciò che già esiste.
   *
   * ⚠ ASIMMETRIA VOLUTA: l'assenso si ricorda, il diniego no. Fra i dinieghi c'è il **timeout**,
   * che non è un atto umano: ricordarlo trasformerebbe un guasto di rete in una conversazione
   * sigillata. Ricordare l'assenso, invece, lo impone I22 — chi conferma legge tutto il tenant,
   * e ri-chiedere a ogni lettura sarebbe il tetto che ADR-0040 §6 ha scartato.
   */
  let consensoLetture = false;
  let richiestaInVolo: Promise<boolean> | undefined;

  const chiediPerLettura = (
    tool: string,
    input: unknown,
    quante: number | undefined,
    livello: LivelloPersone | undefined,
  ): Promise<boolean> => {
    if (richiestaInVolo) return richiestaInVolo;
    const nuova = async (): Promise<boolean> => {
      try {
        return await withTimeout(
          approve({
            tool,
            input,
            classe: "read",
            ...(quante !== undefined ? { personeDistinte: quante } : {}),
            ...(livello !== undefined ? { livello } : {}),
          }),
          timeoutMs,
          false,
        );
      } catch {
        return false; // l'approvatore alza → si nega (fail-closed, come per le scritture)
      }
    };
    richiestaInVolo = nuova()
      .then((ok) => {
        if (ok) consensoLetture = true;
        return ok;
      })
      .finally(() => {
        richiestaInVolo = undefined;
      });
    return richiestaInVolo;
  };

  const auditDecision = (
    tool: string,
    args: unknown,
    decision: ToolDecision,
    reason: string,
  ): void => {
    const { quante, livello } = leggiPersone();
    // Audit is best-effort and MUST NOT change the gate decision: swallow sink errors.
    void audit
      .record({
        who: { principal: who.principal, ...(who.subject !== undefined ? { subject: who.subject } : {}) },
        tenant: who.tenant ?? "unknown",
        tool,
        args,
        ...(quante !== undefined ? { personeDistinte: quante } : {}),
        ...(livello !== undefined ? { livelloPersone: livello } : {}),
        decision: decision.behavior,
        reason,
      })
      .catch(() => {});
  };

  return async function canUseTool(name: string, input: unknown): Promise<ToolDecision> {
    // 1. Allowlist (deny-by-default, before classification).
    if (!allowlist.has(name)) {
      const d: ToolDecision = { behavior: "deny", message: DENY_NOT_ALLOWLISTED };
      auditDecision(name, input, d, "TOOL_NOT_ALLOWLISTED");
      return d;
    }

    // 2. Classificazione. Per gli strumenti col verbo nel nome è la stessa di
    //    sempre; per i parametrici (ADR-0033 §5.2) si risolve l'operazione e si
    //    guarda il METODO — perché il nome, lì, non dice più cosa fa la chiamata.
    const classe = classifyCall(name, input, opts.operations);

    // 2a. Operazione non risolta → si NEGA. Non è pedanteria: l'alternativa è
    //     trattare come lettura ciò che non si è riusciti a leggere, cioè
    //     auto-approvare l'ignoto. Questo ramo è la ragione per cui uno strumento
    //     generico può esistere senza aprire un buco.
    if (classe === "unresolved") {
      const d: ToolDecision = { behavior: "deny", message: DENY_UNRESOLVED_OPERATION };
      auditDecision(name, input, d, "OPERATION_UNRESOLVED");
      return d;
    }

    // 2b. Lettura. Fino alla soglia alta passa da sé, come è sempre stato. OLTRE la soglia —
    //     e quando il conto non è misurabile — si FERMA e chiede (#252, ADR-0040 R2): è lo
    //     stesso ponte delle scritture, con lo stesso evento `approval_required` che il web
    //     già gestisce. Non è un tetto: chi conferma legge tutto il suo tenant (I22), e
    //     l'assenso vale per il resto della conversazione.
    if (classe === "read") {
      const { quante, livello } = leggiPersone();
      // TRE casi fanno chiedere, e sono tre affermazioni diverse con la stessa conseguenza:
      //   · `confermato`  → il conto ha superato la soglia alta: il caso per cui esiste;
      //   · `non-misurato`→ soglie illeggibili o contatore guasto (D2/D4 di `#251`);
      //   · livello assente → il gate non è cablato al contatore (D7): «non l'ho guardato».
      const oltreLaSoglia =
        livello === undefined || livello === "confermato" || livello === "non-misurato";
      if (!oltreLaSoglia) {
        const d: ToolDecision = { behavior: "allow", updatedInput: input as Record<string, unknown> };
        auditDecision(name, input, d, "READ_AUTO_ALLOW");
        return d;
      }
      // L'assenso già dato in questa conversazione non si ri-chiede (D5) — ma si scrive nel
      // diario con una ragione propria, perché «è passata senza chiedere» e «è passata perché
      // un umano aveva già acconsentito» sono due fatti diversi, e a posteriori contano.
      if (consensoLetture) {
        const d: ToolDecision = { behavior: "allow", updatedInput: input as Record<string, unknown> };
        auditDecision(name, input, d, "READ_OVER_THRESHOLD_CONSENTED");
        return d;
      }
      const consentito = await chiediPerLettura(name, input, quante, livello);
      const d: ToolDecision = consentito
        ? { behavior: "allow", updatedInput: input as Record<string, unknown> }
        : { behavior: "deny", message: DENY_READ_OVER_THRESHOLD };
      auditDecision(
        name, input, d,
        consentito ? "READ_OVER_THRESHOLD_APPROVED" : "READ_OVER_THRESHOLD_DENIED",
      );
      return d;
    }

    // 3. Allowlisted write → HITL with deny-by-default on timeout/throw.
    let approved = false;
    try {
      const { quante, livello } = leggiPersone();
      approved = await withTimeout(
        approve({
          tool: name,
          input,
          classe: "write",
          ...(quante !== undefined ? { personeDistinte: quante } : {}),
          ...(livello !== undefined ? { livello } : {}),
        }),
        timeoutMs,
        false,
      );
    } catch {
      approved = false; // approver threw → fail closed
    }
    const d: ToolDecision = approved
      ? { behavior: "allow", updatedInput: input as Record<string, unknown> }
      : { behavior: "deny", message: DENY_NOT_APPROVED };
    auditDecision(name, input, d, approved ? "WRITE_HUMAN_APPROVED" : "WRITE_DENIED_OR_TIMEOUT");
    return d;
  };
}
