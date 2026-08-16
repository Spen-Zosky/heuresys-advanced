#!/usr/bin/env python3
"""
build_agent_operations.py — le operazioni che l'agente puo' RISOLVERE, derivate dall'atlante.

PERCHE' ESISTE (#156, ADR-0033 §5.2). Il gate delle scritture classifica una chiamata
parametrica sul **metodo HTTP dell'operazione risolta**, e la risoluzione passa da un
`OperationResolver`. Finora quel resolver era **solo un'interfaccia**: senza, ogni chiamata
a `hrx_entity_query` esce `unresolved`, cioe' negata. Collegare lo strumento prima di avere
il resolver riaprirebbe §5.2 dalla porta accanto — per questo si costruisce prima.

DERIVATO, MAI SCRITTO A MANO. La mappa nasce da `atlas.yaml`, che si rigenera dal codice e
dal DB vivo: uno schema che cambia aggiorna le operazioni senza che nessuno le ricopi. Un
elenco scritto a mano misurerebbe la mano.

IL PERIMETRO E' UN DATO, NON UN LETTERALE. I concetti aperti stanno in
`docs/kb/agent-perimetri.json`, la stessa fonte che legge `check_concetti_agente.py`.
La dottrina di Enzo (2026-08-16) e' che l'agente vada **ovunque porti valore aggiunto**:
quell'elenco cresce, e questo strumento non va toccato quando cresce.

FAIL-CLOSED DUE VOLTE:
  · esce **solo** cio' che e' dichiarato aperto. Un concetto non in elenco non ha
    operazioni, quindi non si risolve, quindi il gate lo nega;
  · per i perimetri `sola_lettura` escono **solo le GET**. Una POST che non compare non
    puo' essere risolta nemmeno per sbaglio: non e' filtrata a valle, non esiste proprio.

L'`operationId` e' DETERMINISTICO e derivato da metodo+percorso, cosi' due generazioni
dello stesso atlante danno lo stesso file (e un diff vuoto e' un'informazione):
    GET  /                      -> get
    GET  /:id                   -> get_by_id
    GET  /:id/skills            -> get_by_id_skills
    POST /                      -> post

  python docs/kb/tools/build_agent_operations.py            # scrive il file
  python docs/kb/tools/build_agent_operations.py --stdout   # lo stampa e basta
  python docs/kb/tools/build_agent_operations.py --selftest
"""
import io
import json
import os
import re
import sys

ATLAS = os.path.join("docs", "kb", "atlas", "atlas.yaml")
PERIMETRI = os.path.join("docs", "kb", "agent-perimetri.json")
USCITA = os.path.join("docs", "kb", "atlas", "agent-operations.json")


def ceco(cosa, rimedio):
    raise SystemExit("NON MISURABILE: %s.\n  %s\n  Uno zero silenzioso qui sarebbe un "
                     "falso verde." % (cosa, rimedio))


def operation_id(metodo: str, path: str) -> str:
    """metodo+percorso -> identificativo stabile. Nessun contatore, nessun ordine implicito."""
    pezzi = [metodo.lower()]
    for seg in path.strip("/").split("/"):
        if not seg:
            continue
        if seg.startswith(":"):
            pezzi.append("by_" + re.sub(r"[^a-z0-9]+", "_", seg[1:].lower()))
        else:
            pezzi.append(re.sub(r"[^a-z0-9]+", "_", seg.lower()))
    return "_".join(pezzi)


def leggi_rotte(righe):
    """atlas.yaml -> {modulo: [{method, path, permission}]}.

    Parser mirato invece di PyYAML, come in `build_concepts.py`: la dipendenza non e'
    installata ovunque e non se ne aggiungono. Il file e' generato da uno strumento nostro
    con indentazione fissa, quindi il parsing e' deterministico quanto il file.
    """
    moduli, in_api, mod, campo, corrente = {}, False, None, None, None
    for ln in righe:
        if re.match(r"^api:$", ln):
            in_api = True
            continue
        if in_api and re.match(r"^[a-z_]+:$", ln):
            break
        if not in_api:
            continue
        m = re.match(r"^  ([a-z0-9][a-z0-9-]*):$", ln)
        if m:
            mod, campo, corrente = m.group(1), None, None
            moduli[mod] = []
            continue
        if mod is None:
            continue
        m = re.match(r"^    ([a-z]+):", ln)
        if m:
            campo = m.group(1)
            corrente = None
            continue
        if campo != "routes":
            continue
        m = re.match(r"^      - method: (\S+)$", ln)
        if m:
            corrente = {"method": m.group(1), "path": None, "permission": None}
            moduli[mod].append(corrente)
            continue
        if corrente is None:
            continue
        m = re.match(r'^        path: "?([^"\s]+)"?$', ln)
        if m:
            corrente["path"] = m.group(1)
            continue
        m = re.match(r'^        permission: "?([^"\s]+)"?$', ln)
        if m and m.group(1) != "null":
            corrente["permission"] = m.group(1)
    return moduli


