#!/usr/bin/env python3
"""
build_origine_moduli.py — per ogni modulo dell'API, i prefissi delle rotte e le tabelle che
legge e scrive, derivati dall'atlante (piano interfacce L10, A-14).

PERCHE' ESISTE. L'origine del dato (nativo, importato, ibrido: I23, ADR-0041) e' dichiarata
nel database, tabella per tabella, in `sys.sys_classificazione_direzione_dato` (000429).
Una pagina o una risposta pero' non nominano tabelle: nominano un modulo (`/v1/time-off`).
Questo file e' il ponte, e come l'atlante non si scrive a mano: un modulo che tocca una
tabella nuova la porta con se' alla prossima rigenerazione.

Il file generato contiene SOLO la struttura (modulo -> prefissi, tabelle). Lo stato di
ciascuna tabella lo legge l'API dal database, cosi' una riclassificazione non chiede un
rilascio.

  python docs/kb/tools/build_origine_moduli.py           # scrive il file
  python docs/kb/tools/build_origine_moduli.py --check   # esce 1 se il file non e' allineato
"""
import io
import json
import os
import sys

import yaml

ATLAS = os.path.join("docs", "kb", "atlas", "atlas.yaml")
USCITA = os.path.join("apps", "api", "src", "lib", "origine", "moduli.generated.ts")

# Fuori, con la ragione. Le segnalazioni hanno l'isolamento assoluto (ADR-0036 §5, #99 F4):
# nessun modulo fuori dalla custodia nomina le loro tabelle, nemmeno per descriverne
# l'origine. Lo stesso confine delle letture dell'agente (A-13).
MODULI_FUORI = {"whistleblowing"}
TABELLE_FUORI_PREFISSO = "sys_whistleblowing"


def genera() -> str:
    with io.open(ATLAS, encoding="utf-8") as f:
        atlante = yaml.safe_load(f)
    moduli = {}
    for nome, mod in sorted((atlante.get("api") or {}).items()):
        if nome in MODULI_FUORI:
            continue
        prefissi = sorted(p for p in (mod.get("prefixes") or []) if p.startswith("/v1/"))
        tabelle = sorted(t.split(".", 1)[1] for t in (mod.get("tables") or []) if t.startswith("sys."))
        tabelle = [t for t in tabelle if not t.startswith(TABELLE_FUORI_PREFISSO)]
        if prefissi:
            moduli[nome] = {"prefissi": prefissi, "tabelle": tabelle}
    corpo = json.dumps(moduli, ensure_ascii=False, indent=2)
    return (
        "// GENERATO da docs/kb/tools/build_origine_moduli.py dall'atlante: non si modifica a mano.\n"
        "// Piano interfacce L10, A-14: per ogni modulo, i prefissi delle rotte e le tabelle sys.*.\n"
        "export interface ModuloDelleTabelle {\n"
        "  prefissi: readonly string[];\n"
        "  tabelle: readonly string[];\n"
        "}\n\n"
        f"export const MODULI_DELLE_TABELLE: Readonly<Record<string, ModuloDelleTabelle>> = {corpo};\n"
    )


def main() -> int:
    testo = genera()
    if "--check" in sys.argv:
        try:
            with io.open(USCITA, encoding="utf-8", newline="") as f:
                attuale = f.read()
        except FileNotFoundError:
            attuale = ""
        if attuale != testo:
            print(f"{USCITA} non e' allineato all'atlante: python {sys.argv[0]}")
            return 1
        print(f"{USCITA} allineato")
        return 0
    with io.open(USCITA, "w", encoding="utf-8", newline="\n") as f:
        f.write(testo)
    print(f"scritto {USCITA}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
