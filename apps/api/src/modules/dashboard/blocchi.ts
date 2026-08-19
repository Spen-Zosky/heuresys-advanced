/**
 * apps/api/src/modules/dashboard/blocchi.ts — #142 F3b: i dati dentro le viste.
 *
 * F2 ha modellato le otto famiglie e le loro 27 viste; F3a ha consegnato il catalogo, dove
 * ogni vista esce già con la propria **modalità** (`open` / `masked` / `denied`). Qui la
 * granularità smette di essere un modello e diventa una query: ogni vista `open` porta il
 * proprio contenuto reale, letto dal database di produzione.
 *
 * COSA NON FA QUESTO FILE, e va detto perché è il difetto che F3a ha già pagato una volta:
 * **non decide chi vede cosa**. La modalità è già decisa da `modalitaDellaVista` (matrix.ts),
 * unica fonte, e il service riempie SOLO le viste `open`. Un fornitore qui dentro non
 * conosce M1, non conosce i domini e non deve conoscerli: se lo facesse, ci sarebbero due
 * posti dove si decide una mascheratura, e il giorno in cui divergono vince quello sbagliato.
 *
 * IL PERIMETRO — un solo oggetto, tre casi, nessuna eccezione sparsa:
 *  · `platform`  → cross-tenant (`tenantId` nullo): lo apre solo il permesso di famiglia
 *  · `self`      → il solo `userId` dell'attore: è il pavimento universale (I17)
 *  · tutte le altre → il tenant dell'attore, ristretto alle `unitaDelPerimetro` quando
 *    l'attore governa una catena invece dell'intera azienda (I19: la catena, e niente
 *    delle catene sorelle). Perimetro vuoto = l'intero tenant, non «niente».
 *
 * I valori di stato usati nei filtri sono stati MISURATI sul database il 2026-08-19, non
 * ricordati: assegnazioni `ACTIVE`/`ENDED` · valutazioni `COMPLETED` · formazione
 * `ASSIGNED`/`IN_PROGRESS`/`COMPLETED` · approvazioni `PENDING`/`APPROVED`/`APPLIED`/`REJECTED`
 * · permessi `PENDING`/`APPROVED` · buste paga **minuscole** (`paid`/`available`).
 */

import type { DashboardBlockContent } from "@heuresys/shared";
import type { DbConnector } from "./repository.js";

/** Il perimetro su cui un fornitore calcola il proprio contenuto. */
export interface PerimetroBlocchi {
  /** `null` = cross-tenant: solo la famiglia `platform` lo riceve. */
  tenantId: string | null;
  /** L'attore, per le viste self-service. */
  userId: string;
  /** Le unità organizzative che l'attore governa. Vuoto = l'intero tenant. */
  unitaDelPerimetro: string[];
}

type Fornitore = (q: DbConnector, p: PerimetroBlocchi) => Promise<DashboardBlockContent>;

/* ------------------------------------------------------------------ *
 * Aiutanti — un solo posto per le forme che si ripetono
 * ------------------------------------------------------------------ */

const contatori = (
  c: Array<{ key: string; label: string; value: number }>,
): DashboardBlockContent => ({ kind: "counters", counters: c });

const serie = (p: Array<{ bucket: string; value: number }>): DashboardBlockContent => ({
  kind: "series",
  points: p,
});

const elenco = (
  r: Array<{ id: string; label: string; detail: string | null; value: number | null }>,
): DashboardBlockContent => ({ kind: "list", rows: r });

const n = (v: unknown): number => Number(v ?? 0);
const s = (v: unknown): string => String(v ?? "");
const sn = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

/**
 * Il filtro di perimetro, in una forma sola. `$1` = tenant (nullo → tutti), `$2` = unità
 * (vuoto → tutte). Passarli sempre entrambi, anche quando una query ne usa uno solo, tiene
 * la posizione dei parametri stabile e le query leggibili una accanto all'altra.
 */
const P = (p: PerimetroBlocchi): [string | null, string[]] => [p.tenantId, p.unitaDelPerimetro];

