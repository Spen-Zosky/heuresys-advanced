#!/usr/bin/env python3
"""check_documenti.py — i documenti vivi dicono il vero? Controlli deterministici.

Voce R4 del piano `docs/piani/PIANO_riordino-documentazione_20261125.md` (automazioni
A1-A5 della sezione 5). Funziona su qualunque repo git: lo stesso file serve al datastore.

Che cosa è un documento vivo (il perimetro dei controlli):
  - ogni pagina sotto `docs/wiki/`;
  - ogni `.md` tracciato che in testa dichiara `stato: vivo` nel blocco di metadati;
  - i documenti di governo elencati in GOVERNO (CLAUDE.md, README, regole, skill).
Gli altri documenti (archivi, piani chiusi, misure) non sono controllati: sono storia.

Controlli (senza opzioni li fa tutti):
  --metadati     A1: chi ha un blocco di metadati usa dominio e natura dell'elenco chiuso,
                 una data `aggiornato_il` valida e `fonti` che esistono. Le pagine di
                 `docs/wiki/` (salvo index, log e indice analitico) devono averlo.
  --link         A2: i link relativi markdown e i rimandi `[[...]]` risolvono.
  --rimandi      A4: nessun documento vivo cita un documento ritirato (registro dei ritiri)
                 o un documento che si dichiara `stato: sostituito`.
  --affermazioni A5: nessun documento vivo contiene una frase vietata perché falsa
                 (`docs/wiki/affermazioni_vietate.txt`, una regex per riga, `#` commenta;
                 una riga `!percorso` esenta quel file).
  --freschezza   A3 (avviso, non rosso): una fonte cambiata dopo `aggiornato_il`.

Esce 0 se non ci sono rilievi rossi, 1 se ce ne sono, 2 se non ha potuto leggere.
"""
import argparse
import datetime
import os
import re
import subprocess
import sys

DOMINI = {
    "governo", "architettura", "dati-db", "api-backend", "frontend-ux", "sicurezza-accessi",
    "agenti-ia", "processi-organizzazione", "tassonomie-conoscenza", "consolidamento-tenant",
    "operazioni-infra", "qualita-verifica", "prodotto-visione", "stato-pianificazione",
    "storia-archivio",
}
NATURE = {"norma", "decisione", "riferimento", "stato", "piano", "esito", "generato", "modello",
          "dati", "scambio", "codice-doc"}
STATI = {"vivo", "chiuso", "sostituito"}
GOVERNO = (
    "CLAUDE.md", "README.md", ".claude/rules/", ".claude/skills/", "preflight/",
)
WIKI = "docs/wiki/"
WIKI_GENERATI = {"docs/wiki/index.md", "docs/wiki/log.md", "docs/wiki/indice-analitico.md"}
REGISTRI_RITIRI = (
    "docs/piani/riordino-documentazione_20261125/REGISTRO_RITIRI.tsv",
    "esecuzione/_misure/REGISTRO_RITIRI_20261125.tsv",
)
VIETATE = "docs/wiki/affermazioni_vietate.txt"

LINK_RE = re.compile(r"\[[^\]\n]*\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")
WIKI_RE = re.compile(r"\[\[([^\]|#\n]+)")
GENERATO_RE = re.compile(r"<!-- generato:\w+ -->.*?<!-- /generato -->", re.S)
CODICE_RE = re.compile(r"```.*?```", re.S)
INLINE_RE = re.compile(r"`[^`\n]*`")


def git(root, *args):
    return subprocess.check_output(["git", "-C", root, *args], text=True, stderr=subprocess.DEVNULL)


def metadati(testo):
    """Il blocco YAML in testa, letto riga per riga (chiave: valore; liste [a, b])."""
    if not testo.startswith("---\n"):
        return None
    fine = testo.find("\n---", 4)
    if fine < 0:
        return None
    m = {}
    for riga in testo[4:fine].splitlines():
        if ":" not in riga or riga.startswith((" ", "#")):
            continue
        k, v = riga.split(":", 1)
        v = v.split(" #", 1)[0].strip()
        if v.startswith("[") and v.endswith("]"):
            v = [x.strip().strip("'\"") for x in v[1:-1].split(",") if x.strip()]
        else:
            v = v.strip("'\"")
        m[k.strip()] = v
    return m


