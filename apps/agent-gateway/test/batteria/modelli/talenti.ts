/**
 * Dominio D1 «Talenti, tavole di rimpiazzo, carriere e percorsi» (piano AI-driven, D1).
 *
 * Fonti, le stesse che l'API mostra: posizioni critiche (`sys_critical_positions`), tavole di
 * rimpiazzo (`sys_succession_pools` + `sys_successor_candidates`), rischio di uscita
 * (`sys_flight_risk_scores`), matrice dei talenti (`sys_talent_scores`), piani di carriera e
 * posizioni obiettivo, mentoring, percorsi di carriera e formativi. Il perimetro di un
 * responsabile è quello di `orgSubtreeUserIds` (apps/api/src/lib/scope/org.ts).
 */
import { PROFILI } from "../profili.js";
import type { Bozza, Dominio, Interroga, Modello, Riga } from "../genera.js";

const TENANT = "(SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK')";
const nome = (u: string) => `${u}.user_last_name || ', ' || ${u}.user_first_name`;

/** I candidati delle tavole di rimpiazzo: posizione, persona, prontezza. */
const CANDIDATI = `SELECT p.position_title AS posizione, u.user_id, ${nome("u")} AS nome, c.successor_candidate_readiness_level AS prontezza
    FROM sys.sys_successor_candidates c
    JOIN sys.sys_succession_pools s ON s.succession_pool_id = c.successor_candidate_pool_id
    JOIN sys.sys_positions p ON p.position_id = s.succession_pool_position_id
    JOIN sys.sys_users u ON u.user_id = c.successor_candidate_user_id
   WHERE c.successor_candidate_tenant_id = ${TENANT}`;

const CRITICHE = `SELECT p.position_id, p.position_title AS titolo
    FROM sys.sys_critical_positions cp JOIN sys.sys_positions p ON p.position_id = cp.critical_position_position_id
   WHERE cp.critical_position_tenant_id = ${TENANT}`;

const RISCHIO = `SELECT DISTINCT ON (f.flight_risk_score_user_id) f.flight_risk_score_user_id AS user_id,
         f.flight_risk_score_band AS fascia, f.flight_risk_score_value AS valore, ${nome("u")} AS nome
    FROM sys.sys_flight_risk_scores f JOIN sys.sys_users u ON u.user_id = f.flight_risk_score_user_id
   WHERE f.flight_risk_score_tenant_id = ${TENANT}
   ORDER BY f.flight_risk_score_user_id, f.flight_risk_score_computed_at DESC`;

const TALENTI = `SELECT DISTINCT ON (t.talent_score_user_id) t.talent_score_user_id AS user_id,
         t.talent_score_band AS fascia, t.talent_score_potential AS potenziale, ${nome("u")} AS nome
    FROM sys.sys_talent_scores t JOIN sys.sys_users u ON u.user_id = t.talent_score_user_id
   WHERE t.talent_score_tenant_id = ${TENANT}
   ORDER BY t.talent_score_user_id, t.talent_score_computed_at DESC`;

/** Le persone di un'unità e di quelle sotto (assegnazioni attive); $1 = nome dell'unità. */
const NELL_UNITA = `WITH RECURSIVE albero AS (
      SELECT organization_unit_id AS id FROM sys.sys_organization_units
       WHERE organization_unit_tenant_id = ${TENANT} AND organization_unit_is_active AND organization_unit_name = $1
      UNION SELECT o.organization_unit_id FROM sys.sys_organization_units o JOIN albero a ON o.organization_unit_parent_id = a.id
       WHERE o.organization_unit_is_active),
    persone AS (SELECT DISTINCT x.user_position_assignment_user_id AS user_id
      FROM sys.sys_user_position_assignments x
      JOIN sys.sys_positions p ON p.position_id = x.user_position_assignment_position_id
      JOIN albero a ON a.id = p.position_organization_unit_id
     WHERE x.user_position_assignment_status = 'ACTIVE')`;

/** Il perimetro di un responsabile; $1 = email. Come `orgSubtreeUserIds` (sé compreso). */
const PERIMETRO = `WITH RECURSIVE io AS (SELECT user_id FROM sys.sys_users WHERE user_email = $1),
    albero AS (
      SELECT o.organization_unit_id AS id FROM sys.sys_organization_units o, io
       WHERE o.organization_unit_manager_user_id = io.user_id AND o.organization_unit_is_active
      UNION SELECT o.organization_unit_id FROM sys.sys_organization_units o JOIN albero a ON o.organization_unit_parent_id = a.id
       WHERE o.organization_unit_is_active),
    persone AS (SELECT x.user_position_assignment_user_id AS user_id
      FROM sys.sys_user_position_assignments x
      JOIN sys.sys_positions p ON p.position_id = x.user_position_assignment_position_id
      JOIN albero a ON a.id = p.position_organization_unit_id
     WHERE x.user_position_assignment_status = 'ACTIVE'
     UNION SELECT user_id FROM io)`;

