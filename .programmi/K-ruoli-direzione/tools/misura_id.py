#!/usr/bin/env python3
"""misura_id.py — I-D passo 17, ri-misure IN LINEA della sessione principale (W3): tutte le query del
registro di provenienza scritte PER INTERO e ri-eseguibili, in una transazione READ ONLY.
Scrive evidenze/I-D_rimisure_<yyyymmddHHMM>.txt e lo stampa. Ogni numero ha accanto la sua query.

Sezioni: (1) le due convenzioni del registro; (2) registro per tabella normalizzata vs righe reali =
orfani; (3) presenze; (4) CONFLITTI per D5 sulle quattro tabelle ibride, con la definizione eseguita.
"""
from __future__ import annotations

import os
import sys
from datetime import datetime

import psycopg2

QUI = os.path.dirname(os.path.abspath(__file__))
RADICE_K = os.path.dirname(QUI)
DSN = "host=localhost port=5433 user=heuresys dbname=heuresys_advanced"
IBRIDE = {  # tabella -> (colonna id, colonna persona, colonna periodo)
    "sys_time_off_balances": ("balance_id", "balance_subject_user_id", "balance_year"),
    "sys_time_off_requests": ("request_id", "request_subject_user_id", "request_start_date"),
    "sys_overtime": ("overtime_id", "overtime_subject_user_id", "overtime_date"),
    "sys_leave_accrual_rules": ("accrual_rule_id", "accrual_rule_tenant_id", "created_at"),
}
REG = "sys.sys_source_lineage_records"
NORM = "replace(source_lineage_target_table_name,'sys.','')"

out: list[str] = []


def w(s: str = "") -> None:
    out.append(s)
    print(s)


def q(cur, sql: str, titolo: str) -> list[tuple]:
    cur.execute(sql)
    righe = cur.fetchall()
    w(f"\n### {titolo}")
    w("```sql\n" + sql.strip() + "\n```")
    for r in righe[:60]:
        w("  " + " | ".join("" if v is None else str(v) for v in r))
    if len(righe) > 60:
        w(f"  … ({len(righe)} righe)")
    return righe


