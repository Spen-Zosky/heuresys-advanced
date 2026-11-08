/**
 * Pending-approval registry — the human-in-the-loop bridge (#9 WI-B, M-2 §3).
 *
 * The write-gate's `approve(req)` returns a Promise<boolean>. In the live service that
 * promise is resolved out-of-band: the SSE stream emits an `approval_required` event
 * carrying an `approvalId` + the REDACTED tool/args; a human clicks allow/deny in the
 * webapp, which calls `POST /agent/approve { approvalId, decision }`; that route looks
 * the id up here and resolves the pending promise.
 *
 * DENY-BY-DEFAULT everywhere:
 *  - unknown / already-resolved / expired id → resolve(false) (no-op for the caller);
 *  - approval not resolved within approvalTimeoutMs → auto resolve(false);
 *  - a 'deny' decision → resolve(false).
 *
 * SDK-free + framework-free + pure (clock + id-generator injectable) so it is fully
 * unit-testable without the live SDK, heuresys, or an HTTP server.
 */
import { randomUUID } from "node:crypto";

export type ApprovalDecision = "allow" | "deny";

interface Pending {
  resolve: (allowed: boolean) => void;
  /** La persona che ha chiesto (ADR-0056, cancello): solo lei può decidere. */
  owner: string | undefined;
  expiresAt: number;
  timer: ReturnType<typeof setTimeout>;
}

export interface ApprovalRegistryOptions {
  /** Auto-deny if not resolved within this window (default 120s). */
  approvalTimeoutMs?: number;
  /** Injectable for tests (default Date.now). */
  now?: () => number;
  /** Injectable for tests (default crypto.randomUUID). */
  genId?: () => string;
}

/**
 * L'esito di una decisione legata alla persona (ADR-0056, piano dei principi agentici T3):
 *  - `resolved`: la richiesta era in attesa e l'ha decisa la persona che l'aveva aperta;
 *  - `unknown`: sconosciuta, scaduta o già decisa (nessun effetto, come sempre);
 *  - `not-owner`: in attesa, ma chi decide non è la persona che ha chiesto. La richiesta resta in
 *    attesa e scade da sola: un tentativo da un'altra persona non la chiude, né in un senso né
 *    nell'altro, perché altrimenti chiunque potrebbe almeno negare le scritture altrui.
 */
export type ResolveOutcome = "resolved" | "unknown" | "not-owner";

export interface PendingApproval {
  /** Opaque id the SSE event carries and /agent/approve resolves against. */
  approvalId: string;
  /** Resolves true when a human allows, false on deny / timeout / unknown id. */
  decided: Promise<boolean>;
}

/**
 * In-memory registry of awaiting write approvals. One instance per server process
 * (module-level singleton in server.ts); the test constructs throwaway instances.
 */
export class ApprovalRegistry {
  private readonly pending = new Map<string, Pending>();
  private readonly timeoutMs: number;
  private readonly now: () => number;
  private readonly genId: () => string;

  constructor(opts: ApprovalRegistryOptions = {}) {
    this.timeoutMs = opts.approvalTimeoutMs ?? 120_000;
    this.now = opts.now ?? Date.now;
    this.genId = opts.genId ?? randomUUID;
  }

  /** Number of approvals currently awaiting a human (test/observability helper). */
  get size(): number {
    return this.pending.size;
  }

  /**
   * Registers a new pending approval. Returns the id (for the SSE event) and a promise
   * that resolves to the human's decision (or false on timeout). The promise NEVER rejects.
   */
  create(owner?: string): PendingApproval {
    const approvalId = this.genId();
    const expiresAt = this.now() + this.timeoutMs;
    const decided = new Promise<boolean>((resolve) => {
      const finalize = (allowed: boolean) => {
        const entry = this.pending.get(approvalId);
        if (!entry) return; // already resolved → idempotent no-op
        clearTimeout(entry.timer);
        this.pending.delete(approvalId);
        resolve(allowed);
      };
      const timer = setTimeout(() => finalize(false), this.timeoutMs);
      // Do not keep the event loop alive purely for a pending approval timer.
      if (typeof timer === "object" && typeof (timer as { unref?: () => void }).unref === "function") {
        (timer as { unref: () => void }).unref();
      }
      this.pending.set(approvalId, { resolve: finalize, owner, expiresAt, timer });
    });
    return { approvalId, decided };
  }

  /**
   * Resolves a pending approval. Returns true iff an awaiting approval with that id was
   * found and resolved; unknown / expired / already-resolved ids return false (no-op).
   */
  resolve(approvalId: string, decision: ApprovalDecision): boolean {
    const entry = this.pending.get(approvalId);
    if (!entry) return false; // unknown / expired / already-resolved → no-op (deny-by-default)
    entry.resolve(decision === "allow");
    return true;
  }

  /**
   * Guarda senza decidere (ADR-0056 D4, piano T6b): prima di registrare la decisione nel database
   * il server vuole sapere se c'è ancora un giro in attesa e se è di chi ha premuto. Senza questo
   * passo una decisione su una richiesta già scaduta in memoria resterebbe scritta come approvata
   * senza che niente venga eseguito.
   */
  peek(approvalId: string, caller: string | undefined): "pending" | "unknown" | "not-owner" {
    const entry = this.pending.get(approvalId);
    if (!entry) return "unknown";
    if (!caller || !entry.owner || entry.owner !== caller) return "not-owner";
    return "pending";
  }

  /**
   * Come `resolve`, ma solo per la persona che ha aperto la richiesta. Una richiesta creata senza
   * persona (`create()` senza argomento) non si può decidere da qui: chi la apre senza dire per
   * conto di chi non ottiene una richiesta che chiunque può chiudere.
   */
  resolveAs(approvalId: string, decision: ApprovalDecision, caller: string | undefined): ResolveOutcome {
    const entry = this.pending.get(approvalId);
    if (!entry) return "unknown";
    if (!caller || !entry.owner || entry.owner !== caller) return "not-owner";
    entry.resolve(decision === "allow");
    return "resolved";
  }
}
