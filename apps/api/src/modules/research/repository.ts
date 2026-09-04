/**
 * apps/api/src/modules/research/repository.ts
 *
 * La contabilita' della ricerca, sulle cinque tabelle che esistevano gia' (#132 F4g).
 *
 * ⚠ SI CONVIVE, NON CI SI APPROPRIA. Le 12 corse di `STORIA36` vivono in queste stesse
 * tabelle: ogni lettura di questo file filtra per **versione di fascicolo** o per **dominio**,
 * mai «tutte le corse». Una query senza filtro qui dentro restituirebbe la storia dei 36 mesi
 * di RTL travestita da ricerca.
 */
import type { Pool, PoolClient } from "pg";
import type { ContestoRicerca } from "./domain.js";
import type { FonteRegistrata } from "./sources.js";

export type DbConnector = Pool | PoolClient;

/** L'identificativo di una versione, dal fascicolo e dal numero che l'utente vede. */
export async function versioneDaNumero(
  q: DbConnector,
  blueprintId: string,
  numero: number,
): Promise<string | null> {
  const res = await q.query<{ id: string }>(
    `SELECT tenant_blueprint_version_id AS id FROM sys.sys_tenant_blueprint_versions
      WHERE tenant_blueprint_version_blueprint_id = $1 AND tenant_blueprint_version_number = $2`,
    [blueprintId, numero],
  );
  return res.rows[0]?.id ?? null;
}

/** Il contesto di categoria, risolto dai sei parametri della versione di fascicolo. */
export async function contestoDaVersione(
  q: DbConnector,
  versionId: string,
): Promise<{ contesto: ContestoRicerca | null; mancanti: string[] }> {
  const res = await q.query<{
    ateco_code: string | null;
    ateco_label: string | null;
    size_band_code: string | null;
    employee_count: number | null;
    country_code: string | null;
    regulatory_intensity: string | null;
    operating_model_code: string | null;
  }>(
    `SELECT ac.activity_classification_code           AS ateco_code,
            ac.activity_classification_name           AS ateco_label,
            sb.enterprise_size_band_code              AS size_band_code,
            v.tenant_blueprint_version_employee_count AS employee_count,
            v.tenant_blueprint_version_country_code   AS country_code,
            v.tenant_blueprint_version_regulatory_intensity AS regulatory_intensity,
            om.operating_model_code                   AS operating_model_code
       FROM sys.sys_tenant_blueprint_versions v
       LEFT JOIN sys.sys_activity_classifications ac
              ON ac.activity_classification_id = v.tenant_blueprint_version_industry_class_id
       LEFT JOIN sys.sys_enterprise_size_bands sb
              ON sb.enterprise_size_band_id = v.tenant_blueprint_version_size_band_id
       LEFT JOIN sys.sys_operating_model_catalog om
              ON om.operating_model_id = v.tenant_blueprint_version_operating_model_id
      WHERE v.tenant_blueprint_version_id = $1`,
    [versionId],
  );
  const r = res.rows[0];
  if (!r) return { contesto: null, mancanti: ["versione"] };

  const mancanti: string[] = [];
  if (!r.ateco_code) mancanti.push("settore di attivita' (ATECO)");
  if (!r.size_band_code) mancanti.push("fascia dimensionale");
  if (r.employee_count === null || r.employee_count < 1) mancanti.push("numero di addetti");
  if (!r.country_code) mancanti.push("paese");
  if (!r.regulatory_intensity) mancanti.push("intensita' di vigilanza");
  if (!r.operating_model_code) mancanti.push("modello operativo");
  if (mancanti.length > 0) return { contesto: null, mancanti };

  return {
    contesto: {
      atecoCode: r.ateco_code!,
      atecoLabel: r.ateco_label ?? r.ateco_code!,
      sizeBandCode: r.size_band_code!,
      employeeCount: r.employee_count!,
      countryCode: r.country_code!.trim(),
      regulatoryIntensity: r.regulatory_intensity!,
      operatingModelCode: r.operating_model_code!,
    },
    mancanti: [],
  };
}

