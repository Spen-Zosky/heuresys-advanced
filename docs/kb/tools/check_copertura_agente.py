#!/usr/bin/env python3
"""Ogni scrittura dell'API ha la sua classe per l'agente, oppure un'esclusione scritta.

Piano Heuresys AI-driven (`docs/piani/PIANO_heuresys-ai-driven_20261126.md`), voci F1 e F1b,
ADR-0063 e ADR-0056 D2. Principio P1: ogni funzione nuova nasce con la sua voce per l'agente.
Una rotta POST, PUT, PATCH o DELETE che compare nel codice senza una riga in
`docs/kb/agent-classi-scritture.json` rende rosso questo controllo, e con lui la CI.

LE ROTTE SI LEGGONO DAL CODICE, non dall'atlante. L'atlante si rigenera dopo l'unione: se il
controllo guardasse quello, una rotta nuova passerebbe la PR e diventerebbe rossa su main il
giorno dopo, a lavoro già unito. Si usa lo stesso lettore dell'atlante (`build_atlas.scan_api`),
che non tocca il database, così i due non possono contare in modo diverso.

Che cosa rende rosso:
  1. una scrittura del codice senza riga (il caso per cui il controllo esiste);
  2. una riga che non corrisponde più a nessuna rotta, o con metodo o percorso diversi;
  3. una riga senza `ragione`, con una classe diversa da B e C, con una categoria `fuori` ignota,
     oppure con `classe` e `fuori` insieme;
  4. una DELETE nel catalogo che non è C o non porta `verifica` (il file del ritiro logico, che
     deve esistere);
  5. una scrittura aperta in `agent-perimetri.json` che qui è `fuori`.

Uscita: 0 verde, 1 rosso, 2 una fonte manca. `--json` stampa i conti; `--selftest` prova che il
controllo diventa rosso su una rotta finta e su una DELETE di classe B.

  python3 docs/kb/tools/check_copertura_agente.py
"""
from __future__ import annotations

import contextlib
import copy
import io
import json
import os
import sys

QUI = os.path.dirname(os.path.abspath(__file__))
RADICE = os.path.abspath(os.path.join(QUI, "..", "..", ".."))
REGISTRO = os.path.join(RADICE, "docs", "kb", "agent-classi-scritture.json")
PERIMETRI = os.path.join(RADICE, "docs", "kb", "agent-perimetri.json")
MAPPA = os.path.join(RADICE, "docs", "kb", "atlas", "agent-operations.json")

sys.path.insert(0, QUI)


def scritture_del_codice() -> dict[tuple[str, str], dict]:
    """{(modulo, operationId): {metodo, percorso}} per ogni rotta non GET del codice."""
    with contextlib.redirect_stderr(io.StringIO()):  # _pg_agenti avvisa su stderr: qui non serve il DB
        import build_atlas
    from build_agent_operations import operation_id

    moduli = build_atlas.scan_api(build_atlas.build_symbol_map())
    out = {}
    for mod, info in moduli.items():
        for r in info["routes"]:
            if r["method"] == "GET":
                continue
            out[(mod, operation_id(r["method"], r["path"]))] = {"metodo": r["method"], "percorso": r["path"]}
    return out


def verifica(codice: dict, registro: dict, perimetri: dict) -> tuple[list[str], dict]:
    rossi: list[str] = []
    categorie = registro.get("_categorie_fuori") or {}
    righe = {(m, o): v for m, ops in (registro.get("scritture") or {}).items() for o, v in ops.items()}

    for k in sorted(set(codice) - set(righe)):
        c = codice[k]
        rossi.append("senza classe: %s %s %s (%s) — aggiungi la riga in docs/kb/agent-classi-scritture.json"
                     % (k[0], c["metodo"], c["percorso"], k[1]))
    for k in sorted(set(righe) - set(codice)):
        rossi.append("riga senza rotta: %s %s — la rotta non esiste più nel codice" % k)

    for k in sorted(set(righe) & set(codice)):
        v, c = righe[k], codice[k]
        dove = "%s %s" % k
        if v.get("metodo") != c["metodo"] or v.get("percorso") != c["percorso"]:
            rossi.append("%s: la riga dice %s %s, il codice %s %s"
                         % (dove, v.get("metodo"), v.get("percorso"), c["metodo"], c["percorso"]))
        if not str(v.get("ragione") or "").strip():
            rossi.append("%s: manca la ragione" % dove)
        ha_classe, ha_fuori = "classe" in v, "fuori" in v
        if ha_classe == ha_fuori:
            rossi.append("%s: serve `classe` oppure `fuori`, uno solo dei due" % dove)
            continue
        if ha_fuori and v["fuori"] not in categorie:
            rossi.append("%s: categoria `fuori` ignota: %s" % (dove, v["fuori"]))
        if ha_classe and v["classe"] not in ("B", "C"):
            rossi.append("%s: classe %r non ammessa per una scrittura (solo B o C)" % (dove, v["classe"]))
        if ha_classe and c["metodo"] == "DELETE":
            if v["classe"] != "C":
                rossi.append("%s: una cancellazione nel catalogo è sempre C (P17, ADR-0035)" % dove)
            fonte = str(v.get("verifica") or "").split(":")[0].strip()
            if not fonte or not os.path.isfile(os.path.join(RADICE, fonte)):
                rossi.append("%s: una DELETE nel catalogo porta `verifica` con il file del ritiro logico" % dove)

    for voce in perimetri.get("aperti") or []:
        for oid in voce.get("scritture") or []:
            v = righe.get((voce.get("concetto"), oid))
            if v is not None and "fuori" in v:
                rossi.append("%s %s: aperta in agent-perimetri.json ma qui è fuori (%s)"
                             % (voce.get("concetto"), oid, v["fuori"]))

    conti = {"scritture": len(codice), "B": 0, "C": 0, "fuori": {}}
    for k in codice:
        v = righe.get(k) or {}
        if v.get("classe") in ("B", "C"):
            conti[v["classe"]] += 1
        elif "fuori" in v:
            conti["fuori"][v["fuori"]] = conti["fuori"].get(v["fuori"], 0) + 1
    non_business = sum(n for cat, n in conti["fuori"].items()
                       if not (categorie.get(cat) or {}).get("di_business", True))
    conti["catalogo"] = conti["B"] + conti["C"]
    conti["di_business"] = conti["scritture"] - non_business
    conti["copertura_business_pct"] = (round(100.0 * conti["catalogo"] / conti["di_business"], 1)
                                       if conti["di_business"] else None)
    return rossi, conti


