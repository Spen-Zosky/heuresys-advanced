# -*- coding: utf-8 -*-
"""#156 — i perimetri su cui l'agente porta valore, applicati al catalogo reale dei moduli.

LA DOTTRINA, che viene prima del criterio (Enzo, 2026-08-16):
**l'agente va applicato a qualunque perimetro nel quale puo' portare valore aggiunto.**
E' la stessa direzione gia' data per #159 il 2026-08-13 — «in TUTTE le schede che hanno
i requisiti», non in una scelta a mano — e vale identica qui. Conseguenza sulla forma di
questo strumento: NON produce «un candidato fra cui scegliere», produce una **coda di
adozione**. La domanda non e' *quale*, e' *in che ordine* — e l'ordine e' il rischio
crescente, perche' si comincia da dove un errore costa meno.

Il gemello `check_idoneita_agente.py` risponde alla domanda di #159: quali PAGINE possono
ospitare l'assistente. Questo risponde a quella di #156: su quali DATI puo' leggere.
L'unita' non e' la pagina ne' la tabella: e' il **modulo API** — ADR-0033 §2, ed e' il
livello che l'agente deve scegliere per poi agire. Le due domande sono state confuse una
volta in `.handoff/STATE.md`, che attribuiva a #156 le «83 idonee» di #159 (corretto il
2026-08-16): universi diversi, cardinalita' diverse, fonti diverse.

TRE PROVE, tutte meccaniche — si leggono dal codice, non si giudicano a occhio:

  V1 HA UNA LETTURA   almeno una rotta GET. Senza, non c'e' nulla da leggere.
  V2 NON E' PRESIDIO  non e' una superficie di servizio/piattaforma ne' a isolamento
                      assoluto. Elencate UNA PER UNA col motivo, mai un jolly.
  V3 QUALCUNO GUARDA  almeno un suo endpoint e' consumato da una pagina web. E' la forma
                      misurabile di «porta valore aggiunto»: se nessuna superficie mostra
                      quei dati, non esiste il momento in cui un utente farebbe li' una
                      domanda. Non e' un divieto permanente — diventa vero da se' il
                      giorno che nasce la pagina, ed e' per questo che si ri-esegue.

POI L'ORDINE, che non e' un'ammissione ma una precedenza:
  APERTO      gia' deciso e in adozione. Oggi uno.
  IN CODA     ordinati per rischio: prima chi non tocca dati di persona, poi le quattro
              classi riservate. Riservato NON vuol dire escluso: i permessi si applicano
              comunque sulla sessione inoltrata (ADR-0033 §3). Vuol dire dopo.

DUE ONESTA' CHE LO STRUMENTO DEVE AVERE:
  1. L'atlante e' GENERATO e invecchia. Qui si pretende **fresco**: se il codice che
     descrive e' cambiato dopo la sua generazione, questo strumento si ferma invece di
     misurare il passato (Enzo, 2026-08-16: «l'atlante deve essere sempre aggiornato e mai
     fermo a qualcosa di superato o incompleto»). Lo stesso controllo vive nella dashboard
     di avvio, cosi' nessuno deve ricordarselo.
  2. Un universo vuoto e' `NON MISURABILE`, non «nessun candidato». Il gemello stampava
     «0 pagine» senza protestare fuori radice: un falso verde perfetto. Qui i rami ciechi
     protestano ognuno per se', con la causa e il rimedio.

  python docs/kb/tools/check_concetti_agente.py             # la coda
  python docs/kb/tools/check_concetti_agente.py --riservati # anche le 4 classi riservate
  python docs/kb/tools/check_concetti_agente.py --tollera-atlante-vecchio
  python docs/kb/tools/check_concetti_agente.py --json out.json
"""
import os
import re
import io
import sys
import json
import subprocess

MODULI = os.path.join("apps", "api", "src", "modules")
ATLANTE = os.path.join("docs", "kb", "atlas", "atlas.yaml")
CLASSI = os.path.join("apps", "api", "src", "lib", "scope", "data-classes.ts")
# I percorsi che l'atlante descrive: se nessuno e' cambiato, l'atlante e' ancora vero.
FONTI_ATLANTE = ("apps/api/src/modules", "apps/web/src/app",
                 "packages/shared/src/schemas", "db/migrations")

# La coda di adozione, con la sua data. Cresce: non e' «la scelta», e' cio' che e' gia'
# entrato. Finche' e' una riga sola, e' il primo passo di un'adozione generale.
APERTI = {
    "organization-units":
        "Enzo, 2026-08-16 — PRIMO perimetro in sola lettura, non l'unico. Coerente con la "
        "decisione dello stesso giorno su #193: l'organigramma e' rubrica aziendale, "
        "visibile a chiunque lavori in azienda",
}