/** Le unità del perimetro, espanse alla discendenza: I19 vuole la catena, non il solo livello. */
const CTE_UNITA = `
  WITH RECURSIVE perimetro AS (
    SELECT u.organization_unit_id
      FROM sys.sys_organization_units u
     WHERE (cardinality($2::uuid[]) = 0 OR u.organization_unit_id = ANY($2::uuid[]))
       AND ($1::uuid IS NULL OR u.organization_unit_tenant_id = $1::uuid)
     UNION
    SELECT f.organization_unit_id
      FROM sys.sys_organization_units f
      JOIN perimetro p ON f.organization_unit_parent_id = p.organization_unit_id
  )`;

/* ------------------------------------------------------------------ *
 * AZIENDA (company) — 4 viste
 * ------------------------------------------------------------------ */

const companyHeadcount: Fornitore = async (q, p) => {
  const r = await q.query<{ attivi: string; cessati: string; posizioni: string; unita: string }>(
    `${CTE_UNITA}
     SELECT
       (SELECT count(DISTINCT a.user_position_assignment_user_id)
          FROM sys.sys_user_position_assignments a
          JOIN sys.sys_positions pos ON pos.position_id = a.user_position_assignment_position_id
         WHERE a.user_position_assignment_status = 'ACTIVE'
           AND pos.position_organization_unit_id IN (SELECT organization_unit_id FROM perimetro)) AS attivi,
       (SELECT count(DISTINCT a.user_position_assignment_user_id)
          FROM sys.sys_user_position_assignments a
          JOIN sys.sys_positions pos ON pos.position_id = a.user_position_assignment_position_id
         WHERE a.user_position_assignment_status = 'ENDED'
           AND pos.position_organization_unit_id IN (SELECT organization_unit_id FROM perimetro)) AS cessati,
       (SELECT count(*) FROM sys.sys_positions pos
         WHERE pos.position_is_active
           AND pos.position_organization_unit_id IN (SELECT organization_unit_id FROM perimetro)) AS posizioni,
       (SELECT count(*) FROM perimetro) AS unita`,
    P(p),
  );
  const x = r.rows[0];
  return contatori([
    { key: "attivi", label: "Persone in servizio", value: n(x?.attivi) },
    { key: "cessati", label: "Rapporti conclusi", value: n(x?.cessati) },
    { key: "posizioni", label: "Posizioni attive", value: n(x?.posizioni) },
    { key: "unita", label: "Unità organizzative", value: n(x?.unita) },
  ]);
};

const companyAndamentoOrganico: Fornitore = async (q, p) => {
  const r = await q.query<{ bucket: string; value: string }>(
    `${CTE_UNITA}
     SELECT to_char(date_trunc('month', a.user_position_assignment_start_date), 'YYYY-MM') AS bucket,
            count(*) AS value
       FROM sys.sys_user_position_assignments a
       JOIN sys.sys_positions pos ON pos.position_id = a.user_position_assignment_position_id
      WHERE pos.position_organization_unit_id IN (SELECT organization_unit_id FROM perimetro)
        AND a.user_position_assignment_start_date IS NOT NULL
        AND a.user_position_assignment_start_date >= (CURRENT_DATE - INTERVAL '24 months')
      GROUP BY 1 ORDER BY 1`,
    P(p),
  );
  return serie(r.rows.map((x) => ({ bucket: s(x.bucket), value: n(x.value) })));
};

const companyCoperturaCompetenze: Fornitore = async (q, p) => {
  // ⚠ `user_skill_proficiency` è **varchar**, non un numero: RD-08 vuole i campi categorici
  // come `varchar + CHECK`, mai un ENUM né una scala numerica. La prima stesura ne faceva la
  // media e il database ha risposto «function avg(character varying) does not exist» — un
  // errore che nessun typecheck poteva vedere, perché il tipo vive nello schema, non nel TS.
  // La copertura si misura quindi contando le PERSONE, e il livello prevalente si nomina.
  const r = await q.query<{ id: string; label: string; detail: string; value: string }>(
    `${CTE_UNITA}
     SELECT sk.skill_id::text AS id, sk.skill_name AS label,
            mode() WITHIN GROUP (ORDER BY us.user_skill_proficiency) AS detail,
            count(DISTINCT us.user_skill_user_id) AS value
       FROM sys.sys_user_skills us
       JOIN sys.sys_skills sk ON sk.skill_id = us.user_skill_skill_id
       JOIN sys.sys_user_position_assignments a
         ON a.user_position_assignment_user_id = us.user_skill_user_id
        AND a.user_position_assignment_status = 'ACTIVE'
       JOIN sys.sys_positions pos ON pos.position_id = a.user_position_assignment_position_id
      WHERE pos.position_organization_unit_id IN (SELECT organization_unit_id FROM perimetro)
      GROUP BY 1, 2 ORDER BY count(DISTINCT us.user_skill_user_id) DESC, 2 LIMIT 15`,
    P(p),
  );
  return elenco(
    r.rows.map((x) => ({
      id: s(x.id),
      label: s(x.label),
      detail: `livello prevalente: ${s(x.detail)}`,
      value: n(x.value),
    })),
  );
};

