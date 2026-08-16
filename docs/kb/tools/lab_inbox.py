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

# --- stdout utf-8 (2026-08-16) -------------------------------------------------
# Su Windows, con stdout NON terminale, Python sceglie la codepage ANSI (cp1252) e
# ogni carattere fuori repertorio fa morire la print con UnicodeEncodeError — exit 1.
# Qui muoiono il verdetto del guardiano, i titoli con frecce, le emoji del riassunto.
# `errors="replace"` e' la rete: uno strumento di misura non deve morire di tipografia.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
# -------------------------------------------------------------------------------

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


def citato(lab_id: str, testo: str) -> bool:
    """Vero se `testo` cita ESATTAMENTE questo lab-id (#129).

    Prima si cercava la sottostringa `lab-id: <id>`, e un id che e' PREFISSO di un
    altro veniva scambiato per il suo omonimo piu' lungo. Due danni misurati in
    direzioni opposte, entrambi eseguiti e non dedotti: una consegna nuova risultava
    gia' ingerita e spariva dal canale (boot, `--ingest` e il controllo L1 falliscono
    insieme, perche' condividono questo stesso predicato), e in L2 una voce risultava
    gemellata a quella sbagliata, rompendo la traccia.

    Il confronto e' ancorato a inizio e fine riga. Il trattino iniziale resta
    OPZIONALE: nel registro la riga e' `  - lab-id: X`, nel frontmatter del file di
    consegna e' `lab-id: X` senza trattino — pretenderlo renderebbe orfani tutti i
    gemelli, che e' il difetto opposto e altrettanto grave.
    """
    return re.search(rf"^[ \t]*-?[ \t]*lab-id:[ \t]*{re.escape(lab_id)}[ \t]*$",
                     testo, re.M) is not None


def stato_nel_registro(lab_id: str, registro: str) -> str | None:
    """None = mai ingerita; altrimenti lo status del blocco che la contiene."""
    if not citato(lab_id, registro):
        return None
    blocchi = re.split(r"(?=^- \*\*#)", registro, flags=re.M)
    for b in blocchi:
        if citato(lab_id, b):
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


def id_citati(registro: str) -> set[int]:
    return {int(n) for n in re.findall(r"^- \*\*#(\d+)", registro, re.M)}


def classifica(blocco: str, registro: str) -> tuple[str, int | None]:
    """Che cosa e' questo blocco? ('nuova'|'aggiornamento'|'numero-proprio', id).

    Nasce dal difetto misurato il 2026-08-16 (voce #200): `ingerisci` sostituiva
    `#NN` con `str.replace`, che NON dice se ha sostituito. Un blocco che portava
    gia' `#196` entrava tale e quale, e nel registro finivano due `#196`.

    Qui la domanda si fa PRIMA e in modo esplicito, cosi' l'assenza del segnaposto
    smette di essere un non-evento.

    La domanda si fa sull'INTESTAZIONE, non sul testo (canonica 2026-08-16). La
    prima stesura chiedeva `"#NN" in blocco`, cioe' guardava tutto il corpo: un
    blocco intestato `- **#196` che citasse `#NN` piu' sotto — cosa che le consegne
    di questo lab fanno spesso, perche' parlano del meccanismo stesso — risultava
    «nuova», e la sostituzione colpiva la CITAZIONE lasciando il numero vero in
    testa. Misurato su un lab finto: due `#196` nel registro, cioe' il difetto #200
    che rientra dalla finestra dalla porta della sua stessa correzione.
    """
    m = re.match(r"\s*- \*\*#(NN|\d+)", blocco)
    if not m:
        return ("numero-proprio", None)        # ne' segnaposto ne' numero: malformato
    if m.group(1) == "NN":
        return ("nuova", None)
    num = int(m.group(1))
    return ("aggiornamento" if num in id_citati(registro) else "numero-proprio", num)


def numera(blocco: str, n: int) -> str:
    """Il segnaposto si sostituisce SOLO nell'intestazione (canonica 2026-08-16).

    Gemella di `classifica`: se quella decide guardando l'intestazione, questa deve
    scrivere nello stesso punto, o le due possono divergere. `str.replace(..., 1)`
    colpirebbe la prima occorrenza ovunque essa sia.
    """
    return re.sub(r"^(\s*- \*\*#)NN", rf"\g<1>{n}", blocco, count=1)


def blocchi_pronti() -> str:
    registro = _leggi(REGISTRO)
    n = prossimo_id(registro)
    fuori = []
    for c in consegne():
        if not c["valida"] or stato_nel_registro(c["lab_id"], registro) is not None:
            continue
        specie, num = classifica(c["blocco"], registro)
        if specie != "nuova":
            fuori.append(f"(NON ingeribile — {specie}"
                         + (f" di #{num}" if num else "") + f": {c['file']})")
            continue
        b = numera(c["blocco"], n)
        b += f"\n  - lab-id: {c['lab_id']}"
        fuori.append(b)
        n += 1
    return "\n\n".join(fuori) if fuori else "(niente da ingerire)"


def _referto_respinte(respinte: list) -> str:
    """Cosa NON e' stato ingerito, e perche'. Il file resta dov'e'."""
    if not respinte:
        return ""
    righe = [f"⚠ {len(respinte)} consegne NON ingerite (restano in inbox/):"]
    for c, specie, num in respinte:
        if specie == "aggiornamento":
            righe.append(f"   · {c['file']}")
            righe.append(f"     e' una PROPOSTA DI AGGIORNAMENTO per #{num}, che gia' esiste. "
                         f"Ingerirla creerebbe un secondo #{num} (e' il difetto #200).")
            righe.append(f"     Apri #{num} nel registro e fondi a mano cio' che serve: "
                         f"la fusione automatica lascerebbe residui che il lint non vede.")
        else:
            righe.append(f"   · {c['file']}")
            righe.append(f"     il blocco non porta il segnaposto #NN"
                         + (f" e cita #{num}, che nel registro non esiste" if num else "")
                         + ". I numeri li assegna l'ingestione: rimetti #NN.")
    return "\n".join(righe)


def ingerisci() -> str:
    registro = _leggi(REGISTRO)
    da_fare = [c for c in consegne()
               if c["valida"] and stato_nel_registro(c["lab_id"], registro) is None]
    if not da_fare:
        return "niente da ingerire"
    # Tre esiti, non uno. Un blocco che non porta il segnaposto NON si ingerisce:
    # o e' una proposta di aggiornamento per una voce che esiste (e allora la
    # fusione e' un atto di lettura, non di script — la fusione automatica
    # produrrebbe gli stessi residui che quella manuale ha gia' prodotto), o e' un
    # numero inventato, che qui non e' ammesso: i numeri li assegna l'ingestione.
    respinte = []
    ingeribili = []
    for c in da_fare:
        specie, num = classifica(c["blocco"], registro)
        (ingeribili if specie == "nuova" else respinte).append((c, specie, num))
    if not ingeribili:
        return _referto_respinte(respinte) or "niente da ingerire"
    da_fare = [c for c, _, _ in ingeribili]

    n = prossimo_id(registro)
    nuovi = []
    for c in da_fare:
        b = numera(c["blocco"], n) + f"\n  - lab-id: {c['lab_id']}"
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
            "\nOra: python docs/kb/tools/handoff_lint.py e commit (docs/kb e' SoT)."
            + ("\n" + _referto_respinte(respinte) if respinte else ""))


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
