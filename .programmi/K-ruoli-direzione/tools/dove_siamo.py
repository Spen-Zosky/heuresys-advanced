#!/usr/bin/env python3
"""dove_siamo.py — la procedura di ripresa R2 del mandato K (sezione 3.3).

Stampa, in quest'ordine:
  (1) le righe di esiti/RISPOSTE_ENZO.md non ancora applicate (la voce e' ancora ATTESA_ENZO);
  (2) le righe IN CORSO / SOSPESA / ATTESA_ENZO con presa_da, presa_il ed eta' in ore;
  (3) la prima riga PRONTA nell'ordine del file (= ordine di fase);
  (4) per ogni voce con migrazione_prenotata: il file esiste? e' completo (`-- FINE NNN`)?
      e' nel registro sys.sys_schema_migrations? l'EFFETTO e' presente nel database
      secondo il dizionario EFFETTI (consapevole del ritiro)?
  (5) le cartelle evidenze/wf_* senza _VERIFICATO.txt (workflow orfani: si ignorano);
  (6) il guardiano.

Codici d'uscita: 0 = niente di rosso · 1 = ROSSO (file incompleto, effetto NON DICHIARATO,
riga malformata) · 4 = database non raggiungibile (NON MISURATO: non e' «va bene»).
Non scrive nulla. Non decide nulla: la regola di scelta R3 la applica chi legge.
"""
from __future__ import annotations

import glob
import os
import re
import subprocess
import sys
from datetime import datetime, timezone

QUI = os.path.dirname(os.path.abspath(__file__))
RADICE_K = os.path.dirname(QUI)                         # .programmi/K-ruoli-direzione
REPO = os.path.dirname(os.path.dirname(RADICE_K))        # D:\heuresys-advanced
STATO = os.path.join(RADICE_K, "STATO.md")
RISPOSTE = os.path.join(RADICE_K, "esiti", "RISPOSTE_ENZO.md")
EVIDENZE = os.path.join(RADICE_K, "evidenze")
MIGRAZIONI = os.path.join(REPO, "db", "migrations")
DSN = "host=localhost port=5433 user=heuresys dbname=heuresys_advanced"