def main() -> int:
    ap = argparse.ArgumentParser()
    for o in ("metadati", "link", "rimandi", "affermazioni", "freschezza"):
        ap.add_argument(f"--{o}", action="store_true")
    ap.add_argument("--repo", default=".")
    ap.add_argument("--quieto", action="store_true", help="solo il riepilogo")
    ap.add_argument("--selftest", action="store_true", help="prova lo strumento su un repo finto")
    a = ap.parse_args()
    if a.selftest:
        return selftest()
    tutti = not any((a.metadati, a.link, a.rimandi, a.affermazioni, a.freschezza))
    try:
        root = git(a.repo, "rev-parse", "--show-toplevel").strip()
        tracciati = git(root, "ls-files").splitlines()
    except (subprocess.CalledProcessError, OSError) as e:
        print(f"NON MISURATO: {e}")
        return 2
    insieme = set(tracciati)
    cartelle = set()
    for p in tracciati:
        d = os.path.dirname(p)
        while d and d not in cartelle:
            cartelle.add(d)
            d = os.path.dirname(d)
    stemmi = {}
    for p in tracciati:
        if p.endswith(".md"):
            stemmi.setdefault(os.path.basename(p)[:-3], []).append(p)

    testi, meta = {}, {}
    for p in tracciati:
        if not p.endswith(".md"):
            continue
        try:
            with open(os.path.join(root, p), encoding="utf-8", errors="replace") as f:
                # i blocchi generati (build_wiki.py) riportano titoli e percorsi delle fonti:
                # sono dati, non affermazioni della pagina
                testi[p] = GENERATO_RE.sub("", f.read())
        except OSError:
            continue
        meta[p] = metadati(testi[p])

    def vivo(p):
        m = meta.get(p) or {}
        return p.startswith(WIKI) or m.get("stato") == "vivo" or p.startswith(GOVERNO) or p in GOVERNO

    vivi = sorted(p for p in testi if vivo(p))
    sostituiti = {p for p, m in meta.items() if m and m.get("stato") == "sostituito"}
    ritirati = {}
    for reg in REGISTRI_RITIRI:
        pieno = os.path.join(root, reg)
        if os.path.exists(pieno):
            with open(pieno, encoding="utf-8") as f:
                next(f, None)
                for riga in f:
                    c = riga.rstrip("\n").split("\t")
                    if c and c[0] and c[0] not in insieme:
                        ritirati[c[0]] = c[2][:9] if len(c) > 2 else "?"

    rossi, avvisi = [], []

    if tutti or a.metadati:
        for p in vivi:
            m = meta.get(p)
            # le regole e le skill hanno un blocco loro (paths, name): conta solo il nostro
            if m is None or "dominio" not in m:
                if p.startswith(WIKI) and p not in WIKI_GENERATI:
                    rossi.append(f"A1 {p}: pagina del wiki senza blocco di metadati")
                continue
            if m.get("dominio") not in DOMINI:
                rossi.append(f"A1 {p}: dominio «{m.get('dominio')}» fuori dall'elenco chiuso")
            if m.get("natura") not in NATURE:
                rossi.append(f"A1 {p}: natura «{m.get('natura')}» fuori dall'elenco chiuso")
            if m.get("stato") not in STATI:
                rossi.append(f"A1 {p}: stato «{m.get('stato')}» fuori dall'elenco chiuso")
            try:
                datetime.date.fromisoformat(str(m.get("aggiornato_il")))
            except ValueError:
                rossi.append(f"A1 {p}: aggiornato_il «{m.get('aggiornato_il')}» non è una data")
            fonti = m.get("fonti") or []
            for fo in fonti if isinstance(fonti, list) else [fonti]:
                fo = fo.rstrip("/")
                if fo not in insieme and fo not in cartelle:
                    rossi.append(f"A1 {p}: la fonte {fo} non esiste")

    def righe_utili(testo):
        # i blocchi di codice e il codice in linea non sono rimandi
        return INLINE_RE.sub("", CODICE_RE.sub(lambda m: "\n" * m.group(0).count("\n"), testo)).splitlines()

    if tutti or a.link or a.rimandi:
        for p in vivi:
            base = os.path.dirname(p)
            for n, riga in enumerate(righe_utili(testi[p]), 1):
                for dest in LINK_RE.findall(riga):
                    if re.match(r"^[a-z][a-z0-9+.-]*:", dest) or dest.startswith(("#", "/", "<")):
                        continue
                    dest = dest.split("#", 1)[0]
                    if not dest:
                        continue
                    t = os.path.normpath(os.path.join(base, dest)).replace(os.sep, "/")
                    if t in ritirati:
                        if tutti or a.rimandi:
                            rossi.append(f"A4 {p}:{n}: rimanda a {t}, ritirato (recupero da {ritirati[t]})")
                    elif t in sostituiti:
                        if tutti or a.rimandi:
                            rossi.append(f"A4 {p}:{n}: rimanda a {t}, che si dichiara sostituito")
                    elif t not in insieme and t not in cartelle and not os.path.exists(os.path.join(root, t)):
                        if tutti or a.link:
                            rossi.append(f"A2 {p}:{n}: link rotto verso {dest}")
                for w in WIKI_RE.findall(riga):
                    nome = w.strip().split("/")[-1]
                    nome = nome[:-3] if nome.endswith(".md") else nome
                    if nome not in stemmi and (tutti or a.link):
                        rossi.append(f"A2 {p}:{n}: rimando [[{w.strip()}]] senza pagina")
            if tutti or a.rimandi:
                for r in ritirati:
                    if r in testi[p]:
                        voce = f"A4 {p}: nomina {r}, ritirato (recupero da {ritirati[r]})"
                        if not any(x.startswith(f"A4 {p}:") and r in x for x in rossi):
                            rossi.append(voce)

    if tutti or a.affermazioni:
        pieno = os.path.join(root, VIETATE)
        regole, esenti = [], set()
        if os.path.exists(pieno):
            with open(pieno, encoding="utf-8") as f:
                for riga in f:
                    riga = riga.rstrip("\n")
                    if not riga.strip() or riga.lstrip().startswith("#"):
                        continue
                    if riga.startswith("!"):
                        esenti.add(riga[1:].strip())
                    else:
                        regole.append(re.compile(riga, re.I))
        for p in vivi:
            if p in esenti or p == VIETATE:
                continue
            for n, riga in enumerate(testi[p].splitlines(), 1):
                for r in regole:
                    if r.search(riga):
                        rossi.append(f"A5 {p}:{n}: affermazione vietata «{r.pattern}»")

    if tutti or a.freschezza:
        for p in vivi:
            m = meta.get(p) or {}
            try:
                d = datetime.date.fromisoformat(str(m.get("aggiornato_il")))
            except ValueError:
                continue
            fonti = m.get("fonti") or []
            for fo in fonti if isinstance(fonti, list) else [fonti]:
                try:
                    ult = git(root, "log", "-1", "--format=%cs", "--", fo).strip()
                except subprocess.CalledProcessError:
                    continue
                if ult and datetime.date.fromisoformat(ult) > d:
                    avvisi.append(f"A3 {p}: la fonte {fo} è cambiata il {ult}, dopo aggiornato_il {d}")

    if not a.quieto:
        for r in rossi:
            print("  [!!] " + r)
        for v in avvisi:
            print("  [..] " + v)
    print(f"check_documenti: {len(vivi)} documenti vivi, {len(rossi)} rilievi rossi, {len(avvisi)} avvisi"
          f" ({len(ritirati)} percorsi ritirati nel registro)")
    return 1 if rossi else 0


