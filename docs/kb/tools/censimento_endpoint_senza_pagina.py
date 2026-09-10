#!/usr/bin/env python3
"""
B15 — censimento degli endpoint che nessuna pagina chiama.

PERCHE' UNO STRUMENTO E NON UN ELENCO SCRITTO A MANO. Un censimento battuto a tastiera e' vero
il giorno che lo scrivi e falso poco dopo: bastano due rotte nuove — ed e' successo oggi
stesso, con `branches` — perche' i numeri non tornino piu'. Questo lo ri-deriva dall'atlante,
che e' la SoT interrogabile del progetto, e si puo' rilanciare quando serve.

⚠ L'ATLANTE DEVE ESSERE FRESCO. Un censimento su una mappa vecchia e' peggio di nessun
censimento, perche' ha l'aria di un fatto. Lo strumento si rifiuta di girare se
`atlante_fresco.py` dice «vecchio».

LE TRE ETICHETTE, e come si assegnano. La classificazione automatica non e' un'opinione della
macchina: e' una REGOLA scritta, applicata a tutti allo stesso modo, e ogni riga porta il
motivo per cui l'ha ricevuta. Dove la regola non decide, l'etichetta e' `serve-una-pagina` —
il valore che chiede attenzione umana, mai quello che la chiude.

  non-serve      la rotta non ha una persona come destinatario: sonde di salute, superfici di
                 servizio, amministrazione di piattaforma, scritture che una pagina esistente
                 gia' compie per altra via.
  serve-altrove  la consuma qualcosa che non e' una pagina: l'agente, un'integrazione, un
                 lavoro programmato.
  serve-una-pagina  tutto il resto, ed e' il caso in cui la decisione torna a Enzo.

Uso:
    python docs/kb/tools/censimento_endpoint_senza_pagina.py            # scrive il referto
    python docs/kb/tools/censimento_endpoint_senza_pagina.py --check    # solo i conteggi
"""
from __future__ import annotations

import subprocess
import sys
from collections import Counter
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parents[3]
ATLAS = REPO / "docs" / "kb" / "atlas" / "atlas.yaml"
USCITA = REPO / "docs" / "kb" / "xtras" / "B15_CENSIMENTO_endpoint_senza_pagina.md"

# ── LE REGOLE, per modulo. Ogni voce porta l'etichetta e la RAGIONE, che finisce nel referto
#    accanto a ogni riga: un'etichetta senza motivo e' un'opinione travestita da censimento.
PER_MODULO: dict[str, tuple[str, str]] = {
    # non-serve — superfici tecniche e di servizio
    "observability":     ("non-serve", "sonde e misure di sistema: destinatario un sistema, non una persona"),
    "provenance":        ("non-serve", "tracciabilita' tecnica dei dati: da dove vengono, non di chi sono"),
    "generated-origins": ("non-serve", "registro dell'origine delle righe generate: diagnostica"),
    "public-stats":      ("non-serve", "statistiche della vetrina pubblica, gia' consumate dalla landing"),
    "reference-sync":    ("non-serve", "sincronizzazione ISTAT/ATECO/ESCO: lavoro di servizio"),
    "seed-acquisition-runs":    ("non-serve", "corse tecniche di acquisizione"),
    "seed-approval-decisions":  ("non-serve", "approvazioni delle corse di acquisizione"),
    "seed-candidate-records":   ("non-serve", "candidati grezzi di una corsa di acquisizione"),
    "tenant-materialization":   ("non-serve", "costruzione di un cliente: amministrazione di piattaforma"),
    "auth":              ("serve-altrove", "flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato"),
    "research":          ("serve-altrove", "il motore di ricerca: lo consuma il ponte dei modelli, non una pagina"),
    "advisor":           ("serve-altrove", "raccomandazioni prescrittive: le consuma l'agente"),
    "semantic-matching": ("serve-altrove", "somiglianza semantica: la consuma l'agente e il ponte competenze"),
}