# Il dizionario degli EFFETTI: per voce, la query di post-condizione CONSAPEVOLE DEL RITIRO
# (dopo una migrazione di rollback l'oggetto puo' esistere ancora, ritirato: la query deve
# dire ASSENTE). Chiave `voce` vale per tutte le migrazioni della voce; `voce/000NNN` la
# scavalca per quella sola migrazione. Una voce con migrazione prenotata e senza query
# stampa NON DICHIARATA, ed e' un rosso. Si riempie voce per voce, coi nomi REALI delle
# colonne (misurato 2026-09-14: sys_auth_roles.auth_role_code, nessun retired_at finche'
# R-1 passo 0 non lo aggiunge).
EFFETTI: dict[str, str] = {
    # F0.4 / 3.5 — la vista di prova; dopo il rollback (rinomina in _ritirata) e' ASSENTE.
    "K-PROVA": "select 1 from pg_views where schemaname='sys' and viewname='v_prova_ripresa_k'",
    # F2
    "S-1": "select 1 from pg_views where schemaname='sys' and viewname='v_permessi_solo_plenipotenziari'",
    "S-3": "select 1 from pg_views where schemaname='sys' and viewname='v_registro_provenienza_orfano'",
    # F4
    "R-1": "select 1 from information_schema.columns where table_schema='sys' and table_name='sys_auth_role_permissions' and column_name='revoked_at'",
    "R-0": "select 1 from information_schema.tables where table_schema='sys' and table_name='sys_platform_user_tenant_assignments'",
    "R-9": "select 1 from sys.sys_auth_roles where auth_role_code in ('PLATFORM_OPERATOR','SALES') and retired_at is null having count(*) = 2",
    "R-2": "select 1 from sys.sys_auth_roles where auth_role_code='DPO' and retired_at is null",
    "R-7": "select 1 from sys.sys_auth_roles where auth_role_code='SECURITY_ADMIN' and retired_at is null",
    "R-3": "select 1 from sys.sys_auth_roles where auth_role_code='TAXONOMY_STEWARD' and retired_at is null",
    "R-10": "select 1 from sys.sys_auth_permissions where auth_permission_code='requisition:manage'",
    "R-4": "select 1 from sys.sys_auth_roles where auth_role_code='RECRUITER' and retired_at is null",
    # F5
    "X-1": "select 1 from sys.sys_classificazione_direzione_dato where tabella='sys_classificazione_direzione_dato'",
    # X-2 — una query per tabella (colonna origine_dato aggiunta dalla mig. omonima).
    "X-2/000433": "select 1 from information_schema.columns where table_schema='sys' and table_name='sys_user_contracts' and column_name='origine_dato'",
    "X-2/000434": "select 1 from information_schema.columns where table_schema='sys' and table_name='sys_user_pay_slips' and column_name='origine_dato'",
    "X-2/000435": "select 1 from information_schema.columns where table_schema='sys' and table_name='sys_user_identity_documents' and column_name='origine_dato'",
    "X-2/000436": "select 1 from information_schema.columns where table_schema='sys' and table_name='sys_position_compensation_profiles' and column_name='origine_dato'",
    "X-2/000437": "select 1 from information_schema.columns where table_schema='sys' and table_name='sys_time_off_requests' and column_name='origine_dato'",
    "X-2/000438": "select 1 from information_schema.columns where table_schema='sys' and table_name='sys_time_off_balances' and column_name='origine_dato'",
    "X-2/000439": "select 1 from information_schema.columns where table_schema='sys' and table_name='sys_leave_balance_transactions' and column_name='origine_dato'",
    "X-2/000440": "select 1 from information_schema.columns where table_schema='sys' and table_name='sys_compensation_recommendations' and column_name='origine_dato'",
    "X-2/000441": "select 1 from information_schema.columns where table_schema='sys' and table_name='sys_payroll_handoff_records' and column_name='origine_dato'",
    "X-2/000442": "select 1 from information_schema.columns where table_schema='sys' and table_name='sys_leave_accrual_rules' and column_name='origine_dato'",
    "X-2/000443": "select 1 from information_schema.columns where table_schema='sys' and table_name='sys_compensation_bands' and column_name='origine_dato'",
    "X-2/000444": "select 1 from information_schema.columns where table_schema='sys' and table_name='sys_overtime' and column_name='origine_dato'",
    "R-5": "select 1 from sys.sys_auth_role_permissions rp join sys.sys_auth_roles r on r.auth_role_id=rp.auth_role_id join sys.sys_auth_permissions p on p.auth_permission_id=rp.auth_permission_id where r.auth_role_code='BLUEPRINT_MANAGER' and p.auth_permission_code='tenant_blueprint:write' and rp.revoked_at is null",
    "X-3": "select 1 from pg_views where schemaname='sys' and viewname='v_source_lineage_normalizzata'",
    "X-4": "select 1 from information_schema.tables where table_schema='sys' and table_name='sys_conflitti_ibridi'",
    "X-5": "select 1 from pg_views where schemaname='sys' and viewname='v_direzione_del_dato_violata'",
    # F4 — R-8 CHIUSA (S1109); query dichiarata nel commento di 000431 stesso.
    "R-8": "select 1 from sys.sys_auth_role_permissions rp join sys.sys_auth_roles r on r.auth_role_id=rp.auth_role_id join sys.sys_auth_permissions p on p.auth_permission_id=rp.auth_permission_id where r.auth_role_code='IMPLEMENTATION_CONSULTANT' and p.auth_permission_code='seed_acquisition:trigger' and rp.revoked_at is null",
    # F4 — R-6 SOSPESA (S1109); query dichiarata nel commento di 000432 stesso.
    "R-6": "select 1 from sys.sys_auth_roles where auth_role_code='PEOPLE_MANAGER' and retired_at is null",
}

STATI_APERTI = ("IN CORSO", "SOSPESA", "ATTESA_ENZO")