const testo = (r: Riga, c: string) => String(r[c]);
const colonna = async (q: Interroga, sql: string, c = "v", p: unknown[] = []) => (await q(sql, p)).map((r) => testo(r, c));
/** Un elemento ogni `passo`, per variare senza esplodere. Deterministico. */
const ogni = <T>(x: T[], passo: number, da = 0) => x.filter((_, i) => i % passo === da);

const FASCE_RISCHIO = [["LOW", "basso"], ["MEDIUM", "medio"], ["HIGH", "alto"]] as const;
const FASCE_TALENTO = [["STAR", "Star"], ["HIGH_PERFORMER", "High performer"], ["CORE", "Core"]] as const;
const PRONTEZZE = [["READY_NOW", "Pronto subito"], ["READY_6_MONTHS", "Pronto entro 6 mesi"], ["READY_1_YEAR", "Pronto entro 1 anno"], ["READY_2_YEARS", "Pronto entro 2 anni"]] as const;
const ESITI = [["APPROVED", "approvate"], ["PENDING_REVIEW", "in attesa"], ["REJECTED", "respinte"]] as const;

const criticheOrdinate = (q: Interroga) => colonna(q, `SELECT titolo AS v FROM (${CRITICHE}) k ORDER BY titolo`);
const divisioni = (q: Interroga) =>
  colonna(q, `SELECT organization_unit_name AS v FROM sys.sys_organization_units
    WHERE organization_unit_tenant_id = ${TENANT} AND organization_unit_is_active AND organization_unit_name LIKE 'Divisione %' ORDER BY 1`);
const candidatiPersone = (q: Interroga) => colonna(q, `SELECT DISTINCT nome AS v FROM (${CANDIDATI}) c ORDER BY 1`);

const hr = (b: Omit<Bozza, "profilo">): Bozza => ({ profilo: "hr", ...b });

const posizioniCritiche: Modello = {
  chiave: "critiche",
  bozze: async (q) => {
    const out: Bozza[] = [
      hr({ categoria: "posizioni-critiche", testo: "Quante posizioni sono registrate come critiche?", confronto: "numero", sql: `SELECT count(*) AS n FROM (${CRITICHE}) k` }),
      hr({ categoria: "posizioni-critiche", testo: "Elenca tutte le posizioni registrate come critiche.", confronto: "insieme", sql: `SELECT titolo AS nome, true AS dentro FROM (${CRITICHE}) k ORDER BY 1` }),
      hr({ categoria: "posizioni-critiche", testo: "Quante posizioni critiche non hanno nessun successore candidato nelle tavole di rimpiazzo?", confronto: "numero", sql: `SELECT count(*) AS n FROM (${CRITICHE}) k WHERE NOT EXISTS (SELECT 1 FROM (${CANDIDATI}) c WHERE c.posizione = k.titolo)` }),
      hr({ categoria: "posizioni-critiche", testo: "Quante posizioni critiche non hanno, nel proprio bacino di successione, nessun candidato pronto subito?", confronto: "numero", sql: `SELECT count(*) AS n FROM (${CRITICHE}) k WHERE NOT EXISTS (SELECT 1 FROM (${CANDIDATI}) c WHERE c.posizione = k.titolo AND c.prontezza = 'READY_NOW')` }),
      hr({ categoria: "posizioni-critiche", testo: "Quali posizioni critiche non hanno, nel proprio bacino di successione, nessun candidato pronto subito?", confronto: "insieme", sql: `SELECT k.titolo AS nome, NOT EXISTS (SELECT 1 FROM (${CANDIDATI}) c WHERE c.posizione = k.titolo AND c.prontezza = 'READY_NOW') AS dentro FROM (${CRITICHE}) k ORDER BY 1` }),
      hr({ categoria: "posizioni-critiche", testo: "Quante posizioni critiche hanno, nel proprio bacino di successione, almeno un candidato pronto subito?", confronto: "numero", sql: `SELECT count(*) AS n FROM (${CRITICHE}) k WHERE EXISTS (SELECT 1 FROM (${CANDIDATI}) c WHERE c.posizione = k.titolo AND c.prontezza = 'READY_NOW')` }),
    ];
    // Vero o falso su posizioni critiche e non critiche.
    const non = await colonna(q, `SELECT DISTINCT position_title AS v FROM sys.sys_positions p
      WHERE position_tenant_id = ${TENANT} AND position_is_active AND position_title NOT IN (SELECT titolo FROM (${CRITICHE}) k)
        AND position_title LIKE 'Responsabile %' ORDER BY 1`);
    for (const t of [...ogni(await criticheOrdinate(q), 2), ...ogni(non, 3).slice(0, 5)]) {
      out.push(hr({ categoria: "posizioni-critiche", testo: `La posizione «${t}» è registrata fra le posizioni critiche? Rispondi sì o no.`, confronto: "veroFalso", sql: `SELECT EXISTS (SELECT 1 FROM (${CRITICHE}) k WHERE k.titolo = $1) AS vero`, parametri: [t] }));
    }
    return out;
  },
};