const companyAndamentoValutazioni: Fornitore = async (q, p) => {
  const r = await q.query<{ bucket: string; value: string }>(
    `${CTE_UNITA}
     SELECT to_char(date_trunc('quarter', av.assessment_period_end), 'YYYY-"Q"Q') AS bucket,
            count(*) AS value
       FROM sys.sys_assessments av
       JOIN sys.sys_user_position_assignments a
         ON a.user_position_assignment_user_id = av.assessment_subject_user_id
        AND a.user_position_assignment_status = 'ACTIVE'
       JOIN sys.sys_positions pos ON pos.position_id = a.user_position_assignment_position_id
      WHERE pos.position_organization_unit_id IN (SELECT organization_unit_id FROM perimetro)
        AND av.assessment_period_end IS NOT NULL
      GROUP BY 1 ORDER BY 1`,
    P(p),
  );
  return serie(r.rows.map((x) => ({ bucket: s(x.bucket), value: n(x.value) })));
};

/* ------------------------------------------------------------------ *
 * PROCESSI (process) — 3 viste
 * ------------------------------------------------------------------ */

const processProcessiAttivi: Fornitore = async (q, p) => {
  const r = await q.query<{ id: string; label: string; detail: string; value: string }>(
    `SELECT bp.blueprint_process_id::text AS id,
            bp.blueprint_process_name AS label,
            bp.blueprint_process_code AS detail,
            count(oup.organization_unit_process_id) AS value
       FROM sys.sys_blueprint_process_registry bp
       LEFT JOIN sys.sys_organization_unit_processes oup
              ON oup.org_unit_process_blueprint_process_id = bp.blueprint_process_id
             AND ($1::uuid IS NULL OR oup.org_unit_process_tenant_id = $1::uuid)
      GROUP BY 1, 2, 3 ORDER BY 4 DESC, 2 LIMIT 20`,
    [p.tenantId],
  );
  return elenco(
    r.rows.map((x) => ({
      id: s(x.id),
      label: s(x.label),
      detail: s(x.detail),
      value: n(x.value),
    })),
  );
};

const processAttivitaRecenti: Fornitore = async (q, p) => {
  const r = await q.query<{ id: string; label: string; detail: string; occorso: string }>(
    `SELECT e.user_timeline_event_id::text AS id,
            e.user_timeline_event_summary AS label,
            e.user_timeline_event_type AS detail,
            to_char(e.user_timeline_event_occurred_at, 'YYYY-MM-DD') AS occorso
       FROM sys.sys_user_timeline_events e
      WHERE ($1::uuid IS NULL OR e.user_timeline_event_tenant_id = $1::uuid)
      ORDER BY e.user_timeline_event_occurred_at DESC NULLS LAST LIMIT 15`,
    [p.tenantId],
  );
  return elenco(
    r.rows.map((x) => ({
      id: s(x.id),
      label: s(x.label),
      detail: `${s(x.detail)} · ${s(x.occorso)}`,
      value: null,
    })),
  );
};

const processApprovazioniInCoda: Fornitore = async (q, p) => {
  const r = await q.query<{ stato: string; value: string }>(
    `SELECT approval_request_status AS stato, count(*) AS value
       FROM sys.sys_approval_requests
      WHERE ($1::uuid IS NULL OR approval_request_tenant_id = $1::uuid)
      GROUP BY 1 ORDER BY 2 DESC`,
    [p.tenantId],
  );
  return contatori(
    r.rows.map((x) => ({ key: s(x.stato).toLowerCase(), label: s(x.stato), value: n(x.value) })),
  );
};

/* ------------------------------------------------------------------ *
 * ORGANIZZAZIONE (org) — 3 viste
 * ------------------------------------------------------------------ */

