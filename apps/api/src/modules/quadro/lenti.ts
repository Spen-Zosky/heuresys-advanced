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
  leggi: (valore: number, prima: number | null) => Omit<Insight, "chiave" | "area" | "valore" | "andamento"> | null;
}

const n = (x: number) => x.toLocaleString("it-IT");
const plurale = (x: number, uno: string, molti: string) => (x === 1 ? uno : molti);

export const LENTI: Lente[] = [
  /* ---------------- organizzazione e posizioni ---------------- */
  {
    chiave: "posizioni-critiche-scoperte",
    aree: ["organizzazione", "posizioni"],
    sql: `WITH ${POS} SELECT count(*)::int AS valore, NULL::int AS prima FROM pos
           WHERE pos.position_criticality IN ('CRITICAL','HIGH') AND NOT ${OCCUPATA}`,
    leggi: (v) =>
      v === 0
        ? { tono: "positivo", titolo: "Tutte le posizioni critiche hanno un titolare", dettaglio: "Nessun processo importante è senza una persona che lo presidia.", azione: null }
        : {
            tono: "rischio",
            titolo: `${n(v)} ${plurale(v, "posizione critica è scoperta", "posizioni critiche sono scoperte")}`,
            dettaglio: "Sono le posizioni che, senza titolare, fermano un processo importante: vanno coperte per prime.",
            azione: { etichetta: "Vedi le posizioni", href: "/positions" },
          },
  },
  {
    chiave: "posizioni-scoperte",
    aree: ["organizzazione", "posizioni"],
    sql: `WITH ${POS} SELECT count(*) FILTER (WHERE NOT ${OCCUPATA})::int AS valore, count(*)::int AS prima FROM pos`,
    leggi: (v, tot) =>
      v === 0 || !tot
        ? null
        : {
            tono: v / tot > 0.1 ? "attenzione" : "informazione",
            titolo: `${n(v)} posizioni su ${n(tot)} sono senza titolare (${Math.round((v / tot) * 100)}%)`,
            dettaglio: "Una posizione scoperta è lavoro che qualcun altro sta facendo in più, o che non si fa.",
            azione: { etichetta: "Apri l'organigramma", href: "/organization/org-chart" },
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
    leggi: (v) =>
      v === 0
        ? null
        : {
            tono: "rischio",
            titolo: `${n(v)} ${plurale(v, "posizione critica non ha", "posizioni critiche non hanno")} un successore`,
            dettaglio: "Se il titolare lascia, non c'è nessuno preparato a prenderne il posto.",
            azione: { etichetta: "Pianifica la successione", href: "/career-succession" },
          },
  },
  {
    chiave: "unita-senza-responsabile",
    aree: ["organizzazione"],
    sql: `SELECT count(*)::int AS valore, NULL::int AS prima FROM sys.sys_organization_units ou
           WHERE ou.organization_unit_is_active AND ou.organization_unit_manager_user_id IS NULL
             AND ($1::uuid[] IS NULL OR ou.organization_unit_tenant_id = ANY($1::uuid[]))
             AND $2::uuid[] IS NULL`,
    leggi: (v) =>
      v === 0
        ? null
        : {
            tono: "attenzione",
            titolo: `${n(v)} ${plurale(v, "unità organizzativa non ha", "unità organizzative non hanno")} un responsabile`,
            dettaglio: "Senza responsabile nessuno approva ferie, valutazioni e richieste di quell'unità.",
            azione: { etichetta: "Apri l'organigramma", href: "/organization/org-chart" },
          },
  },
  {
    chiave: "ampiezza-di-controllo",
    aree: ["organizzazione"],
    sql: `WITH ${POS} SELECT count(*)::int AS valore, NULL::int AS prima FROM (
            SELECT pos.position_reports_to_position_id FROM pos
             WHERE pos.position_reports_to_position_id IS NOT NULL
             GROUP BY 1 HAVING count(*) > 12) x`,
    leggi: (v) =>
      v === 0
        ? null
        : {
            tono: "attenzione",
            titolo: `${n(v)} ${plurale(v, "responsabile ha", "responsabili hanno")} più di 12 riporti diretti`,
            dettaglio: "Oltre una dozzina di riporti diretti il responsabile fatica a seguire ciascuno: valuta un livello intermedio.",
            azione: { etichetta: "Diagnosi dell'organizzazione", href: "/organization" },
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
    leggi: (v) =>
      v === 0
        ? null
        : {
            tono: "attenzione",
            titolo: `${n(v)} ${plurale(v, "persona con contratto non occupa", "persone con contratto non occupano")} una posizione`,
            dettaglio: "Il modello è centrato sulla posizione: una persona fuori dall'organigramma non ha responsabile, obiettivi né competenze attese.",
            azione: { etichetta: "Vedi le persone", href: "/users" },
          },
  },
  {
    chiave: "contratti-in-scadenza",
    aree: ["persone", "retribuzioni"],
    sql: `WITH ${PP} SELECT count(DISTINCT c.user_contract_user_id)::int AS valore, NULL::int AS prima
            FROM sys.sys_user_contracts c JOIN pp ON pp.user_id = c.user_contract_user_id
           WHERE c.user_contract_end_date BETWEEN current_date AND current_date + 90`,
    leggi: (v) =>
      v === 0
        ? null
        : {
            tono: "attenzione",
            titolo: `${n(v)} ${plurale(v, "contratto scade", "contratti scadono")} nei prossimi 90 giorni`,
            dettaglio: "Rinnovo, trasformazione o uscita vanno decisi prima della scadenza.",
            azione: { etichetta: "Vedi le persone", href: "/users" },
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
    leggi: (v) =>
      v === 0
        ? null
        : {
            tono: "rischio",
            titolo: `${n(v)} ${plurale(v, "persona ha", "persone hanno")} un rischio d'uscita alto`,
            dettaglio: "Il modello incrocia anzianità, straordinari, assenze, obiettivi, clima e posizione nella banda.",
            azione: { etichetta: "Vedi i segnali", href: "/insights" },
          },
  },
  {
    chiave: "certificazioni-in-scadenza",
    aree: ["persone", "formazione"],
    sql: `WITH ${PP} SELECT count(*)::int AS valore, NULL::int AS prima
            FROM sys.sys_user_certifications c JOIN pp ON pp.user_id = c.user_certification_user_id
           WHERE c.user_certification_expires_date BETWEEN current_date AND current_date + 60`,
    leggi: (v) =>
      v === 0
        ? null
        : {
            tono: "attenzione",
            titolo: `${n(v)} ${plurale(v, "certificazione scade", "certificazioni scadono")} entro 60 giorni`,
            dettaglio: "Una certificazione scaduta può impedire di svolgere un'attività regolamentata.",
            azione: { etichetta: "Formazione", href: "/learning" },
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
    leggi: (v, imminenti) =>
      v === 0
        ? { tono: "positivo", titolo: "Nessuna richiesta di assenza in attesa", dettaglio: "Tutte le richieste hanno avuto una risposta.", azione: null }
        : {
            tono: (imminenti ?? 0) > 0 ? "attenzione" : "informazione",
            titolo: `${n(v)} ${plurale(v, "richiesta di assenza aspetta", "richieste di assenza aspettano")} una risposta`,
            dettaglio: imminenti ? `${n(imminenti)} ${plurale(imminenti, "comincia", "cominciano")} entro una settimana: chi le ha chieste deve saperlo in tempo.` : "Nessuna comincia entro la settimana.",
            azione: { etichetta: "Rispondi", href: "/approvals" },
          },
  },
  {
    chiave: "ferie-accumulate",
    aree: ["assenze"],
    sql: `WITH ${PP} SELECT count(DISTINCT b.balance_subject_user_id)::int AS valore, NULL::int AS prima
            FROM sys.sys_time_off_balances b JOIN pp ON pp.user_id = b.balance_subject_user_id
           WHERE b.balance_year = extract(year FROM current_date)::int
             AND coalesce(b.balance_total_days,0) + coalesce(b.balance_carryover_days,0)
                 + coalesce(b.balance_adjustment_days,0) - coalesce(b.balance_used_days,0) > 20`,
    leggi: (v) =>
      v === 0
        ? null
        : {
            tono: "attenzione",
            titolo: `${n(v)} ${plurale(v, "persona ha", "persone hanno")} più di 20 giorni di ferie da godere`,
            dettaglio: "Ferie accumulate sono un debito per l'azienda e un segnale di carico di lavoro: vanno pianificate.",
            azione: { etichetta: "Vedi i saldi", href: "/time-off" },
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
    leggi: (v, prima) =>
      v === 0 && !prima
        ? null
        : {
            tono: prima && v > prima * 1.25 ? "attenzione" : "informazione",
            titolo: `${n(v)} giorni di assenza negli ultimi 30 giorni`,
            dettaglio: prima ? `Erano ${n(prima)} nei 30 giorni prima.` : "Nessuna assenza nei 30 giorni prima.",
            azione: { etichetta: "Presenze", href: "/analytics/attendance" },
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
    leggi: (v, scaduti) =>
      v === 0 && !scaduti
        ? null
        : {
            tono: "rischio",
            titolo: v > 0 ? `${n(v)} ${plurale(v, "obiettivo è", "obiettivi sono")} a rischio o bloccati` : `${n(scaduti ?? 0)} obiettivi aperti oltre la scadenza`,
            dettaglio: scaduti ? `${n(scaduti)} ${plurale(scaduti, "obiettivo aperto ha", "obiettivi aperti hanno")} già superato la scadenza.` : "Nessun obiettivo aperto oltre la scadenza.",
            azione: { etichetta: "Vedi gli obiettivi", href: "/goals" },
          },
  },
  {
    chiave: "valutazioni-aperte",
    aree: ["valutazioni"],
    sql: `WITH ${PP} SELECT count(*)::int AS valore,
                 count(*) FILTER (WHERE r.review_period_end < current_date - 30)::int AS prima
            FROM sys.sys_performance_reviews r JOIN pp ON pp.user_id = r.review_subject_user_id
           WHERE r.review_status IN ('DRAFT','IN_PROGRESS','SUBMITTED')`,
    leggi: (v, ritardo) =>
      v === 0
        ? null
        : {
            tono: (ritardo ?? 0) > 0 ? "attenzione" : "informazione",
            titolo: `${n(v)} ${plurale(v, "valutazione è", "valutazioni sono")} ancora aperte`,
            dettaglio: ritardo ? `${n(ritardo)} ${plurale(ritardo, "riguarda", "riguardano")} un periodo chiuso da oltre un mese.` : "Tutte riguardano il periodo in corso.",
            azione: { etichetta: "Vedi le valutazioni", href: "/performance" },
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
    leggi: (v, obbligatori) =>
      v === 0
        ? { tono: "positivo", titolo: "Nessuna formazione in ritardo", dettaglio: "Ogni percorso assegnato è nei tempi.", azione: null }
        : {
            tono: (obbligatori ?? 0) > 0 ? "rischio" : "attenzione",
            titolo: `${n(v)} ${plurale(v, "percorso di formazione è", "percorsi di formazione sono")} oltre la scadenza`,
            dettaglio: obbligatori ? `${n(obbligatori)} ${plurale(obbligatori, "è obbligatorio", "sono obbligatori")}: un obbligo formativo scaduto è un rilievo in caso di verifica.` : "Nessuno è obbligatorio.",
            azione: { etichetta: "Formazione", href: "/learning" },
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
    leggi: (v, lunghe) =>
      v === 0
        ? null
        : {
            tono: (lunghe ?? 0) > 0 ? "attenzione" : "informazione",
            titolo: `${n(v)} ${plurale(v, "selezione è aperta", "selezioni sono aperte")}`,
            dettaglio: lunghe ? `${n(lunghe)} da oltre 60 giorni: conviene rivedere profilo o canali.` : "Tutte aperte da meno di 60 giorni.",
            azione: { etichetta: "Selezione", href: "/recruiting" },
          },
  },
  {
    chiave: "approvazioni-in-attesa",
    aree: ["approvazioni"],
    sql: `SELECT count(*)::int AS valore, NULL::int AS prima FROM sys.sys_approval_requests ar
           WHERE ar.approval_request_status = 'PENDING' AND $2::uuid[] IS NULL
             AND ($1::uuid[] IS NULL OR ar.approval_request_tenant_id = ANY($1::uuid[]))`,
    leggi: (v) =>
      v === 0
        ? null
        : {
            tono: "informazione",
            titolo: `${n(v)} ${plurale(v, "richiesta aspetta", "richieste aspettano")} un'approvazione`,
            dettaglio: "Sono le decisioni ferme nel flusso di approvazione del cliente.",
            azione: { etichetta: "Approvazioni", href: "/approvals" },
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
    leggi: (v) =>
      v === 0
        ? { tono: "positivo", titolo: "Ogni utenza attiva ha un ruolo", dettaglio: "Nessuno entra senza sapere che cosa può fare.", azione: null }
        : {
            tono: "attenzione",
            titolo: `${n(v)} ${plurale(v, "utenza attiva non ha", "utenze attive non hanno")} nessun ruolo`,
            dettaglio: "Entrano ma non vedono niente: o il ruolo manca, o l'utenza andrebbe chiusa.",
            azione: { etichetta: "Vedi gli utenti", href: "/users" },
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
    leggi: (v) =>
      v === 0
        ? { tono: "positivo", titolo: "Tutte le utenze hanno il secondo fattore", dettaglio: "Ogni accesso chiede più della sola password.", azione: null }
        : {
            tono: "attenzione",
            titolo: `${n(v)} ${plurale(v, "persona entra", "persone entrano")} con la sola password`,
            dettaglio: "Senza secondo fattore un accesso rubato basta per entrare: va attivato.",
            azione: { etichetta: "Regole del secondo fattore", href: "/admin/mfa-policy" },
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
    leggi: (v, tot) =>
      !tot
        ? null
        : v === 0
          ? { tono: "positivo", titolo: `Tutti i ${n(tot)} processi hanno un responsabile al suo posto`, dettaglio: "Ogni processo ha una persona che ne risponde.", azione: null }
          : {
              tono: "rischio",
              titolo: `${n(v)} processi su ${n(tot)} non hanno un responsabile in carica`,
              dettaglio: "Il processo c'è, ma la posizione che ne risponde manca o è scoperta: nessuno lo presidia.",
              azione: { etichetta: "Vedi i processi", href: "/processes" },
            },
  },
  {
    chiave: "documenti-da-rivedere",
    aree: ["contenuti"],
    sql: `SELECT count(*) FILTER (WHERE d.document_status = 'in_review')::int AS valore,
                  count(*) FILTER (WHERE d.document_status = 'published' AND d.document_expires_date < current_date)::int AS prima
             FROM sys.sys_content_documents d
            WHERE $2::uuid[] IS NULL AND ($1::uuid[] IS NULL OR d.document_tenant_id = ANY($1::uuid[]))`,
    leggi: (v, scaduti) =>
      v === 0 && !scaduti
        ? { tono: "positivo", titolo: "Nessun documento fermo in revisione né scaduto", dettaglio: "Il regolamento pubblicato è quello in vigore.", azione: null }
        : {
            tono: scaduti ? "attenzione" : "informazione",
            titolo: `${n(v)} in revisione, ${n(scaduti ?? 0)} pubblicati ma scaduti`,
            dettaglio: "Un documento scaduto ancora pubblicato dice alle persone una regola che non vale più.",
            azione: { etichetta: "Vedi i documenti", href: "/content" },
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
    leggi: (vecchie, aperte) =>
      !aperte
        ? { tono: "positivo", titolo: "Nessuna segnalazione aperta", dettaglio: "Ogni segnalazione ricevuta ha avuto un esito.", azione: null }
        : {
            tono: vecchie ? "rischio" : "informazione",
            titolo: `${n(aperte)} ${plurale(aperte, "segnalazione aperta", "segnalazioni aperte")}, ${n(vecchie)} da oltre 30 giorni`,
            dettaglio: "La legge chiede un riscontro a chi segnala entro tre mesi: le più vecchie vanno chiuse per prime.",
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
    leggi: (v, tot) =>
      !tot
        ? null
        : v === 0
          ? { tono: "positivo", titolo: `I ${n(tot)} progetti attivi sono nei tempi`, dettaglio: "Nessuno ha superato la data di fine.", azione: null }
          : {
              tono: "attenzione",
              titolo: `${n(v)} progetti attivi su ${n(tot)} hanno superato la data di fine`,
              dettaglio: "O vanno chiusi, o la data va rivista: un progetto senza termine credibile non si governa.",
              azione: { etichetta: "Vedi i progetti", href: "/projects" },
            },
  },
  {
    chiave: "contatti-da-richiamare",
    aree: ["contatti"],
    sql: `SELECT count(*) FILTER (WHERE l.created_at < now() - interval '3 days')::int AS valore, count(*)::int AS prima
             FROM sys.sys_leads l
            WHERE l.lead_status = 'NEW' AND $1::uuid[] IS NULL AND $2::uuid[] IS NULL`,
    leggi: (v, nuovi) =>
      !nuovi
        ? { tono: "positivo", titolo: "Nessun contatto nuovo in attesa", dettaglio: "Ogni richiesta arrivata dal sito è stata presa in carico.", azione: null }
        : {
            tono: v ? "attenzione" : "informazione",
            titolo: `${n(nuovi)} ${plurale(nuovi, "contatto nuovo", "contatti nuovi")}, ${n(v)} in attesa da oltre 3 giorni`,
            dettaglio: "Un contatto che aspetta si raffredda: va richiamato.",
            azione: { etichetta: "Vedi i contatti", href: "/leads" },
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
    leggi: (v) =>
      v === 0
        ? null
        : {
            tono: "attenzione",
            titolo: `${n(v)} ${plurale(v, "contratto applica", "contratti applicano")} un CCNL diverso da quello del resto dell'azienda`,
            dettaglio: "Può essere corretto (un dirigente, una società del gruppo), ma più spesso è un dato sbagliato: va controllato.",
            azione: { etichetta: "Vedi le persone", href: "/users" },
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
           WHERE b.balance_subject_user_id = ($1::uuid[])[1] AND b.balance_year = extract(year FROM current_date)::int`,
    leggi: (v) => ({
      tono: v > 20 ? "attenzione" : "informazione",
      titolo: `Hai ${n(v)} giorni di ferie e permessi da godere quest'anno`,
      dettaglio: v > 20 ? "Sono tanti: pianificali con il tuo responsabile prima della fine dell'anno." : "Il saldo comprende maturato, riporto e rettifiche.",
      azione: { etichetta: "Le mie assenze", href: "/me/time-off" },
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
    leggi: (v, tot) =>
      !tot
        ? null
        : {
            tono: v > 0 ? "attenzione" : "positivo",
            titolo: v > 0 ? `${n(v)} dei tuoi ${n(tot)} obiettivi aperti ${plurale(v, "chiede", "chiedono")} attenzione` : `I tuoi ${n(tot)} obiettivi aperti sono nei tempi`,
            dettaglio: v > 0 ? "Sono a rischio, bloccati o oltre la scadenza." : "Nessuno è a rischio o in ritardo.",
            azione: { etichetta: "I miei obiettivi", href: "/me/performance" },
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
    leggi: (v, tot) =>
      !tot
        ? null
        : {
            tono: v > 0 ? "attenzione" : "informazione",
            titolo: `Hai ${n(tot)} ${plurale(tot, "percorso", "percorsi")} di formazione da completare`,
            dettaglio: v > 0 ? `${n(v)} ${plurale(v, "scade", "scadono")} entro 30 giorni.` : "Nessuno scade entro 30 giorni.",
            azione: { etichetta: "La mia formazione", href: "/me/learning" },
          },
  },
  {
    chiave: "mie-richieste",
    aree: ["personale"],
    personale: true,
    sql: `SELECT count(*)::int AS valore, NULL::int AS prima FROM sys.sys_time_off_requests r
           WHERE r.request_subject_user_id = ($1::uuid[])[1] AND r.request_status = 'PENDING'`,
    leggi: (v) =>
      v === 0
        ? null
        : {
            tono: "informazione",
            titolo: `${n(v)} ${plurale(v, "tua richiesta di assenza aspetta", "tue richieste di assenza aspettano")} una risposta`,
            dettaglio: "Il tuo responsabile la vede nelle sue approvazioni.",
            azione: { etichetta: "Le mie assenze", href: "/me/time-off" },
          },
  },
];