const rimpiazzo: Modello = {
  chiave: "rimpiazzo",
  bozze: async (q) => {
    const out: Bozza[] = [];
    // I titolari e i candidati di altre tavole non sono «nomi in più» se citati come titolare della posizione.
    const universo = (filtro: string) => `SELECT nome, bool_or(${filtro}) AS dentro FROM (${CANDIDATI}) c
      WHERE c.user_id NOT IN (SELECT x.user_position_assignment_user_id FROM sys.sys_user_position_assignments x
          JOIN sys.sys_positions p ON p.position_id = x.user_position_assignment_position_id
         WHERE x.user_position_assignment_status = 'ACTIVE' AND p.position_title = $1)
      GROUP BY nome ORDER BY 1`;
    for (const t of await criticheOrdinate(q)) {
      out.push(
        hr({ categoria: "successori", testo: `Chi sono i successori candidati nel bacino di successione della posizione «${t}»?`, confronto: "insieme", sql: universo("c.posizione = $1"), parametri: [t] }),
        hr({ categoria: "successori", testo: `Quanti successori candidati ci sono nel bacino di successione della posizione «${t}»?`, confronto: "numero", sql: `SELECT count(*) AS n FROM (${CANDIDATI}) c WHERE c.posizione = $1`, parametri: [t] }),
        hr({ categoria: "prontezza", testo: `Per il bacino di successione della posizione «${t}», elenca i successori candidati con la loro prontezza.`, confronto: "coppie", vocabolario: "prontezza", sql: `SELECT nome, prontezza AS etichetta, true AS dentro FROM (${CANDIDATI}) c WHERE c.posizione = $1 ORDER BY 1`, parametri: [t] }),
        hr({ categoria: "prontezza", testo: `Nel bacino di successione della posizione «${t}» c'è almeno un candidato pronto subito? Rispondi sì o no.`, confronto: "veroFalso", sql: `SELECT EXISTS (SELECT 1 FROM (${CANDIDATI}) c WHERE c.posizione = $1 AND c.prontezza = 'READY_NOW') AS vero`, parametri: [t] }),
        hr({ categoria: "prontezza", testo: `Chi, fra i candidati del bacino di successione della posizione «${t}», è pronto subito?`, confronto: "insieme", sql: universo("c.posizione = $1 AND c.prontezza = 'READY_NOW'"), parametri: [t] }),
      );
    }
    for (const [codice, parole] of PRONTEZZE) {
      out.push(
        hr({ categoria: "prontezza", testo: `Nelle tavole di rimpiazzo, quanti successori candidati hanno come livello di prontezza esattamente «${parole}»?`, confronto: "numero", sql: `SELECT count(*) AS n FROM (${CANDIDATI}) c WHERE c.prontezza = $1`, parametri: [codice] }),
        hr({ categoria: "prontezza", testo: `Elenca le persone che nelle tavole di rimpiazzo hanno come livello di prontezza esattamente «${parole}».`, confronto: "insieme", sql: `SELECT nome, bool_or(prontezza = $1) AS dentro FROM (${CANDIDATI}) c GROUP BY nome ORDER BY 1`, parametri: [codice] }),
      );
    }
    out.push(
      hr({ categoria: "successori", testo: "Quanti successori candidati ci sono in tutto nelle tavole di rimpiazzo?", confronto: "numero", sql: `SELECT count(*) AS n FROM (${CANDIDATI}) c` }),
      hr({ categoria: "successori", testo: "Quante tavole di rimpiazzo attive ci sono?", confronto: "numero", sql: `SELECT count(*) AS n FROM sys.sys_succession_pools WHERE succession_pool_tenant_id = ${TENANT} AND succession_pool_status = 'ACTIVE'` }),
    );
    const persone = await candidatiPersone(q);
    for (const p of persone) {
      out.push(hr({ categoria: "successori", testo: `Nei bacini di successione, per quale posizione ${p} è fra i successori candidati?`, confronto: "insieme", sql: `SELECT DISTINCT k.titolo AS nome, EXISTS (SELECT 1 FROM (${CANDIDATI}) c WHERE c.posizione = k.titolo AND c.nome = $1) AS dentro
        FROM (${CRITICHE}) k WHERE k.titolo NOT IN (SELECT p.position_title FROM sys.sys_user_position_assignments x JOIN sys.sys_positions p ON p.position_id = x.user_position_assignment_position_id JOIN sys.sys_users u ON u.user_id = x.user_position_assignment_user_id WHERE x.user_position_assignment_status = 'ACTIVE' AND ${nome("u")} = $1) ORDER BY 1`, parametri: [p] }));
    }
    for (const p of ogni(persone, 2, 1)) {
      out.push(hr({ categoria: "prontezza", testo: `Nei bacini di successione, con quale prontezza ${p} è fra i successori candidati?`, confronto: "etichetta", vocabolario: "prontezza", sql: `SELECT min(prontezza) AS etichetta FROM (${CANDIDATI}) c WHERE c.nome = $1 HAVING count(DISTINCT prontezza) = 1`, parametri: [p] }));
    }
    return out;
  },
};

