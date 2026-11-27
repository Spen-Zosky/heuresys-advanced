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

LE SCRITTURE, DAL 2026-11-26 (F1, ADR-0063). Ogni scrittura con una classe B o C in
`docs/kb/agent-classi-scritture.json` entra nel catalogo, su ogni modulo, con la sua classe.
Il registro e' una decisione scritta riga per riga; `check_copertura_agente.py` lo tiene
allineato al codice in CI. Con LIBERA spenta (ADR-0063 D4) ogni scrittura, B o C, passa
dalla conferma della persona collegata. Le esclusioni (accessi, governo degli agenti,
cancellazioni fisiche...) non escono: non sono filtrate a valle, non esistono nella mappa.

FAIL-CLOSED DUE VOLTE (la storia di prima di F1):
  · le SCRITTURE escono **solo** per cio' che e' dichiarato aperto. Dal 2026-11-05 (#254,
    ADR-0040 §5) le LETTURE escono per ogni modulo, tranne quelli in FUORI_DALLE_LETTURE:
    il perimetro delle letture lo fa l'API, con i permessi della persona senza mandati;
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
# F1 del piano Heuresys AI-driven (ADR-0063): la classe d'azione di ogni scrittura. Una scrittura
# entra nel catalogo solo se qui ha `classe` B o C; `fuori` e l'assenza la lasciano fuori.
CLASSI = os.path.join("docs", "kb", "agent-classi-scritture.json")
USCITA = os.path.join("docs", "kb", "atlas", "agent-operations.json")

# #254 (ADR-0040 §5, piano interfacce L10 A-13): l'agente LEGGE cio' che legge la persona, su
# tutti i moduli, in una mossa sola. Il filtro sulle letture non e' piu' qui: e' nell'API, che
# risponde all'agente con i permessi della persona senza mandati (ADR-0050 D6, gettone di L9).
# `agent-perimetri.json` resta la fonte delle SCRITTURE e la cronaca delle aperture decise.
DECISIONE_LETTURE = ("ADR-0040 §5 (#254, piano interfacce L10 A-13): l'agente legge cio' che legge "
                     "la persona, senza mandati; le scritture restano dei soli perimetri decisi")
DATA_LETTURE = "2026-11-05"
DECISIONE_SCRITTURE = ("ADR-0063 F1 (piano accettato da Enzo il 2026-11-26): le scritture con classe B o C "
                       "in agent-classi-scritture.json, ognuna con la conferma della persona collegata")
DATA_SCRITTURE = "2026-11-26"
# Fuori anche dalle letture, uno per uno con la ragione (mai un jolly):
FUORI_DALLE_LETTURE = {
    "auth": "superficie di autenticazione: il gettone d'agente non la tocca (L9, A-3)",
    "whistleblowing": "isolamento assoluto delle segnalazioni, solo la custodia (ADR-0036 §5, mig 000414)",
}


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


def leggi_prefissi(righe):
    """atlas.yaml -> {modulo: [prefisso, ...]}: il percorso su cui l'API monta il modulo.

    Ondata 4 (2026-11-18): il catalogo generico chiamava `/<concetto><percorso>`, cioè dava per
    scontato che il modulo stesse sotto `/v1/<concetto>`. Per sei moduli non è vero
    (`semantic-matching` sta sotto `/v1/matching`, `capability-*` sotto `/v1/capability`):
    ogni loro lettura andava a un indirizzo inesistente. La base ora viene dall'atlante.
    """
    moduli, in_api, mod, campo = {}, False, None, None
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
            mod, campo = m.group(1), None
            moduli[mod] = []
            continue
        m = re.match(r"^    ([a-z]+):", ln)
        if m:
            campo = m.group(1)
            continue
        m = re.match(r'^      - "?(/v1/[^"\s]*?)/?"?$', ln)
        if m and campo == "prefixes" and mod is not None:
            moduli[mod].append(m.group(1))
    return moduli


def base_di(cid, prefissi):
    """La base del concetto senza `/v1`, oppure None se non si può dire quale sia.

    Un modulo con più prefissi (tenant-consolidation) non dice nell'atlante a quale prefisso
    appartenga ogni rotta: si lascia fuori invece di indovinare (fail-closed)."""
    p = prefissi.get(cid) or []
    if len(p) != 1:
        return None
    return p[0][len("/v1"):] or "/"


APP_TS = os.path.join("apps", "api", "src", "app.ts")
MODULI = os.path.join("apps", "api", "src", "modules")