def main() -> int:
    ts = datetime.now().strftime("%Y%m%d%H%M")
    con = psycopg2.connect(DSN)
    con.autocommit = False
    cur = con.cursor()
    cur.execute("SET TRANSACTION READ ONLY")
    cur.execute("SET LOCAL statement_timeout = '120s'")
    w(f"# I-D — ri-misure in linea (S1103, {datetime.now().isoformat(timespec='minutes')}) — transazione READ ONLY")

    w("\n## (1) Le due convenzioni del registro")
    q(cur, f"""select (source_lineage_target_table_name like 'sys.%') as con_prefisso,
       count(*) as righe, count(distinct source_lineage_target_table_name) as tabelle_distinte,
       count(*) filter (where source_lineage_source_natural_key is null) as senza_natural_key,
       count(*) filter (where source_lineage_source_record_id is null) as senza_source_record_id
  from {REG} group by 1 order by 1""", "righe e tabelle per convenzione (prefisso 'sys.' si/no)")
    q(cur, f"""select count(distinct source_lineage_target_table_name) as grafie,
       count(distinct {NORM}) as tabelle_normalizzate from {REG}""",
      "grafie distinte vs tabelle normalizzate (se uguali a 36 = nessuna tabella in entrambe le grafie)")
    q(cur, f"""select source_lineage_target_table_name, count(*) from {REG}
  where source_lineage_target_table_name like 'sys.%' group by 1 order by 2 desc""", "le tabelle scritte CON prefisso")

    w("\n## (2) Registro per tabella normalizzata vs righe reali → ORFANI (registro > tabella)")
    tab = q(cur, f"""select {NORM} as tabella, count(*) as nel_registro,
       count(distinct source_lineage_target_record_id) as id_distinti from {REG} group by 1 order by 1""",
            "registro per tabella normalizzata")
    w("\n### confronto con la tabella reale: per ogni tabella `select count(*) from sys.<t>` e id del registro che NON esistono piu' nella tabella")
    w("  tabella | nel_registro | righe_reali | orfani(registro-tabella) | id_registro_non_in_tabella")
    tot_orf = 0
    n_orf = 0
    for tabella, nreg, _ in tab:
        cur.execute("select 1 from information_schema.tables where table_schema='sys' and table_name=%s", (tabella,))
        if not cur.fetchone():
            w(f"  {tabella} | {nreg} | TABELLA INESISTENTE | {nreg} | {nreg}")
            tot_orf += nreg
            n_orf += 1
            continue
        cur.execute("select column_name from information_schema.columns where table_schema='sys' and table_name=%s and ordinal_position=1", (tabella,))
        pk = cur.fetchone()[0]
        cur.execute(f"select count(*) from sys.{tabella}")
        reali = cur.fetchone()[0]
        cur.execute(f"""select count(*) from {REG} l where {NORM}=%s
                         and not exists (select 1 from sys.{tabella} t where t.{pk}::text = l.source_lineage_target_record_id::text)""", (tabella,))
        mancanti = cur.fetchone()[0]
        orf = nreg - reali
        if orf > 0:
            tot_orf += orf
            n_orf += 1
        w(f"  {tabella} | {nreg} | {reali} | {orf if orf > 0 else ''} | {mancanti}")
    w(f"\n  TABELLE CON ORFANI (registro > tabella): {n_orf} · orfani totali {tot_orf}")
    w("  Definizione di «orfano» per S-3: per tabella normalizzata, max(0, righe_registro - righe_reali); la colonna id_registro_non_in_tabella e' la definizione PER RIGA (id del registro che non trova la riga bersaglio) e vale anche dove il totale non supera la tabella.")

    w("\n## (3) Presenze (sys_attendance)")
    q(cur, f"""select (select count(*) from sys.sys_attendance) as presenze,
       (select count(*) from {REG} where {NORM}='sys_attendance') as nel_registro,
       (select count(*) from {REG} where {NORM}='sys_attendance' and source_lineage_target_record_id is not null) as per_identificativo,
       (select count(*) from {REG} where {NORM}='sys_attendance' and source_lineage_source_natural_key is not null) as per_nome,
       (select count(*) from sys.sys_attendance a where exists (select 1 from {REG} l where {NORM}='sys_attendance' and l.source_lineage_target_record_id = a.attendance_id)) as presenze_con_provenienza,
       (select count(*) from sys.sys_attendance a where not exists (select 1 from {REG} l where {NORM}='sys_attendance' and l.source_lineage_target_record_id = a.attendance_id)) as presenze_senza_provenienza""",
      "presenze: totale, registro, per identificativo, per nome, con/senza provenienza")

    w("\n## (4) CONFLITTI PER D5 — quattro tabelle ibride")
    w("Definizione ESEGUITA (euristica, perche' la colonna di origine X-2 non esiste ancora): una riga e' «in conflitto» se")
    w("  (a) esiste nel registro di provenienza (e' stata importata) E (b) la tabella bersaglio ha updated_at > created_at del registro (e' stata modificata DOPO la corsa di importazione).")
    w("Il confronto e' bersaglio.updated_at > registro.created_at, NON un confronto interno al registro.")
    tot = 0
    for t, (idc, persona, periodo) in IBRIDE.items():
        righe = q(cur, f"""select count(*) as righe_totali,
       count(*) filter (where l.source_lineage_record_id is not null) as importate_nel_registro,
       count(*) filter (where l.source_lineage_record_id is null) as native_senza_registro,
       count(*) filter (where l.source_lineage_record_id is not null and b.updated_at > l.created_at) as in_conflitto,
       count(*) filter (where l.source_lineage_record_id is not null and b.updated_at > l.created_at + interval '1 hour') as in_conflitto_oltre_1h,
       count(distinct b.{persona}) filter (where l.source_lineage_record_id is not null and b.updated_at > l.created_at) as persone_o_tenant_coinvolti
  from sys.{t} b
  left join {REG} l on l.source_lineage_target_record_id = b.{idc} and {NORM} = '{t}'""",
                  f"{t}")
        tot += righe[0][3]
    w(f"\n  CONFLITTI TOTALI (definizione eseguita sopra): {tot}")
    con.rollback()
    p = os.path.join(RADICE_K, "evidenze", f"I-D_rimisure_{ts}.txt")
    open(p, "w", encoding="utf-8", newline="\n").write("\n".join(out) + "\n")
    print(f"\n[scritto] {os.path.relpath(p, RADICE_K)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