const rischio: Modello = {
  chiave: "rischio",
  bozze: async (q) => {
    const out: Bozza[] = [];
    for (const [codice, parola] of FASCE_RISCHIO) {
      out.push(hr({ categoria: "rischio-uscita", testo: `Secondo il punteggio di rischio di uscita, quante persone sono oggi nella fascia «${parola}»?`, confronto: "numero", sql: `SELECT count(*) AS n FROM (${RISCHIO}) r WHERE fascia = $1`, parametri: [codice] }));
    }
    out.push(
      hr({ categoria: "rischio-uscita", testo: "Secondo il punteggio di rischio di uscita, quali persone sono oggi nella fascia «medio»?", confronto: "insieme", sql: `SELECT nome, fascia = 'MEDIUM' AS dentro FROM (${RISCHIO}) r ORDER BY 1` }),
      hr({ categoria: "rischio-uscita", testo: "Qual è la persona con il punteggio di rischio di uscita più alto?", confronto: "primo", sql: `SELECT nome, valore = (SELECT max(valore) FROM (${RISCHIO}) m) AS dentro FROM (${RISCHIO}) r ORDER BY valore DESC, nome` }),
      hr({ categoria: "rischio-uscita", testo: "Chi sono le tre persone con il punteggio di rischio di uscita più alto, in ordine decrescente?", confronto: "ordine", sql: `SELECT nome, valore AS valore, row_number() OVER (ORDER BY valore DESC, nome) <= 3 AS dentro FROM (${RISCHIO}) r ORDER BY valore DESC, nome` }),
      hr({ categoria: "rischio-uscita", testo: "Quanti successori candidati delle tavole di rimpiazzo nel punteggio di rischio di uscita sono nella fascia «medio» o «alto»?", confronto: "numero", sql: `SELECT count(DISTINCT c.user_id) AS n FROM (${CANDIDATI}) c JOIN (${RISCHIO}) r ON r.user_id = c.user_id WHERE r.fascia IN ('MEDIUM','HIGH')` }),
      hr({ categoria: "rischio-uscita", testo: "Quali successori candidati delle tavole di rimpiazzo nel punteggio di rischio di uscita sono nella fascia «medio» o «alto»?", confronto: "insieme", sql: `SELECT c.nome, bool_or(r.fascia IN ('MEDIUM','HIGH')) AS dentro FROM (${CANDIDATI}) c LEFT JOIN (${RISCHIO}) r ON r.user_id = c.user_id GROUP BY c.nome ORDER BY 1` }),
    );
    const persone = await colonna(q, `(SELECT nome AS v FROM (${RISCHIO}) r WHERE fascia = 'MEDIUM' ORDER BY nome LIMIT 5)
      UNION ALL (SELECT nome FROM (${RISCHIO}) r WHERE fascia = 'LOW' ORDER BY nome LIMIT 4)`);
    for (const p of persone) {
      out.push(hr({ categoria: "rischio-uscita", testo: `Qual è la fascia di rischio di uscita di ${p}?`, confronto: "etichetta", vocabolario: "rischio", sql: `SELECT fascia AS etichetta FROM (${RISCHIO}) r WHERE nome = $1`, parametri: [p] }));
    }
    for (const p of [...persone.slice(0, 2), ...persone.slice(-2)]) {
      out.push(hr({ categoria: "rischio-uscita", testo: `Nel punteggio di rischio di uscita, ${p} è nella fascia «medio»? Rispondi sì o no.`, confronto: "veroFalso", sql: `SELECT fascia = 'MEDIUM' AS vero FROM (${RISCHIO}) r WHERE nome = $1`, parametri: [p] }));
    }
    const div = await divisioni(q);
    for (const d of div) {
      out.push(hr({ categoria: "rischio-uscita", testo: `Nella ${d}, comprese le unità che ne dipendono, quante persone sono nella fascia «medio» del punteggio di rischio di uscita?`, confronto: "numero", sql: `${NELL_UNITA} SELECT count(*) AS n FROM persone JOIN (${RISCHIO}) r USING (user_id) WHERE r.fascia = 'MEDIUM'`, parametri: [d] }));
    }
    for (let i = 0; i + 1 < div.length; i += 1) {
      const [a, b] = [div[i]!, div[i + 1]!];
      const conta = (p: string) => `(WITH RECURSIVE albero AS (SELECT organization_unit_id AS id FROM sys.sys_organization_units WHERE organization_unit_tenant_id = ${TENANT} AND organization_unit_is_active AND organization_unit_name = ${p}
          UNION SELECT o.organization_unit_id FROM sys.sys_organization_units o JOIN albero z ON o.organization_unit_parent_id = z.id WHERE o.organization_unit_is_active)
        SELECT count(DISTINCT x.user_position_assignment_user_id) FROM sys.sys_user_position_assignments x
          JOIN sys.sys_positions p ON p.position_id = x.user_position_assignment_position_id JOIN albero z ON z.id = p.position_organization_unit_id
          JOIN (${RISCHIO}) r ON r.user_id = x.user_position_assignment_user_id
         WHERE x.user_position_assignment_status = 'ACTIVE' AND r.fascia = 'MEDIUM')`;
      // Un pareggio non dà righe, e la domanda si scarta.
      out.push(hr({ categoria: "confronto-unita", testo: `Ha più persone nella fascia «medio» del punteggio di rischio di uscita la ${a} o la ${b}, contando le unità dipendenti? Comincia la risposta con il nome della divisione.`, confronto: "etichetta", sql: `SELECT CASE WHEN x > y THEN $1 ELSE $2 END AS etichetta, ARRAY[CASE WHEN x > y THEN $2 ELSE $1 END] AS altre FROM (SELECT ${conta("$1")} AS x, ${conta("$2")} AS y) k WHERE x <> y`, parametri: [a, b] }));
    }
    // Perché: il fattore che pesa di più nel punteggio, solo se è uno solo.
    for (const p of persone.slice(0, 5)) {
      out.push(hr({ categoria: "perche", testo: `Nel punteggio di rischio di uscita di ${p}, quale fattore pesa di più?`, confronto: "etichetta", vocabolario: "fattore", sql: `WITH f AS (SELECT e->>'feature' AS fattore, (e->>'contribution')::numeric AS peso FROM (SELECT flight_risk_score_payload AS j FROM sys.sys_flight_risk_scores s JOIN sys.sys_users u ON u.user_id = s.flight_risk_score_user_id WHERE s.flight_risk_score_tenant_id = ${TENANT} AND ${nome("u")} = $1 ORDER BY s.flight_risk_score_computed_at DESC LIMIT 1) k, jsonb_array_elements(k.j->'derivation'->'features') e)
        SELECT min(fattore) AS etichetta FROM f WHERE peso = (SELECT max(peso) FROM f) HAVING count(*) = 1`, parametri: [p] }));
    }
    return out;
  },
};

