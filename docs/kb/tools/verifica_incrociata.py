#!/usr/bin/env python3
"""
verifica_incrociata.py — l'organigramma contraddice il resto dei dati della persona?

Perche' esiste
--------------
Una migrazione puo' essere corretta in se' e lasciare il database incoerente: un
capo senza il ruolo che il suo incarico richiede, un corso assegnato per una
mansione che la persona non ha piu', un obiettivo dato da chi non e' piu' il suo
responsabile. `db_health.py` guarda la salute *strutturale* dello schema; questo
guarda la coerenza *semantica* fra collocazione organizzativa e tutto il resto.

Il principio, e la ragione della colonna "universo"
---------------------------------------------------
Ogni verifica dichiara **che aspetto avrebbe l'incoerenza se ci fosse** e la
cerca. Ma un risultato a zero non e' una buona notizia finche' non si sa se
poteva essere diverso da zero: per questo ogni verifica porta con se' una
seconda query, l'**universo**, che conta le righe che *avrebbero potuto* essere
segnalate. Universo a zero => la verifica e' dichiarata NON FALSIFICABILE e non
viene contata come superata. Una verifica che non puo' fallire non e' una
verifica.

Nessun valore atteso e' scritto a mano. La scala delle competenze si legge da
`sys_skill_proficiency_levels.rank`; il rango dei livelli contrattuali si ricava
dalla mediana della retribuzione reale per livello; i ruoli di comando sono
quelli gerarchici che *non* sono detenuti dalla quasi totalita' delle persone.

Uso:
    python verifica_incrociata.py                 # tutte le famiglie
    python verifica_incrociata.py --famiglia X4   # una sola (ripetibile)
    python verifica_incrociata.py --dettaglio 20  # quante righe di esempio mostrare
    python verifica_incrociata.py --json <file>

Esito: 1 se almeno una verifica di tipo DIFETTO trova righe, o se una verifica
attesa risulta non falsificabile. 0 altrimenti.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timezone

PSQL = ["psql", "-h", os.environ.get("PGHOST", "localhost"),
        "-p", os.environ.get("PGPORT", "5433"),
        "-U", os.environ.get("PGUSER", "heuresys"),
        "-d", os.environ.get("PGDATABASE", "heuresys_advanced"),
        "-At", "-F", "\t"]

# ---------------------------------------------------------------------------
# Prelude: le CTE comuni. Tutto cio' che le verifiche danno per assodato sta
# qui, in un punto solo, e si ri-deriva dai dati a ogni esecuzione.
# ---------------------------------------------------------------------------
PRELUDE = """
WITH RECURSIVE
ou AS (
  SELECT * FROM sys.sys_organization_units WHERE organization_unit_is_active
),
att AS (   -- collocazione ATTUALE: assegnazione attiva -> posizione -> unita'
  SELECT a.user_position_assignment_user_id  AS uid,
         a.user_position_assignment_position_id AS pid,
         p.position_organization_unit_id     AS ouid,
         p.position_title                    AS titolo,
         a.user_position_assignment_tenant_id AS tid
  FROM sys.sys_user_position_assignments a
  JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
  WHERE a.user_position_assignment_status = 'ACTIVE'
),
capo AS (  -- responsabile attuale di una persona = chi regge l'unita' della sua posizione
  SELECT att.uid, att.ouid, o.organization_unit_code AS oucode,
         o.organization_unit_name AS ouname,
         o.organization_unit_manager_user_id AS capo_uid
  FROM att JOIN ou o ON o.organization_unit_id = att.ouid
),
ruoli AS (
  -- `rs` serve solo a stamparli; i confronti si fanno su `rl`, perche' MANAGER
  -- e' sottostringa di HRMS_MANAGER e di BLUEPRINT_MANAGER: un LIKE mentirebbe.
  SELECT ur.user_auth_role_user_id AS uid,
         string_agg(r.auth_role_code, '+' ORDER BY r.auth_role_code) AS rs,
         array_agg(r.auth_role_code ORDER BY r.auth_role_code) AS rl
  FROM sys.sys_user_auth_roles ur
  JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
  WHERE ur.user_auth_role_revoked_at IS NULL
  GROUP BY 1
),
comando AS (  -- ruoli di comando DERIVATI: gerarchici e non detenuti dalla quasi totalita'
  SELECT r.auth_role_code
  FROM sys.sys_auth_roles r
  JOIN sys.sys_user_auth_roles ur ON ur.user_auth_role_role_id = r.auth_role_id
                                 AND ur.user_auth_role_revoked_at IS NULL
  WHERE r.auth_role_category = 'hierarchical_operational'
  GROUP BY r.auth_role_code
  HAVING count(*) < 0.5 * (SELECT count(*) FROM sys.sys_users)
),
contr AS (  -- contratto attivo piu' recente per persona
  SELECT DISTINCT ON (user_contract_user_id)
         user_contract_user_id AS uid,
         user_contract_ccnl_level AS lev,
         user_contract_gross_annual_salary AS ral
  FROM sys.sys_user_contracts
  WHERE user_contract_status = 'ACTIVE'
  ORDER BY user_contract_user_id, user_contract_start_date DESC
),
ccnl AS (   -- rango EMPIRICO dei livelli: ordinati per mediana della retribuzione reale
  SELECT lev,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY ral) AS med,
         rank() OVER (ORDER BY percentile_cont(0.5) WITHIN GROUP (ORDER BY ral)) AS rango
  FROM contr WHERE ral IS NOT NULL AND lev IS NOT NULL
  GROUP BY lev
),
prof AS (
  SELECT skill_proficiency_level_code AS cod, skill_proficiency_level_rank AS rango
  FROM sys.sys_skill_proficiency_levels
),
albero_ou AS (   -- chiusura transitiva dell'albero delle UNITA' (antenato -> discendente)
  SELECT organization_unit_id AS anten, organization_unit_id AS disc, 0 AS lv FROM ou
  UNION ALL
  SELECT a.anten, o.organization_unit_id, a.lv + 1
  FROM albero_ou a JOIN ou o ON o.organization_unit_parent_id = a.disc
  WHERE a.lv < 20
),
albero_pos AS ( -- chiusura transitiva dell'albero delle POSIZIONI (quello che usa il resolver)
  SELECT position_id AS anten, position_id AS disc, 0 AS lv
  FROM sys.sys_positions WHERE position_is_active
  UNION ALL
  SELECT a.anten, p.position_id, a.lv + 1
  FROM albero_pos a
  JOIN sys.sys_positions p ON p.position_reports_to_position_id = a.disc AND p.position_is_active
  WHERE a.lv < 20
),
prof_ou AS (   -- profondita' di ogni unita' dalla radice
  SELECT disc AS ouid, max(lv) AS liv FROM albero_ou GROUP BY disc
)
"""

# ---------------------------------------------------------------------------
# Le verifiche. tipo: 'difetto' (righe = allarme) | 'misura' (righe = informativa)
# ---------------------------------------------------------------------------
V: list[dict] = []


def check(id, famiglia, titolo, incoerenza, sql, universo, tipo="difetto", colonne=None,
          precondizione=None, cecita=None):
    """precondizione: SQL scalare che deve dare > 0 perche' la verifica abbia senso.
    cecita: la ragione, in chiaro, da stampare quando la precondizione non regge —
    serve a distinguere «nessuna incoerenza» da «non potevo vedere nulla»."""
    V.append(dict(id=id, famiglia=famiglia, titolo=titolo, incoerenza=incoerenza,
                  sql=sql, universo=universo, tipo=tipo, colonne=colonne or [],
                  precondizione=precondizione, cecita=cecita))


# --- X1 organigramma <-> RBAC ----------------------------------------------
check("X1a", "X1", "Responsabile con i ruoli di chi non dirige nulla",
      "un capo di unita' il cui insieme di ruoli coincide con l'insieme piu' diffuso "
      "fra chi non regge alcuna unita'",
      """
      , base AS (
        SELECT r.rs, count(*) n FROM ruoli r
        WHERE r.uid NOT IN (SELECT organization_unit_manager_user_id FROM ou
                            WHERE organization_unit_manager_user_id IS NOT NULL)
        GROUP BY 1 ORDER BY 2 DESC LIMIT 1
      )
      SELECT u.user_email,
             (SELECT string_agg(organization_unit_code, ' ') FROM ou
               WHERE organization_unit_manager_user_id = u.user_id),
             coalesce(r.rs, '(nessun ruolo)'),
             'insieme di riferimento: ' || (SELECT rs FROM base)
      FROM ou o
      JOIN sys.sys_users u ON u.user_id = o.organization_unit_manager_user_id
      LEFT JOIN ruoli r ON r.uid = u.user_id
      WHERE coalesce(r.rs, '') = coalesce((SELECT rs FROM base), '@')
      GROUP BY u.user_email, u.user_id, r.rs
      ORDER BY 1
      """,
      "SELECT count(DISTINCT organization_unit_manager_user_id) FROM ou "
      "WHERE organization_unit_manager_user_id IS NOT NULL",
      colonne=["persona", "unita' rette", "ruoli", "riferimento"])

check("X1b", "X1", "Ruolo di comando senza comando",
      "chi detiene un ruolo di comando ma non regge alcuna unita' attiva",
      """
      SELECT u.user_email, r.rs,
             coalesce((SELECT c.oucode FROM capo c WHERE c.uid = u.user_id), '(nessuna unita)'),
             (SELECT count(*)::text FROM albero_pos ap
               JOIN att a2 ON a2.pid = ap.disc
               WHERE ap.anten = (SELECT pid FROM att WHERE uid = u.user_id LIMIT 1) AND ap.lv > 0)
      FROM ruoli r
      JOIN sys.sys_users u ON u.user_id = r.uid
      WHERE EXISTS (SELECT 1 FROM comando c WHERE c.auth_role_code = ANY(r.rl))
        AND NOT EXISTS (SELECT 1 FROM ou WHERE organization_unit_manager_user_id = r.uid)
      ORDER BY 1
      """,
      "SELECT count(*) FROM ruoli r WHERE EXISTS "
      "(SELECT 1 FROM comando c WHERE c.auth_role_code = ANY(r.rl))",
      colonne=["persona", "ruoli", "unita' retta", "riporti sull'albero posizioni"])

check("X1c", "X1", "Unita' senza responsabile",
      "un'unita' attiva il cui responsabile non e' dichiarato",
      """
      SELECT organization_unit_code, organization_unit_name, organization_unit_type, ''
      FROM ou WHERE organization_unit_manager_user_id IS NULL ORDER BY 1
      """,
      "SELECT count(*) FROM ou",
      colonne=["unita'", "nome", "tipo", ""])

# --- X2 organigramma <-> inquadramento -------------------------------------
check("X2a", "X2", "Capo inquadrato sotto un suo sottoposto",
      "il responsabile di un'unita' ha un livello contrattuale di rango inferiore "
      "a quello di almeno una persona che gli riporta nella stessa unita'",
      """
      SELECT uc.user_email || ' (' || cc.lev || ')',
             us.user_email || ' (' || cs.lev || ')',
             o.organization_unit_code,
             'rango capo ' || rc.rango::text || ' < rango sottoposto ' || rs2.rango::text
      FROM ou o
      JOIN sys.sys_users uc ON uc.user_id = o.organization_unit_manager_user_id
      JOIN contr cc ON cc.uid = uc.user_id
      JOIN ccnl rc ON rc.lev = cc.lev
      JOIN att a ON a.ouid = o.organization_unit_id AND a.uid <> uc.user_id
      JOIN sys.sys_users us ON us.user_id = a.uid
      JOIN contr cs ON cs.uid = us.user_id
      JOIN ccnl rs2 ON rs2.lev = cs.lev
      WHERE rc.rango < rs2.rango
      ORDER BY 3, 1
      """,
      """SELECT count(*) FROM ou o
         JOIN contr cc ON cc.uid = o.organization_unit_manager_user_id
         JOIN att a ON a.ouid = o.organization_unit_id AND a.uid <> o.organization_unit_manager_user_id
         JOIN contr cs ON cs.uid = a.uid""",
      colonne=["capo", "sottoposto", "unita'", "confronto"])

check("X2b", "X2", "Gerarchia delle unita' contraddetta dall'inquadramento",
      "il capo di un'unita' superiore ha rango contrattuale inferiore al capo di "
      "un'unita' che le sta sotto nell'albero",
      """
      SELECT usup.user_email || ' (' || csup.lev || ') ' || osup.organization_unit_code,
             uinf.user_email || ' (' || cinf.lev || ') ' || oinf.organization_unit_code,
             'distanza ' || t.lv::text,
             'rango ' || rsup.rango::text || ' < ' || rinf.rango::text
      FROM albero_ou t
      JOIN ou osup ON osup.organization_unit_id = t.anten
      JOIN ou oinf ON oinf.organization_unit_id = t.disc
      JOIN sys.sys_users usup ON usup.user_id = osup.organization_unit_manager_user_id
      JOIN sys.sys_users uinf ON uinf.user_id = oinf.organization_unit_manager_user_id
      JOIN contr csup ON csup.uid = usup.user_id JOIN ccnl rsup ON rsup.lev = csup.lev
      JOIN contr cinf ON cinf.uid = uinf.user_id JOIN ccnl rinf ON rinf.lev = cinf.lev
      WHERE t.lv > 0 AND rsup.rango < rinf.rango
      ORDER BY 3, 1
      """,
      "SELECT count(*) FROM albero_ou WHERE lv > 0",
      colonne=["capo superiore", "capo inferiore", "distanza", "confronto"])

# --- X3 organigramma <-> retribuzione --------------------------------------
check("X3a", "X3", "Retribuzione fuori dalla fascia della propria posizione",
      "la retribuzione contrattuale cade fuori dagli estremi della fascia agganciata "
      "alla posizione ricoperta",
      """
      SELECT u.user_email, a.titolo,
             round(c.ral)::text || ' EUR',
             'fascia ' || b.compensation_band_code || ' [' ||
             round(b.compensation_band_min_eur)::text || '-' ||
             round(b.compensation_band_max_eur)::text || ']'
      FROM att a
      JOIN contr c ON c.uid = a.uid
      JOIN sys.sys_users u ON u.user_id = a.uid
      JOIN sys.sys_position_compensation_profiles pcp ON pcp.position_id = a.pid
      JOIN sys.sys_compensation_bands b ON b.compensation_band_id = pcp.compensation_band_id
      WHERE c.ral IS NOT NULL
        AND (c.ral < b.compensation_band_min_eur OR c.ral > b.compensation_band_max_eur)
      ORDER BY 1
      """,
      """SELECT count(*) FROM att a JOIN contr c ON c.uid = a.uid
         JOIN sys.sys_position_compensation_profiles pcp ON pcp.position_id = a.pid
         JOIN sys.sys_compensation_bands b ON b.compensation_band_id = pcp.compensation_band_id
         WHERE c.ral IS NOT NULL""",
      colonne=["persona", "posizione", "retribuzione", "fascia attesa"])

check("X3b", "X3", "Retribuzione anomala rispetto ai pari livello",
      "retribuzione oltre 1,5 volte lo scarto interquartile dal quartile del proprio "
      "livello contrattuale (regola statistica, non soglia scelta a mano)",
      """
      , q AS (
        SELECT lev,
               percentile_cont(0.25) WITHIN GROUP (ORDER BY ral) q1,
               percentile_cont(0.75) WITHIN GROUP (ORDER BY ral) q3
        FROM contr WHERE ral IS NOT NULL GROUP BY lev
      )
      SELECT u.user_email, c.lev, round(c.ral)::text || ' EUR',
             'atteso [' || round(q.q1 - 1.5*(q.q3-q.q1))::text || '-' ||
             round(q.q3 + 1.5*(q.q3-q.q1))::text || ']'
      FROM contr c JOIN q ON q.lev = c.lev
      JOIN sys.sys_users u ON u.user_id = c.uid
      WHERE c.ral IS NOT NULL AND q.q3 > q.q1
        AND (c.ral < q.q1 - 1.5*(q.q3-q.q1) OR c.ral > q.q3 + 1.5*(q.q3-q.q1))
      ORDER BY 2, 3
      """,
      "SELECT count(*) FROM contr WHERE ral IS NOT NULL",
      colonne=["persona", "livello", "retribuzione", "intervallo atteso"])

check("X3c", "X3", "Contratto attivo senza busta paga recente",
      "una persona con contratto attivo per cui l'ultima busta paga e' anteriore a "
      "novanta giorni fa",
      """
      SELECT u.user_email, c.lev,
             coalesce(max(ps.user_pay_slip_period_end)::text, '(nessuna busta)'),
             (CURRENT_DATE - coalesce(max(ps.user_pay_slip_period_end), DATE '1900-01-01'))::text || ' giorni'
      FROM contr c
      JOIN sys.sys_users u ON u.user_id = c.uid
      LEFT JOIN sys.sys_user_pay_slips ps ON ps.user_pay_slip_user_id = c.uid
      GROUP BY 1, 2
      HAVING CURRENT_DATE - coalesce(max(ps.user_pay_slip_period_end), DATE '1900-01-01') > 90
      ORDER BY 4 DESC
      """,
      "SELECT count(*) FROM contr",
      colonne=["persona", "livello", "ultima busta", "ritardo"])

# --- X4 posizione <-> competenze -------------------------------------------
check("X4a", "X4", "Requisito di competenza della posizione attuale non coperto",
      "la posizione ricoperta richiede una competenza che la persona non possiede, "
      "o la possiede a un rango inferiore a quello richiesto",
      """
      SELECT u.user_email, a.titolo, s.skill_name,
             'richiesto ' || r.required_proficiency || ', posseduto ' ||
             coalesce(us.user_skill_proficiency, 'NULLA')
      FROM att a
      JOIN sys.sys_users u ON u.user_id = a.uid
      JOIN sys.sys_position_skill_requirements r ON r.position_id = a.pid
      JOIN sys.sys_skills s ON s.skill_id = r.skill_id
      LEFT JOIN sys.sys_user_skills us ON us.user_skill_user_id = a.uid AND us.user_skill_skill_id = r.skill_id
      LEFT JOIN prof pr ON pr.cod = r.required_proficiency
      LEFT JOIN prof pu ON pu.cod = us.user_skill_proficiency
      WHERE us.user_skill_id IS NULL OR coalesce(pu.rango, 0) < pr.rango
      ORDER BY 1, 3
      """,
      "SELECT count(*) FROM att a JOIN sys.sys_position_skill_requirements r ON r.position_id = a.pid",
      colonne=["persona", "posizione", "competenza", "confronto"])

check("X4b", "X4", "Competenza posseduta che nessuna posizione richiede piu'",
      "una competenza registrata su una persona che non compare fra i requisiti di "
      "alcuna posizione attiva del suo tenant",
      """
      SELECT u.user_email, s.skill_name, us.user_skill_proficiency, ''
      FROM sys.sys_user_skills us
      JOIN sys.sys_users u ON u.user_id = us.user_skill_user_id
      JOIN sys.sys_skills s ON s.skill_id = us.user_skill_skill_id
      WHERE NOT EXISTS (
        SELECT 1 FROM sys.sys_position_skill_requirements r
        JOIN sys.sys_positions p ON p.position_id = r.position_id AND p.position_is_active
        WHERE r.skill_id = us.user_skill_skill_id
          AND p.position_tenant_id = us.user_skill_tenant_id)
      ORDER BY 2, 1
      """,
      "SELECT count(*) FROM sys.sys_user_skills",
      tipo="misura",
      colonne=["persona", "competenza", "livello", ""])

# --- X5 posizione <-> formazione -------------------------------------------
# Prima stesura di X5a: «percorso richiesto da qualche posizione ma non dalla tua».
# Trovava 58 righe su 5 persone — tutte apicali — e il verdetto sarebbe stato falso:
# quelle 5 posizioni dichiarano ZERO requisiti formativi, percio' qualunque corso
# assegnato risultava estraneo. Il difetto non era la formazione, era il catalogo.
# La verifica ora si applica solo a chi ha una posizione che i requisiti li dichiara;
# il buco del catalogo e' diventato X5d, che e' il difetto vero.
check("X5a", "X5", "Formazione assegnata per una mansione che la persona non ha",
      "un percorso assegnato a una persona la cui posizione DICHIARA requisiti formativi "
      "propri, e quel percorso non e' fra questi pur essendo richiesto da altre posizioni",
      """
      SELECT u.user_email, a.titolo, lp.learning_path_name,
             la.user_learning_assignment_status
      FROM sys.sys_user_learning_assignments la
      JOIN att a ON a.uid = la.user_learning_assignment_user_id
      JOIN sys.sys_users u ON u.user_id = la.user_learning_assignment_user_id
      JOIN sys.sys_learning_paths lp ON lp.learning_path_id = la.user_learning_assignment_path_id
      WHERE la.user_learning_assignment_path_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM sys.sys_position_learning_requirements pr
                     WHERE pr.position_id = a.pid)
        AND EXISTS (SELECT 1 FROM sys.sys_position_learning_requirements pr
                     WHERE pr.learning_path_id = la.user_learning_assignment_path_id)
        AND NOT EXISTS (SELECT 1 FROM sys.sys_position_learning_requirements pr
                         WHERE pr.learning_path_id = la.user_learning_assignment_path_id
                           AND pr.position_id = a.pid)
      ORDER BY 1, 3
      """,
      """SELECT count(*) FROM sys.sys_user_learning_assignments la
         JOIN att a ON a.uid = la.user_learning_assignment_user_id
         WHERE la.user_learning_assignment_path_id IS NOT NULL
           AND EXISTS (SELECT 1 FROM sys.sys_position_learning_requirements pr
                        WHERE pr.position_id = a.pid)""",
      colonne=["persona", "posizione attuale", "percorso", "stato"])

check("X5d", "X5", "Posizione ricoperta che non dichiara alcun requisito formativo",
      "una posizione con persone dentro e nessuna riga in `sys_position_learning_requirements`: "
      "per chi la ricopre non esiste un atteso formativo, quindi nessuna lacuna e' calcolabile "
      "e nessun corso e' giustificabile",
      """
      SELECT p.position_title, string_agg(u.user_email, ' '),
             count(*)::text || ' persone', '0 requisiti formativi'
      FROM att a
      JOIN sys.sys_positions p ON p.position_id = a.pid
      JOIN sys.sys_users u ON u.user_id = a.uid
      WHERE NOT EXISTS (SELECT 1 FROM sys.sys_position_learning_requirements pr
                         WHERE pr.position_id = a.pid)
      GROUP BY p.position_id, p.position_title
      ORDER BY 1
      """,
      "SELECT count(DISTINCT pid) FROM att",
      colonne=["posizione", "chi la ricopre", "persone", "requisiti"])

check("X5b", "X5", "Formazione obbligatoria della posizione attuale mai assegnata",
      "la posizione ricoperta dichiara un percorso obbligatorio e alla persona non "
      "risulta alcuna assegnazione su quel percorso",
      """
      SELECT u.user_email, a.titolo, lp.learning_path_name, 'obbligatorio, non assegnato'
      FROM att a
      JOIN sys.sys_users u ON u.user_id = a.uid
      JOIN sys.sys_position_learning_requirements pr ON pr.position_id = a.pid AND pr.is_mandatory
      JOIN sys.sys_learning_paths lp ON lp.learning_path_id = pr.learning_path_id
      WHERE NOT EXISTS (
        SELECT 1 FROM sys.sys_user_learning_assignments la
        WHERE la.user_learning_assignment_user_id = a.uid
          AND la.user_learning_assignment_path_id = pr.learning_path_id)
      ORDER BY 1, 3
      """,
      """SELECT count(*) FROM att a
         JOIN sys.sys_position_learning_requirements pr ON pr.position_id = a.pid AND pr.is_mandatory""",
      colonne=["persona", "posizione", "percorso obbligatorio", "stato"])

check("X5c", "X5", "Lacuna formativa agganciata a una posizione non piu' ricoperta",
      "una riga di `sys_learning_gaps` il cui `position_id` non e' la posizione attiva "
      "della persona",
      """
      SELECT u.user_email, s.skill_name,
             'lacuna su posizione ' || pg.position_title,
             'posizione attuale ' || coalesce(a.titolo, '(nessuna)')
      FROM sys.sys_learning_gaps g
      JOIN sys.sys_users u ON u.user_id = g.learning_gap_user_id
      LEFT JOIN sys.sys_skills s ON s.skill_id = g.learning_gap_skill_id
      LEFT JOIN sys.sys_positions pg ON pg.position_id = g.learning_gap_position_id
      LEFT JOIN att a ON a.uid = g.learning_gap_user_id
      WHERE g.learning_gap_position_id IS NOT NULL
        AND (a.pid IS NULL OR g.learning_gap_position_id <> a.pid)
      ORDER BY 1
      """,
      "SELECT count(*) FROM sys.sys_learning_gaps WHERE learning_gap_position_id IS NOT NULL",
      colonne=["persona", "competenza", "lacuna", "collocazione attuale"],
      precondizione="SELECT count(learning_gap_position_id) FROM sys.sys_learning_gaps",
      cecita="delle 270 lacune formative NESSUNA dichiara la posizione, e nessuna la "
             "competenza: restano utente, punteggio e gravita'. La tabella non e' "
             "agganciata ne' all'organigramma ne' alla tassonomia delle competenze, "
             "quindi nessuna migrazione dell'organigramma potra' renderla incoerente "
             "— ne' coerente")

# --- X6 posizione <-> obiettivi e misurazioni ------------------------------
# La forma del menu' — «obiettivo assegnato da un capo che non e' piu' il capo» — non
# e' misurabile: `goal_owner_user_id` e' vuoto su tutte e 2189 le righe, e cosi'
# `okr_owner_user_id` su tutte e 17. L'unico aggancio organizzativo che gli OKR
# dichiarano e' `okr_department`, testo libero. Quella e' la cosa verificabile.
check("X6a", "X6", "OKR agganciato a un reparto che nell'organigramma non esiste",
      "un OKR il cui `okr_department` non corrisponde ad alcuna unita' attiva, ne' per "
      "codice ne' per nome: l'obiettivo di reparto non ha un reparto",
      """
      SELECT o.okr_department, left(o.okr_objective, 46), o.okr_okr_type,
             o.okr_period_start::text
      FROM sys.sys_okrs o
      WHERE o.okr_department IS NOT NULL
        AND lower(o.okr_department) <> 'company-wide'
        AND NOT EXISTS (
          SELECT 1 FROM ou u
          WHERE lower(u.organization_unit_name) LIKE '%' || lower(o.okr_department) || '%'
             OR lower(o.okr_department) LIKE '%' || lower(u.organization_unit_name) || '%'
             OR lower(u.organization_unit_code) = lower(o.okr_department))
      ORDER BY 1
      """,
      "SELECT count(*) FROM sys.sys_okrs WHERE okr_department IS NOT NULL "
      "AND lower(okr_department) <> 'company-wide'",
      colonne=["reparto dichiarato", "obiettivo", "tipo", "dal"])

check("X6b", "X6", "KPI assegnato a chi la propria posizione non lo prevede",
      "un obiettivo di KPI su una persona la cui posizione attiva non elenca quel KPI "
      "fra i propri requisiti: il KPI segue la persona, non l'incarico",
      """
      SELECT u.user_email, coalesce(a.titolo, '(nessuna posizione)'),
             k.kpi_definition_name,
             t.kpi_target_period_start::text || ' -> ' || t.kpi_target_period_end::text
      FROM sys.sys_kpi_targets t
      JOIN sys.sys_users u ON u.user_id = t.kpi_target_user_id
      JOIN sys.sys_kpi_definitions k ON k.kpi_definition_id = t.kpi_target_kpi_id
      LEFT JOIN att a ON a.uid = t.kpi_target_user_id
      WHERE EXISTS (SELECT 1 FROM sys.sys_position_kpi_requirements r WHERE r.position_id = a.pid)
        AND NOT EXISTS (SELECT 1 FROM sys.sys_position_kpi_requirements r
                         WHERE r.position_id = a.pid AND r.kpi_definition_id = t.kpi_target_kpi_id)
      ORDER BY 1, 3
      """,
      # Come per X5a: si misura solo dove un atteso esiste. Il catalogo mancante e' X6d.
      """SELECT count(*) FROM sys.sys_kpi_targets t
         JOIN att a ON a.uid = t.kpi_target_user_id
         WHERE EXISTS (SELECT 1 FROM sys.sys_position_kpi_requirements r WHERE r.position_id = a.pid)""",
      colonne=["persona", "posizione", "KPI", "periodo"])

check("X6d", "X6", "Il catalogo dei KPI di posizione copre una frazione delle posizioni",
      "posizioni ricoperte che non dichiarano alcun requisito KPI: senza atteso, un "
      "obiettivo di KPI assegnato alla persona non e' riconducibile all'incarico",
      """
      SELECT 'posizioni ricoperte senza requisiti KPI',
             count(DISTINCT a.pid)::text || ' su ' || (SELECT count(DISTINCT pid)::text FROM att),
             count(DISTINCT a.uid)::text || ' persone',
             (SELECT count(DISTINCT kpi_definition_id)::text FROM sys.sys_position_kpi_requirements)
               || ' KPI usati su ' || (SELECT count(*)::text FROM sys.sys_kpi_definitions) || ' definiti'
      FROM att a
      WHERE NOT EXISTS (SELECT 1 FROM sys.sys_position_kpi_requirements r WHERE r.position_id = a.pid)
      HAVING count(*) <> 0
      """,
      "SELECT count(DISTINCT pid) FROM att",
      colonne=["misura", "posizioni scoperte", "persone", "ampiezza del catalogo"])

check("X6c", "X6", "Obiettivo personale senza alcun titolare registrato",
      "`sys_goals.goal_owner_user_id` e `sys_okrs.okr_owner_user_id` misurano chi ha "
      "assegnato l'obiettivo: se restano vuoti, dopo le migrazioni nessuno potra' dire "
      "se un obiettivo e' stato dato da un capo che non e' piu' il capo",
      """
      SELECT 'sys_goals.goal_owner_user_id', count(*)::text || ' righe',
             count(goal_owner_user_id)::text || ' valorizzate', ''
      FROM sys.sys_goals HAVING count(goal_owner_user_id) = 0
      UNION ALL
      SELECT 'sys_okrs.okr_owner_user_id', count(*)::text || ' righe',
             count(okr_owner_user_id)::text || ' valorizzate', ''
      FROM sys.sys_okrs HAVING count(okr_owner_user_id) = 0
      """,
      "SELECT (SELECT count(*) FROM sys.sys_goals) + (SELECT count(*) FROM sys.sys_okrs)",
      colonne=["colonna", "righe", "valorizzate", ""])

# --- X7 valutazioni <-> linea ----------------------------------------------
check("X7a", "X7", "Valutazione APERTA con un valutatore che non e' il responsabile",
      "una valutazione non conclusa il cui `review_reviewer_user_id` non regge l'unita' "
      "della persona valutata",
      """
      SELECT us.user_email, ur.user_email, c.oucode,
             r.review_status || ' ' || r.review_period_start::text
      FROM sys.sys_performance_reviews r
      JOIN sys.sys_users us ON us.user_id = r.review_subject_user_id
      LEFT JOIN sys.sys_users ur ON ur.user_id = r.review_reviewer_user_id
      LEFT JOIN capo c ON c.uid = r.review_subject_user_id
      WHERE r.review_status <> 'COMPLETED'
        AND (r.review_reviewer_user_id IS NULL OR c.capo_uid IS NULL
             OR r.review_reviewer_user_id <> c.capo_uid)
      ORDER BY 1
      """,
      "SELECT count(*) FROM sys.sys_performance_reviews WHERE review_status <> 'COMPLETED'",
      colonne=["valutato", "valutatore", "unita'", "stato"])

check("X7b", "X7", "Valutazione CHIUSA il cui valutatore non e' piu' il responsabile",
      "una valutazione conclusa il cui valutatore non regge oggi l'unita' della persona "
      "valutata: storica e spiegabile finche' l'organigramma non cambia, ma e' la misura "
      "che dice quanto la linea di valutazione si e' staccata dalla linea organizzativa",
      """
      SELECT us.user_email, coalesce(ur.user_email, '(nessuno)'), c.oucode,
             r.review_period_start::text || ' -> ' || r.review_period_end::text
      FROM sys.sys_performance_reviews r
      JOIN sys.sys_users us ON us.user_id = r.review_subject_user_id
      LEFT JOIN sys.sys_users ur ON ur.user_id = r.review_reviewer_user_id
      LEFT JOIN capo c ON c.uid = r.review_subject_user_id
      WHERE r.review_status = 'COMPLETED'
        AND (r.review_reviewer_user_id IS NULL OR c.capo_uid IS NULL
             OR r.review_reviewer_user_id <> c.capo_uid)
      ORDER BY 4 DESC, 1
      """,
      "SELECT count(*) FROM sys.sys_performance_reviews WHERE review_status = 'COMPLETED'",
      tipo="misura",
      colonne=["valutato", "valutatore", "unita' attuale", "periodo"])

check("X7c", "X7", "Responsabile senza alcuna valutazione da fare",
      "chi regge un'unita' con persone dentro e non compare come valutatore di nessuno",
      """
      SELECT u.user_email, o.organization_unit_code,
             (SELECT count(*)::text FROM att a WHERE a.ouid = o.organization_unit_id
                AND a.uid <> o.organization_unit_manager_user_id) || ' persone rette',
             '0 valutazioni'
      FROM ou o
      JOIN sys.sys_users u ON u.user_id = o.organization_unit_manager_user_id
      WHERE EXISTS (SELECT 1 FROM att a WHERE a.ouid = o.organization_unit_id
                      AND a.uid <> o.organization_unit_manager_user_id)
        AND NOT EXISTS (SELECT 1 FROM sys.sys_performance_reviews r
                         WHERE r.review_reviewer_user_id = o.organization_unit_manager_user_id)
      ORDER BY 1
      """,
      "SELECT count(*) FROM ou o WHERE EXISTS (SELECT 1 FROM att a WHERE a.ouid = o.organization_unit_id)",
      colonne=["responsabile", "unita'", "persone rette", "valutazioni fatte"])

# --- X8 assi funzionali <-> organigramma -----------------------------------
check("X8a", "X8", "Squadra o processo agganciato a un'unita' inesistente o inattiva",
      "un team o un processo di unita' il cui `organization_unit_id` non compare fra "
      "le unita' attive",
      """
      SELECT 'team ' || t.team_code, t.team_name, coalesce(o.organization_unit_code, '(assente)'), ''
      FROM sys.sys_teams t
      LEFT JOIN ou o ON o.organization_unit_id = t.team_organization_unit_id
      WHERE t.team_is_active AND o.organization_unit_id IS NULL
      UNION ALL
      SELECT 'processo ' || p.organization_unit_process_id::text, coalesce(p.org_unit_process_role, ''),
             coalesce(o.organization_unit_code, '(assente)'), ''
      FROM sys.sys_organization_unit_processes p
      LEFT JOIN ou o ON o.organization_unit_id = p.org_unit_process_org_unit_id
      WHERE o.organization_unit_id IS NULL
      """,
      "SELECT (SELECT count(*) FROM sys.sys_teams WHERE team_is_active) "
      "+ (SELECT count(*) FROM sys.sys_organization_unit_processes)",
      colonne=["oggetto", "nome", "unita' citata", ""])

check("X8b", "X8", "Capo squadra senza collocazione organizzativa",
      "il `team_lead_user_id` di una squadra attiva non ha alcuna assegnazione di "
      "posizione attiva",
      """
      SELECT t.team_code, u.user_email, '(nessuna posizione attiva)', ''
      FROM sys.sys_teams t
      JOIN sys.sys_users u ON u.user_id = t.team_lead_user_id
      WHERE t.team_is_active AND NOT EXISTS (SELECT 1 FROM att a WHERE a.uid = t.team_lead_user_id)
      ORDER BY 1
      """,
      "SELECT count(*) FROM sys.sys_teams WHERE team_is_active AND team_lead_user_id IS NOT NULL",
      colonne=["squadra", "capo squadra", "collocazione", ""])

check("X8c", "X8", "Quanto l'asse funzionale attraversa quello organizzativo",
      "membri di squadra che non appartengono all'unita' della squadra: NON e' un difetto "
      "(ADR-0027: gli assi sono ortogonali), e' la misura di quanto le squadre siano "
      "trasversali — serve a sapere quanta parte del lavoro le migrazioni non toccano",
      """
      SELECT t.team_code, u.user_email,
             coalesce(ot.organization_unit_code, '(nessuna)') || ' <- squadra',
             coalesce(c.oucode, '(nessuna)') || ' <- persona'
      FROM sys.sys_team_members tm
      JOIN sys.sys_teams t ON t.team_id = tm.team_member_team_id AND t.team_is_active
      JOIN sys.sys_users u ON u.user_id = tm.team_member_user_id
      LEFT JOIN ou ot ON ot.organization_unit_id = t.team_organization_unit_id
      LEFT JOIN capo c ON c.uid = tm.team_member_user_id
      WHERE tm.team_member_is_active
        AND (c.ouid IS NULL OR t.team_organization_unit_id IS NULL
             OR c.ouid <> t.team_organization_unit_id)
      ORDER BY 1, 2
      """,
      "SELECT count(*) FROM sys.sys_team_members tm JOIN sys.sys_teams t "
      "ON t.team_id = tm.team_member_team_id AND t.team_is_active WHERE tm.team_member_is_active",
      tipo="misura",
      colonne=["squadra", "membro", "unita' squadra", "unita' persona"])

# --- X9 coerenza temporale --------------------------------------------------
check("X9a", "X9", "Assegnazione con fine anteriore all'inizio",
      "`end_date` < `start_date` su un'assegnazione di posizione",
      """
      SELECT u.user_email, p.position_title,
             a.user_position_assignment_start_date::text,
             a.user_position_assignment_end_date::text
      FROM sys.sys_user_position_assignments a
      JOIN sys.sys_users u ON u.user_id = a.user_position_assignment_user_id
      JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
      WHERE a.user_position_assignment_end_date IS NOT NULL
        AND a.user_position_assignment_end_date < a.user_position_assignment_start_date
      """,
      "SELECT count(*) FROM sys.sys_user_position_assignments WHERE user_position_assignment_end_date IS NOT NULL",
      colonne=["persona", "posizione", "inizio", "fine"])

check("X9b", "X9", "Assegnazioni sovrapposte nel tempo",
      "due assegnazioni della stessa persona i cui intervalli si accavallano",
      """
      SELECT u.user_email, p1.position_title || ' | ' || p2.position_title,
             a1.user_position_assignment_start_date::text || ' -> ' ||
             coalesce(a1.user_position_assignment_end_date::text, 'aperta'),
             a2.user_position_assignment_start_date::text || ' -> ' ||
             coalesce(a2.user_position_assignment_end_date::text, 'aperta')
      FROM sys.sys_user_position_assignments a1
      JOIN sys.sys_user_position_assignments a2
        ON a2.user_position_assignment_user_id = a1.user_position_assignment_user_id
       AND a2.user_position_assignment_id > a1.user_position_assignment_id
      JOIN sys.sys_users u ON u.user_id = a1.user_position_assignment_user_id
      JOIN sys.sys_positions p1 ON p1.position_id = a1.user_position_assignment_position_id
      JOIN sys.sys_positions p2 ON p2.position_id = a2.user_position_assignment_position_id
      WHERE a1.user_position_assignment_start_date
              <= coalesce(a2.user_position_assignment_end_date, DATE '9999-12-31')
        AND a2.user_position_assignment_start_date
              <= coalesce(a1.user_position_assignment_end_date, DATE '9999-12-31')
      ORDER BY 1
      """,
      """SELECT count(*) FROM sys.sys_user_position_assignments a1
         JOIN sys.sys_user_position_assignments a2
           ON a2.user_position_assignment_user_id = a1.user_position_assignment_user_id
          AND a2.user_position_assignment_id > a1.user_position_assignment_id""",
      colonne=["persona", "le due posizioni", "intervallo 1", "intervallo 2"])

check("X9c", "X9", "Persona con contratto attivo e nessuna collocazione",
      "contratto `ACTIVE` senza alcuna assegnazione di posizione attiva, e il rovescio",
      """
      SELECT u.user_email, 'contratto attivo, nessuna posizione', c.lev, ''
      FROM contr c JOIN sys.sys_users u ON u.user_id = c.uid
      WHERE NOT EXISTS (SELECT 1 FROM att a WHERE a.uid = c.uid)
      UNION ALL
      SELECT u.user_email, 'posizione attiva, nessun contratto attivo', a.titolo, ''
      FROM att a JOIN sys.sys_users u ON u.user_id = a.uid
      WHERE NOT EXISTS (SELECT 1 FROM contr c WHERE c.uid = a.uid)
      ORDER BY 2, 1
      """,
      "SELECT (SELECT count(*) FROM contr) + (SELECT count(*) FROM att)",
      colonne=["persona", "situazione", "dettaglio", ""])

# --- X10 perimetri ----------------------------------------------------------
check("X10a", "X10", "Divergenza fra l'albero che il resolver usa e l'albero delle unita'",
      "per ogni responsabile, il perimetro calcolato sull'albero delle POSIZIONI "
      "(`position_reports_to_position_id`, quello che il resolver interroga) confrontato "
      "col perimetro calcolato sull'albero delle UNITA'",
      """
      , per_ou AS (
        SELECT o.organization_unit_manager_user_id capo, count(DISTINCT a.uid) n
        FROM ou o JOIN albero_ou t ON t.anten = o.organization_unit_id
        JOIN att a ON a.ouid = t.disc AND a.uid <> o.organization_unit_manager_user_id
        WHERE o.organization_unit_manager_user_id IS NOT NULL GROUP BY 1
      ), per_pos AS (
        SELECT ac.uid capo, count(DISTINCT a.uid) n
        FROM att ac JOIN albero_pos t ON t.anten = ac.pid AND t.lv > 0
        JOIN att a ON a.pid = t.disc AND a.uid <> ac.uid GROUP BY 1
      )
      SELECT u.user_email,
             coalesce(po.n, 0)::text || ' sul ramo unita',
             coalesce(pp.n, 0)::text || ' sul ramo posizioni',
             'divergenza ' || abs(coalesce(po.n,0) - coalesce(pp.n,0))::text
      FROM per_ou po
      FULL JOIN per_pos pp ON pp.capo = po.capo
      JOIN sys.sys_users u ON u.user_id = coalesce(po.capo, pp.capo)
      WHERE coalesce(po.n, 0) <> coalesce(pp.n, 0)
      ORDER BY abs(coalesce(po.n,0) - coalesce(pp.n,0)) DESC
      """,
      # L'universo non sono i soli responsabili di unita': la divergenza puo' nascere
      # anche da chi ha riporti sull'albero delle posizioni SENZA reggere nulla — e'
      # anzi il caso piu' grave. Contarli entrambi, o il rapporto mente.
      """SELECT count(*) FROM (
           SELECT organization_unit_manager_user_id uid FROM ou WHERE organization_unit_manager_user_id IS NOT NULL
           UNION
           SELECT ac.uid FROM att ac JOIN albero_pos t ON t.anten = ac.pid AND t.lv > 0
         ) z""",
      colonne=["responsabile", "perimetro unita'", "perimetro posizioni", "scarto"])

check("X10b", "X10", "Responsabile che non appartiene all'unita' che dirige",
      "chi regge un'unita' ma la sua posizione attiva sta in un'altra unita'. Sono "
      "esclusi i vertici, dove la coincidenza di due cariche e' voluta (la CEO regge "
      "la societa' E la Direzione Generale): l'esclusione non e' scelta qui, e' la "
      "stessa che il progetto dichiara in `sys.fn_organization_integrity_violations`",
      """
      SELECT u.user_email, o.organization_unit_code || ' (dirige)',
             coalesce(c.oucode, '(nessuna)') || ' (appartiene)', a.titolo
      FROM ou o
      JOIN sys.sys_users u ON u.user_id = o.organization_unit_manager_user_id
      LEFT JOIN att a ON a.uid = o.organization_unit_manager_user_id
      LEFT JOIN capo c ON c.uid = o.organization_unit_manager_user_id
      WHERE (a.ouid IS NULL OR a.ouid <> o.organization_unit_id)
        AND o.organization_unit_type NOT IN ('HEADQUARTERS', 'GENERAL_MANAGEMENT')
      ORDER BY 1
      """,
      "SELECT count(*) FROM ou WHERE organization_unit_manager_user_id IS NOT NULL "
      "AND organization_unit_type NOT IN ('HEADQUARTERS','GENERAL_MANAGEMENT')",
      colonne=["responsabile", "unita' diretta", "unita' di appartenenza", "posizione"])

check("X10c", "X10", "Nodo di comando implausibile sull'albero delle posizioni",
      "una posizione con riporti diretti il cui titolare non regge alcuna unita' "
      "e non ha ruolo di comando: e' il difetto per cui il resolver gerarchico "
      "attribuisce perimetri a chi non ha incarico",
      """
      SELECT coalesce(u.user_email, '(posizione vacante)'), p.position_title,
             (SELECT count(*)::text FROM sys.sys_positions f
               WHERE f.position_reports_to_position_id = p.position_id AND f.position_is_active) || ' riporti diretti',
             coalesce(r.rs, '(nessun ruolo)')
      FROM sys.sys_positions p
      LEFT JOIN att a ON a.pid = p.position_id
      LEFT JOIN sys.sys_users u ON u.user_id = a.uid
      LEFT JOIN ruoli r ON r.uid = a.uid
      WHERE p.position_is_active
        AND EXISTS (SELECT 1 FROM sys.sys_positions f
                     WHERE f.position_reports_to_position_id = p.position_id AND f.position_is_active)
        AND NOT EXISTS (SELECT 1 FROM ou o WHERE o.organization_unit_manager_user_id = a.uid)
        AND (r.rl IS NULL OR NOT EXISTS (SELECT 1 FROM comando c WHERE c.auth_role_code = ANY(r.rl)))
      ORDER BY 3 DESC, 2
      """,
      """SELECT count(*) FROM sys.sys_positions p WHERE p.position_is_active
         AND EXISTS (SELECT 1 FROM sys.sys_positions f
                      WHERE f.position_reports_to_position_id = p.position_id AND f.position_is_active)""",
      colonne=["titolare", "posizione", "riporti", "ruoli"])

# X10d e X10e nascono dalla ricostruzione del 2026-08-04: le migrazioni hanno
# creato posizioni nuove e disattivato le vecchie, ma alcuni riporti puntano
# ancora alle disattivate. L'albero non e' piu' sbagliato — e' spezzato, che e'
# un difetto diverso e che X10a da solo non sapeva nominare.
check("X10d", "X10", "Riporto verso una posizione disattivata",
      "una posizione attiva il cui `position_reports_to_position_id` punta a una "
      "posizione non piu' attiva: la catena si interrompe li', e chiunque stia sotto "
      "diventa irraggiungibile dall'alto",
      """
      SELECT coalesce(u.user_email, '(vacante)'), f.position_title,
             'riporta a ' || s.position_title, 'DISATTIVATA'
      FROM sys.sys_positions f
      JOIN sys.sys_positions s ON s.position_id = f.position_reports_to_position_id
      LEFT JOIN att a ON a.pid = f.position_id
      LEFT JOIN sys.sys_users u ON u.user_id = a.uid
      WHERE f.position_is_active AND NOT s.position_is_active
      ORDER BY 2, 1
      """,
      "SELECT count(*) FROM sys.sys_positions WHERE position_is_active "
      "AND position_reports_to_position_id IS NOT NULL",
      colonne=["titolare", "posizione", "riporta a", "stato del superiore"])

check("X10e", "X10", "Radici multiple nell'albero delle posizioni",
      "un tenant con piu' di una posizione priva di superiore: ogni radice oltre la "
      "prima e' un troncone che nessuna catena gerarchica raggiunge. UNA radice per "
      "tenant e' la forma corretta, non un difetto — la prima stesura le segnalava "
      "tutte e avrebbe gridato al lupo per sempre",
      """
      SELECT coalesce(t.tenant_code, '(?)'), p.position_title,
             coalesce(u.user_email, '(vacante)'),
             (SELECT count(*)::text FROM albero_pos ap WHERE ap.anten = p.position_id AND ap.lv > 0)
               || ' posizioni sotto'
      FROM sys.sys_positions p
      LEFT JOIN att a ON a.pid = p.position_id
      LEFT JOIN sys.sys_users u ON u.user_id = a.uid
      LEFT JOIN sys.sys_tenancies t ON t.tenant_id = p.position_tenant_id
      WHERE p.position_is_active AND p.position_reports_to_position_id IS NULL
        AND p.position_tenant_id IN (
          SELECT position_tenant_id FROM sys.sys_positions
          WHERE position_is_active AND position_reports_to_position_id IS NULL
          GROUP BY position_tenant_id HAVING count(*) > 1)
      ORDER BY 1, 2
      """,
      "SELECT count(*) FROM sys.sys_positions WHERE position_is_active",
      colonne=["tenant", "posizione", "titolare", "sotto-albero"])

# --- X11 isolamento fra catene sorelle -------------------------------------
check("X11a", "X11", "Intersezione fra i perimetri di unita' sorelle",
      "due unita' con lo stesso genitore i cui sotto-alberi contengono la stessa persona: "
      "se accade, l'isolamento fra catene sorelle non regge",
      """
      , per AS (
        SELECT t.anten ouid, a.uid
        FROM albero_ou t JOIN att a ON a.ouid = t.disc
      )
      SELECT o1.organization_unit_code || ' + ' || o2.organization_unit_code,
             'genitore ' || coalesce(og.organization_unit_code, '(radice)'),
             count(*)::text || ' persone in comune',
             string_agg(DISTINCT u.user_email, ' ')
      FROM ou o1
      JOIN ou o2 ON o2.organization_unit_parent_id IS NOT DISTINCT FROM o1.organization_unit_parent_id
                AND o2.organization_unit_id > o1.organization_unit_id
      LEFT JOIN ou og ON og.organization_unit_id = o1.organization_unit_parent_id
      JOIN per p1 ON p1.ouid = o1.organization_unit_id
      JOIN per p2 ON p2.ouid = o2.organization_unit_id AND p2.uid = p1.uid
      JOIN sys.sys_users u ON u.user_id = p1.uid
      GROUP BY 1, 2
      ORDER BY 3 DESC
      """,
      """SELECT count(*) FROM ou o1 JOIN ou o2
         ON o2.organization_unit_parent_id IS NOT DISTINCT FROM o1.organization_unit_parent_id
        AND o2.organization_unit_id > o1.organization_unit_id""",
      colonne=["coppia di sorelle", "genitore", "sovrapposizione", "chi"])

check("X11b", "X11", "Ciclo o profondita' anomala nell'albero delle posizioni",
      "una posizione che compare fra i propri discendenti, o una catena piu' lunga "
      "della profondita' dell'albero delle unita'",
      """
      SELECT p.position_title, 'profondita ' || max(t.lv)::text,
             (SELECT max(liv)::text FROM prof_ou) || ' livelli nelle unita',
             CASE WHEN bool_or(t.anten = t.disc AND t.lv > 0) THEN 'CICLO' ELSE 'catena lunga' END
      FROM albero_pos t
      JOIN sys.sys_positions p ON p.position_id = t.anten
      GROUP BY p.position_id, p.position_title
      HAVING max(t.lv) > (SELECT max(liv) FROM prof_ou)
          OR bool_or(t.anten = t.disc AND t.lv > 0)
      ORDER BY 2 DESC
      """,
      "SELECT count(*) FROM albero_pos WHERE lv > 0",
      colonne=["posizione", "profondita'", "riferimento unita'", "natura"])

# --- X12 il legame di staff ferma il perimetro ------------------------------
# Eseguibile dal 2026-08-04: `000244` ha introdotto `organization_unit_relation`
# (LINEA / STAFF). E' la ragione per cui quella colonna esiste — se scendendo
# lungo l'albero si entra comunque nelle unita' in staff, la colonna non serve a
# niente. La precondizione tiene la famiglia onesta sui cloni dove non c'e'.
COL_RELAZIONE = ("SELECT count(*) FROM information_schema.columns "
                 "WHERE table_schema='sys' AND table_name='sys_organization_units' "
                 "AND column_name='organization_unit_relation'")

check("X12a", "X12", "Il legame di staff non ferma la discesa del perimetro",
      "persone che entrerebbero nel perimetro di un responsabile solo perche' la "
      "discesa attraversa un legame dichiarato STAFF: sono esattamente le persone "
      "che la colonna `organization_unit_relation` esiste per tenere fuori",
      """
      , albero_linea AS (
        SELECT organization_unit_id AS anten, organization_unit_id AS disc, 0 AS lv FROM ou
        UNION ALL
        SELECT a.anten, o.organization_unit_id, a.lv + 1
        FROM albero_linea a
        JOIN ou o ON o.organization_unit_parent_id = a.disc
                 AND coalesce(o.organization_unit_relation, 'LINEA') <> 'STAFF'
        WHERE a.lv < 20
      ),
      pieno AS (
        SELECT o.organization_unit_manager_user_id capo, a.uid
        FROM ou o JOIN albero_ou t ON t.anten = o.organization_unit_id
        JOIN att a ON a.ouid = t.disc AND a.uid <> o.organization_unit_manager_user_id
        WHERE o.organization_unit_manager_user_id IS NOT NULL
      ),
      linea AS (
        SELECT o.organization_unit_manager_user_id capo, a.uid
        FROM ou o JOIN albero_linea t ON t.anten = o.organization_unit_id
        JOIN att a ON a.ouid = t.disc AND a.uid <> o.organization_unit_manager_user_id
        WHERE o.organization_unit_manager_user_id IS NOT NULL
      )
      SELECT u.user_email,
             (SELECT count(DISTINCT uid)::text FROM pieno p WHERE p.capo = x.capo) || ' scendendo ovunque',
             (SELECT count(DISTINCT uid)::text FROM linea l WHERE l.capo = x.capo) || ' fermandosi allo staff',
             count(*)::text || ' persone di differenza'
      FROM (SELECT DISTINCT capo, uid FROM pieno
            EXCEPT SELECT DISTINCT capo, uid FROM linea) x
      JOIN sys.sys_users u ON u.user_id = x.capo
      GROUP BY u.user_email, x.capo
      ORDER BY count(*) DESC
      """,
      "SELECT count(*) FROM ou WHERE coalesce(organization_unit_relation,'LINEA') = 'STAFF'",
      tipo="misura",
      colonne=["responsabile", "perimetro pieno", "perimetro di linea", "differenza"],
      precondizione=COL_RELAZIONE,
      cecita="la colonna `organization_unit_relation` non esiste in questo database: "
             "la introduce la migrazione 000244")

check("X12b", "X12", "Unita' in staff senza un vertice a cui essere in staff",
      "un'unita' dichiarata STAFF che non ha genitore: essere in staff e' una "
      "proprieta' del legame, e un legame senza l'altro capo non esiste",
      """
      SELECT o.organization_unit_code, o.organization_unit_name,
             o.organization_unit_type, 'STAFF senza genitore'
      FROM ou o
      WHERE coalesce(o.organization_unit_relation, 'LINEA') = 'STAFF'
        AND o.organization_unit_parent_id IS NULL
      ORDER BY 1
      """,
      "SELECT count(*) FROM ou WHERE coalesce(organization_unit_relation,'LINEA') = 'STAFF'",
      colonne=["unita'", "nome", "tipo", "difetto"],
      precondizione=COL_RELAZIONE,
      cecita="la colonna `organization_unit_relation` non esiste in questo database: "
             "la introduce la migrazione 000244")


def q(sql: str) -> list[list[str]]:
    # encoding esplicito: il database e' UTF-8 e su Windows il default della
    # console non lo e' — senza questo i nomi delle competenze arrivano storpiati
    # e finiscono storpiati anche nel referto.
    e = subprocess.run(PSQL + ["-c", sql], capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    if e.returncode != 0:
        return [["__ERRORE__", e.stderr.strip().splitlines()[0] if e.stderr.strip() else "?"]]
    return [r.split("\t") for r in e.stdout.strip().splitlines() if r]


def scalare(sql: str) -> int:
    r = q(PRELUDE + " SELECT (" + sql.strip().rstrip(";") + ")")
    if r and r[0] and r[0][0] == "__ERRORE__":
        return -1
    return int(r[0][0] or 0) if r and r[0] and r[0][0] else 0


def esegui(v: dict) -> dict:
    if v.get("precondizione") is not None and scalare(v["precondizione"]) == 0:
        return dict(v, righe=[], n=0, universo=0, stato="CIECA", errore=None)

    righe = q(PRELUDE + v["sql"])
    errore = bool(righe and righe[0] and righe[0][0] == "__ERRORE__")
    universo = scalare(v["universo"])
    n = 0 if errore else len(righe)
    if errore:
        stato = "ERRORE"
    elif universo == 0:
        stato = "NON FALSIFICABILE"
    elif n == 0:
        stato = "ok"
    else:
        stato = "misura" if v["tipo"] == "misura" else "DIFETTO"
    return dict(v, righe=[] if errore else righe, n=n, universo=universo, stato=stato,
                errore=righe[0][1] if errore else None)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--famiglia", action="append", help="es. X4 (ripetibile)")
    p.add_argument("--dettaglio", type=int, default=6, help="righe di esempio per verifica")
    p.add_argument("--json")
    a = p.parse_args()

    scelte = [v for v in V if not a.famiglia or v["famiglia"] in a.famiglia]
    ts = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")
    print(f"VERIFICA INCROCIATA — organigramma <-> dati della persona   {ts}")
    print(f"{len(scelte)} verifiche su {len(set(v['famiglia'] for v in scelte))} famiglie\n")

    esiti, allarmi = [], []
    fam_corrente = None
    for v in scelte:
        e = esegui(v)
        esiti.append(e)
        if e["famiglia"] != fam_corrente:
            fam_corrente = e["famiglia"]
            print(f"--- {fam_corrente} " + "-" * (70 - len(fam_corrente)))
        marchio = {"ok": "[ok]", "DIFETTO": "[!!]", "misura": "[i ]",
                   "NON FALSIFICABILE": "[??]", "CIECA": "[--]", "ERRORE": "[XX]"}[e["stato"]]
        conta = "  cieca" if e["stato"] == "CIECA" else f"{e['n']:5d} / {e['universo']}"
        print(f"{marchio} {e['id']:5s} {e['titolo'][:56]:56s} {conta}")
        if e["stato"] == "ERRORE":
            print(f"        query fallita: {e['errore']}")
            allarmi.append(f"{e['id']}: query fallita")
        elif e["stato"] == "CIECA":
            for riga in (e["cecita"] or "ragione non dichiarata").split(". "):
                print(f"        {riga}")
            allarmi.append(f"{e['id']}: cieca — {(e['cecita'] or '')[:60]}")
        elif e["stato"] == "NON FALSIFICABILE":
            print("        universo vuoto: questa verifica non poteva trovare nulla, "
                  "non conta come superata")
            allarmi.append(f"{e['id']}: non falsificabile")
        if e["n"]:
            for r in e["righe"][:a.dettaglio]:
                print("        " + " | ".join(x[:46] for x in r))
            if e["n"] > a.dettaglio:
                print(f"        ... altre {e['n'] - a.dettaglio}")
        if e["stato"] == "DIFETTO":
            allarmi.append(f"{e['id']} {e['titolo']}: {e['n']}")

    # X12 non e' piu' un caso speciale: dal 2026-08-04 la colonna esiste e la
    # famiglia e' scritta come tutte le altre, con la propria precondizione.

    print()
    difetti = [e for e in esiti if e["stato"] == "DIFETTO"]
    misure = [e for e in esiti if e["stato"] == "misura"]
    print(f"ESITO: {len(difetti)} verifiche con difetti, {len(misure)} misure informative, "
          f"{len([e for e in esiti if e['stato'] == 'ok'])} pulite")
    for x in allarmi:
        print(f"  - {x}")

    if a.json:
        with open(a.json, "w", encoding="utf-8") as f:
            json.dump({"eseguito": ts,
                       "verifiche": [{k: e[k] for k in
                                      ("id", "famiglia", "titolo", "incoerenza", "tipo",
                                       "stato", "n", "universo", "colonne", "righe", "cecita")}
                                     for e in esiti]}, f, indent=2, ensure_ascii=False)
        print(f"\nreferto grezzo: {os.path.abspath(a.json)}")

    return 1 if allarmi else 0


if __name__ == "__main__":
    sys.exit(main())