def costruisci(radice="."):
    atlas_p = os.path.join(radice, ATLAS)
    perim_p = os.path.join(radice, PERIMETRI)
    if not os.path.isfile(atlas_p):
        ceco("l'atlante non esiste in %s" % ATLAS, "python docs/kb/tools/build_atlas.py")
    if not os.path.isfile(perim_p):
        ceco("i perimetri non esistono in %s" % PERIMETRI, "eseguire dalla radice del repo")

    perim = json.loads(io.open(perim_p, encoding="utf-8").read())
    aperti = perim.get("aperti") or []
    if not aperti:
        ceco("nessun perimetro dichiarato aperto in %s" % PERIMETRI,
             "e' uno stato legittimo solo prima della prima decisione: se non lo e', "
             "la decisione non e' stata registrata")

    rotte = leggi_rotte(io.open(atlas_p, encoding="utf-8").read().splitlines())
    if not rotte:
        ceco("l'atlante non ha prodotto alcuna rotta", "rigenerarlo: build_atlas.py")

    out, mancanti = {}, []
    for voce in aperti:
        cid = voce.get("concetto")
        # Una voce senza decisione e data non e' un perimetro: e' una dimenticanza.
        if not voce.get("decisione") or not voce.get("data"):
            ceco("il perimetro '%s' non porta `decisione` e `data`" % cid,
                 "un'apertura senza chi l'ha decisa e quando non e' verificabile")
        if cid not in rotte:
            mancanti.append(cid)
            continue
        solo_lettura = bool(voce.get("sola_lettura"))
        ops = {}
        for r in rotte[cid]:
            if not r.get("path"):
                continue
            if solo_lettura and (r["method"] or "").upper() != "GET":
                continue
            ops[operation_id(r["method"], r["path"])] = {
                "method": r["method"].upper(),
                "path": r["path"],
                "permission": r.get("permission"),
            }
        out[cid] = {
            "solaLettura": solo_lettura,
            "data": voce["data"],
            "decisione": voce["decisione"],
            "operations": ops,
        }
    if mancanti:
        ceco("questi perimetri aperti non esistono nell'atlante: %s" % ", ".join(mancanti),
             "o il nome del concetto e' sbagliato, o l'atlante e' superato "
             "(python docs/kb/tools/build_atlas.py)")
    return out


def main():
    radice = "."
    dati = costruisci(radice)
    testo = json.dumps({
        "_generato_da": "docs/kb/tools/build_agent_operations.py — non modificare a mano",
        "_fonti": [ATLAS.replace("\\", "/"), PERIMETRI.replace("\\", "/")],
        "concepts": dati,
    }, ensure_ascii=False, indent=1, sort_keys=True)
    if "--stdout" in sys.argv:
        print(testo)
        return 0
    with io.open(os.path.join(radice, USCITA), "w", encoding="utf-8", newline="\n") as fh:
        fh.write(testo + "\n")
    n_ops = sum(len(v["operations"]) for v in dati.values())
    print("agent-operations: %d concetti aperti, %d operazioni risolvibili -> %s"
          % (len(dati), n_ops, USCITA.replace("\\", "/")))
    for cid, v in sorted(dati.items()):
        print("  %-28s %s  %s" % (cid, "sola lettura" if v["solaLettura"] else "lettura+scrittura",
                                  ", ".join(sorted(v["operations"]))))
    return 0


def selftest():
    """Le prove devono poter fallire: ognuna qui ha una controprova che DEVE dare esito opposto."""
    casi = [
        (("GET", "/"), "get"),
        (("GET", "/:id"), "get_by_id"),
        (("get", "/:id/skills"), "get_by_id_skills"),
        (("POST", "/"), "post"),
        (("GET", "/:id/skill-requirements/history"), "get_by_id_skill_requirements_history"),
        (("DELETE", "/:id/skills/:skillId"), "delete_by_id_skills_by_skillid"),
    ]
    ko = 0
    for (m, p), atteso in casi:
        got = operation_id(m, p)
        if got != atteso:
            print("  [KO] %s %s -> %s (atteso %s)" % (m, p, got, atteso))
            ko += 1
    # controprova: due percorsi DIVERSI non devono collassare sullo stesso id
    if operation_id("GET", "/:id") == operation_id("GET", "/:userId"):
        print("  [KO] due parametri diversi collassano sullo stesso id: gli id non sono distintivi")
        ko += 1
    # controprova: metodo diverso, id diverso — altrimenti il gate non distinguerebbe read da write
    if operation_id("GET", "/") == operation_id("DELETE", "/"):
        print("  [KO] GET e DELETE danno lo stesso id: il gate non potrebbe distinguerli")
        ko += 1
    print("selftest: %d casi, %d falliti" % (len(casi) + 2, ko))
    return 1 if ko else 0


if __name__ == "__main__":
    sys.exit(selftest() if "--selftest" in sys.argv else main())
