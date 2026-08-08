#!/usr/bin/env python3
"""
check_identita_azienda.py — l'identita' di un'azienda e' scritta in piu' posti:
questo controllo dice quando quei posti dissentono.

Perche' esiste
--------------
L'identita' di un tenant vive oggi in TRE luoghi, e nessuno li tiene allineati:

  1. `sys_tenancies`                  — `tenant_industry_code`, `tenant_size_band`
                                        (testo libero: nessuna FK, nessun CHECK)
  2. `sys_enterprise_typing_profiles` — la carta d'identita': ATECO e fascia,
                                        con FK verso i cataloghi
  3. `sys_tenant_blueprint_versions`  — il fascicolo di configurazione (#131),
                                        che ricopia l'identita' nella versione

Due dichiarazioni della stessa cosa divergono sempre, prima o poi. E' gia'
successo: la carta d'identita' di Heuresys diceva ATECO 62.10 «programmazione
informatica» mentre `tenant_industry_code` diceva `MGMT_CONSULTING` — lo
strumento invece del mestiere. Riparato dalla migrazione `000282` (`#144`).

SULLA VERIFICA CIECA. Un'azienda senza fascicolo NON e' un'azienda coerente: e'
un'azienda **non ancora descritta**, e finisce in una colonna sua. Zero
scostamenti su universo zero non e' una verifica superata, e' una verifica che
non ha guardato niente — qui viene detto a voce alta, e l'esito lo riflette.

SULLA FALSIFICABILITA'. Quando questo controllo e' stato progettato, lo
scostamento di Heuresys doveva servire da prova che sa accendersi. Poi il dato
e' stato riparato — giustamente: conservare un dato sbagliato in produzione per
comodita' di un test sarebbe il verso storto. Quindi la prova si **costruisce ad
arte**: `--autoprova` introduce uno scostamento dentro una transazione che viene
annullata, e pretende che il controllo lo veda. Se non lo vede, e' rotto il
controllo, e lo script esce con codice diverso da zero.

Uso:
    python docs/kb/tools/check_identita_azienda.py
    python docs/kb/tools/check_identita_azienda.py --autoprova
    python docs/kb/tools/check_identita_azienda.py --json <file>

Esito: 0 se ogni azienda descritta e' coerente; 1 se c'e' uno scostamento o se
l'autoprova fallisce; 2 se il database non e' raggiungibile.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys

PSQL = [
    "psql",
    "-h", os.environ.get("PGHOST", "localhost"),
    "-p", os.environ.get("PGPORT", "5433"),
    "-U", os.environ.get("PGUSER", "heuresys"),
    "-d", os.environ.get("PGDATABASE", "heuresys_advanced"),
    "-At", "-F", "\t",
]

# Una riga per azienda. Le tre dichiarazioni affiancate, piu' la famiglia di
# modelli a cui l'ATECO risale (mig. 000301): e' l'unico ponte MECCANICO fra il
# codice di settore del tenant e la sua classificazione economica. Dove il ponte
# non esiste, il confronto non si inventa: si dichiara non verificabile.
QUERY = """
SELECT t.tenant_code,
       t.tenant_status,
       coalesce(t.tenant_industry_code, ''),
       coalesce(t.tenant_size_band, ''),
       coalesce(c.activity_classification_code, ''),
       coalesce(b.enterprise_size_band_code, ''),
       coalesce(f.blueprint_family_code, ''),
       coalesce(bp.tenant_blueprint_code, ''),
       coalesce(fc.activity_classification_code, ''),
       coalesce(fb.enterprise_size_band_code, ''),
       coalesce(v.tenant_blueprint_version_status, '')
  FROM sys.sys_tenancies t
  LEFT JOIN sys.sys_enterprise_typing_profiles e
         ON e.enterprise_typing_tenant_id = t.tenant_id
  LEFT JOIN sys.sys_activity_classifications c
         ON c.activity_classification_id = e.enterprise_typing_industry_class_id
  LEFT JOIN sys.sys_enterprise_size_bands b
         ON b.enterprise_size_band_id = e.enterprise_typing_size_band_id
  LEFT JOIN sys.sys_blueprint_families f
         ON f.blueprint_family_id
          = sys.sys_blueprint_family_for_activity_class(e.enterprise_typing_industry_class_id)
  LEFT JOIN sys.sys_tenant_blueprints bp
         ON bp.tenant_blueprint_tenant_id = t.tenant_id
        AND bp.tenant_blueprint_status = 'ACTIVE'
  LEFT JOIN sys.sys_tenant_blueprint_versions v
         ON v.tenant_blueprint_version_id = bp.tenant_blueprint_current_version_id
  LEFT JOIN sys.sys_activity_classifications fc
         ON fc.activity_classification_id = v.tenant_blueprint_version_industry_class_id
  LEFT JOIN sys.sys_enterprise_size_bands fb
         ON fb.enterprise_size_band_id = v.tenant_blueprint_version_size_band_id
 WHERE t.tenant_status = 'ACTIVE'
 ORDER BY t.tenant_code
