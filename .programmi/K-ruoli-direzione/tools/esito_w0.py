#!/usr/bin/env python3
"""esito_w0.py — F0.2 passo 8: da <cartella wf>/<oggetto>_lettore.json + _verifica.json produce
esiti/F0.2_censimento_C1.md con i soli numeri verificati; i numeri discordanti li sostituisce
con quelli ri-misurati in linea (passati come RIMISURATI qui sotto, con il comando esatto)."""
from __future__ import annotations

import json
import os
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
RADICE_K = os.path.dirname(QUI)
CARTELLA = sys.argv[1]
OGGETTI = ["sys_auth_roles", "sys_auth_role_permissions", "sys_auth_permissions",
           "sys_source_lineage_records", "sys_user_position_assignments", "role-codes.ts"]
# (oggetto, insieme) -> (numero ri-misurato in linea, comando esatto, elementi o None)
RIMISURATI = {
    ("sys_auth_role_permissions", "cancelli"): (5, 'rg --no-ignore --hidden -l "sys_auth_role_permissions" .github docs/kb/tools scripts',
        ["docs/kb/tools/build_atlas.py", "docs/kb/tools/status_dashboard.py", "docs/kb/tools/atlas-sweep-templates/fragments_s1016/api_c1.yaml", "docs/kb/tools/atlas-sweep-templates/fragments_s1016/api_c6.yaml", "docs/kb/tools/atlas-sweep-templates/fragments_s1016/db_live.yaml"]),
    ("sys_auth_role_permissions", "scrittori"): (55, 'rg --no-ignore --hidden -il "INSERT INTO sys\\.sys_auth_role_permissions|UPDATE sys\\.sys_auth_role_permissions" db/migrations | wc -l', None),
    ("sys_auth_permissions", "scrittori"): (50, 'rg --no-ignore --hidden -il "INSERT INTO.*sys_auth_permissions|UPDATE.*sys_auth_permissions" db/migrations | wc -l', None),
    ("sys_source_lineage_records", "test"): (3, 'rg --no-ignore --hidden -l "sys_source_lineage_records" --glob "*.test.ts" --glob "*.spec.ts" .',
        ["apps/api/test/sdbi-perf-feedback.integration.test.ts", "apps/api/test/provenance.integration.test.ts", "apps/api/test/evidence.integration.test.ts"]),
    ("role-codes.ts", "test"): (12, 'rg --no-ignore --hidden -l "ROLE_CODES|RoleCode|role-codes" apps/api/test | wc -l', None),
}

out = ["# F0.2 — Censimento C1: chi sorveglia i sei oggetti che il mandato tocchera'", "",
       f"Data: 2026-09-14, sessione S1102. Workflow W0 (`workflows/W0_censimento.js`), cartella `{CARTELLA}`: 6 lettori sonnet, 6 verificatori haiku, 12/12 completati, 0 errori, 22 minuti.",
       "",
       "Regola di lettura: ogni numero e' VERIFICATO (uguale fra lettore e verificatore) salvo dove e' scritto **ri-misurato in linea**: li' lettore e verificatore discordavano e vale il numero ottenuto dalla sessione principale col comando riportato. Gli elenchi completi degli elementi sono nei file `<oggetto>_lettore.json` della cartella.",
       "",
       "## Perche' esiste questo file",
       "",
       "E' la lista di cio' che diventa ROSSO quando F4 aggiunge un ruolo o un permesso, e dice a R-1..R-9 quali file toccare oltre alla migrazione. Un insieme vuoto porta il comando che prova che e' vuoto.",
       ""]
RUN = json.load(open(os.path.join(CARTELLA, "_risultato.json"), encoding="utf-8"))["result"]["esiti"]
LETTURE = {e["oggetto"]: e["lettura"] for e in RUN}
for o in OGGETTI:
    # la fonte e' l'esito STRUTTURATO del run (validato dallo schema), non il file scritto a mano
    # dall'agente: su sys_user_position_assignments i due dicevano 14 e 16 per gli scrittori.
    let = LETTURE[o]
    # i file *_verifica.json scritti a mano dagli agenti non sono tutti JSON valido (uno ha un
    # \escape spurio): la verifica la si legge dal risultato del run, non da qui.
    out.append(f"## `{o}`")
    out.append("")
    out.append("| insieme | numero | comando | elementi (primi 12) |")
    out.append("|---|---|---|---|")
    for ins in let["insiemi"]:
        k = (o, ins["nome"])
        if k in RIMISURATI:
            n, cmd, el = RIMISURATI[k]
            num = f"**{n}** (ri-misurato in linea; lettore {ins['numero']})"
            elementi = el if el is not None else ins["elementi"]
        else:
            num, cmd, elementi = str(ins["numero"]), ins["comando"], ins["elementi"]
        el_txt = "<br>".join(e.replace("|", "\\|") for e in elementi[:12]) + (f"<br>… (+{len(elementi) - 12})" if len(elementi) > 12 else "")
        out.append(f"| {ins['nome']} | {num} | `{cmd.replace('|', '\\|')}` | {el_txt or '(vuoto)'} |")
    if let.get("non_misurato"):
        out.append("")
        out.append("Non misurato, dichiarato dal lettore:")
        for nm in let["non_misurato"]:
            out.append(f"- {nm}")
    out.append("")

out += ["## Le due cose che questo censimento insegna a F4", "",
        "1. **Chi crea le tre tabelle auth e' una sola migrazione**, `000005_auth_foundation.sql` (righe 221 e seguenti): per ADR-0035 e' il file che si emenda quando si ritira, non l'ultimo che le tocca. Le migrazioni che le SCRIVONO sono decine (55 su `sys_auth_role_permissions`, 50 su `sys_auth_permissions`, 7 su `sys_auth_roles`): ogni ruolo nuovo aggiunge la propria, come `000181_whistleblowing.sql` e `000414`.",
        "2. **L'unica sentinella viva sulle tre tabelle auth e' `sys.v_whistleblowing_fuori_dal_custode`** (000414): un ruolo nuovo che ricevesse un permesso `whistleblowing:*` la accenderebbe. Le viste di G-D2 e S-1 nasceranno accanto a lei. `sys_user_position_assignments` ha invece 7 sentinelle e 27 test: G-1 le fara' scattare tutte.",
        "",
        "## Verifica W3 (sezione 3.6)", "",
        "- Spia trovata dal verificatore su 6/6 oggetti: il numero alterato (+7) compare fra le discrepanze di ciascun verificatore (8→1, 8→1, 8→1, 7→0, 14→7, 10→3).",
        "- Su `sys_auth_permissions` e `role-codes.ts` lo script ha loggato `SCARTATO` perche' confronta la STRINGA del comando e il verificatore l'aveva riscritta (senza il prefisso `python q.py`, o con `sentinelle: ` davanti): il numero prova che la spia e' stata trovata, la stringa no. Accettati sulla prova numerica; il confronto testuale degli script W1/W2 ha la stessa fragilita' — registrato in `esiti/REGISTRO_SCOPERTE.md`, non si emenda lo script di iniziativa.",
        "- Cinque discrepanze vere, ri-misurate in linea (tabelle sopra). Tre numeri per la stessa domanda su `sys_auth_role_permissions`/scrittori (53, 56, 55) nascono da tre regex diverse: il numero che vale e' quello col comando scritto accanto.",
        ""]
with open(os.path.join(RADICE_K, "esiti", "F0.2_censimento_C1.md"), "w", encoding="utf-8", newline="\n") as fh:
    fh.write("\n".join(out))
print("scritto esiti/F0.2_censimento_C1.md")