# V2 — le esclusioni, una per una. Un jolly qui nasconderebbe il giorno in cui un modulo
# nuovo cade in una di queste famiglie senza che nessuno lo noti.
ESCLUSI = {
    "whistleblowing":
        "isolamento assoluto (ADR-0036 §5): non vi arriva nemmeno il mandato tecnico",
    "auth":
        "credenziali e sessioni: le governa il mandato tecnico, non si leggono per dominio",
    "mfa-policy":
        "superficie di piattaforma: politica del secondo fattore",
    "gdpr":
        "superficie di governo: richieste dell'interessato, con procedura propria",
    "observability":
        "superficie di servizio: stato dei processi, non dato di dominio",
    "provenance":
        "superficie di servizio: da dove vengono i dati, e' governo della piattaforma",
    "reference-sync":
        "superficie di servizio: la sincronizzazione ISTAT/ATECO/ESCO",
    "seed-acquisition-runs":
        "superficie di servizio: le corse di acquisizione",
    "seed-approval-decisions":
        "superficie di servizio: le approvazioni delle corse di acquisizione",
    "seed-candidate-records":
        "superficie di servizio: i candidati grezzi di una corsa di acquisizione",
    "tenant-materialization":
        "superficie di piattaforma: la materializzazione di un tenant",
    "leads":
        "superficie commerciale: contatti raccolti dal sito pubblico, non dato di dominio",
}

RISERVATE = ("PERSONAL", "COMPENSATION", "SKILL", "EVALUATION")


def ceco(cosa, rimedio):
    raise SystemExit("NON MISURABILE: %s.\n  %s\n  Uno zero silenzioso qui sarebbe un "
                     "falso verde." % (cosa, rimedio))


# ---------------------------------------------------------------- 1. moduli su disco
# La verita' di OGGI: l'atlante puo' essere indietro, il filesystem no.
if not os.path.isdir(MODULI):
    ceco("la cartella dei moduli non esiste sotto %s" % MODULI, "eseguire dalla radice del repo")
moduli = sorted(d for d in os.listdir(MODULI) if os.path.isdir(os.path.join(MODULI, d)))
if not moduli:
    ceco("nessun modulo trovato sotto %s" % MODULI, "eseguire dalla radice del repo")

# ---------------------------------------------------------------- 2. atlante, e dev'essere fresco
try:
    import yaml
except ImportError:
    ceco("il modulo python `yaml` non e' installato",
         "pip install pyyaml — senza atlante non si leggono le rotte")
if not os.path.isfile(ATLANTE):
    ceco("l'atlante non esiste in %s" % ATLANTE, "python docs/kb/tools/build_atlas.py")
atlas = yaml.safe_load(io.open(ATLANTE, encoding="utf-8").read()) or {}
api = atlas.get("api") or {}
if not api:
    ceco("l'atlante non contiene alcun modulo sotto `api:`", "python docs/kb/tools/build_atlas.py")
gen = ((atlas.get("meta") or {}).get("generated_from_commit") or "").strip('"')
try:
    cambiati = subprocess.check_output(
        ["git", "diff", "--name-only", gen + "..HEAD", "--"] + list(FONTI_ATLANTE),
        stderr=subprocess.DEVNULL).decode().split() if gen else None
except Exception:
    cambiati = None
if cambiati and "--tollera-atlante-vecchio" not in sys.argv:
    ceco("l'atlante e' SUPERATO — %d file di sorgente cambiati dopo %s, quindi i moduli "
         "nati dopo non ci sono e le rotte mostrate sono quelle di allora"
         % (len(cambiati), gen[:8]),
         "python docs/kb/tools/build_atlas.py  (oppure --tollera-atlante-vecchio, "
         "sapendo che si sta misurando il passato)")

# ---------------------------------------------------------------- 3. classi di dato
if not os.path.isfile(CLASSI):
    ceco("le classi di dato non esistono in %s" % CLASSI, "eseguire dalla radice del repo")
src = io.open(CLASSI, encoding="utf-8").read()


def elenco(nome):
    m = re.search(r"export const %s[^=]*=\s*\{(.*?)\n\};" % nome, src, re.S)
    if not m:
        return {}
    return {c.group(1).strip('"'): c.group(2) for c in
            re.finditer(r'^\s*([A-Za-z_][A-Za-z0-9_]*|"[^"]+")\s*:\s*"([^"]*)"', m.group(1), re.M)}


CLASSE = elenco("RESOURCE_DATA_CLASS")
NO_PERSONE = elenco("RESOURCE_SENZA_DATI_DI_PERSONA")
MULTI = elenco("RESOURCE_MULTICLASSE")
DA_DECIDERE = elenco("RESOURCE_DA_DECIDERE")
if not CLASSE:
    ceco("nessuna classe di dato letta da %s" % CLASSI,
         "la forma di RESOURCE_DATA_CLASS e' cambiata: adeguare la lettura")

# ---------------------------------------------------------------- 4. V3, chi lo guarda
consumati = ((atlas.get("cross") or {}).get("endpoints_with_web_consumers") or {})
if not consumati:
    ceco("l'atlante non dichiara alcun consumatore web (`cross.endpoints_with_web_consumers`)",
         "rigenerarlo: senza quella mappa V3 non e' misurabile e ogni modulo sembrerebbe muto")