# Per prefisso di percorso, quando il modulo non basta a decidere.
PER_PREFISSO: list[tuple[str, str, str]] = [
    ("/healthz",  "non-serve", "sonda di salute"),
    ("/readyz",   "non-serve", "sonda di prontezza"),
    ("/v1/admin", "non-serve", "amministrazione di piattaforma"),
]


def atlante_fresco() -> bool:
    r = subprocess.run(
        [sys.executable, str(REPO / "docs" / "kb" / "tools" / "atlante_fresco.py")],
        capture_output=True, text=True,
    )
    return r.returncode == 0 and "fresco" in r.stdout


def etichetta(modulo: str, percorso: str, metodo: str) -> tuple[str, str]:
    for pref, eti, perche in PER_PREFISSO:
        if percorso.startswith(pref):
            return eti, perche
    if modulo in PER_MODULO:
        return PER_MODULO[modulo]
    # Una scrittura senza pagina non e' di per se' un buco: spesso la compie una pagina che
    # legge da un'altra rotta. Ma non lo si puo' DEDURRE, quindi resta da guardare.
    return "serve-una-pagina", "nessuna regola la copre: la decisione e' di Enzo"


def main() -> int:
    if not ATLAS.exists():
        print("atlante assente: rigeneralo con build_atlas.py", file=sys.stderr)
        return 2
    if not atlante_fresco():
        print("ATLANTE VECCHIO — un censimento su una mappa vecchia e' peggio di nessun "
              "censimento. Rigeneralo con build_atlas.py e rilancia.", file=sys.stderr)
        return 2

    a = yaml.safe_load(ATLAS.read_text(encoding="utf-8"))
    cross = a["cross"]
    senza_pagina = cross["api_only_endpoints"]
    con_pagina = cross["endpoints_with_web_consumers"]
    orfani = cross["web_endpoints_unmatched"]

    # Il modulo di ogni endpoint, risolto per prefisso dall'atlante stesso.
    prefisso_modulo: list[tuple[str, str]] = []
    for nome, m in a["api"].items():
        for p in m.get("prefixes") or []:
            prefisso_modulo.append((p, nome))
    prefisso_modulo.sort(key=lambda x: -len(x[0]))

    def modulo_di(percorso: str) -> str:
        for p, nome in prefisso_modulo:
            if percorso.startswith(p):
                return nome
        return "(fuori da ogni modulo)"

    # I moduli che almeno una pagina gia' chiama: e' un FATTO misurato, e cambia la natura
    # della decisione. Un endpoint di un modulo gia' servito e' un AMPLIAMENTO di una pagina che
    # esiste; uno di un modulo che nessuna pagina chiama e' un dominio intero senza interfaccia.
    def _perc(e):
        return e if isinstance(e, str) else (e.get("path") or e.get("url") or str(e))
    moduli_serviti = {modulo_di(_perc(e)) for e in con_pagina}

    righe = []
    for e in senza_pagina:
        percorso = e if isinstance(e, str) else (e.get("path") or e.get("url") or str(e))
        metodo = "" if isinstance(e, str) else (e.get("method") or "")
        mod = modulo_di(percorso)
        eti, perche = etichetta(mod, percorso, metodo)
        righe.append((mod, metodo, percorso, eti, perche,
                      "amplia una pagina" if mod in moduli_serviti else "dominio senza interfaccia"))
    righe.sort(key=lambda r: (r[0], r[2], r[1]))

    conte = Counter(r[3] for r in righe)
    if "--check" in sys.argv:
        print(f"senza pagina: {len(righe)} · con pagina: {len(con_pagina)} · orfani: {len(orfani)}")
        for k, v in sorted(conte.items()):
            print(f"  {k:18s} {v}")
        return 0

    fuori = "\n".join(f"- `{o}`" for o in orfani) if orfani else "- *(nessuno)*"
    corpo = [
        "# B15 — Censimento: gli endpoint che nessuna pagina chiama",
        "",
        "**Generato da** `docs/kb/tools/censimento_endpoint_senza_pagina.py`, che lo ri-deriva",
        "dall'atlante e si rifiuta di girare se l'atlante non e' fresco. **Non modificare a mano**:",
        "si rilancia. Un censimento battuto a tastiera e' vero il giorno che lo scrivi e falso",
        "poco dopo — bastano due rotte nuove, ed e' successo il giorno stesso in cui e' nato",
        "questo file, con il modulo `branches`.",
        "",
        "⚠ **Questo censimento non costruisce niente e non chiede di costruire niente.** La scelta",
        "di cosa fare per prima torna a Enzo.",
        "",
        "## I numeri",
        "",
        "| | |",
        "|---|---|",
        f"| Endpoint che **nessuna pagina chiama** | **{len(righe)}** |",
        f"| Endpoint chiamati da almeno una pagina | {len(con_pagina)} |",
        f"| Riferimenti di pagina che non trovano una rotta | {len(orfani)} |",
        "",
        "### Una seconda misura, che cambia la natura della decisione",
        "",
        f"Dei moduli che compaiono qui, **{len(moduli_serviti)}** hanno gia' almeno una pagina che li",
        "chiama e **il resto no**. Non e' un dettaglio: un endpoint di un modulo gia' servito e'",
        "l'**ampliamento** di una pagina che esiste — la direzione che Enzo ha dettato, «allargare",
        "cio' che c'e' senza creare doppioni». Un endpoint di un modulo che nessuna pagina chiama e'",
        "un **dominio intero senza interfaccia**, e costa un lavoro di un altro ordine. La colonna",
        "«il modulo» della tabella lo dice riga per riga.",
        "",
        "### Come si distribuiscono le tre etichette",
        "",
        "| etichetta | quanti | cosa vuol dire |",
        "|---|---|---|",
        f"| `serve-una-pagina` | **{conte.get('serve-una-pagina', 0)}** | nessuna regola li copre: sono quelli su cui decide Enzo |",
        f"| `non-serve` | {conte.get('non-serve', 0)} | il destinatario non e' una persona: sonde, servizio, amministrazione di piattaforma |",
        f"| `serve-altrove` | {conte.get('serve-altrove', 0)} | li consuma l'agente, un'integrazione o un lavoro programmato |",
        "",
        "## I riferimenti di pagina che non trovano una rotta",
        "",
        "⚠ **GUARDATI UNO PER UNO il 2026-09-10, e il verdetto e': l'atlante ha un buco, le pagine",
        "stanno bene.** Nessuno dei due e' un endpoint: sono `<Link href=...>` di NAVIGAZIONE fra",
        "pagine — `/content/[id]` porta al dettaglio di un documento (chiamato da `content/page.tsx`",
        "e da `blueprints/[variantId]/page.tsx`), `/leads` alla pagina dei contatti. L'estrattore",
        "dell'atlante li raccoglie perche' somigliano a un percorso di API, ma nessuna delle due",
        "pagine sta chiamando una rotta che non esiste. Le rotte vere ci sono e hanno un prefisso",
        "diverso (`/v1/content`, `/v1/leads`, registrate in `app.ts`).",
        "",
        "**Non e' stato corretto qui**: toccare l'estrattore dell'atlante e' un lavoro suo, con la",
        "sua prova, e questo blocco e' un censimento. Registrato come scoperta fuori ciclo.",
        "",
        fuori,
        "",
        "## Il censimento, per modulo",
        "",
        "| modulo | metodo | percorso | etichetta | il modulo | perche' |",
        "|---|---|---|---|---|---|",
    ]
    for mod, met, perc, eti, perche, nat in righe:
        corpo.append(f"| `{mod}` | {met or '—'} | `{perc}` | **{eti}** | {nat} | {perche} |")
    corpo.append("")
    corpo.append(f"**Totale righe: {len(righe)}.** Il censimento e' completo o non e': se questo")
    corpo.append("numero non coincide con il conteggio in cima, il file e' stale — rilancia lo strumento.")
    corpo.append("")

    USCITA.parent.mkdir(parents=True, exist_ok=True)
    USCITA.write_text("\n".join(corpo), encoding="utf-8")
    print(f"scritto {USCITA.relative_to(REPO)} — {len(righe)} righe etichettate")
    for k, v in sorted(conte.items()):
        print(f"  {k:18s} {v}")
    print(f"riferimenti orfani: {len(orfani)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
