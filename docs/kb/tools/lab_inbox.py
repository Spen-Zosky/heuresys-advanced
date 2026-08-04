#!/usr/bin/env python3
"""
lab_inbox.py — il canale AUTOMATICO lab -> canonica.

Il problema che risolve
-----------------------
Il design-lab sta fuori dal repo di proposito (sessioni parallele senza collisioni),
ma questo rendeva le sue consegne un PONTE MANUALE: un file di consegna da leggere,
una frase di Enzo, la memoria che «forse» viene notata. Questo strumento chiude il
giro: al boot la sessione canonica SCOPRE da sola cosa il lab ha depositato, sa
distinguere cio' che e' gia' stato ingerito (e in che stato e') da cio' che resta,
e puo' ingerire nel registro con un comando.

Il modello e' lo stesso di COWORK_INBOX (chi non puo' scrivere la SoT deposita, la
CLI riconcilia e committa), adattato al confine del filesystem.

Il contratto
------------
Il lab deposita UNA consegna per file in `<lab>/inbox/*.md`:

    ---
    lab-id: 2026-08-03-slug-stabile
    titolo: Titolo breve
    data: 2026-08-03
    ---
    (prosa libera per umani)
    ```markdown
    - **#NN Titolo del blocco** · status: ACTIVE
      - priority: P2 · effort: ~2h · doc: <path>
      - note: ...
    ```

`#NN` e' un segnaposto: il numero lo assegna l'ingestione (primo id libero del
registro). L'ingestione aggiunge al blocco la riga `lab-id:` — e' QUELLA la
tracciatura: da quel momento questo strumento vede la consegna come ingerita e ne
riporta lo stato leggendolo dal registro (ACTIVE/DONE/...). Il file ingerito viene
spostato in `<lab>/inbox/ingerite/` cosi' anche il lab vede il proprio registro.

Uso
---
    python lab_inbox.py               # riassunto per il boot (una riga se vuoto)
    python lab_inbox.py --blocchi     # i blocchi pronti da incollare, numerati
    python lab_inbox.py --ingest      # scrive i blocchi nel registro e sposta i file
                                      #   (poi: handoff_lint + commit, come sempre)

Cablaggio in session_start.py (in-process, come build_menu/status_dashboard):
    import lab_inbox
    print(lab_inbox.riassunto())
"""
from __future__ import annotations

import argparse
import os
import re
import sys

QUI = os.path.dirname(os.path.abspath(__file__))


def _radici() -> tuple[str, str]:
    """(repo, lab) — funziona sia installato in docs/kb/tools sia nella copia lab."""
    su2 = os.path.dirname(os.path.dirname(QUI))
    if os.path.basename(os.path.dirname(QUI)) == "kb":          # repo: docs/kb/tools
        repo = os.path.dirname(su2)
        lab = os.path.join(os.path.dirname(repo), "heuresys-design-lab")
    else:                                                        # lab: <lab>/tools
        lab = os.path.dirname(QUI)
        repo = os.path.join(os.path.dirname(lab), "heuresys-advanced")
    return (os.environ.get("HRX_REPO", repo), os.environ.get("HRX_LAB", lab))


REPO, LAB = _radici()
INBOX = os.path.join(LAB, "inbox")
INGERITE = os.path.join(INBOX, "ingerite")
REGISTRO = os.path.join(REPO, "docs", "kb", "SOT_BACKLOG.md")


def _leggi(path: str) -> str:
    with open(path, encoding="utf-8", errors="replace") as f:
        return f.read()


def consegne() -> list[dict]:
    """Le consegne depositate, con frontmatter e blocco estratti."""
    out = []
    if not os.path.isdir(INBOX):
        return out
    for nome in sorted(os.listdir(INBOX)):
        path = os.path.join(INBOX, nome)
        if not nome.endswith(".md") or not os.path.isfile(path):
            continue
        testo = _leggi(path)
        fm = re.match(r"^---\n(.*?)\n---\n", testo, re.S)
        campi = dict(re.findall(r"^([a-z-]+):\s*(.+)$", fm.group(1), re.M)) if fm else {}
        blocco = re.search(r"```markdown\n(.*?)```", testo, re.S)
        out.append({"file": nome, "path": path,
                    "lab_id": campi.get("lab-id", ""),
                    "titolo": campi.get("titolo", nome),
                    "blocco": blocco.group(1).rstrip() if blocco else "",
                    "valida": bool(campi.get("lab-id")) and bool(blocco)})
    return out