/** Chi identifica il cliente di questa versione: serve alla guardia di §4.5. */
export async function identitaClienteDaVersione(
  q: DbConnector,
  versionId: string,
): Promise<{ nomeTenant: string | null; codiceTenant: string | null; codiceFascicolo: string | null }> {
  const res = await q.query<{ nome: string | null; codice: string | null; fascicolo: string | null }>(
    `SELECT t.tenant_name AS nome, t.tenant_code AS codice, b.tenant_blueprint_code AS fascicolo
       FROM sys.sys_tenant_blueprint_versions v
       JOIN sys.sys_tenant_blueprints b ON b.tenant_blueprint_id = v.tenant_blueprint_version_blueprint_id
       LEFT JOIN sys.sys_tenancies t ON t.tenant_id = b.tenant_blueprint_tenant_id
      WHERE v.tenant_blueprint_version_id = $1`,
    [versionId],
  );
  const r = res.rows[0];
  return { nomeTenant: r?.nome ?? null, codiceTenant: r?.codice ?? null, codiceFascicolo: r?.fascicolo ?? null };
}

/**
 * Il VOCABOLARIO DI DOMINIO: le parole che **classificano** un'azienda invece di
 * identificarla (#239). Serve alla guardia di §4.5 per non confondere le due cose.
 *
 * Nasce da un caso vero: un fascicolo chiamato «societa' di consulenza (ATECO 70.20)»
 * rendeva riservata la parola «consulenza», e la domanda che il motore genera da se' —
 * «Quali processi aziendali governa di norma un'impresa italiana del settore ATECO …» —
 * la contiene. La corsa non partiva. Non e' un caso di laboratorio: colpisce qualunque
 * azienda che porti nel nome la parola del proprio settore, che nel mondo reale sono
 * tantissime.
 *
 * ⚠ Si legge dalle DUE TABELLE che dichiarano la tassonomia, non da un elenco scritto a
 * mano: un elenco a mano invecchia in silenzio appena qualcuno aggiunge un settore, e
 * questa e' precisamente la classe di dato che il progetto ordina di misurare invece che
 * cristallizzare. Misurato il 2026-09-03: 12 settori + 6 modelli operativi -> 33 parole.
 */
export async function vocabolarioDiDominio(q: DbConnector): Promise<string[]> {
  const res = await q.query<{ parola: string }>(
    `SELECT DISTINCT lower(p) AS parola
       FROM (
         SELECT unnest(regexp_split_to_array(industry_name, '[^[:alnum:]]+')) AS p
           FROM sys.sys_industry_codes
         UNION ALL
         SELECT unnest(regexp_split_to_array(operating_model_name, '[^[:alnum:]]+'))
           FROM sys.sys_operating_model_catalog
       ) x
      WHERE length(p) >= 3`,
  );
  return res.rows.map((r) => r.parola);
}

/** Il tenant del fascicolo, se gia' firmato. `null` per una trattativa. */
export async function tenantDelFascicolo(q: DbConnector, versionId: string): Promise<string | null> {
  const res = await q.query<{ tenant_id: string | null }>(
    `SELECT b.tenant_blueprint_tenant_id AS tenant_id
       FROM sys.sys_tenant_blueprint_versions v
       JOIN sys.sys_tenant_blueprints b ON b.tenant_blueprint_id = v.tenant_blueprint_version_blueprint_id
      WHERE v.tenant_blueprint_version_id = $1`,
    [versionId],
  );
  return res.rows[0]?.tenant_id ?? null;
}

/** Le fonti che questo dominio puo' leggere: approvate, e valide per lui o per tutti. */
export async function registroFonti(q: DbConnector, dominio: string): Promise<FonteRegistrata[]> {
  const res = await q.query<{
    research_source_host_suffix: string;
    research_source_label: string;
    research_source_class: string;
    research_source_status: string;
    research_source_domain: string | null;
  }>(
    `SELECT research_source_host_suffix, research_source_label, research_source_class,
            research_source_status, research_source_domain
       FROM sys.sys_research_sources
      WHERE research_source_domain IS NULL OR research_source_domain = $1`,
    [dominio],
  );
  return res.rows.map((r) => ({
    hostSuffix: r.research_source_host_suffix,
    label: r.research_source_label,
    classe: r.research_source_class as FonteRegistrata["classe"],
    stato: r.research_source_status as FonteRegistrata["stato"],
    dominio: r.research_source_domain,
  }));
}

/**
 * Quante fonti APPROVATE sono utilizzabili da questo dominio.
 *
 * Serve al cancello del servizio: un dominio che confronta col registro e non ha nemmeno una
 * fonte approvata **non e' ricercabile**, e dirlo prima di avviare la corsa vale piu' che
 * lasciar respingere ogni proposta una per una — l'esito sarebbe lo stesso, ma il motivo si
 * leggerebbe solo aprendo dieci schede di validazione.
 */