const talenti: Modello = {
  chiave: "talento",
  bozze: async (q) => {
    const out: Bozza[] = [];
    for (const [codice, parola] of FASCE_TALENTO) {
      out.push(hr({ categoria: "talenti", testo: `Nella matrice dei talenti, quante persone sono nella fascia «${parola}»?`, confronto: "numero", sql: `SELECT count(*) AS n FROM (${TALENTI}) t WHERE fascia = $1`, parametri: [codice] }));
    }
    out.push(
      hr({ categoria: "talenti", testo: "Quante persone hanno una valutazione nella matrice dei talenti?", confronto: "numero", sql: `SELECT count(*) AS n FROM (${TALENTI}) t` }),
      hr({ categoria: "talenti", testo: "Quali successori candidati delle tavole di rimpiazzo sono nella fascia «Star» della matrice dei talenti?", confronto: "insieme", sql: `SELECT c.nome, bool_or(t.fascia = 'STAR') AS dentro FROM (${CANDIDATI}) c LEFT JOIN (${TALENTI}) t ON t.user_id = c.user_id GROUP BY c.nome ORDER BY 1` }),
    );
    const persone = await candidatiPersone(q);
    for (const p of ogni(persone, 2)) {
      out.push(hr({ categoria: "talenti", testo: `In quale fascia della matrice dei talenti è ${p}?`, confronto: "etichetta", vocabolario: "talento", sql: `SELECT fascia AS etichetta FROM (${TALENTI}) t WHERE nome = $1`, parametri: [p] }));
    }
    for (const d of await divisioni(q)) {
      out.push(hr({ categoria: "talenti-per-unita", testo: `Quante persone della ${d}, comprese le unità che ne dipendono, sono nella fascia «Star» della matrice dei talenti?`, confronto: "numero", sql: `${NELL_UNITA} SELECT count(*) AS n FROM persone JOIN (${TALENTI}) t USING (user_id) WHERE t.fascia = 'STAR'`, parametri: [d] }));
    }
    return out;
  },
};

