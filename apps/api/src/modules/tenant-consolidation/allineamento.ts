/**
 * apps/api/src/modules/tenant-consolidation/allineamento.ts — la scheda «Allineamento» della pagina del
 * consolidamento (piano `docs/piani/PIANO_scheda-allineamento_20261118.md`, ADR-0059).
 *
 * Prende la misura della distanza (`distanza.ts`, la stessa della rotta `/distance`, che non cambia) e per ogni
 * voce aggiunge tre cose:
 *   · una CHIAVE stabile (dominio, lato, nomi normalizzati e ricorrenza), con cui una decisione resta attaccata
 *     alla sua voce fra una misura e l'altra;
 *   · una PROPOSTA: Unisco per una coppia riconosciuta, Adotto per una voce del solo modello, Tengo per una voce
 *     del solo tenant, Tolgo per un doppione del tenant nei cataloghi;
 *   · le decisioni registrate in `sys_alignment_decisions` (000499): la bozza e l'approvata.
 *
 * Qui non si cambia nessun dato del tenant: le decisioni approvate sono il registro da cui partirà il motore
 * dell'allineamento (tappe B-C-E del piano del 16/11).
 */
import { createHash } from "node:crypto";
import {
  ALIGNMENT_FAMILIES,
  ALLOWED_ALIGNMENT_DECISIONS,
  type AlignmentDecision,
  type AlignmentDomain,
  type AlignmentRow,
  type AlignmentSide,
} from "@heuresys/shared";
import { normalizza, type DominioDistanza, type MisuraDistanza, type RigaDistanza } from "./distanza.js";
import type { DbConnector } from "./repository.js";

/**
 * I domini che i giri del consolidamento riconoscono già per nome (`sorgenti.ts`). Gli altri sono solo misurati:
 * la pagina lo dice, così nessuno si aspetta dai giri ciò che i giri non fanno.
 */
export const DOMINI_NEI_GIRI: ReadonlySet<DominioDistanza> = new Set<DominioDistanza>([
  "unita", "ruoli", "skill", "processi", "fasi", "metriche", "obiettivi",
  // SA5: i sei cataloghi con nome entrati nei giri (gruppi CONTRACTS … ENGAGEMENTS).
  "ccnl", "obblighi", "formazione", "carriere", "incentivi", "commesse",
]);

/**
 * I cataloghi in cui due voci del tenant con lo stesso nome sono un doppione. Fuori da qui lo stesso nome è
 * legittimo: lo stesso ruolo in più filiali, la stessa fase in più processi, lo stesso posto per più persone.
 */
const CATALOGHI_SENZA_DOPPIONI: ReadonlySet<DominioDistanza> = new Set<DominioDistanza>([
  "skill", "metriche", "obiettivi", "processi", "formazione", "carriere", "incentivi", "commesse", "obblighi",
]);

const FAMIGLIA = new Map<DominioDistanza, AlignmentDomain["famiglia"]>(
  ALIGNMENT_FAMILIES.flatMap((f) => f.domini.map((d) => [d, f.famiglia] as const)),
);

export function latoDi(r: RigaDistanza): AlignmentSide {
  if (r.esito === "solo_modello") return "SOLO_MODELLO";
  if (r.esito === "solo_tenant") return "SOLO_TENANT";
  return "COPPIA";
}

/** La chiave di una voce: 32 cifre esadecimali, uguali finché dominio, lato e nomi restano gli stessi. */
export function chiaveDi(dominio: string, lato: AlignmentSide, modello: string | null, tenant: string | null, ricorrenza: number): string {
  return createHash("sha256")
    .update([dominio, lato, normalizza(modello), normalizza(tenant), String(ricorrenza)].join("\u001f"))
    .digest("hex")
    .slice(0, 32);
}

/** La proposta per una voce, o null se la voce è già uguale e non c'è niente da decidere. */
export function propostaDi(dominio: DominioDistanza, r: RigaDistanza, doppione: boolean): AlignmentDecision | null {
  if (r.esito === "uguale") return null;
  if (r.esito === "solo_modello") return "ADOTTO";
  if (r.esito === "solo_tenant") {
    // I ruoli di accesso restano del tenant: il modello non li porta (ADR-0059, famiglia «Accesso»).
    if (dominio === "ruoli_funzionali") return "TENGO";
    return doppione ? "TOLGO" : "TENGO";
  }
  return "UNISCO";
}

