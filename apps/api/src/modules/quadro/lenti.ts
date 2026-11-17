/**
 * apps/api/src/modules/quadro/lenti.ts — le lenti del quadro degli insight (classe C15 del
 * piano docs/piani/PIANO_interfaccia-sistematica_20261111.md).
 *
 * Una lente è una domanda che un dirigente farebbe guardando la pagina («quante posizioni critiche
 * sono scoperte?», «chi ha accumulato troppe ferie?») tradotta in una query che conta sul
 * perimetro di chi guarda. Ogni query riceve due parametri:
 *   $1 uuid[] — i clienti del perimetro (NULL = tutti, mandato di piattaforma);
 *   $2 uuid[] — le persone del perimetro organizzativo (NULL = tutto il cliente).
 * (le lenti personali ricevono il solo $1 = [chi guarda])
 * e restituisce una riga `{ valore, prima }`: il valore di oggi e, per le lenti d'andamento,
 * quello del periodo precedente. Il tono e le frasi stanno qui, accanto alla query, perché una
 * frase che non corrisponde alla query è il difetto che il quadro deve evitare.
 *
 * Le lenti contano persone, posizioni, richieste: mai un nome né un importo individuale. Quelle
 * su rischio d'uscita e retribuzioni girano solo per i mandati HR (`soloMandatoHR`).
 */
import type { AreaQuadro, Insight } from "@heuresys/shared";
import { pool } from "../../db/client.js";
import { contaSegnalazioniAperte } from "../whistleblowing/repository.js";

/* Le persone attive del perimetro. */
const PP = `pp AS (
  SELECT u.user_id, u.user_tenant_id FROM sys.sys_users u
   WHERE u.user_status = 'ACTIVE' AND u.user_type IS DISTINCT FROM 'SERVICE'
     AND ($1::uuid[] IS NULL OR u.user_tenant_id = ANY($1::uuid[]))
     AND ($2::uuid[] IS NULL OR u.user_id = ANY($2::uuid[])))`;

/* Le posizioni attive del perimetro: tutto il cliente, o le unità in cui lavora il perimetro. */
const POS = `pos AS (
  SELECT p.* FROM sys.sys_positions p
   WHERE p.position_is_active
     AND ($1::uuid[] IS NULL OR p.position_tenant_id = ANY($1::uuid[]))
     AND ($2::uuid[] IS NULL OR p.position_organization_unit_id IN (
           SELECT p2.position_organization_unit_id
             FROM sys.sys_user_position_assignments a2
             JOIN sys.sys_positions p2 ON p2.position_id = a2.user_position_assignment_position_id
            WHERE a2.user_position_assignment_status = 'ACTIVE'
              AND a2.user_position_assignment_user_id = ANY($2::uuid[]))))`;

const OCCUPATA = `EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a
   WHERE a.user_position_assignment_position_id = pos.position_id
     AND a.user_position_assignment_status = 'ACTIVE')`;

export interface Lente {
  chiave: string;
  aree: AreaQuadro[];
  soloMandatoHR?: boolean;
  /** la lente ha senso solo guardando se stessi (area «personale») */
  personale?: boolean;
  /** la lente gira solo per chi ha questo permesso */
  permesso?: string;
  /** la query: oppure, per i dati che vivono in un modulo isolato, il calcolo che quel modulo espone */
  sql: string;
  calcola?: (clienti: string[] | null) => Promise<{ valore: number; prima: number | null }>;
  /** dal valore (e dal precedente) all'insight; null = niente da dire */
  leggi: (valore: number, prima: number | null, L: Testo) => Omit<Insight, "chiave" | "area" | "valore" | "andamento"> | null;
}

export type Lingua = "it" | "en";

/**
 * Gli strumenti con cui una lente scrive la sua frase nella lingua di chi guarda: ogni frase si
 * dichiara in italiano e in inglese accanto alla query, perché una frase che non corrisponde alla
 * query (o che resta in italiano in un'interfaccia inglese) è il difetto che il quadro deve evitare.
 */
export interface Testo {
  lingua: Lingua;
  /** il numero con le migliaia nella forma della lingua */
  n: (x: number) => string;
  /** la frase nella lingua di chi guarda */
  t: (it: string, en: string) => string;
  /** singolare o plurale (1 = singolare) nella lingua di chi guarda; la forma dell'altra lingua si lascia vuota */
  p: (x: number, itUno: string, itMolti: string, enUno: string, enMolti: string) => string;
}

export function testoPer(lingua: Lingua): Testo {
  const locale = lingua === "en" ? "en-GB" : "it-IT";
  return {
    lingua,
    n: (x) => x.toLocaleString(locale),
    t: (it, en) => (lingua === "en" ? en : it),
    p: (x, itUno, itMolti, enUno, enMolti) => (lingua === "en" ? (x === 1 ? enUno : enMolti) : x === 1 ? itUno : itMolti),
  };
}

