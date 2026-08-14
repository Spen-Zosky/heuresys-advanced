#!/usr/bin/env python3
"""
check_completezza_self.py — la completezza del portale personale, derivata a macchina.

IL PROBLEMA (#117)
------------------
Il criterio **C4** di ADR-0036 e l'invariante **I17** rendono la completezza di `self`
VINCOLANTE: ogni dato che descrive una persona e' raggiungibile da quella persona,
oppure l'esclusione e' **dichiarata una per una e motivata**.

Il censimento del 2026-08-03 lo verificava — tabella per tabella, **a mano**. Il difetto
di metodo conta piu' del numero: nessuno strumento lo ricalcolava, quindi ogni migrazione
che aggiunge una tabella con un riferimento a persona abbassava la copertura **senza che
nessuno se ne accorgesse**. Ed era gia' successo: la `000256` ha introdotto le tabelle
del ciclo di valutazione dopo quel censimento.

Un elenco scritto a mano invecchia in silenzio. Questo strumento lo ri-deriva.

LE TRE CATEGORIE, E COSA SIGNIFICANO DAVVERO
--------------------------------------------
  RAGGIUNGIBILE  la tabella e' nominata dal modulo del portale personale
                 (`apps/api/src/modules/me/**`), quindi una rotta `/v1/me/*` la legge.
  ESCLUSA        non e' raggiungibile, e va bene: il motivo e' scritto in `ESCLUSIONI`.
                 Una riga senza motivo non e' ammessa — e' la differenza fra una scelta
                 e una dimenticanza.
  SCOPERTA       ne' l'una ne' l'altra. E' il difetto, e fa uscire 1.

LIMITE DICHIARATO, NON NASCOSTO
-------------------------------
Questo strumento verifica che la tabella sia **letta dal portale personale**, non che
ogni singola query sia filtrata sull'attore. Quel filtro e' garantito per costruzione
(ADR-0011: il modulo `me` esiste apposta) e verificato dai test di scope, non qui.
Dirlo e' necessario: uno strumento che lasciasse credere di aver verificato il filtro
sarebbe peggio di uno che non lo verifica, perche' chiuderebbe la domanda.

USO
---
    python docs/kb/tools/check_completezza_self.py            # rapporto + exit code
    python docs/kb/tools/check_completezza_self.py --elenco   # anche le tabelle a posto
    python docs/kb/tools/check_completezza_self.py --json

Exit: 0 nessuna scoperta · 1 almeno una scoperta · 2 non misurabile (e NON e' un ok).
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
MODULO_ME = REPO / "apps" / "api" / "src" / "modules" / "me"

# ---------------------------------------------------------------------------------------
# LE ESCLUSIONI MOTIVATE.
#
# Ogni voce e' una decisione, non una scorciatoia. Il motivo va scritto per esteso: fra un
# anno l'unica cosa che distinguera' una scelta da una dimenticanza sara' questo testo.
#
# Le categorie ricorrenti, dichiarate una volta e richiamate per brevita':
#   [TECNICA]     non descrive una persona: e' registro, giunzione tecnica o cache.
#   [AUDIT]       traccia chi ha fatto cosa; la persona e' l'ATTORE, non il soggetto.
#   [ALTRUI]      il riferimento a persona indica qualcun altro (un approvatore, un
#                 mentore, un responsabile), non l'interessato.
#   [PIANO]       piano aziendale non deliberato: comunicarlo ha conseguenze reali sulla
#                 persona e sul suo responsabile (decisione di Enzo, 2026-08-04).
#   [PIATTAFORMA] governo della piattaforma, non dato personale.
#   [RESPONSABILE] misura calcolata SULLA persona ma destinata a chi la dirige: e' uno
#                 strumento di conduzione, non un dato che la persona consulta di se'
#                 (decisione di Enzo, 2026-08-13). Diverso da [PIANO]: qui non c'e' una
#                 proposta da deliberare, c'e' un punteggio gia' calcolato.
# ---------------------------------------------------------------------------------------
ESCLUSIONI: dict[str, str] = {
    # --- decisione esplicita di Enzo (2026-08-13) ------------------------------------
    "sys_employee_position_fit_scores":
        "[RESPONSABILE] Enzo, 2026-08-13: il punteggio di aderenza alla posizione e' "
        "materiale del responsabile, NON si mostra all'interessato. 146 righe, una per "
        "ciascuna delle 146 persone misurate.",
    # --- decisioni esplicite di Enzo (2026-08-04, voce L7) ---------------------------
    "sys_successor_candidates":
        "[PIANO] Enzo, 2026-08-04: un piano di successione non deliberato. Comunicare a "
        "qualcuno che e' (o non e') un successore designato ha conseguenze reali su di "
        "lui e sul suo responsabile. NON visibile all'interessato.",
    "sys_compensation_recommendations":
        "[PIANO] Enzo, 2026-08-04: raccomandazione retributiva non deliberata. Stessa "
        "ragione delle successioni: e' una proposta interna, non una decisione presa.",
    # --- registri e giunzioni tecniche -----------------------------------------------
    "sys_schema_migrations": "[TECNICA] registro delle migrazioni applicate.",
    "sys_reference_translations": "[TECNICA] registro delle traduzioni, non dato personale.",
    "sys_ui_interfaces": "[PIATTAFORMA] voci di menu.",
    "sys_gdpr_registry": "[PIATTAFORMA] mappa GDPR delle tabelle; il fascicolo dell'art. 15 "
                         "si esercita con la rotta dedicata, non leggendo la mappa.",
    "sys_industry_codes": "[TECNICA] catalogo dei settori (mig 000305).",
    # --- la famiglia `sys_engagement_*`: un DOPPIONE FERMO, non il clima vivo -----------
    #
    # Correzione della classificazione scritta poche ore prima, nella stessa sessione, e
    # vale la pena lasciarla scritta perche' l'errore era di metodo: avevo classificato
    # queste tabelle dal NOME, convinto che «engagement survey» fosse il sondaggio di
    # clima. Misurando per costruire la superficie e' saltato fuori che le famiglie sono
    # DUE, e che quella viva e' l'altra:
    #
    #   sys_surveys           14 sondaggi, titoli italiani, uno APERTO OGGI
    #                         («Rilevazione di clima in corso»), 8.288 risposte, esposto
    #                         dal portale — e' il clima vero.
    #   sys_engagement_*       6 sondaggi, titoli inglesi, tutti `closed`, l'ultimo fermo
    #                         al 2025-01-10, 862 risposte, nessuna rotta li nomina.
    #
    # Non si espone un residuo: si bonifica. Finche' la decisione non c'e', l'esclusione
    # e' questa, scritta col suo motivo — che e' esattamente cio' che C4 chiede.
    "sys_engagement_surveys":
        "[RESIDUO] doppione fermo della famiglia viva `sys_surveys`: 6 sondaggi in "
        "inglese, tutti chiusi, l'ultimo del 2025-01-10, nessuna rotta li legge. Il clima "
        "vero e' `sys_surveys` (14, uno aperto oggi). Da bonificare, non da esporre.",
    "sys_engagement_survey_responses":
        "[RESIDUO] le 862 risposte del doppione. Quelle vere sono le 8.288 di "
        "`sys_survey_responses`, che la persona rilegge da /v1/me/surveys/:id dal "
        "2026-08-13. Da bonificare insieme alla famiglia.",
    "sys_engagement_survey_templates":
        "[RESIDUO] i 5 modelli del doppione; per giunta il riferimento a persona e' "
        "l'autore del modello, non l'interessato.",
    "sys_engagement_feedback":
        "[ALTRUI] il feedback NON ha mittente: 400 righe e l'unica colonna verso una "
        "persona e' `feedback_reviewed_by_user_id`, cioe' chi lo ha esaminato. Non "
        "esistendo un autore registrato, non esiste un «proprio feedback» da rivedere — "
        "e' anonimo per costruzione dello schema, non per una scelta di visibilita'.",
    "sys_engagement_action_plans":
        "[RESIDUO] gli 8 piani d'azione della famiglia ferma. Stessa sorte del resto di "
        "`sys_engagement_*`: si bonifica, non si espone.",

    # =================================================================================
    # #99 F5 (S1061, 2026-08-14) — le 22 che restavano SCOPERTE, classificate una per
    # una DOPO averle misurate. Il metodo e' quello imparato col doppione `engagement`:
    # mai dal nome, sempre dal dato e da chi lo legge.
    # =================================================================================

    # --- il riferimento a persona e' QUALCUN ALTRO -----------------------------------
    "sys_reward_gate_results":
        "[ALTRUI] 3.283 righe, e l'unica colonna verso una persona e' "
        "`reward_gate_result_evaluator_user_id`: chi ha valutato il cancello, non chi lo "
        "subisce. Il soggetto sta in `sys_reward_gates`, classificata a parte.",
    "sys_calibration_sessions":
        "[ALTRUI] 35 sessioni; la colonna verso una persona e' il FACILITATORE. Il "
        "collegamento all'interessato passa da `sys_calibration_participants`.",
    "sys_whistleblowing_reports":
        "[ALTRUI] + isolamento assoluto (ADR-0036 §5). Due righe, e la colonna verso una "
        "persona e' `whistleblowing_report_assignee_user_id`: chi ha in carico la "
        "segnalazione, non chi l'ha fatta — il segnalante NON e' registrato, ed e' il "
        "punto dell'istituto. L'eccezione di ADR-0036 e' la piu' netta delle quattro: qui "
        "non arriva nemmeno il mandato tecnico, presidiato da #99 F4 su tre livelli.",

    # --- traccia di chi ha fatto cosa: la persona e' l'attore -------------------------
    "sys_position_skill_requirement_history":
        "[AUDIT] 181 righe, `..._actor_user_id` = chi ha cambiato un requisito di "
        "competenza di una POSIZIONE. Il soggetto e' la posizione, non la persona.",
    "sys_organization_unit_history":
        "[AUDIT] 26 righe, `..._actor_user_id` = chi ha modificato l'unita'. Storia della "
        "struttura, non della persona.",
    "sys_seed_approval_decisions":
        "[PIATTAFORMA] 12 decisioni di approvazione della pipeline di acquisizione dati; "
        "la persona e' l'APPROVATORE che governa la piattaforma.",

    # --- misura calcolata sulla persona, destinata a chi la dirige --------------------
    #
    # Le quattro qui sotto seguono la decisione che Enzo ha gia' preso il 2026-08-13 su
    # `sys_employee_position_fit_scores` ([RESPONSABILE]) e quella del 2026-08-04 su
    # `sys_successor_candidates` ([PIANO]). Non sono decisioni nuove: sono la stessa
    # decisione applicata alle tabelle sorelle, che allora non erano state nominate.
    "sys_talent_scores":
        "[RESPONSABILE] 154 punteggi di talento, uno per persona. Stessa natura del "
        "punteggio di aderenza alla posizione, che Enzo il 2026-08-13 ha dichiarato "
        "materiale del responsabile: e' uno strumento di conduzione, non un dato che la "
        "persona consulta di se'.",
    "sys_readiness_scores":
        "[RESPONSABILE] 89 punteggi di prontezza. Idem: misura calcolata SULLA persona "
        "per chi decide una progressione.",
    "sys_succession_scores":
        "[PIANO] 89 punteggi di successione. Coerente con `sys_successor_candidates`, che "
        "Enzo ha escluso il 2026-08-04: un piano di successione non deliberato non si "
        "comunica all'interessato. Questa e' la stessa materia, in forma di punteggio.",
    "sys_calibration_participants":
        "[PIANO] 20 righe con l'interessato in chiaro, ma la calibrazione E' la "
        "deliberazione: ADR-0036 §5 tiene invisibile la valutazione finche' non e' "
        "comunicata (`shared_at OR acknowledged_at`), ed e' il filtro gia' applicato da "
        "#92 F5 su /v1/me/performance. Esporre il tavolo di calibrazione scavalcherebbe "
        "quel filtro dall'altra parte.",

    # --- doppioni fermi: si bonificano, non si espongono ------------------------------
    "sys_kpi_measurements":
        "[RESIDUO] 248 righe / 138 persone, ferme al 2026-06-03 — e sono lo STESSO dato "
        "di `sys_user_kpi_evidence` (248 righe / 138 persone, stessa data), che e' quella "
        "viva: la legge /v1/me/kpis. L'incrocio su (persona, kpi) da' 280 coppie "
        "combacianti. Esporre anche questa mostrerebbe due volte la stessa misura, con il "
        "rischio che divergano. Da bonificare, come la famiglia `engagement`.",
    "sys_okrs":
        "[RESIDUO] 17 righe, e `okr_owner_user_id` e' NULL su TUTTE E 17 (misurato). "
        "Nessun OKR appartiene a nessuno: non esiste un «proprio OKR» da mostrare. Non e' "
        "una scelta di visibilita', e' l'assenza del dato — come per "
        "`sys_engagement_feedback`. Gli obiettivi vivi sono `sys_goals` (2.189 righe, 158 "
        "persone), esposti da /v1/me/goals.",
    "sys_okr_key_results":
        "[RESIDUO] 20 righe, `key_result_owner_user_id` NULL su tutte e 20. Stessa "
        "famiglia scollegata di `sys_okrs`.",
    "sys_okr_check_ins":
        "[RESIDUO] 25 righe, `check_in_subject_user_id` NULL su tutte e 25. Idem.",

    # --- tecniche ---------------------------------------------------------------------
    "sys_user_profile_embeddings":
        "[TECNICA] 156 vettori di embedding del profilo. Non e' un dato leggibile della "
        "persona ma la sua rappresentazione numerica per la ricerca semantica: mostrarlo "
        "non aggiunge nulla che il profilo non dica gia' in chiaro. Cio' che ne DERIVA "
        "(abbinamenti, predizioni) e' esposto e resta il modo giusto di renderne conto.",

    # --- retribuzione variabile: il calcolo non e' la delibera -------------------------
    #
    # Cio' che e' stato davvero erogato la persona lo vede gia', nella busta paga
    # (/v1/me/pay-slips): quello e' il dato deliberato. Queste due tabelle stanno un
    # gradino PRIMA — sono il motore che propone. Vale la stessa ragione con cui Enzo ha
    # escluso `sys_compensation_recommendations` il 2026-08-04.
    "sys_reward_gates":
        "[PIANO] 3.283 cancelli di premio (persona x posizione x periodo) calcolati dal "
        "motore di `compensation`. E' la condizione che una proposta di premio deve "
        "superare, non un importo deciso: comunicarla equivarrebbe ad annunciare un "
        "premio prima che sia deliberato. L'erogato sta nella busta paga, gia' visibile.",
    "sys_variable_pay_calculations":
        "[PIANO] 182 calcoli di retribuzione variabile, stesso gradino dei cancelli. "
        "Idem: la persona vede l'erogato in busta paga, non la simulazione che lo precede.",
}

# I «padri» che NON rendono raggiungibile nessuno.
#
# Prima stesura della quarta categoria: **57 scoperte su 57 diventavano raggiungibili**,
# cioe' un verde perfetto al primo colpo — che e' sempre un motivo di sospetto, non di
# soddisfazione. La causa: quasi ogni tabella ha una chiave esterna verso `sys_users`,
# che il portale ovviamente legge, quindi la regola rispondeva sempre di si'.
#
# Un riferimento a `sys_users` e' la condizione che ha messo la tabella NEL CENSIMENTO:
# usarla anche come prova di raggiungibilita' e' un ragionamento circolare. Lo stesso vale
# per il tenant e per le tabelle di catalogo, che compaiono ovunque.
PADRI_UNIVERSALI = {
    "sys_users", "sys_tenancies", "sys_positions", "sys_organization_units",
    "sys_skills", "sys_job_roles", "sys_kpi_definitions", "sys_learning_paths",
}

# DECISE E DA COSTRUIRE — ne' raggiungibili ne' escluse: la decisione c'e', il codice no.
#
# E' una categoria a se' perche' le due cose sono diverse in modo importante. Una lacuna
# IGNOTA e' un difetto di governo: nessuno sa che esiste. Una lacuna DECISA e SCHEDATA e'
# lavoro in coda, e confonderle fa perdere l'unica informazione che conta — se qualcuno
# se ne sta occupando.
DA_COSTRUIRE: dict[str, str] = {
    "sys_model_predictions":
        "#126 — Enzo, 2026-08-04: VISIBILE all'interessato. 468 righe su 156 persone di "
        "158: quasi tutti hanno oggi una predizione algoritmica su di se' che non possono "
        "vedere. Servono la rotta /v1/me/* e la superficie; va esposto anche il modello e "
        "la data, non il punteggio nudo.",
    "sys_mentor_match_scores":
        "#126 — Enzo, 2026-08-04: VISIBILE all'interessato, ma solo il punteggio "
        "dell'allievo verso i PROPRI mentori: `match_mentor_user_id` resta invisibile se "
        "rivela una graduatoria fra persone.",
    "sys_pulse_checks":
        "Enzo, 2026-08-13 (estensione DERIVATA, dichiarata come tale): 2.834 rilevazioni "
        "di 157 persone, con umore, carico e soddisfazione scritti DALLA PERSONA su "
        "`pulse_check_subject_user_id`. E' lo stesso principio delle risposte — cio' che "
        "la persona ha dichiarato di suo pugno, lo puo' rivedere. A differenza della "
        "famiglia `engagement`, questa tabella NON e' un doppione: e' l'unica del suo "
        "genere, ed e' viva (la legge `insights` per calcolare un punteggio sulla "
        "persona). Superficie da costruire.",

    # --- #99 F5: COSTRUITE il 2026-08-14 (S1061) — restano qui solo come cronaca -------
    #
    # Le quattro voci sotto sono state chiuse nella sessione stessa in cui erano state
    # aperte: /v1/me/mentorships, /v1/me/processes, /v1/me/skill-gap-scores e il campo
    # `assignedTarget` di /v1/me/kpis. Lo strumento le classifica ora RAGGIUNGIBILI da se',
    # leggendo il codice — non da questo elenco, che infatti non le conta piu'.
    # Presidiate da `test/me-self-completeness-f5.integration.test.ts` (7/7, falsificabilita'
    # provata su due sabotaggi distinti).
    "sys_kpi_targets":
        "#99 F5 — VISIBILE: sono gli obiettivi di KPI assegnati alla persona. 301 righe "
        "su 158 persone, l'ultima del 2026-07-23: viva e recente. Oggi /v1/me/kpis mostra "
        "i requisiti della POSIZIONE (`sys_position_kpi_requirements`) e l'ultima "
        "rilevazione, ma NON il bersaglio assegnato a lei: la persona vede a che punto e' "
        "senza vedere dove doveva arrivare. Superficie da costruire.",
    "sys_mentorships":
        "#99 F5 — VISIBILE: 63 rapporti di mentoring reali su 22 allievi, e la persona "
        "compare sia come mentore sia come allievo. Oggi il portale espone i "
        "SUGGERIMENTI di abbinamento (`sys_mentor_match_scores`, /v1/me/mentor-matches) "
        "ma NON i rapporti in corso: si vede chi si potrebbe avere come mentore e non chi "
        "si ha davvero. Da costruire con lo stesso limite gia' deciso da Enzo per gli "
        "abbinamenti — nessuna graduatoria fra persone.",
    "sys_process_participants":
        "#99 F5 — VISIBILE: 845 partecipazioni a processi aziendali, e **nessun modulo "
        "API le legge** (misurato: zero riscontri in apps/api/src/modules). Sapere a "
        "quali processi si partecipa non e' un dato sensibile — e' il proprio lavoro. "
        "Ricade anche sotto il cancello di esposizione #79: dato popolato che il prodotto "
        "non espone da nessuna parte, nemmeno al di fuori del portale personale.",
    "sys_skill_gap_scores":
        "#99 F5 — VISIBILE: 156 punteggi, uno per persona, con `model_version` e "
        "`computed_at`. E' la stessa natura di `sys_model_predictions`, che Enzo il "
        "2026-08-04 ha dichiarato visibile all'interessato: un punteggio algoritmico su "
        "di lei. Le lacune di dettaglio le vede gia' (/v1/me/gaps), quindi l'aggregato "
        "non aggiunge sensibilita'. Vale la stessa prescrizione: esporre modello e data, "
        "non il punteggio nudo.",
}

# Le famiglie che si escludono per prefisso, con la ragione dichiarata una volta sola.
ESCLUSIONI_PREFISSO: list[tuple[str, str]] = [
    ("sys_auth_", "[PIATTAFORMA] l'autenticazione e' separata dai dati della persona (I7); "
                  "la superficie personale e' /me/security, non queste tabelle."),
]


def tabelle_con_persona() -> list[str] | None:
    """Le tabelle di `sys` che portano un riferimento a una persona.

    `None` se il database non risponde: senza il censimento non si puo' dire niente, e
    dirlo e' l'unica risposta onesta.
    """
    sql = """
        SELECT DISTINCT c.table_name
          FROM information_schema.columns c
          JOIN information_schema.tables t
            ON t.table_schema = c.table_schema AND t.table_name = c.table_name
           AND t.table_type = 'BASE TABLE'
         WHERE c.table_schema = 'sys'
           AND (c.column_name LIKE '%user_id'
                OR c.column_name LIKE '%employee_id'
                OR c.column_name LIKE '%person_id')
         ORDER BY 1"""
    try:
        out = subprocess.run(
            ["psql", "-h", "localhost", "-p", "5433", "-U", "heuresys",
             "-d", "heuresys_advanced", "-X", "-q", "-tA", "-c", sql],
            capture_output=True, text=True, timeout=40, encoding="utf-8", errors="replace",
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if out.returncode != 0:
        return None
    return [r.strip() for r in out.stdout.split() if r.strip()]


def _tabelle_in(cartella: Path) -> tuple[set[str], set[str]]:
    """(tabelle nominate, moduli importati) da una cartella di sorgenti."""
    tabelle: set[str] = set()
    moduli: set[str] = set()
    if not cartella.is_dir():
        return tabelle, moduli
    for radice, _, files in os.walk(cartella):
        for f in files:
            if not f.endswith((".ts", ".tsx")):
                continue
            try:
                testo = (Path(radice) / f).read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            tabelle.update(re.findall(r"sys\.(sys_[a-z0-9_]+)", testo))
            moduli.update(re.findall(r'from "\.\./([a-z0-9-]+)/', testo))
    return tabelle, moduli


def tabelle_del_portale() -> set[str]:
    """Le tabelle che il portale personale legge, DIRETTAMENTE O TRAMITE I SERVIZI CHE USA.

    Il secondo pezzo non e' un dettaglio. La prima stesura guardava solo i tre file del
    modulo `me` e dichiarava scoperte tabelle come `sys_time_off_requests`, mentre
    `/me/time-off` esiste eccome: il modulo **compone i servizi di undici altri moduli**
    (`../time-off/service.js`, `../goals/service.js`, `../teams/service.js`, ...), e
    quelle tabelle vivono nei loro repository.

    Fermarsi al primo livello sarebbe stato un falso positivo di massa — quaranta
    tabelle dichiarate irraggiungibili mentre la persona le vede. Un cancello che grida
    al lupo si smette di guardarlo, esattamente come uno che tace.
    """
    dirette, moduli = _tabelle_in(MODULO_ME)
    for m in sorted(moduli):
        altre, _ = _tabelle_in(MODULO_ME.parent / m)
        dirette |= altre
    return dirette


def padri(tabelle: list[str]) -> dict[str, list[str]] | None:
    """Per ogni tabella, le tabelle di `sys` verso cui ha una chiave esterna.

    Serve alla quarta categoria: molte tabelle non sono lette direttamente dal portale
    perche' sono FIGLIE di qualcosa che lo e' — i commenti di un obiettivo, i risultati
    chiave di un OKR, le misurazioni di un KPI. La persona le raggiunge aprendo il
    padre, e chiamarle «scoperte» sarebbe falso.

    E' una DERIVAZIONE, non una decisione: la parentela sta nelle chiavi esterne, non
    nel giudizio di chi scrive l'elenco.
    """
    sql = """
        SELECT c.conrelid::regclass::text, c.confrelid::regclass::text
          FROM pg_constraint c
          JOIN pg_class r ON r.oid = c.conrelid
          JOIN pg_namespace n ON n.oid = r.relnamespace
         WHERE c.contype = 'f' AND n.nspname = 'sys'"""
    try:
        out = subprocess.run(
            ["psql", "-h", "localhost", "-p", "5433", "-U", "heuresys",
             "-d", "heuresys_advanced", "-X", "-q", "-tA", "-F", "|", "-c", sql],
            capture_output=True, text=True, timeout=40, encoding="utf-8", errors="replace",
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if out.returncode != 0:
        return None
    mappa: dict[str, list[str]] = {t: [] for t in tabelle}
    for riga in out.stdout.splitlines():
        if "|" not in riga:
            continue
        figlia, padre = (x.strip().replace("sys.", "") for x in riga.split("|", 1))
        if figlia in mappa and padre != figlia and padre not in PADRI_UNIVERSALI:
            mappa[figlia].append(padre)
    return mappa


def motivo_esclusione(tabella: str) -> str | None:
    if tabella in ESCLUSIONI:
        return ESCLUSIONI[tabella]
    for prefisso, ragione in ESCLUSIONI_PREFISSO:
        if tabella.startswith(prefisso):
            return ragione
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description="Completezza di `self`, derivata (#117).")
    ap.add_argument("--elenco", action="store_true", help="mostra anche le tabelle a posto")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()

    tabelle = tabelle_con_persona()
    if tabelle is None:
        print("[!!] il censimento non e' eseguibile (database irraggiungibile).")
        print("     NON MISURABILE: senza l'elenco delle tabelle ogni risposta sarebbe finta.")
        return 2
    portale = tabelle_del_portale()
    if not portale:
        print(f"[!!] nessuna tabella trovata in {MODULO_ME} — NON MISURABILE.")
        print("     Un elenco vuoto qui farebbe risultare SCOPERTA ogni tabella.")
        return 2

    parentele = padri(tabelle)
    if parentele is None:
        print("[!!] le chiavi esterne non sono interrogabili — NON MISURABILE.")
        return 2

    raggiungibili, tramite_padre, escluse, scoperte, da_costruire = [], [], [], [], []
    for t in tabelle:
        if t in portale:
            raggiungibili.append(t)
        elif t in DA_COSTRUIRE:
            da_costruire.append((t, DA_COSTRUIRE[t]))
        elif (m := motivo_esclusione(t)) is not None:
            escluse.append((t, m))
        elif (pp := [x for x in parentele.get(t, []) if x in portale]):
            # La persona la raggiunge aprendo il padre. E' derivato dalle chiavi
            # esterne, non deciso: la parentela sta nel database.
            tramite_padre.append((t, pp[0]))
        else:
            scoperte.append(t)

    if a.json:
        print(json.dumps({
            "totale": len(tabelle), "raggiungibili": raggiungibili,
            "tramite_padre": [{"tabella": t, "padre": p} for t, p in tramite_padre],
            "escluse": [{"tabella": t, "motivo": m} for t, m in escluse],
            "scoperte": scoperte,
            "da_costruire": [{"tabella": t, "motivo": m} for t, m in da_costruire],
        }, indent=2, ensure_ascii=False))
        return 1 if scoperte else 0

    print("=" * 78)
    print(" COMPLETEZZA DI `self` — C4 / I17, derivata a macchina (#117)")
    print("=" * 78)
    print(f"  tabelle che descrivono una persona   {len(tabelle):>4}")
    print(f"  RAGGIUNGIBILI dal portale personale  {len(raggiungibili):>4}")
    print(f"  raggiungibili TRAMITE IL PADRE       {len(tramite_padre):>4}  (derivato dalle FK)")
    print(f"  ESCLUSE con motivo dichiarato        {len(escluse):>4}")
    print(f"  DECISE, da costruire                 {len(da_costruire):>4}  (lacuna schedata, non ignota)")
    print(f"  SCOPERTE                             {len(scoperte):>4}")
    print("-" * 78)
    print("  Verifica che la tabella sia LETTA dal portale, non che ogni query sia")
    print("  filtrata sull'attore: quel filtro e' garantito da ADR-0011 e provato dai")
    print("  test di scope. Dirlo serve — uno strumento che lasciasse credere il")
    print("  contrario chiuderebbe la domanda invece di rispondere.")

    if a.elenco:
        print("-" * 78)
        for t in raggiungibili:
            print(f"    [ok]   {t}")
        for t, p in tramite_padre:
            print(f"    [pad]  {t:<44} via {p}")
        for t, m in escluse:
            print(f"    [escl] {t:<44} {m[:30]}...")
        for t, m in da_costruire:
            print(f"    [TODO] {t:<44} {m[:30]}...")

    if scoperte:
        print("-" * 78)
        print("  Queste tabelle descrivono una persona, non sono raggiungibili dal suo")
        print("  portale, e nessuno ha scritto perche'. C4 le vuole raggiungibili o")
        print("  escluse CON MOTIVO:")
        for t in scoperte:
            print(f"    · {t}")
        print("=" * 78)
        return 1
    print("  Nessuna tabella scoperta.")
    print("=" * 78)
    return 0


if __name__ == "__main__":
    sys.exit(main())