# ---------------------------------------------------------------- 5. il quadro
aperti, neutri, riservati, esclusi, senza_lettura, senza_superficie = [], [], [], [], [], []

for mod in moduli:
    if mod in ESCLUSI:                                        # V2
        esclusi.append((mod, ESCLUSI[mod]))
        continue
    info = api.get(mod)
    if info is None:
        # Con l'atlante fresco non puo' accadere; con --tollera-atlante-vecchio si'.
        senza_lettura.append((mod, "assente dall'atlante (atlante vecchio tollerato)"))
        continue
    rotte = info.get("routes") or []
    get = [r for r in rotte if (r.get("method") or "").upper() == "GET"]
    if not get:                                               # V1
        senza_lettura.append((mod, "nessuna rotta GET"))
        continue
    prefissi = info.get("prefixes") or []
    pagine = sorted({p for ep, pp in consumati.items()
                     if any(ep.startswith(x) for x in prefissi) for p in pp})
    risorse = sorted({(r.get("permission") or ":").split(":")[0] for r in get if r.get("permission")})
    classi, ignote = set(), []
    for r in risorse:
        if r in CLASSE:
            classi.add(CLASSE[r])
        elif r in NO_PERSONE:
            classi.add("nessun dato di persona")
        elif r in MULTI:
            classi.add("piu' classi")
        elif r in DA_DECIDERE:
            classi.add("dubbio dichiarato")
        else:
            ignote.append(r)
    et = ", ".join(sorted(classi)) or "-"
    if ignote:
        et = (et + " · non classificate: " + ",".join(ignote)).lstrip("- ").strip()
    riga = (mod, len(get), len(pagine), et)
    if mod in APERTI:
        aperti.append((mod, len(get), len(pagine), APERTI[mod]))
    elif not pagine:                                          # V3
        senza_superficie.append(riga)
    elif classi & set(RISERVATE):
        riservati.append(riga)
    else:
        neutri.append(riga)

coda = len(neutri) + len(riservati)
print("=" * 92)
print(" #156 — PERIMETRI DELL'AGENTE: la coda di adozione, dal catalogo reale")
print(" dottrina: ovunque porti valore aggiunto — la domanda e' l'ORDINE, non la scelta")
print("=" * 92)
print("  moduli su disco (oggi)          %4d" % len(moduli))
print("  atlante                         %s" % ("fresco (da %s)" % gen[:8] if not cambiati
                                                else "VECCHIO, tollerato su richiesta"))
print("  V2 esclusi (presidio/isolam.)   %4d" % len(esclusi))
print("  V1 senza alcuna lettura         %4d" % len(senza_lettura))
print("  V3 nessuna pagina li mostra     %4d   (non un divieto: cambia quando nasce la pagina)"
      % len(senza_superficie))
print("  ---")
print("  GIA' APERTI                     %4d" % len(aperti))
print("  IN CODA                         %4d   (%d neutri, poi %d riservati)"
      % (coda, len(neutri), len(riservati)))
print("-" * 92)
print("  APERTI — in adozione, con la loro data:")
if not aperti:
    print("    (nessuno — la coda non e' ancora partita)")
for m, n, pg, perche in aperti:
    print("    %-32s %2d letture · %d pagine" % (m, n, pg))
    print("        %s" % perche)
print("-" * 92)
print("  IN CODA — neutri per primi (nessun dato di persona), per ampiezza di lettura:")
for m, n, pg, et in sorted(neutri, key=lambda x: (-x[1], -x[2])):
    print("    %-32s %2d letture · %d pagine   %s" % (m, n, pg, et))
if "--riservati" in sys.argv:
    print("-" * 92)
    print("  IN CODA — riservati (4 classi). Non esclusi: dopo.")
    for m, n, pg, et in sorted(riservati, key=lambda x: (-x[1], -x[2])):
        print("    %-32s %2d letture · %d pagine   %s" % (m, n, pg, et))
else:
    print("-" * 92)
    print("  IN CODA — riservati: %d moduli, `--riservati` per l'elenco" % len(riservati))
print("-" * 92)
print("  V3 — nessuna pagina li mostra oggi (l'agente non avrebbe un contesto dove servire):")
for m, n, pg, et in sorted(senza_superficie):
    print("    %-32s %2d letture   %s" % (m, n, et))
print("-" * 92)
print("  V2 — esclusi, col motivo, uno per uno:")
for m, perche in sorted(esclusi):
    print("    %-32s %s" % (m, perche))

if "--json" in sys.argv:
    i = sys.argv.index("--json")
    if i + 1 >= len(sys.argv):
        raise SystemExit("--json vuole un percorso")
    with io.open(sys.argv[i + 1], "w", encoding="utf-8", newline="\n") as fh:
        json.dump({"atlante": gen, "atlante_vecchio": bool(cambiati),
                   "aperti": aperti, "neutri": neutri, "riservati": riservati,
                   "senza_superficie": senza_superficie, "senza_lettura": senza_lettura,
                   "esclusi": esclusi}, fh, ensure_ascii=False, indent=1)
    print("\n  scritto: %s" % sys.argv[i + 1])