def blocchi_dal_codice(radice, cid):
    """Un modulo montato su più prefissi: {prefisso: {(metodo, percorso)}} letto dal codice.

    F1 (decisione di Enzo del 2026-11-26): il consolidamento ha tre funzioni di rotte nello stesso
    `routes.ts`, ognuna registrata in `app.ts` con il suo prefisso. L'atlante elenca le rotte del
    modulo senza dire a quale prefisso appartiene ciascuna; il codice lo dice, e si legge da lì.
    Una funzione registrata due volte, o una rotta che non si attribuisce, fermano la costruzione.
    """
    app_ts = io.open(os.path.join(radice, APP_TS), encoding="utf-8").read()
    rotte_ts = io.open(os.path.join(radice, MODULI, cid, "routes.ts"), encoding="utf-8").read()
    importate = set()
    for m in re.finditer(r"import\s*\{([^}]*)\}\s*from\s*\"\./modules/%s/routes\.js\"" % re.escape(cid), app_ts):
        importate |= {x.strip() for x in m.group(1).split(",") if x.strip()}
    prefisso_di = {}
    for m in re.finditer(r"app\.register\(\s*([A-Za-z0-9_]+)\s*,\s*\{\s*prefix:\s*\"(/v1/[^\"]+)\"", app_ts):
        if m.group(1) in importate:
            if m.group(1) in prefisso_di:
                ceco("%s: la funzione %s è registrata due volte" % (cid, m.group(1)), "un solo prefisso per funzione")
            prefisso_di[m.group(1)] = m.group(2).rstrip("/")
    out = {}
    inizi = [(m.start(), m.group(1)) for m in re.finditer(r"^export const ([A-Za-z0-9_]+)\s*:", rotte_ts, re.M)]
    for i, (pos, nome) in enumerate(inizi):
        if nome not in prefisso_di:
            continue
        fine = inizi[i + 1][0] if i + 1 < len(inizi) else len(rotte_ts)
        rotte = {(m.group(1).upper(), m.group(2)) for m in
                 re.finditer(r"app\.(get|post|put|patch|delete)\(\s*\"([^\"]+)\"", rotte_ts[pos:fine])}
        out[prefisso_di[nome]] = rotte
    return out


