/**
 * apps/api/src/modules/tenant-import-runs/validation.ts
 * #206 T4 — la validazione di una persona contro il PROFILO ATTESO della posizione (E19).
 *
 * E19 (Enzo, 2026-08-16): *«i dati iniziali non sono riempitivo: sono i parametri di controllo
 * dell'importazione. Quando arriveranno le persone reali, quei dati diranno se la persona ha le
 * caratteristiche necessarie per essere iniettata nel tenant.»*
 *
 * Il profilo atteso ESISTE GIA' e non si costruisce: `sys_position_skill_requirements`. Il taglio
 * e' `criticality = 'CRITICAL'` — l'unico che porta un significato gia' scritto nei dati (gli altri
 * tre livelli sono gradazioni, CRITICAL e' una dichiarazione; `weight` non ha una soglia che
 * qualcuno abbia mai deciso). Lo stesso criterio della vista `v_positions_with_critical_skill_gap`
 * (T5), cosi' che cio' che la validazione dice PRIMA dell'iniezione e cio' che la vista mostra DOPO
 * siano la stessa misura.
 *
 *   N = requisiti CRITICAL della posizione
 *   M = quanti di quegli N la persona dichiara
 *   AMMESSA (M = N) · AMMESSA_CON_SCOSTAMENTO (M < N) · CIECA (N = 0)
 *
 * ⚠ `CIECA` NON E' UN DETTAGLIO. Su un'azienda appena costruita da P3 e' il caso piu' frequente,
 *   e un AMMESSA con N = 0 non e' una verifica superata: e' «non c'era niente da controllare».
 *   Chi legge «tutte ammesse» deve poter sapere se e' perche' sono brave o perche' non c'era
 *   nessuna domanda. E' il principio dell'universo dichiarato di `verifica_incrociata.py`.
 *
 * ⚠ Il verdetto MISURA, non decide: non esiste `RIFIUTATA`. Che cosa fare di una persona che
 *   non copre i requisiti critici e' E25 (la persona entra sempre, la posizione resta segnalata).
 *
 * Le regole qui sotto sono le sole «tipizzazioni» che P4 fa: la tabella di atterraggio non ne
 * impone nessuna (T2), e ogni fallimento ha QUI un nome e una riga.
 */
import type { DbConnector } from "../tenant-materialization/build-source.js";
import type { E19Esito, TenantImportRow, TenantImportRuleCode } from "@heuresys/shared";

export type StatoRegola = "PASSED" | "FAILED" | "WARNING" | "SKIPPED";

export interface EsitoRegola {
  ruleCode: TenantImportRuleCode;
  status: StatoRegola;
  message: string | null;
  payload: Record<string, unknown>;
}

/** Il profilo atteso di una posizione, letto dal database: i requisiti CRITICAL con nome e codice. */
export interface RequisitoCritico {
  skillId: string;
  skillCode: string;
  skillName: string;
}

/** Il pezzo puro di E19: N, M, l'elenco di cio' che manca, e l'esito. Nessun accesso al database. */
export function valutaCoperturaCritica(
  attesi: readonly RequisitoCritico[],
  codiciDichiarati: ReadonlySet<string>,
): { esito: E19Esito; attesi: number; mancanti: RequisitoCritico[] } {
  if (attesi.length === 0) return { esito: "CIECA", attesi: 0, mancanti: [] };
  const mancanti = attesi.filter((r) => !codiciDichiarati.has(r.skillCode));
  return {
    esito: mancanti.length === 0 ? "AMMESSA" : "AMMESSA_CON_SCOSTAMENTO",
    attesi: attesi.length,
    mancanti,
  };
}

/** `skill_codes` del cliente: codici separati da ';', spazi tolti, vuoti ignorati, MAIUSCOLI. */
export function codiciCompetenza(skillCodes: string | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const parte of (skillCodes ?? "").split(";")) {
    const c = parte.trim().toUpperCase();
    if (c) out.add(c);
  }
  return out;
}

/**
 * La data di assunzione: si prova a leggerla come ISO (`2024-02-29`) o italiana (`29/02/2024`),
 * e si controlla che il giorno ESISTA — `31/02/2024` deve essere respinto qui, con un nome, dopo
 * essere entrato indenne nella tabella di atterraggio (la prova di T2).
 */
