#!/usr/bin/env python3
"""misura_k.py — TUTTE le misure di partenza del mandato K, in un file di evidenza.

Scrive `evidenze/baseline_<yyyymmddHHMM>.txt`: ogni numero ha accanto il comando (query o
ricerca) che lo ha prodotto. I numeri del dossier del 2026-09-14 (14 ruoli, 231 permessi,
102 solo-plenipotenziari, 160 permessi di HRMS_MANAGER, 80 alias, 64.577/6.382 righe di
registro, 705/468/59 riscontri per nome) NON sono copiati qui: si rimisurano.

Guardia: se una misura non e' calcolabile (tabella inesistente, colonna assente, database
muto) lo script esce 2 e lo dice, senza scrivere un baseline a meta'. Controprova (F0.3):
rinominare in TABELLE_AMMINISTRATIVE una tabella in un nome inesistente -> exit 2.

Uso: python .programmi/K-ruoli-direzione/tools/misura_k.py [--stampa]
"""
from __future__ import annotations

import glob
import os
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime

QUI = os.path.dirname(os.path.abspath(__file__))
RADICE_K = os.path.dirname(QUI)
REPO = os.path.dirname(os.path.dirname(RADICE_K))
EVIDENZE = os.path.join(RADICE_K, "evidenze")
DSN = "host=localhost port=5433 user=heuresys dbname=heuresys_advanced"
PLENI = ("PLATFORM_ADMIN", "HRMS_MANAGER", "TENANT_ADMIN")

# Le 12 tabelle amministrative del dossier (Parte K3, script ruoli-k5.py) + sys_overtime,
# che K3.3 e il passo 17 del mandato contano fra le quattro ibride: 13 righe, dichiarate.
TABELLE_AMMINISTRATIVE = [
    "sys_user_contracts", "sys_attendance", "sys_user_pay_slips",
    "sys_time_off_requests", "sys_time_off_balances", "sys_leave_accrual_rules",
    "sys_leave_balance_transactions", "sys_user_identity_documents",
    "sys_compensation_bands", "sys_position_compensation_profiles",
    "sys_compensation_recommendations", "sys_payroll_handoff_records",
    "sys_overtime",
]
HELPER = r"\bis(PlatformAdmin|TenantAdmin|HrmsManager|Manager|TeamLeader|Platform|Ceo|OrgDirector|BranchManager|ProcessOwner|BlueprintManager|ReadOnly)\("


class NonMisurabile(Exception):
    pass


class Baseline:
    def __init__(self) -> None:
        self.righe: list[str] = []
        self.n = 0

    def misura(self, titolo: str, comando: str, valore, dettaglio: list[str] | None = None) -> None:
        self.n += 1
        self.righe.append(f"\n[M{self.n:02d}] {titolo}")
        self.righe.append(f"      valore : {valore}")
        self.righe.append(f"      comando: {comando}")
        for d in dettaglio or []:
            self.righe.append(f"        {d}")

    def testo(self) -> str:
        return "\n".join(self.righe) + "\n"


def q(cur, sql: str, params=None):
    try:
        cur.execute(sql, params)
        return cur.fetchall()
    except Exception as e:  # noqa: BLE001
        raise NonMisurabile(f"{str(e).strip().splitlines()[0]} — query: {' '.join(sql.split())[:160]}") from e


def uno(cur, sql: str, params=None):
    return q(cur, sql, params)[0][0]


def esiste_tabella(cur, nome: str) -> bool:
    return uno(cur, "select count(*) from information_schema.tables where table_schema='sys' and table_name=%s", (nome,)) == 1


def scorri(radice: str):
    for dp, _, fs in os.walk(radice):
        if "node_modules" in dp or "__tests__" in dp or dp.endswith(("test", "tests")):
            continue
        for f in fs:
            if f.endswith((".ts", ".tsx")) and not f.endswith((".test.ts", ".spec.ts", ".test.tsx")):
                yield os.path.join(dp, f)


