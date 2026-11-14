/**
 * apps/api/src/modules/tenant-consolidation/applicazione.ts — AC-8, l'applicazione delle decisioni.
 *
 * Piano: docs/piani/PIANO_consolidamento-applicazione_20261113.md. Disegno: §6 di
 * .programmi/consolidamento/agente/05_DISEGNO_TECNICO.md.
 *
 * Una decisione si applica ai dati del tenant dentro la stessa transazione che la scrive, e si
 * può riapplicare quante volte si vuole: ogni volta si calcola lo stato voluto e si scrive solo
 * ciò che differisce (una riconferma uguale non cambia nessuna riga). Prima di applicare si
 * ritirano gli effetti della decisione che questa sostituisce, leggendo il giornale
 * `staging.tenant_consolidation_undo`: un valore si rimette com'era solo se nessun altro lo ha
 * cambiato nel frattempo.
 *
 * Si scrivono solo nome, codice e descrizione delle voci strutturali dei cinque gruppi, e si
 * creano le voci adottate. Mai persone, contratti, utenze (specifica §7). Niente cancellazioni.
 */
import type { ConsolidationGroup, Decision, LinkForm } from "@heuresys/shared";
import type { DbConnector } from "./repository.js";
import { vociDelPrototipo } from "./sorgenti.js";

interface Bersaglio {
  table: string;
  id: string;
  tenant: string;
  name: string;
  code: string;
  description: string | null;
  /** Le voci con tenant nullo sono del catalogo comune: non si toccano. */
  creabile: boolean;
}

const BERSAGLI: Record<ConsolidationGroup, Bersaglio> = {
  ORGANIZATION: {
    table: "sys_organization_units", id: "organization_unit_id", tenant: "organization_unit_tenant_id",
    name: "organization_unit_name", code: "organization_unit_code", description: null,
    // Un'unità senza padre e senza responsabile è un difetto dell'organigramma (la guardia della 000247 la rifiuta):
    // si registra come adottata e si materializza scegliendo il responsabile, non da sola.
    creabile: false,
  },
  POSITIONS_ROLES: {
    table: "sys_positions", id: "position_id", tenant: "position_tenant_id",
    name: "position_title", code: "position_code", description: null, creabile: false,
  },
  SKILLS: {
    table: "sys_skills", id: "skill_id", tenant: "skill_tenant_id",
    name: "skill_name", code: "skill_code", description: "skill_description", creabile: true,
  },
  PROCESSES: {
    table: "sys_tenant_processes", id: "tenant_process_id", tenant: "tenant_process_tenant_id",
    name: "tenant_process_name", code: "tenant_process_code", description: "tenant_process_description", creabile: true,
  },
  INDICATORS_GOALS: {
    table: "sys_kpi_definitions", id: "kpi_definition_id", tenant: "kpi_definition_tenant_id",
    name: "kpi_definition_name", code: "kpi_definition_code", description: "kpi_definition_description", creabile: true,
  },
};

export interface Cambio {
  table: string;
  recordId: string;
  column: string;
  from: string | null;
  to: string | null;
}

export interface RapportoApplicazione {
  /** Valori cambiati in questa applicazione. Vuoto = la riconferma non ha toccato niente. */
  changed: Cambio[];
  /** Voci create (adozione). */
  created: Array<{ table: string; recordId: string; code: string; name: string }>;
  /** Effetti di una decisione precedente rimessi com'erano. */
  reverted: number;
  /** Ciò che non si è potuto fare, con la ragione detta in italiano. */
  skipped: string[];
}

export interface DecisioneCorrente {
  decisionId: string;
  decision: Decision;
  form: LinkForm | null;
  adr48State: "EREDITATA" | "CONSERVATA" | "PROPRIA" | null;
}

interface ProposteDati {
  proposalId: string;
  group: ConsolidationGroup;
  tenantKeys: string[];
  prototypeKeys: string[];
}

const q = (s: string) => `"${s.replace(/"/g, '""')}"`;

