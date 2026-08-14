# -*- coding: utf-8 -*-
"""#159 F1 — il criterio di idoneita', APPLICATO all'elenco reale delle pagine.

Una scheda e' idonea a ospitare l'assistente se supera QUATTRO prove, in quest'ordine.
Ognuna e' meccanica: si legge dal codice, non si giudica a occhio.

  P1 AUTENTICATA   sta sotto (authenticated). Fuori restano vetrina, login, landing:
                   non c'e' sessione da inoltrare, quindi i permessi non si applicano
                   (decisione vincolante 3 del programma: li applica il server sulla
                   sessione inoltrata).
  P2 HA UN DATO    la pagina interroga almeno un endpoint /v1/*. Se non ne ha, l'agente
                   non ha nulla da leggere: il ponte porterebbe una conversazione su una
                   pagina muta.
  P3 CONTESTO      il contesto di pagina e' esprimibile come PARAMETRO LIBERO — la rotta
                   ha un segmento dinamico [x], oppure e' una vista d'insieme senza
                   parametri. Entrambe si passano al ponte come un valore, non come un
                   ramo condizionale per tipo di pagina (decisione vincolante 2).
  P4 NON PRESIDIO  non e' una superficie di servizio (lo strumento stesso, la salute del
                   sistema, la provenienza dei dati, le corse di acquisizione) ne' una
                   superficie a isolamento assoluto (whistleblowing, ADR-0036 §5: li'
                   non arriva nemmeno il mandato tecnico).
"""
import os, re, json

ROOT = os.path.join("apps", "web", "src", "app")

# P4 — l'elenco delle esclusioni, una per una, col motivo. Mai un carattere jolly.
PRESIDIO = {
    "dev/agent": "e' lo strumento stesso: il pilota del gateway, non una scheda di dominio",
    "system-health": "superficie di servizio: stato dei processi, non dato di dominio",
    "provenance": "superficie di servizio: da dove vengono i dati, e' governo della piattaforma",
    "seed-acquisition/runs": "superficie di servizio: le corse di acquisizione",
    "whistleblowing-console": "isolamento assoluto (ADR-0036 §5): non vi arriva nemmeno il mandato tecnico",
    "admin/mfa-policy": "superficie di piattaforma: politica del secondo fattore",
    "admin/roles": "superficie di piattaforma: la matrice RBAC",
}

RX_V1 = re.compile(r'["\'`]/v1/')


def chiama_v1(src: str, dirpath: str = "") -> bool:
    """La pagina interroga /v1/* — direttamente o tramite i componenti che importa.

    Una pagina SOTTILE delega a componenti: cercare solo nel suo file la dichiara muta
    mentre parla per bocca d'altri. Misurato: /job-catalog (37 righe), /skill-taxonomy
    (42) e /me/career erano tre falsi negativi esattamente di questo tipo.
    """
    if RX_V1.search(src):
        return True
    basi = [os.path.join("apps", "web", "src", *imp.split("/"))
            for imp in re.findall(r'from\s+"@/([a-zA-Z0-9/._-]+)"', src)]
    # …e gli import RELATIVI, che sono la forma piu' comune per i pannelli di una pagina
    # (`./_components/job-families-panel`). Senza questi, /job-catalog risultava muta.
    basi += [os.path.normpath(os.path.join(dirpath, imp))
             for imp in re.findall(r'from\s+"(\./[a-zA-Z0-9/._-]+)"', src)] if dirpath else []
    for base in basi:
        for cand in (base + ".tsx", base + ".ts", os.path.join(base, "index.tsx")):
            if os.path.isfile(cand):
                try:
                    if RX_V1.search(open(cand, encoding="utf-8", errors="replace").read()):
                        return True
                except OSError:
                    pass
    return False


def pagine():
    for dirpath, _dirs, files in os.walk(ROOT):
        if "page.tsx" not in files:
            continue
        rel = os.path.relpath(dirpath, ROOT).replace("\\", "/")
        yield ("" if rel == "." else rel), os.path.join(dirpath, "page.tsx")

def rotta(rel: str) -> str:
    """La rotta pubblica: i gruppi (x) non compaiono nell'URL."""
    parti = [p for p in rel.split("/") if p and not (p.startswith("(") and p.endswith(")"))]
    return "/" + "/".join(parti)

idonee, non_idonee = [], []
for rel, path in pagine():
    src = open(path, encoding="utf-8", errors="replace").read()
    r = rotta(rel)
    chiave = r.lstrip("/")

    if "(authenticated)" not in rel:
        non_idonee.append((r, "P1 non autenticata"))
        continue
    if chiave in PRESIDIO:
        non_idonee.append((r, "P4 " + PRESIDIO[chiave]))
        continue
    # P2: interroga almeno un endpoint /v1/* — anche via un hook o un componente vicino?
    # Si guarda il file della pagina: se la chiamata sta altrove, la pagina la compone e
    # il riscontro resta assente. Il caso e' dichiarato, non nascosto.
    if not chiama_v1(src, os.path.dirname(path)):
        non_idonee.append((r, "P2 nessun endpoint /v1/*, ne' diretto ne' nei componenti importati"))
        continue
    # P3: parametrica (segmento [x]) oppure vista d'insieme. Entrambe idonee: cio' che
    # conta e' che il contesto sia UN VALORE.
    tipo = "parametrica" if "[" in rel else "insieme"
    idonee.append((r, tipo))

if not (idonee or non_idonee):
    raise SystemExit("NON MISURABILE: nessuna pagina trovata sotto %s — "
                     "eseguire dalla radice del repo. Uno zero silenzioso qui "
                     "sarebbe un falso verde." % ROOT)
idonee.sort(); non_idonee.sort()
print("=" * 78)
print(" #159 F1 — IDONEITA' DELLE SCHEDE, applicata all'elenco reale")
print("=" * 78)
tot = len(idonee) + len(non_idonee)
print("  pagine totali            %4d" % tot)
print("  IDONEE                   %4d   (%d parametriche, %d d'insieme)"
      % (len(idonee), sum(1 for _, t in idonee if t == "parametrica"),
         sum(1 for _, t in idonee if t == "insieme")))
print("  non idonee               %4d" % len(non_idonee))
for prova in ("P1", "P2", "P4"):
    n = sum(1 for _, m in non_idonee if m.startswith(prova))
    print("      %s                   %4d" % (prova, n))
print("-" * 78)
print("  IDONEE:")
for r, t in idonee:
    print("    %-52s %s" % (r, t))
print("-" * 78)
print("  NON IDONEE (col motivo, una per una):")
for r, m in non_idonee:
    print("    %-52s %s" % (r, m))
json.dump({"idonee": idonee, "non_idonee": non_idonee},
          open("idoneita.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
