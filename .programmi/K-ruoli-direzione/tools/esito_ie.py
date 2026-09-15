#!/usr/bin/env python3
"""esito_ie.py — I-E passo 23 (W3): dal `_risultato.json` di W2 e da una RI-MISURA in linea di
`righe` e `righe_con_provenienza` per ogni tabella (READ ONLY, nome normalizzato del registro, pk =
prima colonna), produce esiti/I-E.md (245 righe, una per tabella) e la lista delle dubbie a parte.
Controllo DIF-4: set(elenco passo 21) - set(tabelle nell'esito) deve essere vuoto, e viceversa.
Uso: python tools/esito_ie.py <cartella_wf> <elenco_tabelle.txt>
"""
from __future__ import annotations

import json
import os
import sys
from collections import Counter
from datetime import datetime

import psycopg2

QUI = os.path.dirname(os.path.abspath(__file__))
RADICE_K = os.path.dirname(QUI)
DSN = "host=localhost port=5433 user=heuresys dbname=heuresys_advanced"
D6 = {"sys_user_contracts", "sys_user_pay_slips", "sys_user_identity_documents", "sys_position_compensation_profiles"}

cart, elenco = sys.argv[1], sys.argv[2]
r = json.load(open(os.path.join(cart, "_risultato.json"), encoding="utf-8"))
res = r["result"]
righe = {x["tabella"]: x for x in res["righe"]}
attese = [l.strip() for l in open(elenco, encoding="utf-8") if l.strip()]
perse = sorted(set(attese) - set(righe))
in_piu = sorted(set(righe) - set(attese))

con = psycopg2.connect(DSN)
cur = con.cursor()
cur.execute("SET TRANSACTION READ ONLY")
cur.execute("SET LOCAL statement_timeout = '120s'")
mis = {}
for t in attese:
    cur.execute("select column_name from information_schema.columns where table_schema='sys' and table_name=%s and ordinal_position=1", (t,))
    pk = cur.fetchone()[0]
    cur.execute(f"select count(*) from sys.{t}")
    n = cur.fetchone()[0]
    cur.execute(f"""select count(*) from sys.{t} b where exists (select 1 from sys.sys_source_lineage_records l
                     where replace(l.source_lineage_target_table_name,'sys.','') = %s and l.source_lineage_target_record_id::text = b.{pk}::text)""", (t,))
    prov = cur.fetchone()[0]
    mis[t] = (n, prov)
con.rollback()

ts = datetime.now().strftime("%Y%m%d%H%M")
ev = [f"# I-E ri-misura in linea (S1103, {datetime.now().isoformat(timespec='minutes')}) — READ ONLY", "",
      "query per tabella: select count(*) from sys.<t>  ·  select count(*) from sys.<t> b where exists (select 1 from sys.sys_source_lineage_records l where replace(l.source_lineage_target_table_name,'sys.','')='<t>' and l.source_lineage_target_record_id::text = b.<pk>::text)", "",
      "| tabella | righe (lettore) | righe (in linea) | con provenienza (lettore) | con provenienza (in linea) |", "|---|---|---|---|---|"]
diff_righe = diff_prov = 0
for t in attese:
    x = righe.get(t, {})
    n, p = mis[t]
    if x.get("righe") != n:
        diff_righe += 1
    if x.get("righe_con_provenienza") != p:
        diff_prov += 1
    ev.append(f"| {t} | {x.get('righe')} | {n} | {x.get('righe_con_provenienza')} | {p} |")
ev += ["", f"tabelle con `righe` discordante lettore/in linea: {diff_righe} · con `righe_con_provenienza` discordante: {diff_prov} (vince la ri-misura in linea)"]
pe = os.path.join(RADICE_K, "evidenze", f"I-E_rimisure_{ts}.txt")
open(pe, "w", encoding="utf-8", newline="\n").write("\n".join(ev) + "\n")