def raggiungibili(registro: dict) -> tuple[int, list[str]]:
    """Quante scritture del catalogo l'agente raggiunge davvero nella mappa generata, e quali no.

    Informativo, non rosso: la mappa si rigenera dall'atlante, che si rigenera dopo l'unione.
    È però la misura onesta di M1 (piano AI-driven, F1): una classe che la mappa non porta è
    una scrittura che l'agente non può proporre."""
    try:
        with io.open(MAPPA, encoding="utf-8") as fh:
            concetti = json.load(fh).get("concepts") or {}
    except (OSError, ValueError):
        return 0, ["la mappa %s non si legge" % os.path.relpath(MAPPA, RADICE)]
    nella_mappa = {(c.get("modulo") or cid, oid) for cid, c in concetti.items()
                   for oid, op in (c.get("operations") or {}).items() if op.get("method") != "GET"}
    catalogo = {(m, o) for m, ops in (registro.get("scritture") or {}).items()
                for o, v in ops.items() if v.get("classe") in ("B", "C")}
    return len(catalogo & nella_mappa), sorted("%s %s" % k for k in catalogo - nella_mappa)


def leggi(percorso: str) -> dict:
    try:
        with io.open(percorso, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError) as e:
        print("NON MISURABILE: %s non si legge (%s)" % (os.path.relpath(percorso, RADICE), e))
        raise SystemExit(2)


def selftest(codice: dict, registro: dict, perimetri: dict) -> int:
    ko = 0
    rossi, _ = verifica(codice, registro, perimetri)
    if rossi:
        print("  [KO] il registro di partenza non è verde: la controprova non direbbe niente")
        return 1
    finto = dict(codice)
    finto[("modulo-finto", "post_prova")] = {"metodo": "POST", "percorso": "/prova"}
    if not any("senza classe: modulo-finto" in r for r in verifica(finto, registro, perimetri)[0]):
        print("  [KO] una rotta finta senza classe non rende rosso il controllo")
        ko += 1
    sporco = copy.deepcopy(registro)
    cancellazioni = [(m, o) for (m, o), c in codice.items() if c["metodo"] == "DELETE"]
    m, o = cancellazioni[0]
    sporco["scritture"][m][o] = {"metodo": "DELETE", "percorso": codice[(m, o)]["percorso"],
                                 "classe": "B", "ragione": "prova"}
    if not any("sempre C" in r for r in verifica(codice, sporco, perimetri)[0]):
        print("  [KO] una DELETE di classe B non rende rosso il controllo")
        ko += 1
    print("selftest: 3 casi, %d falliti" % ko)
    return 1 if ko else 0


def main() -> int:
    registro, perimetri = leggi(REGISTRO), leggi(PERIMETRI)
    codice = scritture_del_codice()
    if not codice:
        print("NON MISURABILE: il lettore delle rotte non ha trovato scritture")
        return 2
    if "--selftest" in sys.argv:
        return selftest(codice, registro, perimetri)
    rossi, conti = verifica(codice, registro, perimetri)
    if "--json" in sys.argv:
        conti["raggiungibili"], conti["fuori_mappa"] = raggiungibili(registro)
        print(json.dumps({"rossi": rossi, "conti": conti}, ensure_ascii=False, indent=1))
    else:
        fuori = ", ".join("%s %d" % kv for kv in sorted(conti["fuori"].items()))
        print("copertura dell'agente: %d scritture, nel catalogo %d (B %d, C %d), fuori: %s"
              % (conti["scritture"], conti["catalogo"], conti["B"], conti["C"], fuori))
        print("scritture di business %d, nel catalogo %s%%"
              % (conti["di_business"], conti["copertura_business_pct"]))
        n, fuori_mappa = raggiungibili(registro)
        print("raggiungibili dall'agente nella mappa: %d su %d del catalogo%s"
              % (n, conti["catalogo"], (" (mancano: %s)" % ", ".join(fuori_mappa)) if fuori_mappa else ""))
        for r in rossi:
            print("  ROSSO " + r)
        print("esito: %s" % ("ROSSO, %d rilievi" % len(rossi) if rossi else "VERDE"))
    return 1 if rossi else 0


if __name__ == "__main__":
    sys.exit(main())