async function giornale(
  db: DbConnector, tenantId: string, proposalId: string, decisionId: string,
  v: { kind: "UPDATE" | "INSERT"; table: string; recordId: string; column?: string; before?: string | null; after?: string | null },
): Promise<void> {
  await db.query(
    `INSERT INTO staging.tenant_consolidation_undo
       (tenant_id, proposal_id, decision_id, kind, table_name, record_id, column_name, value_before, value_after)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [tenantId, proposalId, decisionId, v.kind, v.table, v.recordId, v.column ?? null, v.before ?? null, v.after ?? null],
  );
}

/** Rimette com'erano i valori scritti da una decisione precedente della stessa proposta. */
async function ritira(
  db: DbConnector, tenantId: string, proposalId: string, decisionId: string,
  voluti: ReadonlyArray<{ recordId: string; column: string; value: string | null }>, rapporto: RapportoApplicazione,
): Promise<void> {
  const { rows } = await db.query<{
    undo_id: string; table_name: string; record_id: string; column_name: string; value_before: string | null; value_after: string | null;
  }>(
    `SELECT undo_id, table_name, record_id, column_name, value_before, value_after
       FROM staging.tenant_consolidation_undo
      WHERE tenant_id = $1 AND proposal_id = $2 AND kind = 'UPDATE' AND reverted_at IS NULL
      ORDER BY created_at DESC, undo_id`,
    [tenantId, proposalId],
  );
  for (const r of rows) {
    const b = Object.values(BERSAGLI).find((x) => x.table === r.table_name);
    if (!b) continue;
    // Ciò che la decisione nuova vuole uguale a ciò che la vecchia aveva scritto resta com'è: niente da ritirare né da riscrivere.
    if (voluti.some((v) => v.recordId === r.record_id && v.column === r.column_name && v.value === r.value_after)) {
      await db.query(`UPDATE staging.tenant_consolidation_undo SET decision_id = $2 WHERE undo_id = $1`, [r.undo_id, decisionId]);
      continue;
    }
    const res = await db.query(
      `UPDATE sys.${q(r.table_name)} SET ${q(r.column_name)} = $1
        WHERE ${q(b.id)} = $2 AND ${q(b.tenant)} = $3 AND ${q(r.column_name)} IS NOT DISTINCT FROM $4`,
      [r.value_before, r.record_id, tenantId, r.value_after],
    );
    if (res.rowCount === 1) rapporto.reverted++;
    else rapporto.skipped.push(`Il valore di ${r.column_name} era stato cambiato da altri: non l'ho rimesso com'era.`);
    await db.query(`UPDATE staging.tenant_consolidation_undo SET reverted_at = now() WHERE undo_id = $1`, [r.undo_id]);
  }
}

async function scrivi(
  db: DbConnector, tenantId: string, p: ProposteDati, decisionId: string, b: Bersaglio,
  recordId: string, column: string, valore: string | null, rapporto: RapportoApplicazione,
): Promise<void> {
  const { rows } = await db.query<{ v: string | null }>(
    `SELECT ${q(column)}::text AS v FROM sys.${q(b.table)} WHERE ${q(b.id)} = $1 AND ${q(b.tenant)} = $2 FOR UPDATE`,
    [recordId, tenantId],
  );
  if (rows.length === 0) { rapporto.skipped.push(`La voce ${recordId} non è più del tenant.`); return; }
  const prima = rows[0]!.v;
  if (prima === valore) return; // già come deve essere: niente da scrivere
  await db.query(`SAVEPOINT cons_scrivi`);
  try {
    await db.query(`UPDATE sys.${q(b.table)} SET ${q(column)} = $1 WHERE ${q(b.id)} = $2 AND ${q(b.tenant)} = $3`, [valore, recordId, tenantId]);
    await db.query(`RELEASE SAVEPOINT cons_scrivi`);
  } catch (e) {
    await db.query(`ROLLBACK TO SAVEPOINT cons_scrivi`);
    rapporto.skipped.push(`Non ho potuto scrivere ${column}: ${(e as Error).message.slice(0, 120)}`);
    return;
  }
  await giornale(db, tenantId, p.proposalId, decisionId, { kind: "UPDATE", table: b.table, recordId, column, before: prima, after: valore });
  rapporto.changed.push({ table: b.table, recordId, column, from: prima, to: valore });
}

/**
 * Applica la decisione corrente di una proposta. Da chiamare nella transazione che l'ha scritta
 * (o da sola, per riapplicare): il risultato non dipende da quante volte si chiama.
 */
export async function applicaDecisione(
  db: DbConnector,
  tenantId: string,
  variantVersionId: string,
  p: ProposteDati,
  d: DecisioneCorrente,
): Promise<RapportoApplicazione> {
  const rapporto: RapportoApplicazione = { changed: [], created: [], reverted: 0, skipped: [] };
  const b = BERSAGLI[p.group];

  const proto = (await vociDelPrototipo(db, variantVersionId, p.group)).filter((v) => p.prototypeKeys.includes(v.key));

  const voluti: Array<{ recordId: string; column: string; value: string | null }> = [];
  if (d.decision === "CONFERMATA") {
    if (p.tenantKeys.length === 1 && proto.length === 1) {
      const t = p.tenantKeys[0]!;
      const v = proto[0]!;
      if (d.form === "NOME_PROTOTIPO") {
        if (v.code) {
          const { rows } = await db.query(
            `SELECT 1 FROM sys.${q(b.table)} WHERE ${q(b.tenant)} = $1 AND ${q(b.code)} = $2 AND ${q(b.id)} <> $3`,
            [tenantId, v.code, t],
          );
          if (rows.length > 0) rapporto.skipped.push(`Il codice ${v.code} è già di un'altra voce del tenant: ho tenuto il codice attuale.`);
          else voluti.push({ recordId: t, column: b.code, value: v.code });
        }
        voluti.push({ recordId: t, column: b.name, value: v.name });
      } else if (d.form !== "FORMA_TENANT" && b.description && v.description) {
        const { rows } = await db.query<{ v: string | null }>(
          `SELECT ${q(b.description)} AS v FROM sys.${q(b.table)} WHERE ${q(b.id)} = $1 AND ${q(b.tenant)} = $2`,
          [t, tenantId],
        );
        if (rows.length === 1 && (rows[0]!.v === null || rows[0]!.v.trim() === "")) {
          voluti.push({ recordId: t, column: b.description, value: v.description });
        }
      }
      // La cascata di un'unità (000490): sede, organico previsto e ragione dell'organico vengono dal modello
      // dove il tenant non li ha ancora; un valore che il tenant ha già è suo e non si tocca.
      if (p.group === "ORGANIZATION") {
        const { rows: m } = await db.query<{ site: string | null; kind: string | null; hc: string | null; note: string | null }>(
          `SELECT u.blueprint_content_unit_site_code AS site, s.blueprint_content_site_kind AS kind,
                  u.blueprint_content_unit_planned_headcount::text AS hc, u.blueprint_content_unit_headcount_note AS note
             FROM sys.sys_blueprint_content_units u
             LEFT JOIN sys.sys_blueprint_content_sites s
               ON s.blueprint_content_site_version_id = u.blueprint_content_unit_version_id
              AND s.blueprint_content_site_code = u.blueprint_content_unit_site_code
            WHERE u.blueprint_content_unit_version_id = $1 AND u.blueprint_content_unit_code = $2`,
          [variantVersionId, v.key],
        );
        const { rows: ora } = await db.query<{ site: string | null; kind: string | null; hc: string | null; note: string | null }>(
          `SELECT organization_unit_site_code AS site, organization_unit_site_kind AS kind,
                  organization_unit_planned_headcount::text AS hc, organization_unit_headcount_note AS note
             FROM sys.sys_organization_units WHERE organization_unit_id = $1 AND organization_unit_tenant_id = $2`,
          [t, tenantId],
        );
        const mm = m[0];
        const oo = ora[0];
        if (mm && oo) {
          const campi: Array<[keyof typeof mm, string]> = [
            ["site", "organization_unit_site_code"], ["kind", "organization_unit_site_kind"],
            ["hc", "organization_unit_planned_headcount"], ["note", "organization_unit_headcount_note"],
          ];
          for (const [k, col] of campi) if (mm[k] !== null && oo[k] === null) voluti.push({ recordId: t, column: col, value: mm[k] });
        }
      }
    } else {
      rapporto.skipped.push("L'abbinamento è fra più voci: ho registrato il collegamento senza cambiare i dati.");
    }
  } else if (d.decision === "ADOTTATA") {
    if (!b.creabile) {
      rapporto.skipped.push(p.group === "ORGANIZATION"
        ? "Un'unità adottata si crea scegliendo il padre e il responsabile: l'ho registrata come adottata, da materializzare."
        : "Una posizione adottata si crea scegliendo unità e ruolo del catalogo: l'ho registrata come adottata, da materializzare.");
    } else {
      for (const v of proto) {
        if (v.key.startsWith("GOAL:")) { rapporto.skipped.push(`Il modello di obiettivo ${v.code ?? v.key} non ha ancora una tabella del tenant: registrato come adottato.`); continue; }
        if (!v.code) continue;
        let escoDaScrivere: string | null = null;
        const { rows: esiste } = await db.query<{ id: string }>(
          `SELECT ${q(b.id)}::text AS id FROM sys.${q(b.table)} WHERE ${q(b.tenant)} = $1 AND ${q(b.code)} = $2`,
          [tenantId, v.code],
        );
        if (esiste.length > 0) continue; // già nel tenant: la riadozione non duplica
        if (p.group === "SKILLS") {
          // Una competenza del modello porta il suo URI ESCO: se il catalogo l'ha già, il tenant la usa da lì
          // (l'URI è unico); senza URI e senza una posizione che la richieda sarebbe residuo (v_skill_isolate_residue).
          const { rows: e } = await db.query<{ uri: string | null; id: string | null }>(
            `SELECT b.blueprint_content_skill_esco_uri AS uri, s.skill_id::text AS id
               FROM sys.sys_blueprint_content_skills b
               LEFT JOIN sys.sys_skills s ON s.skill_esco_uri = b.blueprint_content_skill_esco_uri
              WHERE b.blueprint_content_skill_version_id = $1 AND b.blueprint_content_skill_code = $2`,
            [variantVersionId, v.code],
          );
          const uri = e[0]?.uri ?? null;
          if (!uri) {
            rapporto.skipped.push(`La competenza ${v.code} non ha un URI ESCO e nessuna posizione la richiede: creata da sola resterebbe isolata. L'ho registrata come adottata.`);
            continue;
          }
          if (e[0]?.id) {
            rapporto.skipped.push(`La competenza ${v.code} è già nel catalogo (ESCO): il tenant la usa da lì, senza una copia.`);
            continue;
          }
          escoDaScrivere = uri;
        }
        await db.query(`SAVEPOINT cons_crea`);
        try {
          const cols = [b.tenant, b.code, b.name, ...(b.description ? [b.description] : []), ...(escoDaScrivere ? ["skill_esco_uri"] : [])];
          const vals: unknown[] = [tenantId, v.code, v.name, ...(b.description ? [v.description ?? null] : []), ...(escoDaScrivere ? [escoDaScrivere] : [])];
          const { rows } = await db.query<{ id: string }>(
            `INSERT INTO sys.${q(b.table)} (${cols.map(q).join(", ")})
             VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING ${q(b.id)}::text AS id`,
            vals,
          );
          await db.query(`RELEASE SAVEPOINT cons_crea`);
          await giornale(db, tenantId, p.proposalId, d.decisionId, { kind: "INSERT", table: b.table, recordId: rows[0]!.id, after: v.code });
          rapporto.created.push({ table: b.table, recordId: rows[0]!.id, code: v.code, name: v.name });
        } catch (e) {
          await db.query(`ROLLBACK TO SAVEPOINT cons_crea`);
          rapporto.skipped.push(`Non ho potuto creare ${v.code}: ${(e as Error).message.slice(0, 120)}`);
        }
      }
    }
  }
  // RIFIUTATA, NON_ADOTTATA, PERSONALIZZAZIONE: nessun dato; il collegamento porta la scelta.

  await ritira(db, tenantId, p.proposalId, d.decisionId, voluti, rapporto);
  for (const v of voluti) await scrivi(db, tenantId, p, d.decisionId, b, v.recordId, v.column, v.value, rapporto);

  await db.query(
    `INSERT INTO sys.sys_tenant_consolidation_links
       (tenant_consolidation_link_tenant_id, tenant_consolidation_link_proposal_id, tenant_consolidation_link_decision_id,
        tenant_consolidation_link_group, tenant_consolidation_link_decision, tenant_consolidation_link_form,
        tenant_consolidation_link_adr48_state, tenant_consolidation_link_tenant_keys, tenant_consolidation_link_prototype_keys,
        tenant_consolidation_link_report)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (tenant_consolidation_link_proposal_id) DO UPDATE SET
       tenant_consolidation_link_decision_id = EXCLUDED.tenant_consolidation_link_decision_id,
       tenant_consolidation_link_decision = EXCLUDED.tenant_consolidation_link_decision,
       tenant_consolidation_link_form = EXCLUDED.tenant_consolidation_link_form,
       tenant_consolidation_link_adr48_state = EXCLUDED.tenant_consolidation_link_adr48_state,
       tenant_consolidation_link_tenant_keys = EXCLUDED.tenant_consolidation_link_tenant_keys,
       tenant_consolidation_link_prototype_keys = EXCLUDED.tenant_consolidation_link_prototype_keys,
       tenant_consolidation_link_report = EXCLUDED.tenant_consolidation_link_report,
       tenant_consolidation_link_applied_at = now()`,
    [tenantId, p.proposalId, d.decisionId, p.group, d.decision, d.form, d.adr48State, p.tenantKeys, p.prototypeKeys, JSON.stringify(rapporto)],
  );
  return rapporto;
}
