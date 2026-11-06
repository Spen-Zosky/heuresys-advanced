/**
 * apps/agent-gateway/src/capacita.ts — ADR-0053 A3, piano dei principi agentici voce T3b.
 *
 * IL CANCELLO LEGGE IL REGISTRO DELLE CAPACITÀ (migrazione 000480). Una scrittura può andare senza
 * ponte di approvazione solo se TUTTE queste cose sono vere nello stesso momento:
 *
 *   · la sua classe è B (ADR-0056 D2): la C non diventa mai automatica, a nessun livello;
 *   · l'operazione dell'atlante che esegue sta nell'elenco di una capacità PUBBLICATA
 *     dell'assistente, con la stessa classe B;
 *   · per il tenant della persona quella capacità è oggi in modo `LIBERA`
 *     (`sys.v_agent_capability_activations_current`);
 *   · la conversazione non ha ancora raggiunto il tetto di volume della capacità.
 *
 * Il registro si legge A OGNI SCRITTURA, senza memoria fra una chiamata e l'altra: l'interruttore
 * (ADR-0053 D4, il ritorno a `CONFERMA`) vale dalla chiamata successiva dell'agente, non dalla
 * prossima conversazione.
 *
 * Un registro che non risponde, o che risponde in modo inatteso, non libera niente: la scrittura
 * torna davanti alla persona, come prima di questo file.
 */
import type { Operazione } from "./operazione.js";

/** La capacità che libera un'operazione per un tenant, con il suo tetto. */
export interface CapacitaLibera {
  code: string;
  version: number;
  volumeCap: number;
}

export interface RegistroCapacita {
  /**
   * La capacità `LIBERA` dell'agente che, per quel tenant, contiene l'operazione come classe B;
   * `undefined` se non ce n'è nessuna. Può alzare: chi chiama tratta l'errore come «nessuna».
   */
  liberaPer(agentCode: string, tenantCode: string, op: Operazione): Promise<CapacitaLibera | undefined>;
}

/** Il minimo di `pg.Pool` che serve qui: iniettabile nelle prove. */
export interface Interrogabile {
  query(text: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
}

/**
 * La lettura dal database. Una sola query, con tutte le condizioni dentro: capacità pubblicata,
 * attivazione in vigore `LIBERA`, operazione con lo stesso metodo e classe B, nessuna operazione
 * di classe C nella capacità (il database già lo impedisce all'attivazione; qui si ricontrolla,
 * perché il cancello non si fida di ciò che non legge). Se più capacità la coprono, vale quella
 * col tetto più basso.
 */
export class DbRegistroCapacita implements RegistroCapacita {
  constructor(private readonly db: Interrogabile) {}

  async liberaPer(agentCode: string, tenantCode: string, op: Operazione): Promise<CapacitaLibera | undefined> {
    const { rows } = await this.db.query(
      `SELECT c.agent_capability_code AS code,
              c.agent_capability_version AS version,
              c.agent_capability_volume_cap AS volume_cap
         FROM sys.v_agent_capability_activations_current v
         JOIN sys.sys_tenancies t ON t.tenant_id = v.agent_capability_activation_tenant_id
         JOIN sys.sys_agent_capabilities c ON c.agent_capability_id = v.agent_capability_activation_capability_id
         JOIN sys.sys_agent_capability_operations o ON o.agent_capability_operation_capability_id = c.agent_capability_id
        WHERE t.tenant_code = $1
          AND c.agent_capability_agent_code = $2
          AND c.agent_capability_status = 'PUBBLICATA'
          AND v.agent_capability_activation_mode = 'LIBERA'
          AND o.agent_capability_operation_concept_id = $3
          AND o.agent_capability_operation_operation_id = $4
          AND o.agent_capability_operation_http_method = $5
          AND o.agent_capability_operation_action_class = 'B'
          AND NOT EXISTS (
                SELECT 1 FROM sys.sys_agent_capability_operations x
                 WHERE x.agent_capability_operation_capability_id = c.agent_capability_id
                   AND x.agent_capability_operation_action_class = 'C')
        ORDER BY c.agent_capability_volume_cap ASC, c.agent_capability_code ASC
        LIMIT 1`,
      [tenantCode, agentCode, op.conceptId, op.operationId, op.method.toUpperCase()],
    );
    const r = rows[0] as { code?: unknown; version?: unknown; volume_cap?: unknown } | undefined;
    if (!r || typeof r.code !== "string") return undefined;
    const version = Number(r.version);
    const volumeCap = Number(r.volume_cap);
    if (!Number.isInteger(version) || !Number.isInteger(volumeCap) || volumeCap < 1) return undefined;
    return { code: r.code, version, volumeCap };
  }
}

/**
 * Le scritture già passate da sole in questa conversazione, per capacità e versione. Uno per
 * conversazione, come il contatore delle persone: il tetto di ADR-0053 D1 è «per giro».
 */
export class ContatoreVolume {
  private readonly usate = new Map<string, number>();

  private chiave(c: CapacitaLibera): string {
    return `${c.code}@${c.version}`;
  }

  /** Prenota un posto sotto il tetto; `false` se il tetto è già raggiunto. */
  prenota(c: CapacitaLibera): boolean {
    const k = this.chiave(c);
    const ora = this.usate.get(k) ?? 0;
    if (ora >= c.volumeCap) return false;
    this.usate.set(k, ora + 1);
    return true;
  }

  usateDa(c: CapacitaLibera): number {
    return this.usate.get(this.chiave(c)) ?? 0;
  }
}