const carriere: Modello = {
  chiave: "carriere",
  bozze: async (q) => {
    const piani = `FROM sys.sys_user_career_plans WHERE user_career_plan_tenant_id = ${TENANT}`;
    const obiettivi = `FROM sys.sys_user_target_positions WHERE user_target_position_tenant_id = ${TENANT}`;
    const percorsi = `FROM sys.sys_career_paths c WHERE c.career_path_tenant_id = ${TENANT}`;
    const out: Bozza[] = [
      hr({ categoria: "piani-carriera", testo: "Quanti piani di carriera attivi ci sono?", confronto: "numero", sql: `SELECT count(*) AS n ${piani} AND user_career_plan_status = 'ACTIVE'` }),
      hr({ categoria: "piani-carriera", testo: "Quanti piani di carriera risultano completati?", confronto: "numero", sql: `SELECT count(*) AS n ${piani} AND user_career_plan_status = 'COMPLETED'` }),
      hr({ categoria: "piani-carriera", testo: "Quante persone diverse hanno almeno un piano di carriera attivo?", confronto: "numero", sql: `SELECT count(DISTINCT user_career_plan_user_id) AS n ${piani} AND user_career_plan_status = 'ACTIVE'` }),
      hr({ categoria: "piani-carriera", testo: "Quanti piani di carriera sono registrati in tutto?", confronto: "numero", sql: `SELECT count(*) AS n ${piani}` }),
      hr({ categoria: "posizioni-obiettivo", testo: "Quante posizioni obiettivo di carriera hanno indicato le persone, in tutto?", confronto: "numero", sql: `SELECT count(*) AS n ${obiettivi}` }),
      hr({ categoria: "percorsi", testo: "Quanti percorsi di carriera sono definiti?", confronto: "numero", sql: `SELECT count(*) AS n ${percorsi}` }),
      hr({ categoria: "percorsi", testo: "Quanti percorsi di carriera sono di tipo verticale?", confronto: "numero", sql: `SELECT count(*) AS n ${percorsi} AND career_path_kind = 'VERTICAL'` }),
      hr({ categoria: "percorsi", testo: "Quanti percorsi di carriera sono interfunzionali?", confronto: "numero", sql: `SELECT count(*) AS n ${percorsi} AND career_path_kind = 'CROSS_FUNCTIONAL'` }),
      hr({ categoria: "percorsi", testo: "Elenca i percorsi di carriera interfunzionali.", confronto: "insieme", sql: `SELECT career_path_name AS nome, career_path_kind = 'CROSS_FUNCTIONAL' AS dentro ${percorsi} ORDER BY 1` }),
      hr({ categoria: "percorsi", testo: "Quanti percorsi formativi sono disponibili?", confronto: "numero", sql: `SELECT count(*) AS n FROM sys.sys_learning_paths WHERE learning_path_tenant_id = ${TENANT} OR learning_path_is_global` }),
    ];
    for (const [codice, parole] of ESITI) {
      out.push(hr({ categoria: "posizioni-obiettivo", testo: `Fra le posizioni obiettivo di carriera indicate dalle persone, quante sono ${parole} alla revisione?`, confronto: "numero", sql: `SELECT count(*) AS n ${obiettivi} AND user_target_position_review_status = $1`, parametri: [codice] }));
    }
    for (const p of await colonna(q, `SELECT career_path_name AS v ${percorsi} ORDER BY career_path_code LIMIT 8`)) {
      out.push(hr({ categoria: "percorsi", testo: `Di quanti passi è composto il percorso di carriera «${p}»?`, confronto: "numero", sql: `SELECT count(s.career_path_step_id) AS n FROM sys.sys_career_paths c LEFT JOIN sys.sys_career_path_steps s ON s.career_path_step_path_id = c.career_path_id WHERE c.career_path_tenant_id = ${TENANT} AND c.career_path_name = $1`, parametri: [p] }));
    }
    for (const d of await divisioni(q)) {
      out.push(hr({ categoria: "carriere-per-unita", testo: `Nella ${d}, comprese le unità che ne dipendono, quante persone hanno almeno un piano di carriera attivo?`, confronto: "numero", sql: `${NELL_UNITA} SELECT count(DISTINCT c.user_career_plan_user_id) AS n FROM persone p JOIN sys.sys_user_career_plans c ON c.user_career_plan_user_id = p.user_id WHERE c.user_career_plan_status = 'ACTIVE'`, parametri: [d] }));
    }
    return out;
  },
};

const mentoring: Modello = {
  chiave: "mentoring",
  bozze: async (q) => {
    const m = `FROM sys.sys_mentorships m WHERE m.mentorship_tenant_id = ${TENANT}`;
    const prog = `FROM sys.sys_mentorship_programs g WHERE g.program_tenant_id = ${TENANT}`;
    const out: Bozza[] = [
      hr({ categoria: "mentoring", testo: "Quanti programmi di mentoring ci sono?", confronto: "numero", sql: `SELECT count(*) AS n ${prog}` }),
      hr({ categoria: "mentoring", testo: "Quali sono i programmi di mentoring?", confronto: "insieme", sql: `SELECT program_name AS nome, true AS dentro ${prog} ORDER BY 1` }),
      hr({ categoria: "mentoring", testo: "Quanti rapporti di mentoring sono attivi?", confronto: "numero", sql: `SELECT count(*) AS n ${m} AND m.mentorship_status = 'ACTIVE'` }),
      hr({ categoria: "mentoring", testo: "Quanti rapporti di mentoring sono sospesi?", confronto: "numero", sql: `SELECT count(*) AS n ${m} AND m.mentorship_status = 'ON_HOLD'` }),
      hr({ categoria: "mentoring", testo: "Quanti rapporti di mentoring si sono conclusi?", confronto: "numero", sql: `SELECT count(*) AS n ${m} AND m.mentorship_status = 'COMPLETED'` }),
      hr({ categoria: "mentoring", testo: "Qual è il programma di mentoring con più rapporti attivi?", confronto: "primo", sql: `WITH k AS (SELECT g.program_name AS nome, count(x.mentorship_id) AS n FROM sys.sys_mentorship_programs g LEFT JOIN sys.sys_mentorships x ON x.mentorship_program_id = g.program_id AND x.mentorship_status = 'ACTIVE' WHERE g.program_tenant_id = ${TENANT} GROUP BY 1) SELECT nome, n = (SELECT max(n) FROM k) AS dentro FROM k ORDER BY n DESC, nome` }),
    ];
    for (const p of await colonna(q, `SELECT program_name AS v ${prog} ORDER BY 1`)) {
      out.push(hr({ categoria: "mentoring", testo: `Quanti rapporti di mentoring attivi ha il programma «${p}»?`, confronto: "numero", sql: `SELECT count(*) AS n ${m} AND m.mentorship_status = 'ACTIVE' AND m.mentorship_program_id = (SELECT program_id ${prog} AND g.program_name = $1)`, parametri: [p] }));
    }
    return out;
  },
};