export interface DecisioneRegistrata {
  dominio: string;
  chiave: string;
  bozza: AlignmentDecision | null;
  approvata: AlignmentDecision | null;
  approvataIl: string | null;
}

/** Le voci di un dominio con chiave, lato e proposta, senza le decisioni. */
export function vociDelDominio(dominio: DominioDistanza, righe: RigaDistanza[]): Array<Omit<AlignmentRow, "bozza" | "approvata" | "approvataIl">> {
  const ricorrenze = new Map<string, number>();
  const nomiTenant = new Map<string, number>();
  if (CATALOGHI_SENZA_DOPPIONI.has(dominio)) {
    for (const r of righe) {
      const n = normalizza(r.tenant);
      if (n) nomiTenant.set(n, (nomiTenant.get(n) ?? 0) + 1);
    }
  }
  return righe.map((r) => {
    const lato = latoDi(r);
    const base = [lato, normalizza(r.modello), normalizza(r.tenant)].join("|");
    const n = ricorrenze.get(base) ?? 0;
    ricorrenze.set(base, n + 1);
    const doppione = r.esito === "solo_tenant" && (nomiTenant.get(normalizza(r.tenant)) ?? 0) > 1;
    return {
      chiave: chiaveDi(dominio, lato, r.modello, r.tenant, n),
      lato,
      esito: r.esito,
      modello: r.modello,
      tenant: r.tenant,
      ...(r.nota ? { nota: r.nota } : doppione ? { nota: "Lo stesso nome compare più volte nel tenant: è un doppione." } : {}),
      proposta: propostaDi(dominio, r, doppione),
    };
  });
}

/** Mette insieme misura e decisioni registrate. */
export function componiAllineamento(
  m: MisuraDistanza,
  decisioni: DecisioneRegistrata[],
): { domini: AlignmentDomain[]; superate: number; bozze: number; approvate: number } {
  const perChiave = new Map(decisioni.map((d) => [`${d.dominio}|${d.chiave}`, d]));
  const usate = new Set<string>();
  const domini: AlignmentDomain[] = m.domini.map((d) => {
    const voci = vociDelDominio(d.dominio, d.dettaglio ?? []).map((v) => {
      const k = `${d.dominio}|${v.chiave}`;
      const reg = perChiave.get(k);
      if (reg) usate.add(k);
      return { ...v, bozza: reg?.bozza ?? null, approvata: reg?.approvata ?? null, approvataIl: reg?.approvataIl ?? null };
    });
    const { dettaglio: _d, ...conteggi } = d;
    return {
      ...conteggi,
      famiglia: FAMIGLIA.get(d.dominio) ?? "identita",
      copertura: DOMINI_NEI_GIRI.has(d.dominio) ? "GIRI" : "MISURA",
      righe_voci: voci,
    };
  });
  return {
    domini,
    superate: decisioni.filter((d) => !usate.has(`${d.dominio}|${d.chiave}`)).length,
    bozze: decisioni.filter((d) => d.bozza !== null).length,
    approvate: decisioni.filter((d) => d.approvata !== null).length,
  };
}

/** Controlla una bozza contro la misura di oggi: la voce deve esistere e ammettere la decisione. */
export function controllaBozza(
  domini: AlignmentDomain[],
  voce: { dominio: string; chiave: string; decisione: AlignmentDecision },
): { ok: true; riga: AlignmentRow } | { ok: false; motivo: string } {
  const d = domini.find((x) => x.dominio === voce.dominio);
  const riga = d?.righe_voci.find((r) => r.chiave === voce.chiave);
  if (!riga) return { ok: false, motivo: "La voce non c'è più nella misura di oggi: ricarica la pagina." };
  if (riga.esito === "uguale") return { ok: false, motivo: "La voce è già uguale al modello: non c'è niente da decidere." };
  if (!ALLOWED_ALIGNMENT_DECISIONS[riga.lato].includes(voce.decisione)) {
    return { ok: false, motivo: "Questa decisione non vale per questo tipo di voce." };
  }
  return { ok: true, riga };
}

// ---------------------------------------------------------------------------------------------------
// Registro (000499). SQL parametrizzato, il tenant viene sempre dalla sessione.