def leggi_stato() -> list[dict]:
    righe = []
    with open(STATO, encoding="utf-8") as fh:
        for n, riga in enumerate(fh, 1):
            if not riga.startswith("|"):
                continue
            celle = [c.strip() for c in riga.strip().strip("|").split("|")]
            if not celle or celle[0] in ("K-codice", "") or set(celle[0]) <= {"-", ":"}:
                continue
            if len(celle) != 9:
                righe.append({"voce": celle[0], "stato": "RIGA MALFORMATA", "riga_file": n,
                              "celle": len(celle)})
                continue
            v, st, da, il, ult, pros, mig, evi, nota = celle
            righe.append({"voce": v, "stato": st, "presa_da": da, "presa_il": il,
                          "ultimo_passo_chiuso": ult, "prossimo_passo": pros,
                          "migrazione_prenotata": mig, "evidenza": evi, "nota": nota,
                          "riga_file": n})
    return righe


def leggi_risposte() -> list[tuple[str, str, str]]:
    if not os.path.isfile(RISPOSTE):
        return []
    out = []
    rx = re.compile(r"^\s*([A-Za-z0-9][A-Za-z0-9.\-]*)\s*\|\s*([^|]+?)\s*\|\s*(.+?)\s*$")
    with open(RISPOSTE, encoding="utf-8") as fh:
        for riga in fh:
            if riga.lstrip().startswith(("#", "`", "<")):
                continue
            m = rx.match(riga)
            if m and m.group(1).lower() != "voce":
                out.append((m.group(1), m.group(2), m.group(3)))
    return out


def eta_ore(presa_il: str) -> str:
    try:
        t = datetime.fromisoformat(presa_il)
        if t.tzinfo is None:
            t = t.astimezone()
        d = datetime.now(timezone.utc) - t.astimezone(timezone.utc)
        return f"{d.total_seconds() / 3600:.1f} h fa"
    except ValueError:
        return "eta' NON MISURABILE (presa_il non ISO)"


def connetti():
    try:
        import psycopg2  # noqa: WPS433
    except ImportError:
        return None, "psycopg2 non installato"
    try:
        con = psycopg2.connect(DSN, connect_timeout=8)
        con.set_session(readonly=True, autocommit=True)
        return con, ""
    except Exception as e:  # noqa: BLE001
        return None, str(e).strip().splitlines()[0] if str(e).strip() else repr(e)


def file_migrazione(nnn: str) -> str | None:
    c = glob.glob(os.path.join(MIGRAZIONI, f"{nnn}_*.sql"))
    return c[0] if c else None


def completa(path: str, nnn: str) -> bool:
    with open(path, encoding="utf-8", errors="replace") as fh:
        righe = [r.rstrip("\r\n") for r in fh]
    while righe and not righe[-1].strip():
        righe.pop()
    return bool(righe) and righe[-1].strip() == f"-- FINE {nnn}"