export async function contaFontiApprovate(q: DbConnector, dominio: string): Promise<number> {
  const res = await q.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM sys.sys_research_sources
      WHERE research_source_status = 'APPROVED'
        AND research_source_class IN ('INSTITUTIONAL','ACCREDITED','TOP_CONSULTING')
        AND (research_source_domain IS NULL OR research_source_domain = $1)`,
    [dominio],
  );
  return Number(res.rows[0]?.n ?? 0);
}

/**
 * Le chiavi naturali gia' proposte per questa versione e questo dominio — comprese quelle
 * delle corse precedenti, perche' una seconda corsa non deve riscrivere cio' che c'e'.
 */
export async function chiaviGiaPresenti(
  q: DbConnector,
  versionId: string,
  dominio: string,
): Promise<Set<string>> {
  const res = await q.query<{ chiave: string }>(
    `SELECT c.seed_candidate_record_natural_key AS chiave
       FROM sys.sys_seed_candidate_records c
       JOIN sys.sys_seed_acquisition_runs r ON r.seed_acquisition_run_id = c.seed_candidate_record_run_id
      WHERE r.seed_acquisition_run_blueprint_version_id = $1
        AND c.seed_candidate_record_domain = $2`,
    [versionId, dominio],
  );
  return new Set(res.rows.map((r) => r.chiave));
}

export async function creaCorsa(
  q: DbConnector,
  input: {
    versionId: string;
    tenantId: string | null;
    code: string;
    domande: string[];
    perimetro: unknown[];
    metadata: Record<string, unknown>;
    createdBy: string;
  },
): Promise<string> {
  const res = await q.query<{ seed_acquisition_run_id: string }>(
    `INSERT INTO sys.sys_seed_acquisition_runs (
       seed_acquisition_run_tenant_id, seed_acquisition_run_blueprint_version_id,
       seed_acquisition_run_code, seed_acquisition_run_prompt_template,
       seed_acquisition_run_source_registry_payload, seed_acquisition_run_status,
       seed_acquisition_run_metadata, created_by
     ) VALUES ($1, $2, $3, $4, $5::jsonb, 'RUNNING', $6::jsonb, $7)
     RETURNING seed_acquisition_run_id`,
    [
      input.tenantId,
      input.versionId,
      input.code,
      input.domande.join("\n"),
      JSON.stringify(input.perimetro),
      JSON.stringify(input.metadata),
      input.createdBy,
    ],
  );
  return res.rows[0]!.seed_acquisition_run_id;
}

/** Quante corse esistono gia' per questa versione e questo dominio: serve al codice. */
export async function contaCorse(q: DbConnector, versionId: string, dominio: string): Promise<number> {
  const res = await q.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM sys.sys_seed_acquisition_runs
      WHERE seed_acquisition_run_blueprint_version_id = $1
        AND seed_acquisition_run_metadata->>'dominio' = $2`,
    [versionId, dominio],
  );
  return Number(res.rows[0]?.n ?? 0);
}

export async function scriviProposta(
  q: DbConnector,
  input: {
    runId: string;
    tenantId: string | null;
    dominio: string;
    chiaveNaturale: string;
    contenuto: unknown;
    stato: string;
    metadata: Record<string, unknown>;
  },
): Promise<string> {
  const res = await q.query<{ seed_candidate_record_id: string }>(
    `INSERT INTO sys.sys_seed_candidate_records (
       seed_candidate_record_run_id, seed_candidate_record_tenant_id,
       seed_candidate_record_domain, seed_candidate_record_natural_key,
       seed_candidate_record_payload, seed_candidate_record_validation_status,
       seed_candidate_record_metadata
     ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb)
     RETURNING seed_candidate_record_id`,
    [
      input.runId,
      input.tenantId,
      input.dominio,
      input.chiaveNaturale,
      JSON.stringify(input.contenuto),
      input.stato,
      JSON.stringify(input.metadata),
    ],
  );
  return res.rows[0]!.seed_candidate_record_id;
}