def costruisci(radice="."):
    atlas_p = os.path.join(radice, ATLAS)
    perim_p = os.path.join(radice, PERIMETRI)
    if not os.path.isfile(atlas_p):
        ceco("l'atlante non esiste in %s" % ATLAS, "python docs/kb/tools/build_atlas.py")
    if not os.path.isfile(perim_p):
        ceco("i perimetri non esistono in %s" % PERIMETRI, "eseguire dalla radice del repo")

    classi_p = os.path.join(radice, CLASSI)
    if not os.path.isfile(classi_p):
        ceco("il registro delle classi non esiste in %s" % CLASSI, "eseguire dalla radice del repo")
    registro = json.loads(io.open(classi_p, encoding="utf-8").read()).get("scritture") or {}

    def classe_di(cid, oid):
        """B o C dal registro; None per una scrittura esclusa o senza riga (resta fuori)."""
        v = (registro.get(cid) or {}).get(oid) or {}
        return v.get("classe") if v.get("classe") in ("B", "C") else None

    def operazioni(cid, righe, solo_lettura):
        ops = {}
        for r in righe:
            if not r.get("path"):
                continue
            metodo = (r["method"] or "").upper()
            oid = operation_id(r["method"], r["path"])
            if metodo == "GET":
                classe = "A"
            else:
                classe = None if solo_lettura else classe_di(cid, oid)
                if classe is None:
                    continue
            ops[oid] = {"method": metodo, "path": r["path"], "permission": r.get("permission"),
                        "classe": classe}
        return ops

    perim = json.loads(io.open(perim_p, encoding="utf-8").read())
    aperti = perim.get("aperti") or []
    if not aperti:
        ceco("nessun perimetro dichiarato aperto in %s" % PERIMETRI,
             "e' uno stato legittimo solo prima della prima decisione: se non lo e', "
             "la decisione non e' stata registrata")

    righe_atlas = io.open(atlas_p, encoding="utf-8").read().splitlines()
    rotte = leggi_rotte(righe_atlas)
    prefissi = leggi_prefissi(righe_atlas)
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
        base = base_di(cid, prefissi)
        if base is None:
            ceco("il perimetro aperto '%s' non ha un prefisso unico nell'atlante (%s)"
                 % (cid, ", ".join(prefissi.get(cid) or ["nessuno"])),
                 "l'operazione non saprebbe a quale indirizzo andare")
        # Ondata 4: `scritture` elencava le sole scritture aperte del perimetro. Da F1 le apre il
        # registro delle classi; l'elenco resta come cronaca e deve ancora esistere e avere classe.
        # F1 (ADR-0063, piano accettato da Enzo il 2026-11-26): il registro delle classi supera i
        # `sola_lettura` delle aperture di agosto e settembre, che restano come cronaca.
        ops = operazioni(cid, rotte[cid], False)
        solo_lettura = not any(o["method"] != "GET" for o in ops.values())
        for oid in voce.get("scritture") or []:
            if oid not in ops:
                ceco("il perimetro '%s' apre la scrittura '%s', che non esiste o non ha classe B o C "
                     "in %s" % (cid, oid, CLASSI), "il nome e' sbagliato, o manca la riga nel registro")
        out[cid] = {
            "solaLettura": solo_lettura,
            "base": base,
            "data": voce["data"],
            "decisione": voce["decisione"],
            "operations": ops,
        }
    # #254: ogni altro modulo con una lettura entra in sola lettura, con le sole GET.
    for cid, righe in rotte.items():
        if cid in out or cid in FUORI_DALLE_LETTURE:
            continue
        base = base_di(cid, prefissi)
        if base is None:
            # Più prefissi: l'atlante non dice dove sta ogni rotta. Se il modulo ha scritture con
            # classe, il codice dice a quale prefisso appartiene ognuna e il modulo si apre come un
            # concetto per prefisso (`tenant-consolidations`, `consolidation-runs`, ...), con
            # `modulo` che rimanda alla riga del registro. Senza scritture con classe resta fuori.
            if len(prefissi.get(cid) or []) < 2 or not any(
                    classe_di(cid, operation_id(r["method"], r["path"])) for r in righe
                    if r.get("path") and r["method"].upper() != "GET"):
                continue
            blocchi = blocchi_dal_codice(radice, cid)
            if sorted(blocchi) != sorted(p.rstrip("/") for p in prefissi[cid]):
                ceco("%s: i prefissi del codice (%s) non sono quelli dell'atlante (%s)"
                     % (cid, ", ".join(sorted(blocchi)), ", ".join(prefissi[cid])),
                     "rigenerare l'atlante: python docs/kb/tools/build_atlas.py")
            attribuite = set()
            for pref, chiavi in sorted(blocchi.items()):
                sub = pref[len("/v1/"):].replace("/", "-")
                if sub in rotte and sub != cid:
                    ceco("%s: il concetto %s esiste già come modulo" % (cid, sub), "un nome per concetto")
                righe_sub = [r for r in righe if r.get("path") and (r["method"].upper(), r["path"]) in chiavi]
                attribuite |= {(r["method"].upper(), r["path"]) for r in righe_sub}
                ops = operazioni(cid, righe_sub, False)
                if not ops:
                    continue
                scrive = any(o["method"] != "GET" for o in ops.values())
                out[sub] = {
                    "solaLettura": not scrive,
                    "base": pref[len("/v1"):],
                    "modulo": cid,
                    "data": DATA_SCRITTURE if scrive else DATA_LETTURE,
                    "decisione": DECISIONE_LETTURE + ("; " + DECISIONE_SCRITTURE if scrive else ""),
                    "operations": ops,
                }
            orfane = [r for r in righe if r.get("path") and (r["method"].upper(), r["path"]) not in attribuite]
            if orfane:
                ceco("%s: rotte dell'atlante che il codice non attribuisce a un prefisso: %s"
                     % (cid, ", ".join("%s %s" % (r["method"], r["path"]) for r in orfane)),
                     "rigenerare l'atlante o correggere il lettore delle funzioni di rotte")
            continue
        ops = operazioni(cid, righe, False)
        if ops:
            scrive = any(o["method"] != "GET" for o in ops.values())
            out[cid] = {
                "solaLettura": not scrive,
                "base": base,
                "data": DATA_SCRITTURE if scrive else DATA_LETTURE,
                "decisione": DECISIONE_LETTURE + ("; " + DECISIONE_SCRITTURE if scrive else ""),
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
        "_fonti": [ATLAS.replace("\\", "/"), PERIMETRI.replace("\\", "/"), CLASSI.replace("\\", "/")],
        "concepts": dati,
        # Prova dal vivo del 2026-11-20: una domanda sulle segnalazioni riceveva «nel catalogo non
        # c'è» invece del rifiuto. Il gateway deve sapere che questi concetti esistono e sono vietati.
        "esclusi": dict(sorted(FUORI_DALLE_LETTURE.items())),
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