const orgStrutturaUnita: Fornitore = async (q, p) => {
  const r = await q.query<{ id: string; label: string; detail: string; value: string }>(
    `${CTE_UNITA}
     SELECT u.organization_unit_id::text AS id,
            u.organization_unit_name AS label,
            u.organization_unit_type AS detail,
            (SELECT count(*) FROM sys.sys_positions pos
              WHERE pos.position_organization_unit_id = u.organization_unit_id
                AND pos.position_is_active) AS value
       FROM sys.sys_organization_units u
      WHERE u.organization_unit_id IN (SELECT organization_unit_id FROM perimetro)
        AND u.organization_unit_is_active
      ORDER BY 4 DESC, 2 LIMIT 30`,
    P(p),
  );
  return elenco(
    r.rows.map((x) => ({
      id: s(x.id),
      label: s(x.label),
      detail: s(x.detail),
      value: n(x.value),
    })),
  );
};

const orgPosizioniScoperte: Fornitore = async (q, p) => {
  const r = await q.query<{ id: string; label: string; detail: string }>(
    `${CTE_UNITA}
     SELECT pos.position_id::text AS id, pos.position_title AS label,
            u.organization_unit_name AS detail
       FROM sys.sys_positions pos
       JOIN sys.sys_organization_units u ON u.organization_unit_id = pos.position_organization_unit_id
      WHERE pos.position_organization_unit_id IN (SELECT organization_unit_id FROM perimetro)
        AND pos.position_is_active
        AND NOT EXISTS (
          SELECT 1 FROM sys.sys_user_position_assignments a
           WHERE a.user_position_assignment_position_id = pos.position_id
             AND a.user_position_assignment_status = 'ACTIVE')
      ORDER BY 3, 2 LIMIT 30`,
    P(p),
  );
  return elenco(
    r.rows.map((x) => ({ id: s(x.id), label: s(x.label), detail: s(x.detail), value: null })),
  );
};

const orgCatenaDiRiporto: Fornitore = async (q, p) => {
  const r = await q.query<{ id: string; label: string; detail: string; value: string }>(
    `${CTE_UNITA}
     SELECT u.organization_unit_id::text AS id,
            u.organization_unit_name AS label,
            coalesce(m.user_display_name, '(nessun responsabile)') AS detail,
            (SELECT count(*) FROM sys.sys_organization_units f
              WHERE f.organization_unit_parent_id = u.organization_unit_id) AS value
       FROM sys.sys_organization_units u
       LEFT JOIN sys.sys_users m ON m.user_id = u.organization_unit_manager_user_id
      WHERE u.organization_unit_id IN (SELECT organization_unit_id FROM perimetro)
        AND u.organization_unit_is_active
      ORDER BY 4 DESC, 2 LIMIT 30`,
    P(p),
  );
  return elenco(
    r.rows.map((x) => ({
      id: s(x.id),
      label: s(x.label),
      detail: s(x.detail),
      value: n(x.value),
    })),
  );
};

/* ------------------------------------------------------------------ *
 * FILIALE (branch) — 3 viste. Il perimetro è lo stesso, ristretto al tipo BRANCH.
 * ------------------------------------------------------------------ */

const CTE_FILIALI = `
  WITH RECURSIVE perimetro AS (
    SELECT u.organization_unit_id
      FROM sys.sys_organization_units u
     WHERE (cardinality($2::uuid[]) = 0 OR u.organization_unit_id = ANY($2::uuid[]))
       AND ($1::uuid IS NULL OR u.organization_unit_tenant_id = $1::uuid)
     UNION
    SELECT f.organization_unit_id
      FROM sys.sys_organization_units f
      JOIN perimetro p ON f.organization_unit_parent_id = p.organization_unit_id
  ),
  filiali AS (
    SELECT u.organization_unit_id, u.organization_unit_name
      FROM sys.sys_organization_units u
     WHERE u.organization_unit_id IN (SELECT organization_unit_id FROM perimetro)
       AND u.organization_unit_type = 'BRANCH'
  )`;

