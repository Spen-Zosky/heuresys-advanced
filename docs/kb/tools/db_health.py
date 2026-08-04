#!/usr/bin/env python3
"""
db_health.py — cruscotto di salute del DBMS, con esito binario.

Perche' esiste
--------------
Lo schema `sys` contiene gia' 14 viste sentinella `v_*` che segnalano anomalie
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
}

# Soglie: superate = allarme. Derivano dalla misura del 2026-08-03, non da teoria.
SOGLIE = {
    "duplicati_chiave_naturale": 0,
    "tuple_morte_pct": 20.0,
    "righe_minime_per_bloat": 1000,
    "tabelle_mai_analizzate": 0,
    "giorni_senza_dato_fresco": 7,
    # Misurato dopo il ri-aggancio dei cataloghi (mig 000260, S1043): 214 requisiti
    # restano su posizioni disattivate, e sono spiegati — appartengono alle 20 posizioni
    # gia' vacanti PRIMA della ricostruzione (nessuno le occupava, quindi non hanno una
    # posizione successore) piu' i casi in cui la posizione nuova dichiarava gia' lo
    # stesso requisito. La soglia e' il valore reale e non una cifra tonda piu' larga:
    # se cresce, qualcuno ha disattivato posizioni lasciandosi dietro il loro catalogo.
    "requisiti_su_posizioni_spente": 214,
}


class DbNonRaggiungibile(RuntimeError):
    """psql ha fallito. E' un'eccezione e non un sys.exit perche' questo modulo
    viene invocato in-process dal boot di sessione, che e' una vista e non deve
    morire quando il tunnel e' giu'."""


def q(sql: str) -> list[list[str]]:
    e = subprocess.run(PSQL + ["-c", sql], capture_output=True, text=True)
    if e.returncode != 0:
        raise DbNonRaggiungibile(e.stderr.strip() or "psql ha fallito senza messaggio")
    return [r.split("\t") for r in e.stdout.strip().splitlines() if r]


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
    # per regola col numero di violazioni aperte. Sei regole sono strutturali e devono
    # stare a zero; la settima — «persone attive senza posizione» — e' una misura, e vale
    # 1 perche' admin@heuresys.com e' un'utenza di servizio, non una persona
    # dell'organigramma. Qui si sorveglia il gruppo strutturale: se una sola di quelle
    # sei si accende, l'organigramma ha ricominciato a derivare.
    if uno("""SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
              WHERE n.nspname='sys' AND p.proname='fn_organization_integrity_violations'""") != "0":
        strutt = q("""SELECT coalesce(sum(violazioni),0)
                        FROM sys.fn_organization_integrity_violations()
                       WHERE regola <> 'persone attive senza posizione'""")
        n_strutt = strutt[0][0] if strutt and strutt[0] else "0"
        out.append(("violazioni strutturali dell'organigramma", n_strutt, int(n_strutt) != 0))
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
    for nome, giorni in fresco:
        out.append((f"giorni dall'ultimo dato: {nome}", giorni,
                    int(giorni) - SOGLIE["giorni_senza_dato_fresco"] > 0))

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
