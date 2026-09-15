#!/usr/bin/env python3
"""misura_ib.py — I-B passo 14, ri-misura IN LINEA della tabella famiglie×5 sulle 13 tabelle del
semilavorato (nomi esatti misurati su information_schema). READ ONLY. Per ogni tabella: colonna
tenant (nome o -), bandiera globale (nome o -), righe totali, righe con tenant NULL, righe di
Heuresys System, righe di RTL Bank, righe marcate nel registro del generato (per NOME di tabella:
non e' una FK), e il MODO fisico dedotto meccanicamente. Scrive evidenze/I-B_famiglie_<ts>.txt.
"""
from __future__ import annotations

import os
import sys
from datetime import datetime

import psycopg2

QUI = os.path.dirname(os.path.abspath(__file__))
RADICE_K = os.path.dirname(QUI)
DSN = "host=localhost port=5433 user=heuresys dbname=heuresys_advanced"
TABELLE = ["sys_skill_families", "sys_skill_categories", "sys_skill_taxonomy_edges", "sys_job_families",
           "sys_skills", "sys_job_roles", "sys_tenant_blueprints", "sys_survey_templates", "sys_goal_templates",
           "sys_engagement_survey_templates", "sys_organization_unit_templates", "sys_process_kpi_templates",
           "sys_organization_unit_kpi_templates"]
out: list[str] = []


def w(s: str = "") -> None:
    out.append(s)
    print(s)


def main() -> int:
    ts = datetime.now().strftime("%Y%m%d%H%M")
    con = psycopg2.connect(DSN)
    cur = con.cursor()
    cur.execute("SET TRANSACTION READ ONLY")
    cur.execute("SET LOCAL statement_timeout = '60s'")
    cur.execute("select tenant_id, tenant_name from sys.sys_tenancies order by 2")
    tenants = cur.fetchall()
    w(f"# I-B — famiglie×5 ri-misurata in linea (S1103, {datetime.now().isoformat(timespec='minutes')}) — READ ONLY")
    w("tenant: " + " · ".join(f"{n}={t}" for t, n in tenants))
    w("colonna tenant = information_schema.columns con column_name like '%tenant_id'; bandiera globale = column_name like '%is_global%'")
    w("legame al registro del generato = per NOME: select count(*) from sys.sys_generated_record_origins where generated_record_origin_target_table = '<t>' (non esiste FK: registro oggi a 0 righe)")
    w("")
    w("| tabella | colonna tenant | bandiera globale | righe | tenant NULL | Heuresys System | RTL Bank | nel registro generato | MODO |")
    w("|---|---|---|---|---|---|---|---|---|")
    modi: dict[str, list[str]] = {}
    for t in TABELLE:
        cur.execute("select column_name from information_schema.columns where table_schema='sys' and table_name=%s and column_name like '%%tenant_id'", (t,))
        tc = [r[0] for r in cur.fetchall()]
        cur.execute("select column_name from information_schema.columns where table_schema='sys' and table_name=%s and column_name like '%%is_global%%'", (t,))
        gc = [r[0] for r in cur.fetchall()]
        cur.execute(f"select count(*) from sys.{t}")
        n = cur.fetchone()[0]
        nulli = hs = rtl = "-"
        if tc:
            c = tc[0]
            cur.execute(f"select count(*) filter (where {c} is null), "
                        f"count(*) filter (where {c} = (select tenant_id from sys.sys_tenancies where tenant_name='Heuresys System')), "
                        f"count(*) filter (where {c} = (select tenant_id from sys.sys_tenancies where tenant_name='RTL Bank')) from sys.{t}")
            nulli, hs, rtl = cur.fetchone()
        cur.execute("select count(*) from sys.sys_generated_record_origins where generated_record_origin_target_table = %s", (t,))
        reg = cur.fetchone()[0]
        if not tc:
            modo = "A: catalogo di piattaforma senza tenant (nessuna copia di cliente possibile)"
        elif gc:
            modo = "B: tenant_id nullable + bandiera is_global nella stessa tabella"
        elif nulli == n:
            modo = "C: tenant_id presente ma tutto NULL (di fatto catalogo di piattaforma)"
        elif nulli == 0:
            modo = "D: tenant_id obbligatorio, ogni riga e' di un tenant (Heuresys System = piattaforma)"
        else:
            modo = "E: tenant_id nullable senza bandiera (NULL = piattaforma, valorizzato = cliente)"
        modi.setdefault(modo, []).append(t)
        w(f"| {t} | {tc[0] if tc else '-'} | {gc[0] if gc else '-'} | {n} | {nulli} | {hs} | {rtl} | {reg} | {modo.split(':')[0]} |")
    w("")
    w("## I modi fisici trovati")
    for m, ts_ in modi.items():
        w(f"- **{m}** → {len(ts_)}: {', '.join(ts_)}")
    con.rollback()
    p = os.path.join(RADICE_K, "evidenze", f"I-B_famiglie_{ts}.txt")
    open(p, "w", encoding="utf-8", newline="\n").write("\n".join(out) + "\n")
    print(f"[scritto] {os.path.relpath(p, RADICE_K)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
