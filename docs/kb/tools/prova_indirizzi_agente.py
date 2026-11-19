#!/usr/bin/env python3
"""
prova_indirizzi_agente.py — ogni operazione di lettura dell'agente va a un indirizzo che l'API ha.

PERCHÉ (ondata 4 degli endpoint senza consumatori, 2026-11-18). Il catalogo generico dell'agente
(`hrx_entity_query`) chiamava `/v1/<concetto><percorso>`. Per i moduli che l'API monta altrove
(`semantic-matching` sotto `/v1/matching`, `capability-*` sotto `/v1/capability`, `public-*` sotto
`/v1/public`) ogni lettura finiva su un indirizzo inesistente: 18 su 376 rispondevano 404 prima
della correzione. Questa prova lo misura dal vivo, senza credenziali: una rotta che esiste e chiede
l'accesso risponde 401 (o 400 sui parametri); una rotta che non esiste risponde 404.

Non legge dati e non scrive niente: senza sessione l'API si ferma all'autenticazione.

  python docs/kb/tools/prova_indirizzi_agente.py                       # API su http://localhost:8013
  python docs/kb/tools/prova_indirizzi_agente.py --api https://host    # altrove
  python docs/kb/tools/prova_indirizzi_agente.py --come-prima          # la base di prima, per confronto

Esce 1 se una lettura va a un indirizzo che l'API non ha (404), salvo le rotte pubbliche di
dettaglio, dove 404 è la risposta giusta a un identificativo inventato.
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from collections import Counter

MAPPA = os.path.join("docs", "kb", "atlas", "agent-operations.json")
FINTO = "00000000-0000-4000-8000-000000000000"
# Rotte senza autenticazione: con un identificativo inventato rispondono 404 perché la riga non
# c'è, non perché la rotta manchi. Si elencano per nome, mai per modulo intero.
PUBBLICHE_DI_DETTAGLIO = {("public-job-postings", "get_job_postings_by_id")}


def codice(url):
    for _ in range(8):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, method="GET"), timeout=15) as r:
                return r.status
        except urllib.error.HTTPError as e:
            if e.code == 429:  # il limitatore dell'API: si aspetta, non si conta
                time.sleep(20)
                continue
            return e.code
        except urllib.error.URLError as e:
            raise SystemExit("NON MISURABILE: l'API non risponde (%s)" % e)
    raise SystemExit("NON MISURABILE: l'API continua a rispondere 429")


def main():
    api = "http://localhost:8013"
    if "--api" in sys.argv:
        api = sys.argv[sys.argv.index("--api") + 1].rstrip("/")
    come_prima = "--come-prima" in sys.argv
    concetti = json.load(open(MAPPA, encoding="utf-8"))["concepts"]
    esiti, rotte_mancanti = Counter(), []
    for cid, v in sorted(concetti.items()):
        base = "/" + cid if come_prima else (v.get("base") or "/" + cid)
        for oid, op in sorted(v["operations"].items()):
            if op["method"] != "GET":
                continue
            percorso = re.sub(r":[A-Za-z_][A-Za-z0-9_]*", FINTO, op["path"])
            url = api + "/v1" + ("" if base == "/" else base) + ("" if percorso == "/" else percorso)
            c = codice(url)
            esiti[c] += 1
            if c == 404 and (cid, oid) not in PUBBLICHE_DI_DETTAGLIO:
                rotte_mancanti.append("%s.%s -> %s" % (cid, oid, url[len(api):]))
            time.sleep(0.3)
    print("letture dell'agente: %d · esiti %s" % (sum(esiti.values()), dict(sorted(esiti.items()))))
    for r in rotte_mancanti:
        print("  [404] " + r)
    print("ROSSO: %d letture vanno a un indirizzo che l'API non ha" % len(rotte_mancanti)
          if rotte_mancanti else "VERDE: ogni lettura va a una rotta che l'API ha")
    return 1 if rotte_mancanti else 0


if __name__ == "__main__":
    sys.exit(main())