const branchOrganico: Fornitore = async (q, p) => {
  const r = await q.query<{ id: string; label: string; value: string }>(
    `${CTE_FILIALI}
     SELECT f.organization_unit_id::text AS id, f.organization_unit_name AS label,
            count(DISTINCT a.user_position_assignment_user_id) AS value
       FROM filiali f
       LEFT JOIN sys.sys_positions pos ON pos.position_organization_unit_id = f.organization_unit_id
       LEFT JOIN sys.sys_user_position_assignments a
              ON a.user_position_assignment_position_id = pos.position_id
             AND a.user_position_assignment_status = 'ACTIVE'
      GROUP BY 1, 2 ORDER BY 3 DESC, 2`,
    P(p),
  );
  return elenco(
    r.rows.map((x) => ({ id: s(x.id), label: s(x.label), detail: null, value: n(x.value) })),
  );
};

const branchAttivita: Fornitore = async (q, p) => {
  const r = await q.query<{ id: string; label: string; detail: string }>(
    `${CTE_FILIALI}
     SELECT e.user_timeline_event_id::text AS id,
            e.user_timeline_event_summary AS label,
            e.user_timeline_event_type AS detail
       FROM sys.sys_user_timeline_events e
       JOIN sys.sys_user_position_assignments a
         ON a.user_position_assignment_user_id = e.user_timeline_event_user_id
        AND a.user_position_assignment_status = 'ACTIVE'
       JOIN sys.sys_positions pos ON pos.position_id = a.user_position_assignment_position_id
      WHERE pos.position_organization_unit_id IN (SELECT organization_unit_id FROM filiali)
      ORDER BY e.user_timeline_event_occurred_at DESC NULLS LAST LIMIT 15`,
    P(p),
  );
  return elenco(
    r.rows.map((x) => ({ id: s(x.id), label: s(x.label), detail: s(x.detail), value: null })),
  );
};

const branchCompetenze: Fornitore = async (q, p) => {
  const r = await q.query<{ id: string; label: string; value: string }>(
    `${CTE_FILIALI}
     SELECT sk.skill_id::text AS id, sk.skill_name AS label,
            count(DISTINCT us.user_skill_user_id) AS value
       FROM sys.sys_user_skills us
       JOIN sys.sys_skills sk ON sk.skill_id = us.user_skill_skill_id
       JOIN sys.sys_user_position_assignments a
         ON a.user_position_assignment_user_id = us.user_skill_user_id
        AND a.user_position_assignment_status = 'ACTIVE'
       JOIN sys.sys_positions pos ON pos.position_id = a.user_position_assignment_position_id
      WHERE pos.position_organization_unit_id IN (SELECT organization_unit_id FROM filiali)
      GROUP BY 1, 2 ORDER BY 3 DESC, 2 LIMIT 15`,
    P(p),
  );
  return elenco(
    r.rows.map((x) => ({ id: s(x.id), label: s(x.label), detail: null, value: n(x.value) })),
  );
};

/* ------------------------------------------------------------------ *
 * HR MANAGEMENT (hr) — 5 viste
 * ------------------------------------------------------------------ */

const hrOrganico: Fornitore = async (q, p) => {
  const r = await q.query<{ stato: string; value: string }>(
    `${CTE_UNITA}
     SELECT a.user_position_assignment_status AS stato, count(DISTINCT a.user_position_assignment_user_id) AS value
       FROM sys.sys_user_position_assignments a
       JOIN sys.sys_positions pos ON pos.position_id = a.user_position_assignment_position_id
      WHERE pos.position_organization_unit_id IN (SELECT organization_unit_id FROM perimetro)
      GROUP BY 1 ORDER BY 2 DESC`,
    P(p),
  );
  return contatori(
    r.rows.map((x) => ({ key: s(x.stato).toLowerCase(), label: s(x.stato), value: n(x.value) })),
  );
};

const hrRetribuzioni: Fornitore = async (q, p) => {
  const r = await q.query<{ bucket: string; value: string }>(
    `${CTE_UNITA}
     SELECT ps.user_pay_slip_period AS bucket, count(*) AS value
       FROM sys.sys_user_pay_slips ps
       JOIN sys.sys_user_position_assignments a
         ON a.user_position_assignment_user_id = ps.user_pay_slip_user_id
        AND a.user_position_assignment_status = 'ACTIVE'
       JOIN sys.sys_positions pos ON pos.position_id = a.user_position_assignment_position_id
      WHERE pos.position_organization_unit_id IN (SELECT organization_unit_id FROM perimetro)
      GROUP BY 1 ORDER BY 1 DESC LIMIT 12`,
    P(p),
  );
  return serie(r.rows.map((x) => ({ bucket: s(x.bucket), value: n(x.value) })).reverse());
};

