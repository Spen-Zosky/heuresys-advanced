#!/usr/bin/env python3
"""
db_health.py — cruscotto di salute del DBMS, con esito binario.

Perche' esiste
--------------
Lo schema `sys` contiene viste sentinella `v_*` (scoperte DINAMICAMENTE da pg_views, mai contate a mano qui) che segnalano anomalie
strutturali (sconfinamenti di tenant, assegnazioni orfane, doppi primari...).
Misurato in sessione lab il 2026-08-03: sono tutte a zero, e **nessuno strumento
del progetto le interroga** — non compaiono in session_start.py ne' in
verify_gate.py. Erano un cruscotto costruito e mai acceso.

Questo script le accende, e aggiunge le sonde che nessuna vista copriva:
duplicazione delle chiavi naturali, colonne dichiarate e mai riempite, chiavi
esterne senza indice, tuple morte, statistiche mancanti, freschezza del dato,
copertura per persona.

Esito binario: exit 1 se una sentinella si accende o una soglia e' superata,
exit 2 se il database non e' raggiungibile (non misurato != tutto bene).
Nessun numero e' scritto a mano: tutto si ri-deriva dal catalogo e dai dati.

Uso:
    python docs/kb/tools/db_health.py               # cruscotto completo
    python docs/kb/tools/db_health.py --sentinelle  # solo le viste (veloce, per il boot)
    python docs/kb/tools/db_health.py --compatto    # una riga di sintesi + i soli allarmi
    python docs/kb/tools/db_health.py --json <file>

E' invocato in-process da session_start.py (--sentinelle --compatto) e come gate
pieno da verify_gate.py sui commit che toccano db/**.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys

PSQL = ["psql", "-h", os.environ.get("PGHOST", "localhost"),
        "-p", os.environ.get("PGPORT", "5433"),
        "-U", os.environ.get("PGUSER", "heuresys"),
        "-d", os.environ.get("PGDATABASE", "heuresys_advanced"),
        "-At", "-F", "\t"]

# Viste `v_*` che NON sono sentinelle: contano stato, non anomalie. Una vista
# elencata qui non fa mai fallire il cruscotto — e senza motivo non e' una deroga.
INFORMATIVE = {
    "v_reconciliation_status": "registro delle decisioni di riconciliazione, non un difetto",
    "v_reference_translation_coverage": "copertura traduzioni per entita', metrica",
    "v_pip_completeness": "elenca i PIP incompleti: informativa, ha una soglia propria",
    "v_organization_unit_integrity":
        "una riga per unita' con le bandiere di violazione, non una riga per violazione: "
        "l'allarme dell'organigramma e' la sonda su fn_organization_integrity_violations()",
    "v_positions_with_critical_skill_gap":
        "E25 (P4/T5): una riga per POSIZIONE OCCUPATA, non per anomalia. Lo scostamento fra i "
        "requisiti CRITICAL e le competenze dell'occupante e' la condizione normale di un'azienda "
        "vera — misurato su RTL: 60 persone su 97, peggior caso 2 — quindi righe qui NON sono un "
        "difetto, sono informazione di governo. Porta la colonna `cieca` per distinguere «nessuno "
        "scostamento» da «non c'era niente da controllare»",
}

# Soglie: superate = allarme. Derivano dalla misura del 2026-08-03, non da teoria.
SOGLIE = {
    "duplicati_chiave_naturale": 0,
    "tuple_morte_pct": 20.0,
    "righe_minime_per_bloat": 1000,
    "tabelle_mai_analizzate": 0,
    # La freschezza si misura con il metro della CADENZA del dato, non con uno
    # solo per tutti. Le presenze sono giornaliere: sette giorni di silenzio
    # sono un ritardo vero. Le buste paga sono MENSILI, e quella del mese in
    # corso non puo' esistere finche' il mese non e' finito: con la soglia a 7
    # questo controllo sarebbe rosso circa tre settimane su quattro, ogni mese —
    # e un controllo quasi sempre rosso smette di segnalare qualcosa. Misurato
    # il 2026-08-08: buste all'ultimo periodo chiuso (31 luglio), storia
    # avanzata a ieri, nessun ritardo reale.
    "giorni_senza_dato_fresco": 7,
    "giorni_senza_dato_fresco_mensile": 40,
    # Misurato dopo il ri-aggancio dei QUATTRO cataloghi (mig 000260 e 000261, S1043):
    # 226 righe restano su posizioni disattivate, e sono spiegate — appartengono alle 20
    # posizioni gia' vacanti PRIMA della ricostruzione (nessuno le occupava, quindi non
    # hanno una posizione successore) piu' i casi in cui la posizione nuova dichiarava
    # gia' lo stesso requisito. La soglia e' il valore REALE e non una cifra tonda piu'
    # larga: se cresce, qualcuno ha disattivato posizioni lasciandosi dietro il catalogo.
    "requisiti_su_posizioni_spente": 226,
}


class DbNonRaggiungibile(RuntimeError):
    """psql ha fallito. E' un'eccezione e non un sys.exit perche' questo modulo
    viene invocato in-process dal boot di sessione, che e' una vista e non deve
    morire quando il tunnel e' giu'."""


# ── UNA CONNESSIONE SOLA, NON QUINDICI ────────────────────────────────────────
# Misurato sul tunnel SSH (S1043): APRIRE una connessione costa ~1,12 s, mentre
# eseguire una query su una connessione gia' aperta ne costa ~0,08 — quattordici
# volte meno. Questo modulo faceva 15 chiamate, ognuna con la sua `psql`: ~22
# secondi di sola apertura di canale, pagati A OGNI AVVIO DI SESSIONE, per un
# lavoro che ne vale meno di due.
#
# Ora le query passano tutte da UNA psql tenuta aperta. Ogni domanda termina con
# un marcatore stampato da \echo: e' cosi' che si sa dove finisce una risposta e
# comincia la successiva, senza chiudere il canale.
#
# Se la sessione persistente non si apre o si rompe, si torna da soli al vecchio
# comportamento (una psql per query): uno strumento di diagnosi non deve smettere
# di funzionare per colpa dell'ottimizzazione che lo rende veloce.
_FINE = "\u00a7FINE-RISPOSTA\u00a7"
_sessione = None
_persistente_ko = False


def _sessione_aperta():
    global _sessione, _persistente_ko
    if _persistente_ko:
        return None
    if _sessione is not None and _sessione.poll() is None:
        return _sessione
    try:
        _sessione = subprocess.Popen(
            PSQL + ["-q"], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT, text=True, bufsize=1,
            encoding="utf-8", errors="replace")
        _sessione.stdin.write(chr(92) + "set ON_ERROR_STOP off" + chr(10))
        _sessione.stdin.flush()
        return _sessione
    except Exception:
        _persistente_ko = True
        return None


def _una_tantum(sql):
    """Il vecchio comportamento: una psql per query. Riserva, non strada maestra."""
    e = subprocess.run(PSQL + ["-c", sql], capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    if e.returncode != 0:
        raise DbNonRaggiungibile(e.stderr.strip() or "psql ha fallito senza messaggio")
    return [r.split("\t") for r in e.stdout.strip().splitlines() if r]


def q(sql: str) -> list[list[str]]:
    global _persistente_ko
    ses = _sessione_aperta()
    if ses is None:
        return _una_tantum(sql)
    try:
        ses.stdin.write(sql.rstrip().rstrip(";") + ";\n")
        ses.stdin.write(chr(92) + "echo " + _FINE + chr(10))
        ses.stdin.flush()
        righe = []
        while True:
            riga = ses.stdout.readline()
            if riga == "":                      # la sessione e' morta a meta' domanda
                _persistente_ko = True
                return _una_tantum(sql)
            riga = riga.rstrip("\n")
            if riga == _FINE:
                break
            righe.append(riga)
    except (BrokenPipeError, OSError):
        _persistente_ko = True
        return _una_tantum(sql)
    # Gli errori arrivano su stdout (stderr e' unito): un errore SQL continua a
    # sollevare come prima, cosi' chi chiama non si accorge del cambio.
    for r in righe:
        if r.startswith("ERROR:") or r.startswith("ERRORE:"):
            raise DbNonRaggiungibile(r)
    return [r.split("\t") for r in righe if r]


def uno(sql: str) -> str:
    r = q(sql)
    return r[0][0] if r and r[0] else "0"


def sentinelle() -> list[tuple[str, int, bool]]:
    """(vista, righe, e_un_allarme) per ogni v_* dello schema sys."""
    righe = q("""
        SELECT viewname,
               (xpath('/table/row/c/text()', query_to_xml(
                  format('SELECT count(*) AS c FROM sys.%I', viewname),
                  false, false, '')))[1]::text::bigint
        FROM pg_views WHERE schemaname='sys' AND viewname LIKE 'v!_%' ESCAPE '!'
        ORDER BY 1
    """)
    esito = []
    for vista, n in righe:
        n = int(n)
        esito.append((vista, n, vista not in INFORMATIVE and n != 0))
    return esito


def sonde() -> list[tuple[str, str, bool]]:
    """(nome, valore, e_un_allarme) — le verifiche che nessuna vista copriva."""
    out = []

    dup = q("""
        SELECT 'learning_path_code', count(*)-count(DISTINCT learning_path_code) FROM sys.sys_learning_paths
        UNION ALL SELECT 'learning_module_code', count(*)-count(DISTINCT learning_module_code) FROM sys.sys_learning_modules
        UNION ALL SELECT 'skill_code', count(*)-count(DISTINCT skill_code) FROM sys.sys_skills
        UNION ALL SELECT 'job_role_code', count(*)-count(DISTINCT job_role_code) FROM sys.sys_job_roles
        UNION ALL SELECT 'position_code', count(*)-count(DISTINCT position_code) FROM sys.sys_positions
        UNION ALL SELECT 'user_email', count(*)-count(DISTINCT user_email) FROM sys.sys_users
    """)
    for chiave, n in dup:
        out.append((f"duplicati su {chiave}", n,
                    int(n) != SOGLIE["duplicati_chiave_naturale"]))

    # L'organigramma. La funzione la crea la migrazione 000251 e restituisce una riga
    # per regola col numero di violazioni aperte.
    #
    # [S1052] L'esenzione e' STATA TOLTA. «persone attive senza posizione» era esclusa dal
    # conteggio perche' valeva 1 per via di `admin@heuresys.com`, utenza di servizio e non
    # persona dell'organigramma. Quell'account e' stato rimosso dalla migrazione `000295`
    # (`#139`) e la regola ora vale **0**, misurato — quindi l'esenzione era diventata un
    # punto cieco: nessuno guardava piu' quella regola, e una persona lasciata senza
    # posizione sarebbe passata inosservata. Ora si sorvegliano tutte e otto.
    if uno("""SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
              WHERE n.nspname='sys' AND p.proname='fn_organization_integrity_violations'""") != "0":
        strutt = q("""SELECT coalesce(sum(violazioni),0)
                        FROM sys.fn_organization_integrity_violations()""")
        n_strutt = strutt[0][0] if strutt and strutt[0] else "0"
        out.append(("violazioni dell'organigramma (tutte e 8 le regole)", n_strutt, int(n_strutt) != 0))
    else:
        out.append(("violazioni strutturali dell'organigramma", "n/d (funzione assente)", False))

    # La guardia che e' mancata alla ricostruzione dell'organigramma. Le otto migrazioni
    # avevano 64 auto-verifiche e nessuna guardava i cataloghi agganciati per
    # `position_id`: 1521 requisiti di competenza su 1678 sono rimasti appesi a posizioni
    # disattivate, e l'effetto peggiore non era il rumore ma la CECITA' — la verifica dei
    # divari di competenza e' scesa da 635 a 53 perche' l'universo era crollato, non
    # perche' i divari fossero stati colmati. Un numero che migliora perche' ha perso i
    # dati e' peggio di un numero rosso.
    orfani_req = uno("""
        SELECT (SELECT count(*) FROM sys.sys_position_skill_requirements r
                 JOIN sys.sys_positions p ON p.position_id=r.position_id WHERE NOT p.position_is_active)
             + (SELECT count(*) FROM sys.sys_position_learning_requirements r
                 JOIN sys.sys_positions p ON p.position_id=r.position_id WHERE NOT p.position_is_active)
             + (SELECT count(*) FROM sys.sys_position_kpi_requirements r
                 JOIN sys.sys_positions p ON p.position_id=r.position_id WHERE NOT p.position_is_active)
             + (SELECT count(*) FROM sys.sys_position_compensation_profiles r
                 JOIN sys.sys_positions p ON p.position_id=r.position_id WHERE NOT p.position_is_active)""")
    out.append(("requisiti agganciati a posizioni disattivate", orfani_req,
                int(orfani_req) > SOGLIE["requisiti_su_posizioni_spente"]))

    morte = uno("SELECT count(*) FROM pg_stats WHERE schemaname='sys' AND null_frac=1")
    out.append(("colonne dichiarate e mai riempite", morte, False))  # da triage, non blocca

    fk = uno("""SELECT count(*) FROM pg_constraint c
                JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace
                WHERE n.nspname='sys' AND c.contype='f'
                  AND NOT EXISTS (SELECT 1 FROM pg_index i
                                  WHERE i.indrelid=c.conrelid AND i.indkey[0]=c.conkey[1])""")
    out.append(("chiavi esterne senza indice", fk, False))

    nonval = uno("""SELECT count(*) FROM pg_constraint c
                    JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace
                    WHERE n.nspname='sys' AND c.contype='f' AND NOT c.convalidated""")
    out.append(("vincoli FK non validati", nonval, int(nonval) != 0))

    # Solo tabelle con massa reale: una tabella vuota con 50 tuple morte da' 5000%
    # e non e' bloat. La soglia va applicata dove lo spazio conta davvero.
    peggio = q(f"""SELECT relname, round(100.0*n_dead_tup/n_live_tup,1)
                   FROM pg_stat_user_tables WHERE schemaname='sys'
                     AND n_live_tup - {SOGLIE['righe_minime_per_bloat']} = abs(n_live_tup - {SOGLIE['righe_minime_per_bloat']})
                   ORDER BY 100.0*n_dead_tup/n_live_tup DESC LIMIT 1""")
    if peggio:
        tab, pct = peggio[0]
        out.append((f"tuple morte, peggior tabella ({tab})", f"{pct}%",
                    float(pct) - SOGLIE["tuple_morte_pct"] > 0))

    mai = uno("""SELECT count(*) FROM pg_stat_user_tables WHERE schemaname='sys'
                 AND last_analyze IS NULL AND last_autoanalyze IS NULL AND n_live_tup != 0""")
    out.append(("tabelle popolate mai analizzate", mai,
                int(mai) != SOGLIE["tabelle_mai_analizzate"]))

    fresco = q("""SELECT 'presenze', CURRENT_DATE - max(attendance_date) FROM sys.sys_attendance
                  UNION ALL SELECT 'buste paga', CURRENT_DATE - max(user_pay_slip_period_end)
                  FROM sys.sys_user_pay_slips""")
    # Un dato a cadenza mensile porta la sua soglia: vedi la nota su SOGLIE.
    CADENZA_MENSILE = {"buste paga"}
    for nome, giorni in fresco:
        soglia = SOGLIE["giorni_senza_dato_fresco_mensile" if nome in CADENZA_MENSILE
                        else "giorni_senza_dato_fresco"]
        out.append((f"giorni dall'ultimo dato: {nome}", giorni, int(giorni) - soglia > 0))

    cop = q("""SELECT round(100.0*count(DISTINCT a.user_position_assignment_user_id)/
                            GREATEST((SELECT count(*) FROM sys.sys_users),1),1)
               FROM sys.sys_user_position_assignments a""")
    out.append(("copertura utenti con posizione", f"{cop[0][0]}%", False))

    return out


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--sentinelle", action="store_true")
    p.add_argument("--compatto", action="store_true",
                   help="una riga di sintesi + i soli allarmi (per il boot di sessione)")
    p.add_argument("--json")
    a = p.parse_args()

    allarmi = []
    if not a.compatto:
        print("SENTINELLE  (viste v_* dello schema sys)")
    try:
        righe_s = sentinelle()
    except DbNonRaggiungibile as e:
        print(f"  [? ] sentinelle non misurate — database non raggiungibile ({e})")
        return 2
    for vista, n, allarme in righe_s:
        if not a.compatto:
            if vista in INFORMATIVE:
                print(f"  [i ] {vista:44s} {n:6d}   {INFORMATIVE[vista]}")
            else:
                print(f"  [{'!!' if allarme else 'ok'}] {vista:44s} {n:6d}")
        if allarme:
            allarmi.append(f"{vista}: {n} righe")

    righe_p = []
    if not a.sentinelle:
        if not a.compatto:
            print("\nSONDE  (verifiche che nessuna vista copriva)")
        try:
            righe_p = sonde()
        except DbNonRaggiungibile as e:
            print(f"  [? ] sonde non misurate — database non raggiungibile ({e})")
            return 2
        for nome, valore, allarme in righe_p:
            if not a.compatto:
                print(f"  [{'!!' if allarme else 'ok'}] {nome:44s} {valore}")
            if allarme:
                allarmi.append(f"{nome}: {valore}")

    if a.compatto:
        vigilate = sum(1 for _, _, x in righe_s if True) - len(INFORMATIVE)
        pulite = vigilate - sum(1 for v, _, x in righe_s if x)
        stato = "!!" if allarmi else "OK"
        print(f"  [{stato}] sentinelle  {pulite}/{vigilate} a zero"
              + (f" · {len(allarmi)} allarmi" if allarmi else ""))
        for x in allarmi:
            print(f"  [!!] {x}")
    else:
        print()
        if allarmi:
            print(f"ESITO: {len(allarmi)} ALLARMI")
            for x in allarmi:
                print(f"  - {x}")
        else:
            print("ESITO: tutto nei limiti")

    if a.json:
        with open(a.json, "w", encoding="utf-8") as f:
            json.dump({"sentinelle": [{"vista": v, "righe": n, "allarme": x} for v, n, x in righe_s],
                       "sonde": [{"nome": n, "valore": v, "allarme": x} for n, v, x in righe_p],
                       "allarmi": allarmi}, f, indent=2, ensure_ascii=False)
    return 1 if allarmi else 0


if __name__ == "__main__":
    sys.exit(main())