stati = Counter(x["stato_proposto"] for x in righe.values())
dubbie = sorted(t for t, x in righe.items() if x["dubbia"] or t in D6)
out = ["# I-E — Classificazione delle tabelle `sys.sys_*` nei tre stati (passi 21-23) — ESITO", "",
       f"Data: 2026-09-15, sessione S1103. Workflow W2 (`workflows/W2_classificazione.js`, cartella `{cart}`, run `{r.get('runId','?')}`): 6 lettori sonnet + 6 verificatori haiku, {res['lotti_validi']}/{res['lotti_totali']} lotti validi (spia trovata), **{len(righe)} tabelle classificate su {len(attese)} attese, perse {len(perse)}** (controllo DIF-4 in codice: `set(elenco) - set(esito)` = `{perse}`; in più: `{in_piu}`). Il primo lancio (`wf_fdd26207-9df`) è morto per rete ed è stato abbandonato.",
       "",
       f"**`righe` e `righe_con_provenienza` sono RI-MISURATE IN LINEA** per tutte le {len(attese)} tabelle (`tools/esito_ie.py`, READ ONLY, evidenza `evidenze/I-E_rimisure_{ts}.txt`): i lettori avevano sbagliato il join sul registro (nome con prefisso, id non normalizzato) e davano 0 dappertutto — il verificatore del lotto 0 l'ha colto su `sys_attendance` (0 vs 3.045). Scrittori, stato proposto e regola meccanica «dubbia» sono dei lettori.",
       "",
       "> **In una riga:** " + " · ".join(f"**{k}** {v}" for k, v in sorted(stati.items())) + f" · **dubbie {len(dubbie)}** (regola meccanica del passo 22: scrittori API **e** di importazione, oppure righe > 0 senza scrittore, oppure una delle quattro tabelle di D6). Le dubbie le ratifica Enzo in **X-1** (Fase 5, fuori da questa sessione); le altre no.",
       "",
       "Stati: `nativo` = scritto da rotte API con permesso di people management · `importato` = scritto SOLO da importazione/materializzazione/seed · `ibrido` = gesto nativo + saldo importato (o scrittori di entrambi i tipi) · `infrastruttura` = registri, code, sessioni, cataloghi RBAC: non dati del cliente, fuori dall'invariante I23.",
       "",
       "## Le 245 tabelle", "",
       "| tabella | stato | dubbia | righe | con prov. | scrittori API | scrittori import | motivo |", "|---|---|---|---|---|---|---|---|"]
for t in attese:
    x = righe[t]
    n, p = mis[t]
    sa = "; ".join(x["scrittori_api"])[:120] or "—"
    si = "; ".join(x["scrittori_import"])[:120] or "—"
    mot = x["motivo"].replace("|", "/")[:160]
    out.append(f"| {t} | {x['stato_proposto']} | {'**sì**' if (x['dubbia'] or t in D6) else ''} | {n} | {p} | {sa} | {si} | {mot} |")
out += ["", f"## Le dubbie ({len(dubbie)}) — per X-1 (`ATTESA_ENZO`, Fase 5)", ""]
for t in dubbie:
    x = righe[t]
    out.append(f"- `{t}` — proposta **{x['stato_proposto']}** — {x['motivo'].replace('|','/')[:200]}" + (" — **D6: importata, porta non ancora costruita**" if t in D6 else ""))
out += ["", "## Verdetti", "",
        "- **SBLOCCA X-0** (l'ADR ha la tabella allegata) e **X-1** (le dubbie sono la lista sopra; Enzo risponde riga per riga `X-1 | <tabella> | nativo/importato/ibrido/infrastruttura` in `RISPOSTE_ENZO.md`).",
        "- **Per I-C passo 16**: i moduli delle tabelle `nativo` e `importato` (non dubbie) sono i moduli di PEOPLE_MANAGER e DATA_STEWARD.",
        "- **Per X-2**: la colonna di origine manca su **tutte** le 245 tabelle (`colonna_origine` vuota dai lettori, salvo `sys_attendance.attendance_source`, già nota).",
        "- Nessuna decisione nuova per Enzo oltre X-1, già prevista."]
po = os.path.join(RADICE_K, "esiti", "I-E.md")
open(po, "w", encoding="utf-8", newline="\n").write("\n".join(out) + "\n")
print(f"tabelle {len(righe)}/{len(attese)} perse={perse} in_piu={in_piu} stati={dict(stati)} dubbie={len(dubbie)} diff_righe={diff_righe} diff_prov={diff_prov}")
print(f"[scritto] esiti/I-E.md · evidenze/I-E_rimisure_{ts}.txt")