def selftest() -> int:
    """Una pagina con otto difetti deve dare otto rossi; corretta, zero."""
    import tempfile
    io = os.path.abspath(__file__)
    with tempfile.TemporaryDirectory() as t:
        def scrivi(rel, testo):
            os.makedirs(os.path.join(t, os.path.dirname(rel)), exist_ok=True)
            with open(os.path.join(t, rel), "w", encoding="utf-8") as f:
                f.write(testo)
        def gira():
            subprocess.check_call(["git", "-C", t, "add", "-A"])
            r = subprocess.run([sys.executable, io, "--repo", t], capture_output=True, text=True)
            return r.returncode, r.stdout.count("[!!]")
        subprocess.check_call(["git", "init", "-q", t])
        scrivi(VIETATE, "serve una chiave API\n")
        scrivi(REGISTRI_RITIRI[0], "path\tsha256\trecupero_da_commit\tlotto\tdata\ndocs/vecchio.md\tx\tabc123456\tB\t2026-11-25\n")
        scrivi("docs/wiki/domini/nuda.md", "# senza metadati\n")
        scrivi("docs/wiki/domini/prova.md", "---\ndominio: inventato\nnatura: riferimento\nstato: vivo\n"
               "aggiornato_il: 2026-13-01\nfonti: [apps/manca.ts]\n---\n"
               "Vedi [v](../../vecchio.md), [r](nonce.md), [[Fantasma]].\nQui serve una chiave API.\n")
        rosso = gira()
        meta = "---\ndominio: governo\nnatura: riferimento\nstato: vivo\naggiornato_il: 2026-11-25\nfonti: []\n---\n"
        scrivi("docs/wiki/domini/nuda.md", meta + "# ok\n")
        scrivi("docs/wiki/domini/prova.md", meta + "Vedi [n](nuda.md) e [[nuda]].\n")
        verde = gira()
    ok = rosso == (1, 8) and verde == (0, 0)
    print(f"selftest: rosso {rosso}, verde {verde} -> {'OK' if ok else 'FALLITO'}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