export function leggiData(testo: string | null | undefined): string | null {
  const t = (testo ?? "").trim();
  if (!t) return null;
  let y: number, m: number, d: number;
  let iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (iso) {
    [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else {
    iso = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
    if (!iso) return null;
    [d, m, y] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  }
  const data = new Date(Date.UTC(y, m - 1, d));
  if (data.getUTCFullYear() !== y || data.getUTCMonth() !== m - 1 || data.getUTCDate() !== d) return null;
  return `${y.toString().padStart(4, "0")}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
}

/** L'email: l'unico campo senza il quale una persona non puo' esistere in `sys_users`. */
export function emailNormalizzata(email: string | null | undefined): string | null {
  const e = (email ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

export interface PosizioneTrovata {
  positionId: string;
  positionCode: string;
  positionTitle: string;
  /** L'occupante PRIMARY ACTIVE, se c'e', col suo tipo: e' cio' che decide se la posizione e' vacante. */
  occupante: { userId: string; userType: string; email: string } | null;
}

export async function trovaPosizione(
  db: DbConnector,
  tenantId: string,
  positionCode: string | null | undefined,
): Promise<PosizioneTrovata | null> {
  const code = (positionCode ?? "").trim();
  if (!code) return null;
  const r = await db.query<{
    position_id: string; position_code: string; position_title: string;
    user_id: string | null; user_type: string | null; user_email: string | null;
  }>(
    `SELECT p.position_id, p.position_code, p.position_title, u.user_id, u.user_type, u.user_email
       FROM sys.sys_positions p
       LEFT JOIN sys.sys_user_position_assignments a
         ON a.user_position_assignment_position_id = p.position_id
        AND a.user_position_assignment_kind = 'PRIMARY'
        AND a.user_position_assignment_status = 'ACTIVE'
       LEFT JOIN sys.sys_users u ON u.user_id = a.user_position_assignment_user_id
      WHERE p.position_tenant_id = $1 AND p.position_code = $2 AND p.position_is_active = true
      ORDER BY a.user_position_assignment_start_date DESC NULLS LAST
      LIMIT 1`,
    [tenantId, code],
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    positionId: row.position_id,
    positionCode: row.position_code,
    positionTitle: row.position_title,
    occupante: row.user_id
      ? { userId: row.user_id, userType: row.user_type ?? "STANDARD", email: row.user_email ?? "" }
      : null,
  };
}

export async function requisitiCritici(db: DbConnector, positionId: string): Promise<RequisitoCritico[]> {
  const r = await db.query<{ skill_id: string; skill_code: string; skill_name: string }>(
    `SELECT s.skill_id, s.skill_code, s.skill_name
       FROM sys.sys_position_skill_requirements req
       JOIN sys.sys_skills s ON s.skill_id = req.skill_id
      WHERE req.position_id = $1 AND req.criticality = 'CRITICAL'
      ORDER BY s.skill_code`,
    [positionId],
  );
  return r.rows.map((x) => ({ skillId: x.skill_id, skillCode: x.skill_code.toUpperCase(), skillName: x.skill_name }));
}

export interface VerdettoPersona {
  regole: EsitoRegola[];
  /** PASSED se nessuna regola e' FAILED ne' WARNING; WARNING se almeno una WARNING; FAILED se almeno una FAILED. */
  stato: "PASSED" | "WARNING" | "FAILED";
  e19: E19Esito | null;
  posizione: PosizioneTrovata | null;
  email: string | null;
  hireDate: string | null;
}

/**
 * Tutte le regole su una persona, nell'ordine in cui un lettore vuole vederle: prima cio' che
 * impedisce l'iniezione (email, persona gia' presente, posizione), poi cio' che la qualifica.
 */
export async function valutaPersona(db: DbConnector, tenantId: string, riga: TenantImportRow): Promise<VerdettoPersona> {
  const regole: EsitoRegola[] = [];

  const email = emailNormalizzata(riga.email);
  regole.push(email
    ? { ruleCode: "PERSON_EMAIL", status: "PASSED", message: null, payload: { email } }
    : { ruleCode: "PERSON_EMAIL", status: "FAILED", message: "email assente o non leggibile: senza, la persona non puo' esistere", payload: { email: riga.email ?? null } });

  if (email) {
    const gia = await db.query<{ user_id: string; user_type: string }>(
      `SELECT user_id, user_type FROM sys.sys_users WHERE user_tenant_id = $1 AND lower(user_email) = $2`,
      [tenantId, email],
    );
    const p = gia.rows[0];
    regole.push(p
      ? { ruleCode: "PERSON_NOT_YET_PRESENT", status: "FAILED", message: `una persona con questa email esiste gia' nell'azienda (${p.user_type})`, payload: { userId: p.user_id, userType: p.user_type } }
      : { ruleCode: "PERSON_NOT_YET_PRESENT", status: "PASSED", message: null, payload: {} });
  }

  const posizione = await trovaPosizione(db, tenantId, riga.position_code);
  regole.push(posizione
    ? { ruleCode: "POSITION_EXISTS", status: "PASSED", message: null, payload: { positionId: posizione.positionId, positionCode: posizione.positionCode } }
    : { ruleCode: "POSITION_EXISTS", status: "FAILED", message: `posizione «${(riga.position_code ?? "").trim() || "—"}» non trovata fra quelle attive dell'azienda`, payload: { positionCode: riga.position_code ?? null } });

  let e19: E19Esito | null = null;
  if (posizione) {
    // Vacante: si entra. Occupata da un SEGNAPOSTO: si entra e il segnaposto cede il posto
    // (SUPERSEDED, T7). Occupata da una PERSONA: non si entra — non e' P4 a decidere chi
    // lascia una posizione.
    const occ = posizione.occupante;
    if (!occ) {
      regole.push({ ruleCode: "POSITION_VACANT", status: "PASSED", message: null, payload: {} });
    } else if (occ.userType === "GENERATED_INCUMBENT") {
      regole.push({ ruleCode: "POSITION_VACANT", status: "WARNING", message: `occupata dal segnaposto ${occ.email}: cedera' il posto (SUPERSEDED)`, payload: { placeholderUserId: occ.userId, placeholderEmail: occ.email } });
    } else {
      regole.push({ ruleCode: "POSITION_VACANT", status: "FAILED", message: `occupata da una persona (${occ.email}): l'importazione non sostituisce persone`, payload: { occupantUserId: occ.userId, occupantEmail: occ.email } });
    }

    const attesi = await requisitiCritici(db, posizione.positionId);
    const cop = valutaCoperturaCritica(attesi, codiciCompetenza(riga.skill_codes));
    e19 = cop.esito;
    const payload = {
      esito: cop.esito,
      attesi: cop.attesi,
      mancanti: cop.mancanti.map((m) => ({ skillCode: m.skillCode, skillName: m.skillName })),
    };
    if (cop.esito === "CIECA") {
      regole.push({ ruleCode: "E19_CRITICAL_SKILL_COVERAGE", status: "SKIPPED", message: "la posizione non dichiara requisiti CRITICAL: verifica CIECA, non superata", payload });
    } else if (cop.esito === "AMMESSA") {
      regole.push({ ruleCode: "E19_CRITICAL_SKILL_COVERAGE", status: "PASSED", message: null, payload });
    } else {
      regole.push({ ruleCode: "E19_CRITICAL_SKILL_COVERAGE", status: "WARNING", message: `mancano ${cop.mancanti.length} requisiti CRITICAL su ${cop.attesi}: ${cop.mancanti.map((m) => m.skillName).join(", ")}`, payload });
    }
  }

  const hireDate = leggiData(riga.hire_date);
  const hireTesto = (riga.hire_date ?? "").trim();
  regole.push(!hireTesto
    ? { ruleCode: "HIRE_DATE_PARSEABLE", status: "SKIPPED", message: "data di assunzione assente: l'incarico partira' da oggi", payload: {} }
    : hireDate
      ? { ruleCode: "HIRE_DATE_PARSEABLE", status: "PASSED", message: null, payload: { hireDate } }
      : { ruleCode: "HIRE_DATE_PARSEABLE", status: "WARNING", message: `«${hireTesto}» non e' una data esistente: l'incarico partira' da oggi`, payload: { raw: hireTesto } });

  const stato: VerdettoPersona["stato"] = regole.some((r) => r.status === "FAILED")
    ? "FAILED"
    : regole.some((r) => r.status === "WARNING") ? "WARNING" : "PASSED";

  return { regole, stato, e19, posizione, email, hireDate };
}