def misure_codice(b: Baseline, ruoli: list[str]) -> None:
    rx_ruolo = re.compile(r"['\"](" + "|".join(re.escape(r) for r in ruoli) + r")['\"]")
    rx_helper = re.compile(HELPER)
    rx_helper_nudo = re.compile(HELPER[:-2] + r"\b")   # senza la parentesi: include import/type/export (definizione del dossier k4)
    rx_perm = re.compile(r"requirePermission|hasPermission|permission:\s*['\"]")
    for nome, rel in (("apps/api/src", os.path.join("apps", "api", "src")), ("apps/web/src", os.path.join("apps", "web", "src"))):
        radice = os.path.join(REPO, rel)
        if not os.path.isdir(radice):
            raise NonMisurabile(f"cartella assente: {rel}")
        tot = Counter()
        per_file: dict[str, list[int]] = {}
        for p in scorri(radice):
            try:
                testo = open(p, encoding="utf-8", errors="replace").read()
            except OSError:
                continue
            codice = re.sub(r"/\*.*?\*/", "", testo, flags=re.S)
            codice = re.sub(r"^\s*//.*$", "", codice, flags=re.M)
            a, h, c = len(rx_ruolo.findall(codice)), len(rx_helper.findall(codice)), len(rx_perm.findall(codice))
            hn = len(rx_helper_nudo.findall(codice))
            if a or h or c or hn:
                per_file[os.path.relpath(p, radice).replace(os.sep, "/")] = [a, h, c]
                tot["nome_ruolo"] += a
                tot["helper"] += h
                tot["helper_nudo"] += hn
                tot["permesso"] += c
        top = sorted(per_file.items(), key=lambda x: -(x[1][0] + x[1][1]))[:15]
        b.misura(
            f"{nome}: riscontri per NOME DI RUOLO (stringa) / FUNZIONE-SCORCIATOIA isXxx( / PERMESSO — commenti esclusi, test esclusi",
            f"python: os.walk({rel}) su .ts/.tsx non-test; regex ruoli={rx_ruolo.pattern[:60]}…; helper={HELPER}; perm=requirePermission|hasPermission|permission:",
            f"nome_ruolo={tot['nome_ruolo']} helper_chiamate={tot['helper']} helper_nudo_isXxx={tot['helper_nudo']} permesso={tot['permesso']} file_con_riscontri={len(per_file)}",
            [f"{f}: ruolo={v[0]} helper={v[1]} perm={v[2]}" for f, v in top] + ["(primi 15 file per ruolo+helper)"],
        )