def main() -> int:
    # Scoperto da Cowork (S1105, 2026-09-17): lanciato da PowerShell/console Windows (cp1252),
    # una nota con un carattere fuori da cp1252 (es. una freccia "→") fa uscire con
    # UnicodeEncodeError a meta' stampa — chi legge crede che l'elenco sia completo, e non lo
    # e'. Da Git Bash (UTF-8) il difetto non si manifesta, per questo era invisibile alla CLI.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    rosso = False
    righe = leggi_stato()
    per_voce = {r["voce"]: r for r in righe}
    print("=" * 76)
    print(f" DOVE SIAMO — mandato K · {datetime.now().astimezone().isoformat(timespec='minutes')}")
    print(f" STATO.md: {len(righe)} voci")
    print("=" * 76)

    malformate = [r for r in righe if r["stato"] == "RIGA MALFORMATA"]
    for r in malformate:
        print(f" ROSSO riga {r['riga_file']}: voce {r['voce']} ha {r['celle']} celle invece di 9")
        rosso = True

    # (1) risposte di Enzo non ancora applicate
    print("\n(1) RISPOSTE DI ENZO non ancora applicate")
    risp = leggi_risposte()
    pend = [(v, d, t) for v, d, t in risp
            if v not in per_voce or per_voce[v]["stato"].startswith("ATTESA_ENZO")]
    if not risp:
        print("    nessuna risposta nel file")
    elif not pend:
        print(f"    {len(risp)} risposte, tutte applicate")
    for v, d, t in pend:
        dove = "voce NON in STATO.md" if v not in per_voce else "da applicare"
        print(f"    {v} | {d} | {t}   <- {dove}")

    # (2) voci aperte
    print("\n(2) VOCI APERTE (IN CORSO / SOSPESA / ATTESA_ENZO)")
    aperte = [r for r in righe if r["stato"].startswith(STATI_APERTI)]
    if not aperte:
        print("    nessuna")
    for r in aperte:
        print(f"    {r['voce']:<16} {r['stato']:<28} presa_da={r['presa_da'] or '-'} "
              f"presa_il={r['presa_il'] or '-'} ({eta_ore(r['presa_il']) if r['presa_il'] else 'mai presa'}) "
              f"ultimo_passo={r['ultimo_passo_chiuso'] or '-'} prossimo={r['prossimo_passo'] or '-'}")
        if r["nota"]:
            print(f"    {'':<16} nota: {r['nota']}")

    # (3) prima PRONTA
    print("\n(3) PRIMA VOCE PRONTA (ordine del file = ordine di fase)")
    pronte = [r for r in righe if r["stato"] == "PRONTA"]
    if pronte:
        p = pronte[0]
        print(f"    {p['voce']} — prossimo passo {p['prossimo_passo'] or '?'} — {p['nota']}")
        if len(pronte) > 1:
            print(f"    (altre PRONTE dopo: {', '.join(r['voce'] for r in pronte[1:])})")
    else:
        print("    nessuna PRONTA")
        solo_attese = [r for r in righe if r["stato"].startswith(("ATTESA_ENZO", "BLOCCATA(D"))]
        if solo_attese and not aperte:
            print("    -> caso R3(e): niente da fare, in attesa di Enzo su "
                  + ", ".join(r["voce"] for r in solo_attese))

    # (3-bis) BLOCCATA(fase): il silenzio di (2)/(3) su queste voci si legge come
    # "campo libero" e non lo e' — segnalato da Cowork il 2026-09-19, COWORK_INBOX.md.
    bloccate_fase = [r for r in righe if r["stato"] == "BLOCCATA(fase)"]
    print("\n(3-bis) VOCI BLOCCATA(fase) — non PRONTE, ma NON e' campo libero")
    if not bloccate_fase:
        print("    nessuna")
    else:
        print(f"    {len(bloccate_fase)} voci, ordine del file: "
              + ", ".join(r["voce"] for r in bloccate_fase))
        primo = bloccate_fase[0]
        print(f"    prima in ordine: {primo['voce']} — prossimo passo {primo['prossimo_passo'] or '?'} — {primo['nota']}")

    # (4) migrazioni prenotate
    print("\n(4) MIGRAZIONI PRENOTATE — file / completezza / registro / effetto")
    con, err = connetti()
    db_ok = con is not None
    if not db_ok:
        print(f"    database NON RAGGIUNGIBILE ({err}): registro ed effetto NON MISURATI")
    prenotate = [r for r in righe if r.get("migrazione_prenotata")]
    if not prenotate:
        print("    nessuna voce ha una migrazione prenotata")
    for r in prenotate:
        numeri = [n for n in re.split(r"[\s,;/]+", r["migrazione_prenotata"]) if re.fullmatch(r"\d{6}", n)]
        # Un file `_rollback_di_` RITIRA l'effetto della voce: per lui «effetto ASSENTE» e' l'esito
        # voluto, non un invito a riapplicare. Misurato in F0.4 (S1103): senza questa distinzione la
        # 000416 veniva letta come «caso (i): si (ri)applica».
        rollback_completi = [n for n in numeri
                             if (fp := file_migrazione(n)) and "_rollback_di_" in os.path.basename(fp) and completa(fp, n)]
        for nnn in re.split(r"[\s,;/]+", r["migrazione_prenotata"]):
            if not re.fullmatch(r"\d{6}", nnn):
                print(f"    {r['voce']}: prenotazione malformata «{nnn}» (atteso 000NNN)  ROSSO")
                rosso = True
                continue
            path = file_migrazione(nnn)
            if path is None:
                print(f"    {r['voce']} {nnn}: FILE ASSENTE -> caso (iii): il numero e' prenotato, il file si scrive")
                continue
            nome = os.path.basename(path)
            if not completa(path, nnn):
                print(f"    {r['voce']} {nnn}: {nome}  FILE INCOMPLETO (manca `-- FINE {nnn}`) -> caso (iv): si riscrive per intero  ROSSO")
                rosso = True
                continue
            registro = "NON MISURATO"
            effetto = "NON MISURATO"
            q = EFFETTI.get(f"{r['voce']}/{nnn}") or EFFETTI.get(r["voce"])
            if q is None:
                effetto = "NON DICHIARATA (manca la query in EFFETTI)  ROSSO"
                rosso = True
            if db_ok:
                cur = con.cursor()
                try:
                    cur.execute("select applied_at from sys.sys_schema_migrations where file_name=%s", (nome,))
                    riga = cur.fetchone()
                    registro = f"registrata {riga[0].isoformat(timespec='minutes')}" if riga else "NON registrata"
                except Exception as e:  # noqa: BLE001
                    registro = f"registro NON MISURABILE ({str(e).strip().splitlines()[0]})"
                    con.rollback()
                if q is not None:
                    try:
                        cur.execute(q)
                        effetto = "effetto PRESENTE" if cur.fetchone() else "effetto ASSENTE"
                    except Exception as e:  # noqa: BLE001
                        effetto = f"query dell'effetto FALLITA ({str(e).strip().splitlines()[0]})  ROSSO"
                        rosso = True
                        con.rollback()
            caso = ""
            e_rollback = "_rollback_di_" in nome
            if e_rollback and effetto == "effetto ASSENTE":
                caso = " -> ROLLBACK APPLICATO: l'effetto e' ritirato, NON si riapplica"
            elif e_rollback and effetto == "effetto PRESENTE":
                caso = " -> rollback NON applicato: l'effetto c'e' ancora, si applica il rollback"
            elif effetto == "effetto PRESENTE":
                caso = " -> caso (ii): applicata, passa alla post-condizione"
            elif effetto == "effetto ASSENTE" and rollback_completi:
                caso = f" -> RITIRATA da {', '.join(rollback_completi)} (rollback): NON si riapplica"
            elif effetto == "effetto ASSENTE":
                caso = " -> caso (i): file completo, effetto assente: si (ri)applica"
            print(f"    {r['voce']} {nnn}: {nome}  completo · {registro} · {effetto}{caso}")
            if q is not None:
                print(f"    {'':<10} query: {q}")
    if con is not None:
        con.close()

    # (5) workflow orfani
    print("\n(5) WORKFLOW ORFANI (evidenze/wf_* senza _VERIFICATO.txt) — si ignorano, non si cancellano")
    orfani = []
    if os.path.isdir(EVIDENZE):
        for d in sorted(os.listdir(EVIDENZE)):
            p = os.path.join(EVIDENZE, d)
            if d.startswith("wf_") and os.path.isdir(p) and not os.path.isfile(os.path.join(p, "_VERIFICATO.txt")):
                orfani.append(d)
    if not orfani:
        print("    nessuno")
    for d in orfani:
        print(f"    {d}")

    # (6) guardiano
    print("\n(6) GUARDIANO")
    sys.stdout.flush()
    g = os.path.expanduser("~/.claude/tools/guardiano.py")
    if os.path.isfile(g):
        try:
            out = subprocess.run([sys.executable, g], capture_output=True, timeout=60)
            sys.stdout.buffer.write(out.stdout)
            sys.stdout.flush()
        except (OSError, subprocess.SubprocessError) as e:
            print(f"    guardiano NON MISURABILE: {e}")
    else:
        print("    guardiano.py non trovato: NON MISURABILE")

    print("\n" + "=" * 76)
    if rosso:
        print(" ESITO: ROSSO — vedi le righe marcate. Nessuna voce vera parte su un rosso.")
        return 1
    if not db_ok:
        print(" ESITO: NON MISURATO — il database non ha risposto; registro ed effetti non sono stati guardati.")
        return 4
    if not pronte and bloccate_fase:
        print(f" ESITO: nessuna voce pronta — {len(bloccate_fase)} BLOCCATA(fase), "
              "la promozione a PRONTA e' manuale: il silenzio non vuol dire niente da fare.")
        return 0
    print(" ESITO: nessun rosso.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