"""

CAMPI = [
    "tenant_code", "tenant_status", "industry_code", "size_band",
    "ateco_carta", "fascia_carta", "famiglia_da_ateco",
    "fascicolo", "ateco_fascicolo", "fascia_fascicolo", "stato_versione",
]


def interroga(sql: str, guasto_da_annullare: str | None = None) -> list[list[str]]:
    """Esegue la query passando da stdin. Se e' dato un guasto, gira dentro una
    transazione che viene SEMPRE annullata: l'autoprova non lascia traccia."""
    corpo = sql if guasto_da_annullare is None else (
        f"BEGIN;\n{guasto_da_annullare}\n{sql};\nROLLBACK;"
    )
    try:
        out = subprocess.run(
            PSQL + ["-v", "ON_ERROR_STOP=1"],
            input=corpo, capture_output=True, text=True, timeout=60,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError) as exc:
        print(f"  database non raggiungibile: {exc}", file=sys.stderr)
        sys.exit(2)
    if out.returncode != 0:
        print(f"  psql ha fallito: {out.stderr.strip()}", file=sys.stderr)
        sys.exit(2)
    return [r.split("\t") for r in out.stdout.strip().splitlines() if r.strip()]


def valuta(riga: dict[str, str]) -> tuple[str, list[str]]:
    """Ritorna (esito, scostamenti). Esito: coerente | scostamento |
    non-descritta | non-verificabile."""
    scostamenti: list[str] = []

    # (1) La fascia dimensionale e' dichiarata due volte, e sono confrontabili
    #     direttamente: stesso vocabolario, uno con FK e uno a mano.
    if riga["size_band"] and riga["fascia_carta"] and riga["size_band"] != riga["fascia_carta"]:
        scostamenti.append(
            f"fascia dimensionale: il tenant dice {riga['size_band']}, "
            f"la carta d'identita' dice {riga['fascia_carta']}"
        )

    # (2) Il settore dichiarato contro la classificazione economica. Si puo'
    #     verificare SOLO se l'ATECO risale a una famiglia di modelli: e' il
    #     solo ponte meccanico fra i due vocabolari. Dove manca, si dice.
    verificabile_settore = bool(riga["famiglia_da_ateco"])
    if verificabile_settore and riga["industry_code"]:
        if riga["famiglia_da_ateco"] != riga["industry_code"]:
            scostamenti.append(
                f"settore: il tenant dice {riga['industry_code']}, ma l'ATECO "
                f"{riga['ateco_carta']} risale alla famiglia {riga['famiglia_da_ateco']}"
            )

    # (3) Il fascicolo contro la carta d'identita'.
    if riga["fascicolo"]:
        if riga["ateco_fascicolo"] and riga["ateco_carta"] and riga["ateco_fascicolo"] != riga["ateco_carta"]:
            scostamenti.append(
                f"ATECO: il fascicolo dice {riga['ateco_fascicolo']}, "
                f"la carta d'identita' dice {riga['ateco_carta']}"
            )
        if riga["fascia_fascicolo"] and riga["fascia_carta"] and riga["fascia_fascicolo"] != riga["fascia_carta"]:
            scostamenti.append(
                f"fascia: il fascicolo dice {riga['fascia_fascicolo']}, "
                f"la carta d'identita' dice {riga['fascia_carta']}"
            )

    if scostamenti:
        return "scostamento", scostamenti
    if not riga["fascicolo"]:
        return "non-descritta", []
    if not verificabile_settore:
        return "non-verificabile", []
    return "coerente", []


def leggi(setup: str | None = None) -> list[dict[str, str]]:
    righe = interroga(QUERY, setup)
    return [dict(zip(CAMPI, r + [""] * (len(CAMPI) - len(r)))) for r in righe]