const hrValutazioni: Fornitore = async (q, p) => {
  const r = await q.query<{ stato: string; value: string }>(
    `${CTE_UNITA}
     SELECT av.assessment_status AS stato, count(*) AS value
       FROM sys.sys_assessments av
       JOIN sys.sys_user_position_assignments a
         ON a.user_position_assignment_user_id = av.assessment_subject_user_id
        AND a.user_position_assignment_status = 'ACTIVE'
       JOIN sys.sys_positions pos ON pos.position_id = a.user_position_assignment_position_id
      WHERE pos.position_organization_unit_id IN (SELECT organization_unit_id FROM perimetro)
      GROUP BY 1 ORDER BY 2 DESC`,
    P(p),
  );
  return contatori(
    r.rows.map((x) => ({ key: s(x.stato).toLowerCase(), label: s(x.stato), value: n(x.value) })),
  );
};

const hrFormazione: Fornitore = async (q, p) => {
  const r = await q.query<{ stato: string; value: string }>(
    `${CTE_UNITA}
     SELECT la.user_learning_assignment_status AS stato, count(*) AS value
       FROM sys.sys_user_learning_assignments la
       JOIN sys.sys_user_position_assignments a
         ON a.user_position_assignment_user_id = la.user_learning_assignment_user_id
        AND a.user_position_assignment_status = 'ACTIVE'
       JOIN sys.sys_positions pos ON pos.position_id = a.user_position_assignment_position_id
      WHERE pos.position_organization_unit_id IN (SELECT organization_unit_id FROM perimetro)
      GROUP BY 1 ORDER BY 2 DESC`,
    P(p),
  );
  return contatori(
    r.rows.map((x) => ({ key: s(x.stato).toLowerCase(), label: s(x.stato), value: n(x.value) })),
  );
};

const hrAssenze: Fornitore = async (q, p) => {
  const r = await q.query<{ stato: string; tipo: string; value: string }>(
    `${CTE_UNITA}
     SELECT t.request_status AS stato, t.request_leave_type AS tipo, count(*) AS value
       FROM sys.sys_time_off_requests t
       JOIN sys.sys_user_position_assignments a
         ON a.user_position_assignment_user_id = t.request_subject_user_id
        AND a.user_position_assignment_status = 'ACTIVE'
       JOIN sys.sys_positions pos ON pos.position_id = a.user_position_assignment_position_id
      WHERE pos.position_organization_unit_id IN (SELECT organization_unit_id FROM perimetro)
      GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 12`,
    P(p),
  );
  return contatori(
    r.rows.map((x) => ({
      key: `${s(x.stato)}:${s(x.tipo)}`.toLowerCase(),
      label: `${s(x.tipo)} — ${s(x.stato)}`,
      value: n(x.value),
    })),
  );
};

/* ------------------------------------------------------------------ *
 * PLATFORM MANAGEMENT (platform) — 3 viste. Cross-tenant per costruzione.
 * ------------------------------------------------------------------ */

const platformSaluteSistema: Fornitore = async (q) => {
  const r = await q.query<{
    tenant_attivi: string; utenti: string; unita: string; posizioni: string; competenze: string;
  }>(
    `SELECT
       (SELECT count(*) FROM sys.sys_tenancies WHERE tenant_status = 'ACTIVE') AS tenant_attivi,
       (SELECT count(*) FROM sys.sys_users WHERE user_status = 'ACTIVE') AS utenti,
       (SELECT count(*) FROM sys.sys_organization_units WHERE organization_unit_is_active) AS unita,
       (SELECT count(*) FROM sys.sys_positions WHERE position_is_active) AS posizioni,
       (SELECT count(*) FROM sys.sys_skills) AS competenze`,
  );
  const x = r.rows[0];
  return contatori([
    { key: "tenant", label: "Aziende attive", value: n(x?.tenant_attivi) },
    { key: "utenti", label: "Utenti attivi", value: n(x?.utenti) },
    { key: "unita", label: "Unità organizzative", value: n(x?.unita) },
    { key: "posizioni", label: "Posizioni attive", value: n(x?.posizioni) },
    { key: "competenze", label: "Competenze a catalogo", value: n(x?.competenze) },
  ]);
};