export const LENTI: Lente[] = [
  /* ---------------- organizzazione e posizioni ---------------- */
  {
    chiave: "posizioni-critiche-scoperte",
    aree: ["organizzazione", "posizioni"],
    sql: `WITH ${POS} SELECT count(*)::int AS valore, NULL::int AS prima FROM pos
           WHERE pos.position_criticality IN ('CRITICAL','HIGH') AND NOT ${OCCUPATA}`,
    leggi: (v, _p, L) =>
      v === 0
        ? { tono: "positivo", titolo: L.t("Tutte le posizioni critiche hanno un titolare", "Every critical position has a holder"), dettaglio: L.t("Nessun processo importante è senza una persona che lo presidia.", "No important process is without someone looking after it."), azione: null }
        : {
            tono: "rischio",
            titolo: `${L.n(v)} ${L.p(v, "posizione critica è scoperta", "posizioni critiche sono scoperte", "critical position is unfilled", "critical positions are unfilled")}`,
            dettaglio: L.t("Sono le posizioni che, senza titolare, fermano un processo importante: vanno coperte per prime.", "These are the positions that, without a holder, stop an important process: fill them first."),
            azione: { etichetta: L.t("Vedi le posizioni", "See the positions"), href: "/positions" },
          },
  },
  {
    chiave: "posizioni-scoperte",
    aree: ["organizzazione", "posizioni"],
    sql: `WITH ${POS} SELECT count(*) FILTER (WHERE NOT ${OCCUPATA})::int AS valore, count(*)::int AS prima FROM pos`,
    leggi: (v, tot, L) =>
      v === 0 || !tot
        ? null
        : {
            tono: v / tot > 0.1 ? "attenzione" : "informazione",
            titolo: L.t(
              `${L.n(v)} ${L.p(v, "posizione", "posizioni", "", "")} su ${L.n(tot)} ${L.p(v, "è", "sono", "", "")} senza titolare (${Math.round((v / tot) * 100)}%)`,
              `${L.n(v)} of ${L.n(tot)} ${L.p(v, "", "", "position has", "positions have")} no holder (${Math.round((v / tot) * 100)}%)`,
            ),
            dettaglio: L.t("Una posizione scoperta è lavoro che qualcun altro sta facendo in più, o che non si fa.", "An unfilled position is work that someone else is doing on top of their own, or that is not being done."),
            azione: { etichetta: L.t("Apri l'organigramma", "Open the org chart"), href: "/organization/org-chart" },
          },
  },
  {
    chiave: "critiche-senza-successore",
    aree: ["organizzazione", "posizioni"],
    sql: `WITH ${POS} SELECT count(*)::int AS valore, NULL::int AS prima FROM pos
           WHERE pos.position_criticality IN ('CRITICAL','HIGH')
             AND NOT EXISTS (SELECT 1 FROM sys.sys_succession_pools sp
                               JOIN sys.sys_successor_candidates sc ON sc.successor_candidate_pool_id = sp.succession_pool_id
                              WHERE sp.succession_pool_position_id = pos.position_id)`,
    leggi: (v, _p, L) =>
      v === 0
        ? null
        : {
            tono: "rischio",
            titolo: L.t(`${L.n(v)} ${L.p(v, "posizione critica non ha", "posizioni critiche non hanno", "", "")} un successore`, `${L.n(v)} critical ${L.p(v, "", "", "position has", "positions have")} no successor`),
            dettaglio: L.t("Se il titolare lascia, non c'è nessuno preparato a prenderne il posto.", "If the holder leaves, no one is ready to take their place."),
            azione: { etichetta: L.t("Pianifica la successione", "Plan the succession"), href: "/career-succession" },
          },
  },
  {
    chiave: "unita-senza-responsabile",
    aree: ["organizzazione"],
    sql: `SELECT count(*)::int AS valore, NULL::int AS prima FROM sys.sys_organization_units ou
           WHERE ou.organization_unit_is_active AND ou.organization_unit_manager_user_id IS NULL
             AND ($1::uuid[] IS NULL OR ou.organization_unit_tenant_id = ANY($1::uuid[]))
             AND $2::uuid[] IS NULL`,
    leggi: (v, _p, L) =>
      v === 0
        ? null
        : {
            tono: "attenzione",
            titolo: L.t(`${L.n(v)} ${L.p(v, "unità organizzativa non ha", "unità organizzative non hanno", "", "")} un responsabile`, `${L.n(v)} ${L.p(v, "", "", "organisational unit has", "organisational units have")} no manager`),
            dettaglio: L.t("Senza responsabile nessuno approva ferie, valutazioni e richieste di quell'unità.", "Without a manager, no one approves leave, reviews and requests for that unit."),
            azione: { etichetta: L.t("Apri l'organigramma", "Open the org chart"), href: "/organization/org-chart" },
          },
  },
  {
    chiave: "ampiezza-di-controllo",
    aree: ["organizzazione"],
    sql: `WITH ${POS} SELECT count(*)::int AS valore, NULL::int AS prima FROM (
            SELECT pos.position_reports_to_position_id FROM pos
             WHERE pos.position_reports_to_position_id IS NOT NULL
             GROUP BY 1 HAVING count(*) > 12) x`,
    leggi: (v, _p, L) =>
      v === 0
        ? null
        : {
            tono: "attenzione",
            titolo: L.t(`${L.n(v)} ${L.p(v, "responsabile ha", "responsabili hanno", "", "")} più di 12 riporti diretti`, `${L.n(v)} ${L.p(v, "", "", "manager has", "managers have")} more than 12 direct reports`),
            dettaglio: L.t("Oltre una dozzina di riporti diretti il responsabile fatica a seguire ciascuno: valuta un livello intermedio.", "Beyond a dozen direct reports a manager struggles to follow each one: consider an intermediate level."),
            azione: { etichetta: L.t("Diagnosi dell'organizzazione", "Organisation diagnosis"), href: "/organization" },
          },
  },
  /* ---------------- persone ---------------- */
  {
    chiave: "persone-senza-posizione",
    aree: ["persone", "organizzazione"],
    sql: `WITH ${PP} SELECT count(*)::int AS valore, NULL::int AS prima FROM pp
           WHERE NOT EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a
                              WHERE a.user_position_assignment_user_id = pp.user_id
                                AND a.user_position_assignment_status = 'ACTIVE')
             AND EXISTS (SELECT 1 FROM sys.sys_user_contracts c WHERE c.user_contract_user_id = pp.user_id)`,
    leggi: (v, _p, L) =>
      v === 0
        ? null
        : {
            tono: "attenzione",
            titolo: L.t(`${L.n(v)} ${L.p(v, "persona con contratto non occupa", "persone con contratto non occupano", "", "")} una posizione`, `${L.n(v)} ${L.p(v, "", "", "person with a contract does not hold", "people with a contract do not hold")} a position`),
            dettaglio: L.t("Il modello è centrato sulla posizione: una persona fuori dall'organigramma non ha responsabile, obiettivi né competenze attese.", "The model is built around the position: a person outside the org chart has no manager, goals or expected skills."),
            azione: { etichetta: L.t("Vedi le persone", "See the people"), href: "/users" },
          },
  },
  {
    chiave: "contratti-in-scadenza",
    aree: ["persone", "retribuzioni"],
    sql: `WITH ${PP} SELECT count(DISTINCT c.user_contract_user_id)::int AS valore, NULL::int AS prima
            FROM sys.sys_user_contracts c JOIN pp ON pp.user_id = c.user_contract_user_id
           WHERE c.user_contract_end_date BETWEEN current_date AND current_date + 90`,
    leggi: (v, _p, L) =>
      v === 0
        ? null
        : {
            tono: "attenzione",
            titolo: L.t(`${L.n(v)} ${L.p(v, "contratto scade", "contratti scadono", "", "")} nei prossimi 90 giorni`, `${L.n(v)} ${L.p(v, "", "", "contract expires", "contracts expire")} in the next 90 days`),
            dettaglio: L.t("Rinnovo, trasformazione o uscita vanno decisi prima della scadenza.", "Renewal, conversion or exit must be decided before the end date."),
            azione: { etichetta: L.t("Vedi le persone", "See the people"), href: "/users" },
          },
  },
  {
    chiave: "rischio-di-uscita",
    aree: ["persone", "valutazioni"],
    soloMandatoHR: true,
    sql: `WITH ${PP} SELECT count(*)::int AS valore, NULL::int AS prima FROM (
            SELECT DISTINCT ON (f.flight_risk_score_user_id) f.flight_risk_score_band
              FROM sys.sys_flight_risk_scores f JOIN pp ON pp.user_id = f.flight_risk_score_user_id
             ORDER BY f.flight_risk_score_user_id, f.flight_risk_score_computed_at DESC) x
           WHERE x.flight_risk_score_band IN ('HIGH','CRITICAL')`,
    leggi: (v, _p, L) =>
      v === 0
        ? null
        : {
            tono: "rischio",
            titolo: L.t(`${L.n(v)} ${L.p(v, "persona ha", "persone hanno", "", "")} un rischio d'uscita alto`, `${L.n(v)} ${L.p(v, "", "", "person has", "people have")} a high risk of leaving`),
            dettaglio: L.t("Il modello incrocia anzianità, straordinari, assenze, obiettivi, clima e posizione nella banda.", "The model combines tenure, overtime, absences, goals, climate and position within the band."),
            azione: { etichetta: L.t("Vedi i segnali", "See the signals"), href: "/insights" },
          },
  },
  {
    chiave: "certificazioni-in-scadenza",
    aree: ["persone", "formazione"],
    sql: `WITH ${PP} SELECT count(*)::int AS valore, NULL::int AS prima
            FROM sys.sys_user_certifications c JOIN pp ON pp.user_id = c.user_certification_user_id
           WHERE c.user_certification_expires_date BETWEEN current_date AND current_date + 60`,
    leggi: (v, _p, L) =>
      v === 0
        ? null
        : {
            tono: "attenzione",
            titolo: L.t(`${L.n(v)} ${L.p(v, "certificazione scade", "certificazioni scadono", "", "")} entro 60 giorni`, `${L.n(v)} ${L.p(v, "", "", "certification expires", "certifications expire")} within 60 days`),
            dettaglio: L.t("Una certificazione scaduta può impedire di svolgere un'attività regolamentata.", "An expired certification can prevent someone from carrying out a regulated activity."),
            azione: { etichetta: L.t("Formazione", "Learning"), href: "/learning" },
          },
  },
  /* ---------------- assenze ---------------- */
  {
    chiave: "richieste-assenza-in-attesa",
    aree: ["assenze", "approvazioni"],
    sql: `WITH ${PP} SELECT count(*)::int AS valore,
                 count(*) FILTER (WHERE r.request_start_date < current_date + 7)::int AS prima
            FROM sys.sys_time_off_requests r JOIN pp ON pp.user_id = r.request_subject_user_id
           WHERE r.request_status = 'PENDING'`,
    leggi: (v, imminenti, L) =>
      v === 0
        ? { tono: "positivo", titolo: L.t("Nessuna richiesta di assenza in attesa", "No time-off requests waiting"), dettaglio: L.t("Tutte le richieste hanno avuto una risposta.", "Every request has had an answer."), azione: null }
        : {
            tono: (imminenti ?? 0) > 0 ? "attenzione" : "informazione",
            titolo: L.t(`${L.n(v)} ${L.p(v, "richiesta di assenza aspetta", "richieste di assenza aspettano", "", "")} una risposta`, `${L.n(v)} time-off ${L.p(v, "", "", "request is", "requests are")} waiting for an answer`),
            dettaglio: imminenti
              ? L.t(`${L.n(imminenti)} ${L.p(imminenti, "comincia", "cominciano", "", "")} entro una settimana: chi le ha chieste deve saperlo in tempo.`, `${L.n(imminenti)} ${L.p(imminenti, "", "", "starts", "start")} within a week: the people who asked need to know in time.`)
              : L.t("Nessuna comincia entro la settimana.", "None starts within the week."),
            azione: { etichetta: L.t("Rispondi", "Answer"), href: "/approvals" },
          },
  },
  {
    chiave: "ferie-accumulate",
    aree: ["assenze"],
    sql: `WITH ${PP} SELECT count(DISTINCT b.balance_subject_user_id)::int AS valore, NULL::int AS prima
            FROM sys.sys_time_off_balances b JOIN pp ON pp.user_id = b.balance_subject_user_id
           WHERE b.balance_year = extract(year FROM current_date)::int
             AND b.balance_leave_type IN ('VACATION', 'PERSONAL')
             AND coalesce(b.balance_total_days,0) + coalesce(b.balance_carryover_days,0)
                 + coalesce(b.balance_adjustment_days,0) - coalesce(b.balance_used_days,0) > 20`,
    leggi: (v, _p, L) =>
      v === 0
        ? null
        : {
            tono: "attenzione",
            titolo: L.t(`${L.n(v)} ${L.p(v, "persona ha", "persone hanno", "", "")} più di 20 giorni di ferie da godere`, `${L.n(v)} ${L.p(v, "", "", "person has", "people have")} more than 20 days of leave still to take`),
            dettaglio: L.t("Ferie accumulate sono un debito per l'azienda e un segnale di carico di lavoro: vanno pianificate.", "Accrued leave is a liability for the company and a sign of workload: it needs planning."),
            azione: { etichetta: L.t("Vedi i saldi", "See the balances"), href: "/time-off" },
          },
  },
  {
    chiave: "giorni-di-assenza-30",
    aree: ["assenze"],
    sql: `WITH ${PP} SELECT
            coalesce(sum(r.request_days_requested) FILTER (WHERE r.request_start_date >= current_date - 30), 0)::int AS valore,
            coalesce(sum(r.request_days_requested) FILTER (WHERE r.request_start_date >= current_date - 60 AND r.request_start_date < current_date - 30), 0)::int AS prima
            FROM sys.sys_time_off_requests r JOIN pp ON pp.user_id = r.request_subject_user_id
           WHERE r.request_status = 'APPROVED' AND r.request_start_date <= current_date`,
    leggi: (v, prima, L) =>
      v === 0 && !prima
        ? null
        : {
            tono: prima && v > prima * 1.25 ? "attenzione" : "informazione",
            titolo: L.t(`${L.n(v)} giorni di assenza negli ultimi 30 giorni`, `${L.n(v)} days of absence in the last 30 days`),
            dettaglio: prima ? L.t(`Erano ${L.n(prima)} nei 30 giorni prima.`, `It was ${L.n(prima)} in the 30 days before.`) : L.t("Nessuna assenza nei 30 giorni prima.", "No absence in the 30 days before."),
            azione: { etichetta: L.t("Presenze", "Attendance"), href: "/analytics/attendance" },
          },
  },
  /* ---------------- obiettivi e valutazioni ---------------- */
  {
    chiave: "obiettivi-a-rischio",
    aree: ["obiettivi", "valutazioni"],
    sql: `WITH ${PP} SELECT count(*) FILTER (WHERE g.goal_status IN ('AT_RISK','BLOCKED'))::int AS valore,
                 count(*) FILTER (WHERE g.goal_due_date < current_date)::int AS prima
            FROM sys.sys_goals g JOIN pp ON pp.user_id = coalesce(g.goal_subject_user_id, g.goal_owner_user_id)
           WHERE g.goal_status NOT IN ('COMPLETED','CANCELLED')`,
    leggi: (v, scaduti, L) =>
      v === 0 && !scaduti
        ? null
        : {
            tono: "rischio",
            titolo: v > 0
              ? L.t(`${L.n(v)} ${L.p(v, "obiettivo è", "obiettivi sono", "", "")} a rischio o bloccati`, `${L.n(v)} ${L.p(v, "", "", "goal is", "goals are")} at risk or blocked`)
              : L.t(`${L.n(scaduti ?? 0)} obiettivi aperti oltre la scadenza`, `${L.n(scaduti ?? 0)} open goals past their due date`),
            dettaglio: scaduti
              ? L.t(`${L.n(scaduti)} ${L.p(scaduti, "obiettivo aperto ha", "obiettivi aperti hanno", "", "")} già superato la scadenza.`, `${L.n(scaduti)} open ${L.p(scaduti, "", "", "goal is", "goals are")} already past the due date.`)
              : L.t("Nessun obiettivo aperto oltre la scadenza.", "No open goal past its due date."),
            azione: { etichetta: L.t("Vedi gli obiettivi", "See the goals"), href: "/goals" },
          },
  },
  {
    chiave: "valutazioni-aperte",
    aree: ["valutazioni"],
    sql: `WITH ${PP} SELECT count(*)::int AS valore,
                 count(*) FILTER (WHERE r.review_period_end < current_date - 30)::int AS prima
            FROM sys.sys_performance_reviews r JOIN pp ON pp.user_id = r.review_subject_user_id
           WHERE r.review_status IN ('DRAFT','IN_PROGRESS','SUBMITTED')`,
    leggi: (v, ritardo, L) =>
      v === 0
        ? null
        : {
            tono: (ritardo ?? 0) > 0 ? "attenzione" : "informazione",
            titolo: L.t(`${L.n(v)} ${L.p(v, "valutazione è", "valutazioni sono", "", "")} ancora aperte`, `${L.n(v)} ${L.p(v, "", "", "review is", "reviews are")} still open`),
            dettaglio: ritardo
              ? L.t(`${L.n(ritardo)} ${L.p(ritardo, "riguarda", "riguardano", "", "")} un periodo chiuso da oltre un mese.`, `${L.n(ritardo)} ${L.p(ritardo, "", "", "covers", "cover")} a period that closed over a month ago.`)
              : L.t("Tutte riguardano il periodo in corso.", "All of them cover the current period."),
            azione: { etichetta: L.t("Vedi le valutazioni", "See the reviews"), href: "/performance" },
          },
  },
  /* ---------------- formazione ---------------- */
  {
    chiave: "formazione-in-ritardo",
    aree: ["formazione"],
    sql: `WITH ${PP} SELECT count(*)::int AS valore,
                 count(*) FILTER (WHERE la.user_learning_assignment_is_mandatory)::int AS prima
            FROM sys.sys_user_learning_assignments la JOIN pp ON pp.user_id = la.user_learning_assignment_user_id
           WHERE la.user_learning_assignment_status = 'OVERDUE'
              OR (la.user_learning_assignment_status IN ('ASSIGNED','IN_PROGRESS') AND la.user_learning_assignment_deadline < current_date)`,
    leggi: (v, obbligatori, L) =>
      v === 0
        ? { tono: "positivo", titolo: L.t("Nessuna formazione in ritardo", "No training overdue"), dettaglio: L.t("Ogni percorso assegnato è nei tempi.", "Every assigned path is on schedule."), azione: null }
        : {
            tono: (obbligatori ?? 0) > 0 ? "rischio" : "attenzione",
            titolo: L.t(`${L.n(v)} ${L.p(v, "percorso di formazione è", "percorsi di formazione sono", "", "")} oltre la scadenza`, `${L.n(v)} training ${L.p(v, "", "", "path is", "paths are")} past the deadline`),
            dettaglio: obbligatori
              ? L.t(`${L.n(obbligatori)} ${L.p(obbligatori, "è obbligatorio", "sono obbligatori", "", "")}: un obbligo formativo scaduto è un rilievo in caso di verifica.`, `${L.n(obbligatori)} ${L.p(obbligatori, "", "", "is mandatory", "are mandatory")}: an overdue training obligation is a finding in an audit.`)
              : L.t("Nessuno è obbligatorio.", "None is mandatory."),
            azione: { etichetta: L.t("Formazione", "Learning"), href: "/learning" },
          },
  },
  /* ---------------- selezione e approvazioni ---------------- */
  {
    chiave: "selezioni-lunghe",
    aree: ["selezione", "posizioni"],
    sql: `SELECT count(*) FILTER (WHERE j.requisition_opened_on < current_date - 60)::int AS prima, count(*)::int AS valore
            FROM sys.sys_job_requisitions j
           WHERE j.requisition_status = 'OPEN' AND $2::uuid[] IS NULL
             AND ($1::uuid[] IS NULL OR j.requisition_tenant_id = ANY($1::uuid[]))`,
    leggi: (v, lunghe, L) =>
      v === 0
        ? null
        : {
            tono: (lunghe ?? 0) > 0 ? "attenzione" : "informazione",
            titolo: L.t(`${L.n(v)} ${L.p(v, "selezione è aperta", "selezioni sono aperte", "", "")}`, `${L.n(v)} ${L.p(v, "", "", "search is open", "searches are open")}`),
            dettaglio: lunghe
              ? L.t(`${L.n(lunghe)} da oltre 60 giorni: conviene rivedere profilo o canali.`, `${L.n(lunghe)} for over 60 days: it is worth reviewing the profile or the channels.`)
              : L.t("Tutte aperte da meno di 60 giorni.", "All open for less than 60 days."),
            azione: { etichetta: L.t("Selezione", "Recruiting"), href: "/recruiting" },
          },
  },
  {
    chiave: "approvazioni-in-attesa",
    aree: ["approvazioni"],
    sql: `SELECT count(*)::int AS valore, NULL::int AS prima FROM sys.sys_approval_requests ar
           WHERE ar.approval_request_status = 'PENDING' AND $2::uuid[] IS NULL
             AND ($1::uuid[] IS NULL OR ar.approval_request_tenant_id = ANY($1::uuid[]))`,
    leggi: (v, _p, L) =>
      v === 0
        ? null
        : {
            tono: "informazione",
            titolo: L.t(`${L.n(v)} ${L.p(v, "richiesta aspetta", "richieste aspettano", "", "")} un'approvazione`, `${L.n(v)} ${L.p(v, "", "", "request is", "requests are")} waiting for approval`),
            dettaglio: L.t("Sono le decisioni ferme nel flusso di approvazione del cliente.", "These are the decisions stalled in the client's approval flow."),
            azione: { etichetta: L.t("Approvazioni", "Approvals"), href: "/approvals" },
          },
  },
  /* ---------------- accessi, processi, contenuti, progetti, contatti ----------------
     Lenti di chi governa il cliente o la piattaforma: contano su tutto il cliente ($2 NULL). */
  {
    chiave: "utenze-senza-ruolo",
    aree: ["accessi"],
    sql: `SELECT count(*)::int AS valore, NULL::int AS prima FROM sys.sys_users u
           WHERE u.user_status = 'ACTIVE' AND $2::uuid[] IS NULL
             AND ($1::uuid[] IS NULL OR u.user_tenant_id = ANY($1::uuid[]))
             AND NOT EXISTS (SELECT 1 FROM sys.sys_user_auth_roles r
                              WHERE r.user_auth_role_user_id = u.user_id AND r.user_auth_role_revoked_at IS NULL)`,
    leggi: (v, _p, L) =>
      v === 0
        ? { tono: "positivo", titolo: L.t("Ogni utenza attiva ha un ruolo", "Every active account has a role"), dettaglio: L.t("Nessuno entra senza sapere che cosa può fare.", "No one signs in without knowing what they can do."), azione: null }
        : {
            tono: "attenzione",
            titolo: L.t(`${L.n(v)} ${L.p(v, "utenza attiva non ha", "utenze attive non hanno", "", "")} nessun ruolo`, `${L.n(v)} active ${L.p(v, "", "", "account has", "accounts have")} no role`),
            dettaglio: L.t("Entrano ma non vedono niente: o il ruolo manca, o l'utenza andrebbe chiusa.", "They sign in but see nothing: either the role is missing, or the account should be closed."),
            azione: { etichetta: L.t("Vedi gli utenti", "See the users"), href: "/users" },
          },
  },
  {
    chiave: "utenze-senza-secondo-fattore",
    aree: ["accessi"],
    sql: `SELECT count(*)::int AS valore, NULL::int AS prima FROM sys.sys_users u
           WHERE u.user_status = 'ACTIVE' AND u.user_type IS DISTINCT FROM 'SERVICE' AND $2::uuid[] IS NULL
             AND ($1::uuid[] IS NULL OR u.user_tenant_id = ANY($1::uuid[]))
             AND NOT EXISTS (SELECT 1 FROM sys.sys_auth_mfa_factors f
                              WHERE f.auth_mfa_factor_user_id = u.user_id AND f.auth_mfa_factor_verified)
             AND NOT EXISTS (SELECT 1 FROM sys.sys_auth_mfa_webauthn_credentials w
                              WHERE w.auth_webauthn_cred_user_id = u.user_id)`,
    leggi: (v, _p, L) =>
      v === 0
        ? { tono: "positivo", titolo: L.t("Tutte le utenze hanno il secondo fattore", "Every account has a second factor"), dettaglio: L.t("Ogni accesso chiede più della sola password.", "Every sign-in asks for more than a password."), azione: null }
        : {
            tono: "attenzione",
            titolo: L.t(`${L.n(v)} ${L.p(v, "persona entra", "persone entrano", "", "")} con la sola password`, `${L.n(v)} ${L.p(v, "", "", "person signs", "people sign")} in with a password only`),
            dettaglio: L.t("Senza secondo fattore un accesso rubato basta per entrare: va attivato.", "Without a second factor a stolen password is enough to get in: it needs turning on."),
            azione: { etichetta: L.t("Regole del secondo fattore", "Second-factor rules"), href: "/admin/mfa-policy" },
          },
  },
  {
    chiave: "processi-senza-responsabile",
    aree: ["processi"],
    sql: `SELECT count(*) FILTER (WHERE tp.tenant_process_owner_position_id IS NULL
                                  OR NOT EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a
                                                  WHERE a.user_position_assignment_position_id = tp.tenant_process_owner_position_id
                                                    AND a.user_position_assignment_status = 'ACTIVE'))::int AS valore,
                  count(*)::int AS prima
             FROM sys.sys_tenant_processes tp
            WHERE tp.tenant_process_is_active AND $2::uuid[] IS NULL
              AND ($1::uuid[] IS NULL OR tp.tenant_process_tenant_id = ANY($1::uuid[]))`,
    leggi: (v, tot, L) =>
      !tot
        ? null
        : v === 0
          ? { tono: "positivo", titolo: L.t(`Tutti i ${L.n(tot)} processi hanno un responsabile al suo posto`, `All ${L.n(tot)} processes have an owner in place`), dettaglio: L.t("Ogni processo ha una persona che ne risponde.", "Every process has someone answerable for it."), azione: null }
          : {
              tono: "rischio",
              titolo: L.t(`${L.n(v)} processi su ${L.n(tot)} non hanno un responsabile in carica`, `${L.n(v)} of ${L.n(tot)} processes have no owner in place`),
              dettaglio: L.t("Il processo c'è, ma la posizione che ne risponde manca o è scoperta: nessuno lo presidia.", "The process exists, but the position answerable for it is missing or unfilled: no one looks after it."),
              azione: { etichetta: L.t("Vedi i processi", "See the processes"), href: "/processes" },
            },
  },
  {
    chiave: "documenti-da-rivedere",
    aree: ["contenuti"],
    sql: `SELECT count(*) FILTER (WHERE d.document_status = 'in_review')::int AS valore,
                  count(*) FILTER (WHERE d.document_status = 'published' AND d.document_expires_date < current_date)::int AS prima
             FROM sys.sys_content_documents d
            WHERE $2::uuid[] IS NULL AND ($1::uuid[] IS NULL OR d.document_tenant_id = ANY($1::uuid[]))`,
    leggi: (v, scaduti, L) =>
      v === 0 && !scaduti
        ? { tono: "positivo", titolo: L.t("Nessun documento fermo in revisione né scaduto", "No document stuck in review or expired"), dettaglio: L.t("Il regolamento pubblicato è quello in vigore.", "The published rulebook is the one in force."), azione: null }
        : {
            tono: scaduti ? "attenzione" : "informazione",
            titolo: L.t(`${L.n(v)} in revisione, ${L.n(scaduti ?? 0)} pubblicati ma scaduti`, `${L.n(v)} in review, ${L.n(scaduti ?? 0)} published but expired`),
            dettaglio: L.t("Un documento scaduto ancora pubblicato dice alle persone una regola che non vale più.", "An expired document that is still published tells people a rule that no longer applies."),
            azione: { etichetta: L.t("Vedi i documenti", "See the documents"), href: "/content" },
          },
  },
  // Le segnalazioni: la query vive nella custodia (#99 F4) e la lente gira solo per chi la custodisce.
  {
    chiave: "segnalazioni-aperte",
    aree: ["segnalazioni"],
    permesso: "whistleblowing:read",
    sql: "",
    calcola: async (clienti) => {
      const c = await contaSegnalazioniAperte(pool, clienti);
      return { valore: c.vecchie, prima: c.aperte };
    },
    leggi: (vecchie, aperte, L) =>
      !aperte
        ? { tono: "positivo", titolo: L.t("Nessuna segnalazione aperta", "No open report"), dettaglio: L.t("Ogni segnalazione ricevuta ha avuto un esito.", "Every report received has had an outcome."), azione: null }
        : {
            tono: vecchie ? "rischio" : "informazione",
            titolo: L.t(`${L.n(aperte)} ${L.p(aperte, "segnalazione aperta", "segnalazioni aperte", "", "")}, ${L.n(vecchie)} da oltre 30 giorni`, `${L.n(aperte)} open ${L.p(aperte, "", "", "report", "reports")}, ${L.n(vecchie)} for over 30 days`),
            dettaglio: L.t("La legge chiede un riscontro a chi segnala entro tre mesi: le più vecchie vanno chiuse per prime.", "The law requires a reply to the person who reported within three months: close the oldest first."),
            azione: null,
          },
  },
  {
    chiave: "progetti-oltre-la-scadenza",
    aree: ["progetti"],
    sql: `SELECT count(*) FILTER (WHERE p.project_ends_on < current_date)::int AS valore, count(*)::int AS prima
             FROM sys.sys_projects p
            WHERE p.project_status = 'ACTIVE' AND $2::uuid[] IS NULL
              AND ($1::uuid[] IS NULL OR p.project_tenant_id = ANY($1::uuid[]))`,
    leggi: (v, tot, L) =>
      !tot
        ? null
        : v === 0
          ? { tono: "positivo", titolo: L.t(`I ${L.n(tot)} progetti attivi sono nei tempi`, `The ${L.n(tot)} active projects are on schedule`), dettaglio: L.t("Nessuno ha superato la data di fine.", "None has passed its end date."), azione: null }
          : {
              tono: "attenzione",
              titolo: L.t(`${L.n(v)} progetti attivi su ${L.n(tot)} hanno superato la data di fine`, `${L.n(v)} of ${L.n(tot)} active projects have passed their end date`),
              dettaglio: L.t("O vanno chiusi, o la data va rivista: un progetto senza termine credibile non si governa.", "Either close them or revise the date: a project without a credible end date cannot be governed."),
              azione: { etichetta: L.t("Vedi i progetti", "See the projects"), href: "/projects" },
            },
  },
  {
    chiave: "contatti-da-richiamare",
    aree: ["contatti"],
    sql: `SELECT count(*) FILTER (WHERE l.created_at < now() - interval '3 days')::int AS valore, count(*)::int AS prima
             FROM sys.sys_leads l
            WHERE l.lead_status = 'NEW' AND $1::uuid[] IS NULL AND $2::uuid[] IS NULL`,
    leggi: (v, nuovi, L) =>
      !nuovi
        ? { tono: "positivo", titolo: L.t("Nessun contatto nuovo in attesa", "No new contact waiting"), dettaglio: L.t("Ogni richiesta arrivata dal sito è stata presa in carico.", "Every request that came from the website has been picked up."), azione: null }
        : {
            tono: v ? "attenzione" : "informazione",
            titolo: L.t(`${L.n(nuovi)} ${L.p(nuovi, "contatto nuovo", "contatti nuovi", "", "")}, ${L.n(v)} in attesa da oltre 3 giorni`, `${L.n(nuovi)} new ${L.p(nuovi, "", "", "contact", "contacts")}, ${L.n(v)} waiting for over 3 days`),
            dettaglio: L.t("Un contatto che aspetta si raffredda: va richiamato.", "A contact that waits goes cold: call them back."),
            azione: { etichetta: L.t("Vedi i contatti", "See the contacts"), href: "/leads" },
          },
  },
  /* ---------------- coerenza dei dati ---------------- */
  {
    chiave: "contratti-fuori-dal-ccnl-prevalente",
    aree: ["retribuzioni", "persone"],
    soloMandatoHR: true,
    sql: `WITH ${PP}, c AS (
            SELECT pp.user_tenant_id AS t, c.user_contract_ccnl_type AS ccnl
              FROM sys.sys_user_contracts c JOIN pp ON pp.user_id = c.user_contract_user_id
             WHERE c.user_contract_ccnl_type IS NOT NULL),
          prev AS (SELECT DISTINCT ON (t) t, ccnl FROM c GROUP BY t, ccnl ORDER BY t, count(*) DESC)
          SELECT count(*)::int AS valore, NULL::int AS prima FROM c JOIN prev USING (t) WHERE c.ccnl <> prev.ccnl`,
    leggi: (v, _p, L) =>
      v === 0
        ? null
        : {
            tono: "attenzione",
            titolo: L.t(`${L.n(v)} ${L.p(v, "contratto applica", "contratti applicano", "", "")} un CCNL diverso da quello del resto dell'azienda`, `${L.n(v)} ${L.p(v, "", "", "contract applies", "contracts apply")} a collective agreement (CCNL) different from the rest of the company`),
            dettaglio: L.t("Può essere corretto (un dirigente, una società del gruppo), ma più spesso è un dato sbagliato: va controllato.", "It can be correct (an executive, a group company), but more often it is wrong data: check it."),
            azione: { etichetta: L.t("Vedi le persone", "See the people"), href: "/users" },
          },
  },
  /* ---------------- personale: ciò che riguarda chi guarda ---------------- */
  {
    chiave: "mie-ferie",
    aree: ["personale"],
    personale: true,
    sql: `SELECT coalesce(sum(coalesce(b.balance_total_days,0) + coalesce(b.balance_carryover_days,0)
                 + coalesce(b.balance_adjustment_days,0) - coalesce(b.balance_used_days,0)), 0)::int AS valore, NULL::int AS prima
            FROM sys.sys_time_off_balances b
           WHERE b.balance_subject_user_id = ($1::uuid[])[1] AND b.balance_year = extract(year FROM current_date)::int
             -- forense 16/11: ferie e permessi, non la malattia (175 giorni «da godere» di media)
             AND b.balance_leave_type IN ('VACATION', 'PERSONAL')`,
    leggi: (v, _p, L) => ({
      tono: v > 20 ? "attenzione" : "informazione",
      titolo: L.t(`Hai ${L.n(v)} giorni di ferie e permessi da godere quest'anno`, `You have ${L.n(v)} days of leave and time off still to take this year`),
      dettaglio: v > 20
        ? L.t("Sono tanti: pianificali con il tuo responsabile prima della fine dell'anno.", "That is a lot: plan them with your manager before the end of the year.")
        : L.t("Il saldo comprende maturato, riporto e rettifiche.", "The balance includes accrued, carried-over and adjusted days."),
      azione: { etichetta: L.t("Le mie assenze", "My time off"), href: "/me/time-off" },
    }),
  },
  {
    chiave: "miei-obiettivi",
    aree: ["personale"],
    personale: true,
    sql: `SELECT count(*) FILTER (WHERE g.goal_status IN ('AT_RISK','BLOCKED') OR g.goal_due_date < current_date)::int AS valore,
                 count(*)::int AS prima
            FROM sys.sys_goals g
           WHERE coalesce(g.goal_subject_user_id, g.goal_owner_user_id) = ($1::uuid[])[1]
             AND g.goal_status NOT IN ('COMPLETED','CANCELLED')`,
    leggi: (v, tot, L) =>
      !tot
        ? null
        : {
            tono: v > 0 ? "attenzione" : "positivo",
            titolo: v > 0
              ? L.t(`${L.n(v)} dei tuoi ${L.n(tot)} obiettivi aperti ${L.p(v, "chiede", "chiedono", "", "")} attenzione`, `${L.n(v)} of your ${L.n(tot)} open goals ${L.p(v, "", "", "needs", "need")} attention`)
              : L.t(`I tuoi ${L.n(tot)} obiettivi aperti sono nei tempi`, `Your ${L.n(tot)} open goals are on schedule`),
            dettaglio: v > 0 ? L.t("Sono a rischio, bloccati o oltre la scadenza.", "They are at risk, blocked or past their due date.") : L.t("Nessuno è a rischio o in ritardo.", "None is at risk or late."),
            azione: { etichetta: L.t("I miei obiettivi", "My goals"), href: "/me/performance" },
          },
  },
  {
    chiave: "mia-formazione",
    aree: ["personale"],
    personale: true,
    sql: `SELECT count(*) FILTER (WHERE la.user_learning_assignment_deadline < current_date + 30)::int AS valore, count(*)::int AS prima
            FROM sys.sys_user_learning_assignments la
           WHERE la.user_learning_assignment_user_id = ($1::uuid[])[1]
             AND la.user_learning_assignment_status IN ('ASSIGNED','IN_PROGRESS','OVERDUE')`,
    leggi: (v, tot, L) =>
      !tot
        ? null
        : {
            tono: v > 0 ? "attenzione" : "informazione",
            titolo: L.t(`Hai ${L.n(tot)} ${L.p(tot, "percorso", "percorsi", "", "")} di formazione da completare`, `You have ${L.n(tot)} training ${L.p(tot, "", "", "path", "paths")} to complete`),
            dettaglio: v > 0
              ? L.t(`${L.n(v)} ${L.p(v, "scade", "scadono", "", "")} entro 30 giorni.`, `${L.n(v)} ${L.p(v, "", "", "expires", "expire")} within 30 days.`)
              : L.t("Nessuno scade entro 30 giorni.", "None expires within 30 days."),
            azione: { etichetta: L.t("La mia formazione", "My learning"), href: "/me/learning" },
          },
  },
  {
    chiave: "mie-richieste",
    aree: ["personale"],
    personale: true,
    sql: `SELECT count(*)::int AS valore, NULL::int AS prima FROM sys.sys_time_off_requests r
           WHERE r.request_subject_user_id = ($1::uuid[])[1] AND r.request_status = 'PENDING'`,
    leggi: (v, _p, L) =>
      v === 0
        ? null
        : {
            tono: "informazione",
            titolo: L.t(`${L.n(v)} ${L.p(v, "tua richiesta di assenza aspetta", "tue richieste di assenza aspettano", "", "")} una risposta`, `${L.n(v)} of your time-off ${L.p(v, "", "", "request is", "requests are")} waiting for an answer`),
            dettaglio: L.t("Il tuo responsabile la vede nelle sue approvazioni.", "Your manager sees it in their approvals."),
            azione: { etichetta: L.t("Le mie assenze", "My time off"), href: "/me/time-off" },
          },
  },
];