/** Le domande di un responsabile sul proprio perimetro, e quelle fuori perimetro. */
const responsabili: Modello = {
  chiave: "perimetro",
  bozze: async (q) => {
    const out: Bozza[] = [];
    for (const profilo of ["capo-retail", "capo-crediti", "capo-operations", "capo-it", "capo-finanza"]) {
      const email = PROFILI[profilo]!.email;
      const capo = (b: Omit<Bozza, "profilo" | "parametri"> & { altri?: unknown[] }): Bozza => ({ profilo, ...b, parametri: [email, ...(b.altri ?? [])] });
      const mie = (sorgente: string) => `FROM persone p JOIN (${sorgente}) s USING (user_id)`;
      out.push(
        capo({ categoria: "perimetro-successori", testo: "Fra le persone che dipendono da me, me compreso, quante sono successori candidati nelle tavole di rimpiazzo?", confronto: "numero", sql: `${PERIMETRO} SELECT count(DISTINCT s.user_id) AS n ${mie(CANDIDATI)}` }),
        capo({ categoria: "perimetro-successori", testo: "Quali persone del mio perimetro, me compreso, sono successori candidati nelle tavole di rimpiazzo?", confronto: "insieme", sql: `${PERIMETRO} SELECT c.nome, bool_or(c.user_id IN (SELECT user_id FROM persone)) AS dentro FROM (${CANDIDATI}) c GROUP BY c.nome ORDER BY 1` }),
        capo({ categoria: "perimetro-rischio", testo: "Quante persone del mio perimetro, me compreso, sono nella fascia «medio» del punteggio di rischio di uscita?", confronto: "numero", sql: `${PERIMETRO} SELECT count(*) AS n ${mie(RISCHIO)} WHERE s.fascia = 'MEDIUM'` }),
        capo({ categoria: "perimetro-rischio", testo: "Quali persone del mio perimetro, me compreso, sono nella fascia «medio» del punteggio di rischio di uscita?", confronto: "insieme", sql: `${PERIMETRO} SELECT r.nome, r.user_id IN (SELECT user_id FROM persone) AS dentro FROM (${RISCHIO}) r WHERE r.fascia = 'MEDIUM' ORDER BY 1` }),
        capo({ categoria: "perimetro-talenti", testo: "Quante persone del mio perimetro, me compreso, sono nella fascia «Star» della matrice dei talenti?", confronto: "numero", sql: `${PERIMETRO} SELECT count(*) AS n ${mie(TALENTI)} WHERE s.fascia = 'STAR'` }),
        capo({ categoria: "perimetro-talenti", testo: "Quali persone del mio perimetro, me compreso, sono nella fascia «Star» della matrice dei talenti?", confronto: "insieme", sql: `${PERIMETRO} SELECT t.nome, t.user_id IN (SELECT user_id FROM persone) AS dentro FROM (${TALENTI}) t WHERE t.fascia = 'STAR' ORDER BY 1` }),
        capo({ categoria: "perimetro-carriere", testo: "Quante persone del mio perimetro, me compreso, hanno almeno un piano di carriera attivo?", confronto: "numero", sql: `${PERIMETRO} SELECT count(DISTINCT c.user_career_plan_user_id) AS n FROM persone p JOIN sys.sys_user_career_plans c ON c.user_career_plan_user_id = p.user_id WHERE c.user_career_plan_status = 'ACTIVE'` }),
        capo({ categoria: "perimetro-critiche", testo: "Quante posizioni sono registrate come critiche in azienda?", confronto: "numero", sql: `SELECT count(*) AS n FROM (${CRITICHE}) k WHERE $1::text IS NOT NULL` }),
      );
      // Fuori perimetro: una persona che non dipende da questo responsabile, né è lui.
      const fuori = await q(`${PERIMETRO} SELECT r.nome FROM (${RISCHIO}) r WHERE r.user_id NOT IN (SELECT user_id FROM persone)
        AND r.user_id IN (SELECT user_id FROM (${CANDIDATI}) c) ORDER BY r.nome LIMIT 2`, [email]);
      for (const [i, r] of fuori.entries()) {
        const p = testo(r, "nome");
        const chiesto = i === 0 ? "il punteggio di rischio di uscita" : "la fascia nella matrice dei talenti";
        const sorgente = i === 0
          ? `SELECT replace(round(valore, 2)::text, '.', ',') AS nome, ARRAY[round(valore, 2)::text, trim_scale(round(valore, 2))::text, replace(trim_scale(round(valore, 2))::text, '.', ',')] AS varianti FROM (${RISCHIO}) r WHERE nome = $2`
          : `SELECT CASE fascia WHEN 'STAR' THEN 'star' WHEN 'CORE' THEN 'core' ELSE 'high performer' END AS nome FROM (${TALENTI}) t WHERE nome = $2`;
        out.push(capo({ categoria: "fuori-perimetro", testo: `Qual è ${chiesto} di ${p}?`, confronto: "fuoriPerimetro", sql: `${sorgente} AND $1::text IS NOT NULL`, altri: [p] }));
      }
    }
    return out;
  },
};