const platformCredenziali: Fornitore = async (q) => {
  const r = await q.query<{ correnti: string; da_ruotare: string; algoritmi: string }>(
    `SELECT
       count(*) FILTER (WHERE auth_credential_is_current) AS correnti,
       count(*) FILTER (WHERE auth_credential_must_rotate) AS da_ruotare,
       count(DISTINCT auth_credential_algorithm) AS algoritmi
       FROM sys.sys_auth_credentials`,
  );
  const x = r.rows[0];
  return contatori([
    { key: "correnti", label: "Credenziali correnti", value: n(x?.correnti) },
    { key: "da_ruotare", label: "Da ruotare", value: n(x?.da_ruotare) },
    { key: "algoritmi", label: "Algoritmi in uso", value: n(x?.algoritmi) },
  ]);
};

const platformJob: Fornitore = async (q) => {
  const r = await q.query<{ id: string; label: string; detail: string }>(
    `SELECT ir.import_run_id::text AS id,
            -- import_run_wave e' smallint, non testo: senza il cast il coalesce non compila
            -- (misurato, non previsto: la prova live e' uscita 500 proprio su questa riga).
            coalesce(ir.import_run_classification_scope, 'ondata ' || ir.import_run_wave::text, 'corsa') AS label,
            ir.import_run_status || ' · ' || to_char(ir.import_run_started_at, 'YYYY-MM-DD HH24:MI') AS detail
       FROM reference_sync.import_runs ir
      ORDER BY ir.import_run_started_at DESC NULLS LAST LIMIT 15`,
  );
  return elenco(
    r.rows.map((x) => ({ id: s(x.id), label: s(x.label), detail: s(x.detail), value: null })),
  );
};

/* ------------------------------------------------------------------ *
 * TENANT MANAGEMENT (tenant) — 3 viste
 * ------------------------------------------------------------------ */

const tenantConfigurazione: Fornitore = async (q, p) => {
  const r = await q.query<{
    id: string; codice: string; nome: string; stato: string; industry: string; taglia: string;
  }>(
    `SELECT tenant_id::text AS id, tenant_code AS codice, tenant_name AS nome,
            tenant_status AS stato, coalesce(tenant_industry_code, '—') AS industry,
            coalesce(tenant_size_band, '—') AS taglia
       FROM sys.sys_tenancies
      WHERE ($1::uuid IS NULL OR tenant_id = $1::uuid)
      ORDER BY tenant_code`,
    [p.tenantId],
  );
  return elenco(
    r.rows.map((x) => ({
      id: s(x.id),
      label: `${s(x.nome)} (${s(x.codice)})`,
      detail: `${s(x.stato)} · settore ${s(x.industry)} · dimensione ${s(x.taglia)}`,
      value: null,
    })),
  );
};

const tenantBlueprintAdottati: Fornitore = async (q, p) => {
  const r = await q.query<{ id: string; label: string; detail: string }>(
    `SELECT tb.tenant_blueprint_id::text AS id,
            tb.tenant_blueprint_name AS label,
            tb.tenant_blueprint_status || ' · ' || tb.tenant_blueprint_code AS detail
       FROM sys.sys_tenant_blueprints tb
      WHERE ($1::uuid IS NULL OR tb.tenant_blueprint_tenant_id = $1::uuid)
      ORDER BY tb.tenant_blueprint_name LIMIT 30`,
    [p.tenantId],
  );
  return elenco(
    r.rows.map((x) => ({ id: s(x.id), label: s(x.label), detail: s(x.detail), value: null })),
  );
};

const tenantUtenti: Fornitore = async (q, p) => {
  const r = await q.query<{ stato: string; value: string }>(
    `SELECT user_status AS stato, count(*) AS value
       FROM sys.sys_users
      WHERE ($1::uuid IS NULL OR user_tenant_id = $1::uuid)
      GROUP BY 1 ORDER BY 2 DESC`,
    [p.tenantId],
  );
  return contatori(
    r.rows.map((x) => ({ key: s(x.stato).toLowerCase(), label: s(x.stato), value: n(x.value) })),
  );
};

/* ------------------------------------------------------------------ *
 * SELF-SERVICE (self) — 3 viste. Perimetro: la sola persona che guarda (I17).
 * ------------------------------------------------------------------ */