def stato_nel_registro(lab_id: str, registro: str) -> str | None:
    """None = mai ingerita; altrimenti lo status del blocco che la contiene."""
    if f"lab-id: {lab_id}" not in registro:
        return None
    blocchi = re.split(r"(?=^- \*\*#)", registro, flags=re.M)
    for b in blocchi:
        if f"lab-id: {lab_id}" in b:
            m = re.search(r"· status: ([A-Z'-]+)", b)
            return m.group(1) if m else "?"
    return "?"


def prossimo_id(registro: str) -> int:
    numeri = [int(n) for n in re.findall(r"^- \*\*#(\d+)", registro, re.M)]
    return (max(numeri) + 1) if numeri else 1


def riassunto() -> str:
    """La sezione per il boot. Una riga sola se non c'e' niente di nuovo."""
    if not os.path.isdir(INBOX):
        return ""          # nessun lab su questa macchina: silenzio totale
    registro = _leggi(REGISTRO) if os.path.exists(REGISTRO) else ""
    nuove, ingerite, rotte = [], [], []
    for c in consegne():
        if not c["valida"]:
            rotte.append(c["file"])
            continue
        st = stato_nel_registro(c["lab_id"], registro)
        (nuove if st is None else ingerite).append((c, st))
    righe = []
    if nuove:
        righe.append(f"📥 LAB INBOX — {len(nuove)} consegne dal design-lab NON ancora nel registro:")
        for c, _ in nuove:
            righe.append(f"   · {c['titolo']}  ({c['file']})")
        righe.append("   Ingestione: python docs/kb/tools/lab_inbox.py --ingest   (poi lint + commit)")
    for c, st in ingerite:
        if st not in ("DONE", "FATTO", "WON'T-DO"):
            righe.append(f"   (lab, gia' nel registro, {st}: {c['titolo']})")
    if rotte:
        righe.append(f"   ⚠ consegne malformate (senza lab-id o blocco): {', '.join(rotte)}")
    return "\n".join(righe)


def blocchi_pronti() -> str:
    registro = _leggi(REGISTRO)
    n = prossimo_id(registro)
    fuori = []
    for c in consegne():
        if not c["valida"] or stato_nel_registro(c["lab_id"], registro) is not None:
            continue
        b = c["blocco"].replace("#NN", f"#{n}", 1)
        b += f"\n  - lab-id: {c['lab_id']}"
        fuori.append(b)
        n += 1
    return "\n\n".join(fuori) if fuori else "(niente da ingerire)"


def ingerisci() -> str:
    registro = _leggi(REGISTRO)
    da_fare = [c for c in consegne()
               if c["valida"] and stato_nel_registro(c["lab_id"], registro) is None]
    if not da_fare:
        return "niente da ingerire"
    n = prossimo_id(registro)
    nuovi = []
    for c in da_fare:
        b = c["blocco"].replace("#NN", f"#{n}", 1) + f"\n  - lab-id: {c['lab_id']}"
        nuovi.append(b)
        c["id_assegnato"] = n
        n += 1
    # inserimento in testa allo store: subito prima del primo blocco esistente
    m = re.search(r"^- \*\*#", registro, re.M)
    if not m:
        return "registro senza blocchi: non so dove inserire"
    nuovo_testo = registro[:m.start()] + "\n\n".join(nuovi) + "\n\n" + registro[m.start():]
    with open(REGISTRO, "w", encoding="utf-8", newline="\n") as f:
        f.write(nuovo_testo)
    os.makedirs(INGERITE, exist_ok=True)
    esiti = []
    for c in da_fare:
        os.replace(c["path"], os.path.join(INGERITE, c["file"]))
        esiti.append(f"#{c['id_assegnato']} «{c['titolo']}» (lab-id {c['lab_id']})")
    return ("ingerite nel registro: " + " · ".join(esiti) +
            "\nOra: python docs/kb/tools/handoff_lint.py e commit (docs/kb e' SoT).")


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--blocchi", action="store_true")
    p.add_argument("--ingest", action="store_true")
    a = p.parse_args()
    if a.ingest:
        print(ingerisci())
    elif a.blocchi:
        print(blocchi_pronti())
    else:
        r = riassunto()
        print(r if r else "lab inbox: vuota")
    return 0


if __name__ == "__main__":
    sys.exit(main())