export async function scriviEvidenze(
  q: DbConnector,
  candidateId: string,
  evidenze: ReadonlyArray<{ url: string; retrievedAt: string; sha256: string; byte: number }>,
): Promise<void> {
  for (const e of evidenze) {
    await q.query(
      `INSERT INTO sys.sys_seed_source_evidence (
         seed_source_evidence_candidate_id, seed_source_evidence_url,
         seed_source_evidence_retrieved_at, seed_source_evidence_content_hash,
         seed_source_evidence_payload
       ) VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [candidateId, e.url, e.retrievedAt, e.sha256, JSON.stringify({ byte: e.byte })],
    );
  }
}

export async function scriviValidazioni(
  q: DbConnector,
  candidateId: string,
  controlli: ReadonlyArray<{ regola: string; esito: string; messaggio?: string }>,
): Promise<void> {
  for (const c of controlli) {
    await q.query(
      `INSERT INTO sys.sys_seed_validation_results (
         seed_validation_result_candidate_id, seed_validation_result_rule_code,
         seed_validation_result_status, seed_validation_result_message
       ) VALUES ($1, $2, $3, $4)`,
      [candidateId, c.regola, c.esito, c.messaggio ?? null],
    );
  }
}

export async function chiudiCorsa(
  q: DbConnector,
  runId: string,
  stato: "COMPLETED" | "FAILED",
  metadata: Record<string, unknown>,
): Promise<void> {
  await q.query(
    `UPDATE sys.sys_seed_acquisition_runs
        SET seed_acquisition_run_status = $2,
            seed_acquisition_run_finished_at = now(),
            seed_acquisition_run_metadata = seed_acquisition_run_metadata || $3::jsonb,
            updated_at = now()
      WHERE seed_acquisition_run_id = $1`,
    [runId, stato, JSON.stringify(metadata)],
  );
}

export interface RigaCorsa {
  runId: string;
  code: string;
  stato: "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  domande: string[];
  metadata: Record<string, unknown>;
  versionId: string | null;
  iniziataIl: string;
  finitaIl: string | null;
}

export async function corsaPerId(q: DbConnector, runId: string): Promise<RigaCorsa | null> {
  const res = await q.query<{
    seed_acquisition_run_id: string;
    seed_acquisition_run_code: string;
    seed_acquisition_run_status: RigaCorsa["stato"];
    seed_acquisition_run_prompt_template: string | null;
    seed_acquisition_run_metadata: Record<string, unknown>;
    seed_acquisition_run_blueprint_version_id: string | null;
    seed_acquisition_run_started_at: Date;
    seed_acquisition_run_finished_at: Date | null;
  }>(
    `SELECT seed_acquisition_run_id, seed_acquisition_run_code, seed_acquisition_run_status,
            seed_acquisition_run_prompt_template, seed_acquisition_run_metadata,
            seed_acquisition_run_blueprint_version_id, seed_acquisition_run_started_at,
            seed_acquisition_run_finished_at
       FROM sys.sys_seed_acquisition_runs WHERE seed_acquisition_run_id = $1`,
    [runId],
  );
  const r = res.rows[0];
  if (!r) return null;
  return {
    runId: r.seed_acquisition_run_id,
    code: r.seed_acquisition_run_code,
    stato: r.seed_acquisition_run_status,
    domande: (r.seed_acquisition_run_prompt_template ?? "").split("\n").filter((s) => s.length > 0),
    metadata: r.seed_acquisition_run_metadata,
    versionId: r.seed_acquisition_run_blueprint_version_id,
    iniziataIl: r.seed_acquisition_run_started_at.toISOString(),
    finitaIl: r.seed_acquisition_run_finished_at?.toISOString() ?? null,
  };
}

export interface RigaProposta {
  candidateId: string;
  dominio: string;
  chiaveNaturale: string;
  contenuto: unknown;
  stato: string;
  controlli: Array<{ regola: string; esito: string; messaggio: string | null }>;
  evidenze: Array<{ url: string; retrievedAt: string; sha256: string | null }>;
  decisione: {
    stato: string;
    motivazione: string | null;
    decisaIl: string;
    approvatoreUserId: string | null;
  } | null;
}

/** Le proposte di UNA corsa, con i controlli, le fonti e la decisione se c'e'. */
export async function propostePerCorsa(q: DbConnector, runId: string): Promise<RigaProposta[]> {
  const res = await q.query<{
    id: string; dominio: string; chiave: string; payload: unknown; stato: string;
    controlli: Array<{ regola: string; esito: string; messaggio: string | null }> | null;
    evidenze: Array<{ url: string; retrievedAt: string; sha256: string | null }> | null;
    dec_stato: string | null; dec_motivazione: string | null;
    dec_quando: Date | null; dec_chi: string | null;
  }>(
    `SELECT c.seed_candidate_record_id                AS id,
            c.seed_candidate_record_domain            AS dominio,
            c.seed_candidate_record_natural_key       AS chiave,
            c.seed_candidate_record_payload           AS payload,
            c.seed_candidate_record_validation_status AS stato,
            (SELECT json_agg(json_build_object(
                       'regola',  v.seed_validation_result_rule_code,
                       'esito',   v.seed_validation_result_status,
                       'messaggio', v.seed_validation_result_message)
                     ORDER BY v.created_at)
               FROM sys.sys_seed_validation_results v
              WHERE v.seed_validation_result_candidate_id = c.seed_candidate_record_id) AS controlli,
            (SELECT json_agg(json_build_object(
                       'url',         e.seed_source_evidence_url,
                       'retrievedAt', e.seed_source_evidence_retrieved_at,
                       'sha256',      e.seed_source_evidence_content_hash)
                     ORDER BY e.created_at)
               FROM sys.sys_seed_source_evidence e
              WHERE e.seed_source_evidence_candidate_id = c.seed_candidate_record_id) AS evidenze,
            d.seed_approval_decision_status      AS dec_stato,
            d.seed_approval_decision_rationale   AS dec_motivazione,
            d.seed_approval_decision_decided_at  AS dec_quando,
            d.seed_approval_decision_approver_user_id AS dec_chi
       FROM sys.sys_seed_candidate_records c
       LEFT JOIN LATERAL (
              SELECT * FROM sys.sys_seed_approval_decisions d2
               WHERE d2.seed_approval_decision_candidate_id = c.seed_candidate_record_id
               ORDER BY d2.seed_approval_decision_decided_at DESC LIMIT 1
            ) d ON true
      WHERE c.seed_candidate_record_run_id = $1
      ORDER BY c.created_at`,
    [runId],
  );

  return res.rows.map((r) => ({
    candidateId: r.id,
    dominio: r.dominio,
    chiaveNaturale: r.chiave,
    contenuto: r.payload,
    stato: r.stato,
    controlli: r.controlli ?? [],
    evidenze: (r.evidenze ?? []).map((e) => ({
      url: e.url,
      retrievedAt: typeof e.retrievedAt === "string" ? e.retrievedAt : new Date(e.retrievedAt).toISOString(),
      sha256: e.sha256,
    })),
    decisione: r.dec_stato
      ? {
          stato: r.dec_stato,
          motivazione: r.dec_motivazione,
          decisaIl: (r.dec_quando ?? new Date()).toISOString(),
          approvatoreUserId: r.dec_chi,
        }
      : null,
  }));
}

export async function propostaPerId(
  q: DbConnector,
  candidateId: string,
): Promise<{ candidateId: string; runId: string; dominio: string; stato: string } | null> {
  const res = await q.query<{ id: string; run: string; dominio: string; stato: string }>(
    `SELECT seed_candidate_record_id AS id, seed_candidate_record_run_id AS run,
            seed_candidate_record_domain AS dominio, seed_candidate_record_validation_status AS stato
       FROM sys.sys_seed_candidate_records WHERE seed_candidate_record_id = $1`,
    [candidateId],
  );
  const r = res.rows[0];
  return r ? { candidateId: r.id, runId: r.run, dominio: r.dominio, stato: r.stato } : null;
}

/** La decisione umana: la riga nel registro, **e** lo stato della proposta. */
export async function registraDecisione(
  q: DbConnector,
  input: { candidateId: string; decisione: "APPROVED" | "REJECTED"; motivazione: string; approverId: string },
): Promise<void> {
  await q.query(
    `INSERT INTO sys.sys_seed_approval_decisions (
       seed_approval_decision_candidate_id, seed_approval_decision_approver_user_id,
       seed_approval_decision_status, seed_approval_decision_rationale
     ) VALUES ($1, $2, $3, $4)`,
    [input.candidateId, input.approverId, input.decisione, input.motivazione],
  );
  await q.query(
    `UPDATE sys.sys_seed_candidate_records
        SET seed_candidate_record_validation_status = $2, updated_at = now()
      WHERE seed_candidate_record_id = $1`,
    [input.candidateId, input.decisione],
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// IL PONTE (#132 F6) — leggere le proposte approvate, leggere i cataloghi VERI,
// scrivere il contenuto della versione di variante.
// ═══════════════════════════════════════════════════════════════════════════════

/** Le proposte APPROVATE di una versione di fascicolo, pronte per il ponte. */
export async function propostePerApplicazione(
  q: DbConnector,
  versionId: string,
): Promise<
  Array<{
    candidateId: string;
    dominio: string;
    chiaveNaturale: string;
    contenuto: unknown;
    approvatoreUserId: string | null;
    motivazione: string | null;
  }>
> {
  // La decisione viene con la proposta: chi ha approvato e perche' non sono un di piu' —
  // il registro delle fonti li pretende per vincolo, e prenderli da altrove sarebbe inventarli.
  const res = await q.query<{
    id: string; dominio: string; chiave: string; payload: unknown;
    chi: string | null; perche: string | null;
  }>(
    `SELECT c.seed_candidate_record_id AS id, c.seed_candidate_record_domain AS dominio,
            c.seed_candidate_record_natural_key AS chiave, c.seed_candidate_record_payload AS payload,
            d.seed_approval_decision_approver_user_id AS chi,
            d.seed_approval_decision_rationale AS perche
       FROM sys.sys_seed_candidate_records c
       JOIN sys.sys_seed_acquisition_runs r ON r.seed_acquisition_run_id = c.seed_candidate_record_run_id
       LEFT JOIN LATERAL (
              SELECT * FROM sys.sys_seed_approval_decisions d2
               WHERE d2.seed_approval_decision_candidate_id = c.seed_candidate_record_id
                 AND d2.seed_approval_decision_status = 'APPROVED'
               ORDER BY d2.seed_approval_decision_decided_at DESC LIMIT 1
            ) d ON true
      WHERE r.seed_acquisition_run_blueprint_version_id = $1
        AND c.seed_candidate_record_validation_status = 'APPROVED'
      ORDER BY c.created_at`,
    [versionId],
  );
  return res.rows.map((x) => ({
    candidateId: x.id, dominio: x.dominio, chiaveNaturale: x.chiave, contenuto: x.payload,
    approvatoreUserId: x.chi, motivazione: x.perche,
  }));
}

/**
 * Le fonti approvate entrano nel registro (§4.3).
 *
 * `ON CONFLICT DO UPDATE` sulla chiave naturale del registro: una fonte gia' presente si
 * aggiorna invece di duplicarsi — e' lo stesso criterio della chiave naturale della proposta,
 * e le due devono restare d'accordo o una seconda corsa scriverebbe un doppione.
 */
export async function scriviFontiApprovate(
  q: DbConnector,
  fonti: ReadonlyArray<{
    hostSuffix: string; label: string; classe: string; paese: string | null;
    dominio: string | null; motivazione: string; approvatoreUserId: string | null;
  }>,
): Promise<number> {
  let scritte = 0;
  for (const f of fonti) {
    const res = await q.query(
      `INSERT INTO sys.sys_research_sources (
         research_source_host_suffix, research_source_label, research_source_class,
         research_source_status, research_source_domain, research_source_country_code,
         research_source_rationale, research_source_approved_by, research_source_approved_at)
       VALUES ($1,$2,$3,'APPROVED',$4,$5,$6,$7, now())
       ON CONFLICT (research_source_host_suffix, coalesce(research_source_domain, '*')) DO UPDATE
          SET research_source_label = EXCLUDED.research_source_label,
              research_source_class = EXCLUDED.research_source_class,
              research_source_status = 'APPROVED',
              research_source_country_code = EXCLUDED.research_source_country_code,
              research_source_rationale = EXCLUDED.research_source_rationale,
              research_source_approved_by = EXCLUDED.research_source_approved_by,
              research_source_approved_at = now(),
              updated_at = now()`,
      [f.hostSuffix, f.label, f.classe, f.dominio, f.paese, f.motivazione, f.approvatoreUserId],
    );
    scritte += res.rowCount ?? 0;
  }
  return scritte;
}

/**
 * I vocabolari veri, letti adesso.
 *
 * ⚠ NON si ricopiano in codice. Il tipo di unita' e' una **tabella**; la specie di competenza
 * e il verso di indicatore sono **vincoli** del database. Un elenco scritto a mano da qualche
 * parte sarebbe vero il giorno in cui lo si scrive e falso poco dopo (⭐ IL PUNTO FISSO).
 */
export async function cataloghiVeri(q: DbConnector): Promise<{
  tipiUnita: Set<string>;
  specieCompetenza: Set<string>;
  versiIndicatore: Set<string>;
}> {
  const tipi = await q.query<{ c: string }>(
    `SELECT organization_unit_type_code AS c FROM sys.sys_organization_unit_types`,
  );
  const daCheck = async (nome: string): Promise<Set<string>> => {
    const r = await q.query<{ d: string }>(
      `SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conname = $1`,
      [nome],
    );
    const def = r.rows[0]?.d ?? "";
    // I valori ammessi stanno fra apici dentro l'ARRAY del CHECK: si leggono da li', perche'
    // quello e' il vincolo che il database applica davvero.
    return new Set([...def.matchAll(/'([A-Z_]+)'::character varying/g)].map((m) => m[1] as string));
  };
  return {
    tipiUnita: new Set(tipi.rows.map((r) => r.c)),
    specieCompetenza: await daCheck("sys_skills_skill_kind_check"),
    versiIndicatore: await daCheck("sys_blueprint_content_kpis_verso_ck"),
  };
}

/** Il contenuto di una versione di variante: si scrive, e una chiave gia' presente si aggiorna. */
export async function sostituisciContenuto(
  q: DbConnector,
  versionVarianteId: string,
  c: {
    units: ReadonlyArray<{ code: string; name: string; nameEn: string; parentCode: string | null; unitType: string; level: number }>;
    positions: ReadonlyArray<{ code: string; title: string; titleEn: string; unitCode: string; criticality: string }>;
    skills: ReadonlyArray<{ code: string; name: string; nameEn: string; kind: string; category: string | null }>;
    kpis: ReadonlyArray<{ code: string; name: string; nameEn: string; unit: string | null; direction: string }>;
    processes: ReadonlyArray<{ code: string; name: string; nameEn: string; ordinal: number; ownerPositionCode: string | null; isOptional: boolean }>;
  },
): Promise<void> {
  for (const u of c.units) {
    await q.query(
      `INSERT INTO sys.sys_blueprint_content_units (
         blueprint_content_unit_version_id, blueprint_content_unit_code, blueprint_content_unit_name,
         blueprint_content_unit_name_en, blueprint_content_unit_parent_code, blueprint_content_unit_type,
         blueprint_content_unit_level)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (blueprint_content_unit_version_id, blueprint_content_unit_code) DO UPDATE
          SET blueprint_content_unit_name = EXCLUDED.blueprint_content_unit_name,
              blueprint_content_unit_name_en = EXCLUDED.blueprint_content_unit_name_en,
              blueprint_content_unit_parent_code = EXCLUDED.blueprint_content_unit_parent_code,
              blueprint_content_unit_type = EXCLUDED.blueprint_content_unit_type,
              blueprint_content_unit_level = EXCLUDED.blueprint_content_unit_level,
              updated_at = now()`,
      [versionVarianteId, u.code, u.name, u.nameEn, u.parentCode, u.unitType, u.level],
    );
  }
  for (const p of c.positions) {
    await q.query(
      `INSERT INTO sys.sys_blueprint_content_positions (
         blueprint_content_position_version_id, blueprint_content_position_code,
         blueprint_content_position_title, blueprint_content_position_title_en,
         blueprint_content_position_unit_code, blueprint_content_position_criticality)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (blueprint_content_position_version_id, blueprint_content_position_code) DO UPDATE
          SET blueprint_content_position_title = EXCLUDED.blueprint_content_position_title,
              blueprint_content_position_title_en = EXCLUDED.blueprint_content_position_title_en,
              blueprint_content_position_unit_code = EXCLUDED.blueprint_content_position_unit_code,
              blueprint_content_position_criticality = EXCLUDED.blueprint_content_position_criticality,
              updated_at = now()`,
      [versionVarianteId, p.code, p.title, p.titleEn, p.unitCode, p.criticality],
    );
  }
  for (const s of c.skills) {
    await q.query(
      `INSERT INTO sys.sys_blueprint_content_skills (
         blueprint_content_skill_version_id, blueprint_content_skill_code, blueprint_content_skill_name,
         blueprint_content_skill_name_en, blueprint_content_skill_kind, blueprint_content_skill_category)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (blueprint_content_skill_version_id, blueprint_content_skill_code) DO UPDATE
          SET blueprint_content_skill_name = EXCLUDED.blueprint_content_skill_name,
              blueprint_content_skill_name_en = EXCLUDED.blueprint_content_skill_name_en,
              blueprint_content_skill_kind = EXCLUDED.blueprint_content_skill_kind,
              blueprint_content_skill_category = EXCLUDED.blueprint_content_skill_category,
              updated_at = now()`,
      [versionVarianteId, s.code, s.name, s.nameEn, s.kind, s.category],
    );
  }
  for (const k of c.kpis) {
    await q.query(
      `INSERT INTO sys.sys_blueprint_content_kpis (
         blueprint_content_kpi_version_id, blueprint_content_kpi_code, blueprint_content_kpi_name,
         blueprint_content_kpi_name_en, blueprint_content_kpi_unit, blueprint_content_kpi_direction)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (blueprint_content_kpi_version_id, blueprint_content_kpi_code) DO UPDATE
          SET blueprint_content_kpi_name = EXCLUDED.blueprint_content_kpi_name,
              blueprint_content_kpi_name_en = EXCLUDED.blueprint_content_kpi_name_en,
              blueprint_content_kpi_unit = EXCLUDED.blueprint_content_kpi_unit,
              blueprint_content_kpi_direction = EXCLUDED.blueprint_content_kpi_direction,
              updated_at = now()`,
      [versionVarianteId, k.code, k.name, k.nameEn, k.unit, k.direction],
    );
  }
  // I processi vanno nella loro casa, che e' quella vecchia (#132 F5, mig. 000335): non in una
  // tabella di contenuto, perche' le decisioni del fascicolo puntano li'.
  for (const pr of c.processes) {
    await q.query(
      `INSERT INTO sys.sys_blueprint_process_registry (
         blueprint_process_variant_version_id, blueprint_process_variant_id, blueprint_process_code,
         blueprint_process_name, blueprint_process_name_en, blueprint_process_ordinal,
         blueprint_process_owner_position_code, blueprint_process_is_optional)
       SELECT $1, vv.blueprint_variant_version_variant_id, $2, $3, $4, $5, $6, $7
         FROM sys.sys_blueprint_variant_versions vv
        WHERE vv.blueprint_variant_version_id = $1
       ON CONFLICT DO NOTHING`,
      [versionVarianteId, pr.code, pr.name, pr.nameEn, pr.ordinal, pr.ownerPositionCode, pr.isOptional],
    );
  }
}

/** Le proposte tradotte diventano APPLIED: e' l'ultimo stato del ciclo di §4.7. */
export async function marcaApplicate(q: DbConnector, candidateIds: readonly string[]): Promise<number> {
  if (candidateIds.length === 0) return 0;
  const res = await q.query(
    `UPDATE sys.sys_seed_candidate_records
        SET seed_candidate_record_validation_status = 'APPLIED', updated_at = now()
      WHERE seed_candidate_record_id = ANY($1::uuid[])
        AND seed_candidate_record_validation_status = 'APPROVED'`,
    [candidateIds],
  );
  return res.rowCount ?? 0;
}

/** La versione di variante ancorata al fascicolo, se c'e'. */
export async function varianteAncorata(q: DbConnector, versionId: string): Promise<string | null> {
  const res = await q.query<{ v: string | null }>(
    `SELECT tenant_blueprint_version_variant_version_id AS v
       FROM sys.sys_tenant_blueprint_versions WHERE tenant_blueprint_version_id = $1`,
    [versionId],
  );
  return res.rows[0]?.v ?? null;
}

/** Quante righe di contenuto ha gia' una versione di variante, per dominio. */
export async function contenutoEsistente(q: DbConnector, versionVarianteId: string): Promise<{
  units: number; positions: number; skills: number; kpis: number; processes: number;
}> {
  const r = await q.query<{ u: string; p: string; s: string; k: string; pr: string }>(
    `SELECT (SELECT count(*) FROM sys.sys_blueprint_content_units WHERE blueprint_content_unit_version_id = $1)::text AS u,
            (SELECT count(*) FROM sys.sys_blueprint_content_positions WHERE blueprint_content_position_version_id = $1)::text AS p,
            (SELECT count(*) FROM sys.sys_blueprint_content_skills WHERE blueprint_content_skill_version_id = $1)::text AS s,
            (SELECT count(*) FROM sys.sys_blueprint_content_kpis WHERE blueprint_content_kpi_version_id = $1)::text AS k,
            (SELECT count(*) FROM sys.sys_blueprint_process_registry WHERE blueprint_process_variant_version_id = $1)::text AS pr`,
    [versionVarianteId],
  );
  const x = r.rows[0] as { u: string; p: string; s: string; k: string; pr: string };
  return { units: +x.u, positions: +x.p, skills: +x.s, kpis: +x.k, processes: +x.pr };
}