const selfProfilo: Fornitore = async (q, p) => {
  const r = await q.query<{ id: string; label: string; detail: string }>(
    `SELECT u.user_id::text AS id,
            coalesce(u.user_display_name, u.user_email) AS label,
            coalesce(pos.position_title, '(nessuna posizione attiva)') || ' · ' ||
            coalesce(ou.organization_unit_name, '—') AS detail
       FROM sys.sys_users u
       LEFT JOIN sys.sys_user_position_assignments a
              ON a.user_position_assignment_user_id = u.user_id
             AND a.user_position_assignment_status = 'ACTIVE'
       LEFT JOIN sys.sys_positions pos ON pos.position_id = a.user_position_assignment_position_id
       LEFT JOIN sys.sys_organization_units ou
              ON ou.organization_unit_id = pos.position_organization_unit_id
      WHERE u.user_id = $1::uuid`,
    [p.userId],
  );
  return elenco(
    r.rows.map((x) => ({ id: s(x.id), label: s(x.label), detail: sn(x.detail), value: null })),
  );
};

const selfAttivita: Fornitore = async (q, p) => {
  const r = await q.query<{ id: string; label: string; detail: string }>(
    `SELECT e.user_timeline_event_id::text AS id,
            e.user_timeline_event_summary AS label,
            e.user_timeline_event_type || ' · ' ||
            to_char(e.user_timeline_event_occurred_at, 'YYYY-MM-DD') AS detail
       FROM sys.sys_user_timeline_events e
      WHERE e.user_timeline_event_user_id = $1::uuid
      ORDER BY e.user_timeline_event_occurred_at DESC NULLS LAST LIMIT 15`,
    [p.userId],
  );
  return elenco(
    r.rows.map((x) => ({ id: s(x.id), label: s(x.label), detail: s(x.detail), value: null })),
  );
};

const selfFormazione: Fornitore = async (q, p) => {
  const r = await q.query<{ stato: string; value: string }>(
    `SELECT user_learning_assignment_status AS stato, count(*) AS value
       FROM sys.sys_user_learning_assignments
      WHERE user_learning_assignment_user_id = $1::uuid
      GROUP BY 1 ORDER BY 2 DESC`,
    [p.userId],
  );
  return contatori(
    r.rows.map((x) => ({ key: s(x.stato).toLowerCase(), label: s(x.stato), value: n(x.value) })),
  );
};

/* ------------------------------------------------------------------ *
 * La mappa. Chiave: `<famiglia>/<vista>`, gli stessi codici che stanno nel database.
 * ------------------------------------------------------------------ */

export const FORNITORI: Readonly<Record<string, Fornitore>> = Object.freeze({
  "company/headcount": companyHeadcount,
  "company/andamento-organico": companyAndamentoOrganico,
  "company/copertura-competenze": companyCoperturaCompetenze,
  "company/andamento-valutazioni": companyAndamentoValutazioni,

  "process/processi-attivi": processProcessiAttivi,
  "process/attivita-recenti": processAttivitaRecenti,
  "process/approvazioni-in-coda": processApprovazioniInCoda,

  "org/struttura-unita": orgStrutturaUnita,
  "org/posizioni-scoperte": orgPosizioniScoperte,
  "org/catena-di-riporto": orgCatenaDiRiporto,

  "branch/organico-filiale": branchOrganico,
  "branch/attivita-filiale": branchAttivita,
  "branch/competenze-filiale": branchCompetenze,

  "hr/organico": hrOrganico,
  "hr/retribuzioni": hrRetribuzioni,
  "hr/valutazioni": hrValutazioni,
  "hr/formazione": hrFormazione,
  "hr/assenze": hrAssenze,

  "platform/salute-sistema": platformSaluteSistema,
  "platform/credenziali-e-accessi": platformCredenziali,
  "platform/job-e-corse": platformJob,

  "tenant/configurazione-tenant": tenantConfigurazione,
  "tenant/blueprint-adottati": tenantBlueprintAdottati,
  "tenant/utenti-del-tenant": tenantUtenti,

  "self/il-mio-profilo": selfProfilo,
  "self/le-mie-attivita": selfAttivita,
  "self/la-mia-formazione": selfFormazione,
});

/** La chiave di un fornitore. Un solo posto che la costruisce, o due la scriverebbero diversa. */
export const chiaveFornitore = (famiglia: string, vista: string): string => `${famiglia}/${vista}`;