export async function decisioniRegistrate(q: DbConnector, tenantId: string, runId: string): Promise<DecisioneRegistrata[]> {
  const { rows } = await q.query<{
    dominio: string; chiave: string; bozza: AlignmentDecision | null; approvata: AlignmentDecision | null; approvata_il: Date | null;
  }>(
    `SELECT alignment_decision_domain AS dominio, alignment_decision_row_key AS chiave,
            alignment_decision_draft AS bozza, alignment_decision_approved AS approvata,
            alignment_decision_approved_at AS approvata_il
       FROM sys.sys_alignment_decisions
      WHERE alignment_decision_tenant_id = $1 AND alignment_decision_run_id = $2`,
    [tenantId, runId],
  );
  return rows.map((r) => ({
    dominio: r.dominio, chiave: r.chiave, bozza: r.bozza, approvata: r.approvata,
    approvataIl: r.approvata_il ? new Date(r.approvata_il).toISOString() : null,
  }));
}

export async function salvaBozza(
  q: DbConnector,
  a: { tenantId: string; runId: string; userId: string; dominio: string; riga: AlignmentRow; decisione: AlignmentDecision },
): Promise<void> {
  await q.query(
    `INSERT INTO sys.sys_alignment_decisions (
        alignment_decision_tenant_id, alignment_decision_run_id, alignment_decision_domain, alignment_decision_row_key,
        alignment_decision_side, alignment_decision_model_label, alignment_decision_tenant_label,
        alignment_decision_proposed, alignment_decision_draft, alignment_decision_drafted_by, alignment_decision_drafted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
     ON CONFLICT (alignment_decision_run_id, alignment_decision_domain, alignment_decision_row_key) DO UPDATE
        SET alignment_decision_draft = CASE
              WHEN sys_alignment_decisions.alignment_decision_approved = EXCLUDED.alignment_decision_draft THEN NULL
              ELSE EXCLUDED.alignment_decision_draft END,
            alignment_decision_drafted_by = EXCLUDED.alignment_decision_drafted_by,
            alignment_decision_drafted_at = now(),
            alignment_decision_model_label = EXCLUDED.alignment_decision_model_label,
            alignment_decision_tenant_label = EXCLUDED.alignment_decision_tenant_label,
            alignment_decision_proposed = EXCLUDED.alignment_decision_proposed
      WHERE sys_alignment_decisions.alignment_decision_tenant_id = EXCLUDED.alignment_decision_tenant_id`,
    [a.tenantId, a.runId, a.dominio, a.riga.chiave, a.riga.lato, a.riga.modello, a.riga.tenant, a.riga.proposta, a.decisione, a.userId],
  );
}

/** Il pulsante rosso: ogni bozza diventa la decisione approvata. Restituisce quante. */
export async function approvaBozze(q: DbConnector, tenantId: string, runId: string, userId: string, quando: Date): Promise<number> {
  const r = await q.query(
    `UPDATE sys.sys_alignment_decisions
        SET alignment_decision_approved = alignment_decision_draft,
            alignment_decision_approved_by = $3,
            alignment_decision_approved_at = $4,
            alignment_decision_draft = NULL
      WHERE alignment_decision_tenant_id = $1 AND alignment_decision_run_id = $2
        AND alignment_decision_draft IS NOT NULL`,
    [tenantId, runId, userId, quando],
  );
  return r.rowCount ?? 0;
}

/**
 * Scarta le bozze: dove c'era un'approvata resta quella; le righe che portavano solo la bozza si tolgono, perché
 * una riga del registro vive solo se porta una decisione (vincolo di 000499).
 */
export async function scartaBozze(q: DbConnector, tenantId: string, runId: string): Promise<number> {
  const conApprovata = await q.query(
    `UPDATE sys.sys_alignment_decisions SET alignment_decision_draft = NULL
      WHERE alignment_decision_tenant_id = $1 AND alignment_decision_run_id = $2
        AND alignment_decision_draft IS NOT NULL AND alignment_decision_approved IS NOT NULL`,
    [tenantId, runId],
  );
  const soloBozza = await q.query(
    `DELETE FROM sys.sys_alignment_decisions
      WHERE alignment_decision_tenant_id = $1 AND alignment_decision_run_id = $2
        AND alignment_decision_draft IS NOT NULL AND alignment_decision_approved IS NULL`,
    [tenantId, runId],
  );
  return (conApprovata.rowCount ?? 0) + (soloBozza.rowCount ?? 0);
}