def main() -> int:
    stampa = "--stampa" in sys.argv
    ts = datetime.now().strftime("%Y%m%d%H%M")
    try:
        import psycopg2
    except ImportError:
        print("psycopg2 non installato: NON MISURABILE", file=sys.stderr)
        return 2
    try:
        con = psycopg2.connect(DSN, connect_timeout=8)
    except Exception as e:  # noqa: BLE001
        print(f"database non raggiungibile: NON MISURABILE ({str(e).strip().splitlines()[0]})", file=sys.stderr)
        return 2
    con.set_session(readonly=True, autocommit=True)
    cur = con.cursor()
    b = Baseline()
    b.righe.append(f"BASELINE MANDATO K — misurato {datetime.now().astimezone().isoformat(timespec='minutes')} su {DSN}")
    b.righe.append("Ogni numero porta il comando che l'ha prodotto. Nessun numero e' copiato dal dossier.")

    try:
        # ── ruoli, persone per ruolo
        righe = q(cur, """
            select r.auth_role_code, coalesce(r.auth_role_category,'(nulla)'), r.auth_role_is_platform,
                   (select count(distinct ur.user_auth_role_user_id) from sys.sys_user_auth_roles ur
                     where ur.user_auth_role_role_id = r.auth_role_id and ur.user_auth_role_revoked_at is null),
                   (select count(*) from sys.sys_auth_role_permissions rp where rp.auth_role_id = r.auth_role_id)
              from sys.sys_auth_roles r order by 1""")
        ruoli = [r[0] for r in righe]
        b.misura("ruoli nel catalogo RBAC, con categoria, piattaforma, persone (assegnazioni non revocate) e permessi",
                 "select auth_role_code, auth_role_category, auth_role_is_platform, count persone non revocate, count permessi from sys.sys_auth_roles",
                 len(righe), [f"{r[0]:<26} cat={r[1]:<24} piattaforma={r[2]!s:<5} persone={r[3]:<4} permessi={r[4]}" for r in righe])

        # ── permessi
        n_perm = uno(cur, "select count(*) from sys.sys_auth_permissions")
        b.misura("permessi nel catalogo", "select count(*) from sys.sys_auth_permissions", n_perm)

        perm_ruoli = {c: list(rs) for c, rs in q(cur, """
            select p.auth_permission_code,
                   coalesce(array_agg(r.auth_role_code order by r.auth_role_code) filter (where r.auth_role_code is not null), '{}')
              from sys.sys_auth_permissions p
              left join sys.sys_auth_role_permissions rp on rp.auth_permission_id = p.auth_permission_id
              left join sys.sys_auth_roles r on r.auth_role_id = rp.auth_role_id
             group by 1 order by 1""")}
        senza = sorted(p for p, rs in perm_ruoli.items() if not rs)
        b.misura("permessi senza alcun ruolo", "left join sys_auth_permissions -> sys_auth_role_permissions -> sys_auth_roles, group by permesso, array vuoto",
                 len(senza), senza)
        solo_pleni = sorted(p for p, rs in perm_ruoli.items() if rs and set(rs) <= set(PLENI))
        b.misura(f"permessi il cui insieme di titolari e' NON vuoto e CONTENUTO in {PLENI} (misura di partenza di S-1)",
                 "stesso join; set(ruoli) <= {PLATFORM_ADMIN, HRMS_MANAGER, TENANT_ADMIN}",
                 len(solo_pleni), [f"{p:<44} {','.join(perm_ruoli[p])}" for p in solo_pleni])

        # ── HRMS_MANAGER
        n_hrms = uno(cur, """select count(*) from sys.sys_auth_role_permissions rp
                              join sys.sys_auth_roles r on r.auth_role_id = rp.auth_role_id
                             where r.auth_role_code = 'HRMS_MANAGER'""")
        ha_revoked = uno(cur, "select count(*) from information_schema.columns where table_schema='sys' and table_name='sys_auth_role_permissions' and column_name='revoked_at'")
        b.misura("permessi di HRMS_MANAGER (il numero che la guardia G-D2 difende; «attivi» = tutte le righe finche' revoked_at non esiste)",
                 "select count(*) from sys.sys_auth_role_permissions rp join sys.sys_auth_roles r using(auth_role_id) where r.auth_role_code='HRMS_MANAGER'",
                 n_hrms, [f"colonna revoked_at presente su sys_auth_role_permissions: {'si' if ha_revoked else 'NO (la aggiunge R-1 passo 0)'}"])
        ha_retired = uno(cur, "select count(*) from information_schema.columns where table_schema='sys' and table_name='sys_auth_roles' and column_name='retired_at'")
        b.misura("colonna retired_at su sys_auth_roles", "information_schema.columns", "si" if ha_retired else "NO (la aggiunge R-1 passo 0)")

        # ── alias delle competenze
        if not esiste_tabella(cur, "sys_skill_aliases"):
            raise NonMisurabile("sys_skill_aliases non esiste")
        n_alias = uno(cur, "select count(*) from sys.sys_skill_aliases")
        rip = q(cur, """select case when s.skill_is_global then 'madre GLOBALE' else 'madre di CLIENTE' end,
                              count(*), count(distinct s.skill_tenant_id)
                         from sys.sys_skill_aliases a join sys.sys_skills s on s.skill_id = a.skill_alias_skill_id
                        group by 1 order by 1""")
        orf_alias = uno(cur, "select count(*) from sys.sys_skill_aliases a left join sys.sys_skills s on s.skill_id = a.skill_alias_skill_id where s.skill_id is null")
        b.misura("righe di sys_skill_aliases, e quante hanno competenza madre globale vs di cliente",
                 "select count(*) from sys.sys_skill_aliases; join sys_skills su skill_alias_skill_id group by skill_is_global",
                 n_alias, [f"{r[0]}: {r[1]} alias su {r[2]} tenant distinti" for r in rip] + [f"alias senza competenza madre: {orf_alias}"])

        # ── registro di provenienza: le due convenzioni
        if not esiste_tabella(cur, "sys_source_lineage_records"):
            raise NonMisurabile("sys_source_lineage_records non esiste")
        conv = q(cur, """select (source_lineage_target_table_name like 'sys.%%'), source_lineage_source_system,
                                count(distinct source_lineage_target_table_name), count(*)
                           from sys.sys_source_lineage_records group by 1,2 order by 1,2""")
        tot_reg = uno(cur, "select count(*) from sys.sys_source_lineage_records")
        b.misura("righe di sys_source_lineage_records per convenzione del nome (con/senza prefisso sys.) e sistema di origine",
                 "select (target_table_name like 'sys.%'), source_system, count(distinct target), count(*) group by 1,2",
                 tot_reg, [f"prefisso={'si' if r[0] else 'no':<3} sistema={r[1]:<22} tabelle={r[2]:<4} righe={r[3]}" for r in conv])
        doppie = q(cur, """select replace(source_lineage_target_table_name,'sys.','') from sys.sys_source_lineage_records
                            group by 1 having count(distinct source_lineage_target_table_name) > 1""")
        b.misura("tabelle scritte nel registro in ENTRAMBE le convenzioni",
                 "group by replace(target,'sys.','') having count(distinct target) > 1", len(doppie), [r[0] for r in doppie])

        # ── orfani del registro per tabella (registro > tabella)
        per_tab = q(cur, """select replace(source_lineage_target_table_name,'sys.','') as t, count(*)
                              from sys.sys_source_lineage_records group by 1 order by 1""")
        dett, orfani = [], 0
        for t, n_reg in per_tab:
            if not re.fullmatch(r"[a-z0-9_]+", t):
                dett.append(f"{t:<40} registro={n_reg:<7} NOME NON INTERROGABILE")
                continue
            if not esiste_tabella(cur, t):
                dett.append(f"{t:<40} registro={n_reg:<7} TABELLA INESISTENTE (tutte orfane)")
                orfani += 1
                continue
            n_tab = uno(cur, f"select count(*) from sys.{t}")
            segno = "  <-- registro > tabella" if n_reg > n_tab else ""
            if n_reg > n_tab:
                orfani += 1
            dett.append(f"{t:<40} registro={n_reg:<7} tabella={n_tab:<7}{segno}")
        b.misura("orfani del registro per tabella (nome normalizzato): tabelle in cui il registro supera le righe reali",
                 "per ogni replace(target,'sys.',''): count(*) nel registro vs select count(*) from sys.<t>",
                 orfani, dett)

        # ── le tabelle amministrative
        dett = []
        for t in TABELLE_AMMINISTRATIVE:
            if not esiste_tabella(cur, t):
                raise NonMisurabile(f"tabella amministrativa inesistente: sys.{t}")
            n_tab = uno(cur, f"select count(*) from sys.{t}")
            lin, orig = q(cur, """select count(*), coalesce(string_agg(distinct source_lineage_source_system, ','), '(nessuna)')
                                    from sys.sys_source_lineage_records
                                   where replace(source_lineage_target_table_name,'sys.','') = %s""", (t,))[0]
            cols = [c[0] for c in q(cur, """select column_name from information_schema.columns where table_schema='sys' and table_name=%s
                                           and column_name ~ 'source|origin|import|external|native' order by 1""", (t,))]
            dett.append(f"{t:<36} righe={n_tab:<8} con_provenienza={lin:<7} origine={orig:<22} colonne_di_origine={','.join(cols) or 'NESSUNA'}")
        b.misura(f"le {len(TABELLE_AMMINISTRATIVE)} tabelle amministrative: righe, righe con provenienza (nome normalizzato), colonne di origine sulla riga",
                 "select count(*) from sys.<t>; count nel registro con replace(target,'sys.','')=<t>; information_schema.columns ~ source|origin|import|external|native",
                 len(TABELLE_AMMINISTRATIVE), dett)

        # ── presenze: provenienza per identificativo vs per nome
        if esiste_tabella(cur, "sys_attendance"):
            per_id = uno(cur, """select count(*) from sys.sys_attendance a
                                  where exists (select 1 from sys.sys_source_lineage_records l where l.source_lineage_target_record_id = a.attendance_id)""")
            per_nome = uno(cur, "select count(*) from sys.sys_source_lineage_records where replace(source_lineage_target_table_name,'sys.','')='sys_attendance'")
            b.misura("sys_attendance: righe con provenienza per IDENTIFICATIVO vs righe di registro che la nominano (divario da spiegare in I-D)",
                     "exists(target_record_id = attendance_id) vs count(*) where replace(target,'sys.','')='sys_attendance'",
                     f"per_identificativo={per_id} per_nome={per_nome}")

        # ── migrazioni e tabelle
        files = sorted(glob.glob(os.path.join(REPO, "db", "migrations", "[0-9][0-9][0-9][0-9][0-9][0-9]_*.sql")))
        if not files:
            raise NonMisurabile("nessuna migrazione in db/migrations")
        ultimo = os.path.basename(files[-1])[:6]
        b.misura("ultimo numero di migrazione presente in db/migrations", "ls db/migrations/[0-9]{6}_*.sql | tail -1", ultimo, [f"file totali: {len(files)}"])
        tabelle = [r[0] for r in q(cur, r"select table_name from information_schema.tables where table_schema='sys' and table_name like 'sys\_%%' order by 1")]
        b.misura("numero di tabelle sys.sys_* (serve a W2 per i lotti di I-E)",
                 "select table_name from information_schema.tables where table_schema='sys' and table_name like 'sys\\_%' order by 1",
                 len(tabelle), [", ".join(tabelle)])
        viste = uno(cur, "select count(*) from pg_views where schemaname='sys'")
        b.misura("viste sys.v_* esistenti (sentinelle che db_health raccoglie)", "select count(*) from pg_views where schemaname='sys'", viste)

        # ── codice
        misure_codice(b, ruoli)
    except NonMisurabile as e:
        print(f"NON MISURABILE: {e}", file=sys.stderr)
        print("baseline NON scritto: un baseline a meta' e' peggio di nessun baseline.", file=sys.stderr)
        con.close()
        return 2
    con.close()

    os.makedirs(EVIDENZE, exist_ok=True)
    out = os.path.join(EVIDENZE, f"baseline_{ts}.txt")
    with open(out, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(b.testo())
    if stampa:
        print(b.testo())
    print(f"baseline scritto: {os.path.relpath(out, REPO)}  ({b.n} misure)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