/** Chi non ha il permesso sui talenti: la risposta deve dirlo, senza dati. */
const nonAutorizzati: Modello = {
  chiave: "negate",
  bozze: async (q) => {
    const out: Bozza[] = [];
    const critiche = await criticheOrdinate(q);
    const persone = await candidatiPersone(q);
    for (const [i, profilo] of ["responsabile-rischi", "dipendente"].entries()) {
      const email = PROFILI[profilo]!.email;
      const altri = (await q(`SELECT nome FROM (${CANDIDATI}) c JOIN sys.sys_users u USING (user_id) WHERE u.user_email <> $1 GROUP BY nome ORDER BY 1`, [email])).map((r) => testo(r, "nome"));
      const nega = (testoDomanda: string, sql: string, p: unknown[]): Bozza => ({ profilo, categoria: "non-autorizzato", testo: testoDomanda, confronto: "rifiuto", sql, parametri: p });
      for (const t of ogni(critiche, 3, i)) {
        out.push(nega(`Chi sono i successori candidati nel bacino di successione della posizione «${t}»?`, `SELECT nome FROM (${CANDIDATI}) c WHERE c.posizione = $1 AND c.user_id NOT IN (SELECT user_id FROM sys.sys_users WHERE user_email = $2) ORDER BY 1`, [t, email]));
      }
      for (const p of ogni(altri.filter((x) => persone.includes(x)), 6, i)) {
        out.push(nega(`Qual è il punteggio di rischio di uscita di ${p}?`, `SELECT replace(round(valore, 2)::text, '.', ',') AS nome, ARRAY[round(valore, 2)::text, trim_scale(round(valore, 2))::text, replace(trim_scale(round(valore, 2))::text, '.', ',')] AS varianti FROM (${RISCHIO}) r WHERE nome = $1`, [p]));
      }
      for (const p of ogni(altri, 7, i + 1).slice(0, 3)) {
        out.push(nega(`In quale fascia della matrice dei talenti è ${p}?`, `SELECT CASE fascia WHEN 'STAR' THEN 'star' WHEN 'CORE' THEN 'core' ELSE 'high performer' END AS nome FROM (${TALENTI}) t WHERE nome = $1`, [p]));
      }
      out.push(
        nega("Secondo il punteggio di rischio di uscita, quali persone sono oggi nella fascia «medio»?", `SELECT nome FROM (${RISCHIO}) r WHERE fascia = 'MEDIUM' AND user_id NOT IN (SELECT user_id FROM sys.sys_users WHERE user_email = $1) ORDER BY 1`, [email]),
        nega("Quali persone sono nella fascia «Star» della matrice dei talenti?", `SELECT nome FROM (${TALENTI}) t WHERE fascia = 'STAR' AND user_id NOT IN (SELECT user_id FROM sys.sys_users WHERE user_email = $1) ORDER BY 1`, [email]),
      );
    }
    // Ciò che un dipendente può leggere: i percorsi formativi (permesso learning:read).
    out.push({ profilo: "dipendente", categoria: "percorsi", testo: "Quanti percorsi formativi sono disponibili in azienda?", confronto: "numero", sql: `SELECT count(*) AS n FROM sys.sys_learning_paths WHERE learning_path_tenant_id = ${TENANT} OR learning_path_is_global` });
    for (const p of await colonna(q, `SELECT learning_path_name AS v FROM sys.sys_learning_paths l WHERE learning_path_tenant_id = ${TENANT}
        AND EXISTS (SELECT 1 FROM sys.sys_learning_path_steps s WHERE s.learning_path_step_path_id = l.learning_path_id)
        AND (SELECT count(*) FROM sys.sys_learning_paths z WHERE z.learning_path_name = l.learning_path_name) = 1 ORDER BY 1 LIMIT 5`)) {
      out.push({ profilo: "dipendente", categoria: "percorsi", testo: `Di quanti passi è composto il percorso formativo «${p}»?`, confronto: "numero", sql: `SELECT count(*) AS n FROM sys.sys_learning_path_steps s JOIN sys.sys_learning_paths l ON l.learning_path_id = s.learning_path_step_path_id WHERE l.learning_path_tenant_id = ${TENANT} AND l.learning_path_name = $1`, parametri: [p] });
    }
    return out;
  },
};

export const TALENTI_D1: Dominio = {
  codice: "D1",
  nome: "Talenti, tavole di rimpiazzo, carriere e percorsi",
  modelli: [posizioniCritiche, rimpiazzo, rischio, talenti, carriere, mentoring, responsabili, nonAutorizzati],
};