def stampa(aziende: list[dict[str, str]]) -> tuple[int, int, int, int]:
    coerenti = scostate = non_descritte = non_verificabili = 0
    print("\n=== Identita' delle aziende — tre dichiarazioni a confronto ===\n")
    for a in aziende:
        esito, scostamenti = valuta(a)
        if esito == "coerente":
            coerenti += 1
            marca = "[OK]  "
        elif esito == "scostamento":
            scostate += 1
            marca = "[!!]  "
        elif esito == "non-descritta":
            non_descritte += 1
            marca = "[--]  "
        else:
            non_verificabili += 1
            marca = "[? ]  "

        fascicolo = a["fascicolo"] or "nessun fascicolo"
        print(
            f"{marca}{a['tenant_code']:<12} settore {a['industry_code'] or '—':<18}"
            f" ATECO {a['ateco_carta'] or '—':<8} fascia {a['fascia_carta'] or '—':<3}"
            f"  fascicolo: {fascicolo}"
        )
        for s in scostamenti:
            print(f"        └─ {s}")
        if esito == "non-descritta":
            print("        └─ non ancora descritta da un fascicolo: NON conta come coerente")
        if esito == "non-verificabile":
            print(
                f"        └─ nessuna famiglia di modelli copre l'ATECO {a['ateco_carta']}: "
                "il settore dichiarato non e' verificabile meccanicamente"
            )
    return coerenti, scostate, non_descritte, non_verificabili


def autoprova() -> bool:
    """Costruisce ad arte uno scostamento e pretende che il controllo lo veda.
    Tutto dentro una transazione annullata: il database resta com'era."""
    print("\n=== Autoprova: il controllo sa accendersi? ===\n")
    prima = leggi()
    scostate_prima = sum(1 for a in prima if valuta(a)[0] == "scostamento")

    setup = (
        "UPDATE sys.sys_tenancies SET tenant_size_band = "
        "  CASE WHEN tenant_size_band = 'XL' THEN 'XS' ELSE 'XL' END "
        " WHERE tenant_code = (SELECT min(tenant_code) FROM sys.sys_tenancies "
        "                       WHERE tenant_status = 'ACTIVE');"
    )
    dopo = leggi(setup)
    scostate_dopo = sum(1 for a in dopo if valuta(a)[0] == "scostamento")

    print(f"  scostamenti prima ....... {scostate_prima}")
    print(f"  scostamenti con il guasto {scostate_dopo}")

    if scostate_dopo <= scostate_prima:
        print(
            "\n  AUTOPROVA FALLITA: ho storto la fascia dimensionale di un'azienda e il "
            "controllo non se n'e' accorto. Non e' il dato a essere sano: e' il controllo "
            "a essere cieco.\n"
        )
        return False

    residuo = leggi()
    if sum(1 for a in residuo if valuta(a)[0] == "scostamento") != scostate_prima:
        print("\n  AUTOPROVA FALLITA: il guasto costruito NON e' stato annullato.\n")
        return False

    print("  il controllo si accende, e il guasto costruito non ha lasciato traccia.\n")
    return True


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--autoprova", action="store_true",
                    help="costruisce uno scostamento in una transazione annullata e pretende di vederlo")
    ap.add_argument("--json", metavar="FILE", help="scrive l'esito anche in JSON")
    args = ap.parse_args()

    aziende = leggi()
    if not aziende:
        print("\n  Nessuna azienda ACTIVE: non c'e' niente da verificare, e questo NON e' un verde.\n")
        return 1

    coerenti, scostate, non_descritte, non_verificabili = stampa(aziende)

    print(
        f"\n  {len(aziende)} aziende attive: {coerenti} coerenti, {scostate} con scostamenti, "
        f"{non_descritte} non ancora descritte, {non_verificabili} non verificabili meccanicamente"
    )
    if coerenti == 0:
        print(
            "  Nessuna azienda e' pienamente verificabile oggi: l'assenza di scostamenti "
            "qui NON e' una prova di coerenza."
        )

    if args.json:
        with open(args.json, "w", encoding="utf-8") as fh:
            json.dump(
                {
                    "aziende": [
                        {**a, "esito": valuta(a)[0], "scostamenti": valuta(a)[1]} for a in aziende
                    ],
                    "riepilogo": {
                        "totale": len(aziende), "coerenti": coerenti, "scostamenti": scostate,
                        "non_descritte": non_descritte, "non_verificabili": non_verificabili,
                    },
                },
                fh, ensure_ascii=False, indent=2,
            )

    esito = 0 if scostate == 0 else 1

    if args.autoprova and not autoprova():
        esito = 1

    print("  esito: " + ("VERDE" if esito == 0 else "ROSSO") + "\n")
    return esito


if __name__ == "__main__":
    sys.exit(main())
