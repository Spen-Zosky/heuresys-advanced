#!/usr/bin/env python3
"""Copertura del piano delle interfacce (docs/piani/PIANO_interfacce_20261103.md).

Per ogni rilievo dell'analisi delle interfacce (V1-V12) e per ogni pagina dell'applicazione web
scrive una riga con la voce del piano che lo prende in carico, oppure il motivo scritto per cui non
ne ha una. Una riga che nessuna regola riconosce esce come DA-CLASSIFICARE e il comando esce con 1.

Uso:
    python3 docs/piani/copertura_interfacce/costruisci_copertura.py <cartella analisi-interfacce>

La cartella dell'analisi sta fuori dal deposito (cartella dei file del progetto); il percorso si passa
come argomento. Scrive copertura.tsv accanto a questo file e stampa il riepilogo dei conteggi.
"""
from __future__ import annotations

import csv
import os
import re
import subprocess
import sys
from collections import Counter

QUI = os.path.dirname(os.path.abspath(__file__))
RADICE = subprocess.run(["git", "-C", QUI, "rev-parse", "--show-toplevel"], capture_output=True,
                        text=True, check=True).stdout.strip()
righe: list[list[str]] = []


def aggiungi(fonte: str, rif: str, oggetto: str, voci: str = "", motivo: str = "") -> None:
    esito = "voce" if voci else ("escluso" if motivo else "DA-CLASSIFICARE")
    righe.append([fonte, rif, oggetto.replace("\t", " ")[:200], esito, voci, motivo])


def tsv(base: str, rel: str) -> list[dict[str, str]]:
    with open(os.path.join(base, rel), encoding="utf-8-sig") as f:
        return list(csv.DictReader(f, delimiter="\t"))


# ---------------------------------------------------------------- difetti D-01..D-28 (V4, V9 m, V12)
DIFETTI = {
    "D-01": ("", "ritirato: PEOPLE_MANAGER vede il tenant per mandato (Enzo 31/10 17:06; 000432); resta la documentazione dei ruoli, nel thread «Correggere i difetti delle pagine» (V10 tema 16)"),
    "D-02": ("S-14", ""), "D-03": ("S-7", ""), "D-04": ("S-9", ""),
    "D-05": ("", "non è un difetto: cataloghi leggibili a tutti per ADR-0039"),
    "D-06": ("A-4", ""), "D-07": ("", "corretto in produzione (effb973); manca solo un titolare vero, voce P-6"),
    "D-08": ("S-8", ""), "D-09": ("A-4", ""),
    "D-10": ("P-8", ""), "D-11": ("V-5", ""),
    "D-12": ("", "non è un difetto: falso negativo del giro del 31/10 (V4b §1)"),
    "D-13": ("V-6", ""), "D-14": ("S-3", ""),
    "D-15": ("S-1", ""), "D-16": ("S-1", ""), "D-17": ("S-1", ""),
    "D-18": ("S-2", ""),
    "D-19": ("F-9", ""), "D-20": ("", "non è un difetto: /leads è commerciale, non del tenant"),
    "D-21": ("", "non è un difetto: il tenant di piattaforma non si apre a RTL"),
    "D-22": ("V-15", ""), "D-23": ("V-4", ""), "D-24": ("V-12", ""), "D-25": ("V-13", ""),
    "D-26": ("S-4", ""), "D-27": ("V-1,V-2", ""), "D-28": ("S-6", ""),
}

INCOERENZE = {
    "INC-01": "S-20", "INC-02": "", "INC-03": "S-8", "INC-04": "S-3", "INC-05": "S-1", "INC-06": "A-4",
    "INC-07": "", "INC-08": "S-22", "INC-09": "S-1", "INC-10": "S-19", "INC-11": "S-19,P-7",
    "INC-12": "S-18", "INC-13": "S-17", "INC-14": "S-16", "INC-15": "S-21", "INC-16": "S-22",
    "INC-17": "", "INC-18": "S-10", "INC-19": "V-4", "INC-20": "V-14", "INC-21": "S-2", "INC-22": "S-4",
    "INC-23": "S-23", "INC-24": "S-23",
}
INC_MOTIVI = {
    "INC-02": "corretto in produzione con D-07 (effb973); manca un titolare vero, voce P-6",
    "INC-07": "superata: ADR-0050 accettato e PEOPLE_MANAGER nel mandato HR per decisione di Enzo; il CLAUDE.md si allinea nel thread «Correggere i difetti delle pagine» (V10 tema 16)",
    "INC-17": "documentazione dei ruoli: in corso nel thread «Correggere i difetti delle pagine» (V10 tema 16)",
}

ANOMALIE_TIPO = {
    "endpoint_orfano": "G-38", "endpoint_senza_pagina": "G-37", "endpoint_senza_guardia": "S-10",
    "pagina_temporanea_di_prova_o_demo": "S-4", "guardia_mancante_azioni_di_scrittura_senza_controllo_ui": "S-5",
    "pagina_con_voce_di_menu_inattiva": "S-2", "segni_di_dato_fittizio_o_statico": "V-16",
    "pagina_orfana": "S-4,V-4", "chiamata_con_metodo_errato": "V-5", "pagina_redirect": "V-4",
    "file_web_non_raggiunto_da_alcuna_pagina": "G-40",
}

# cause della tabella pagine_attese_vs_viste (V4, giro del 31/10 con utenze di collaudo), nell'ordine
CAUSE = [
    (r"me/preferences 403", "", "superato: pavimento ESS corretto in produzione (D-06, effb973; USER a tutti e5edee8); il giro V12 non ha 403 di menu"),
    (r"utenza di collaudo con un solo ruolo", "", "superato: utenze di collaudo sospese (PR #130) e USER a ogni utente (e5edee8); V12 rifatto con persone vere"),
    (r"codice inglese del catalogo", "F-9", ""),
    (r"risorsa non trovata anche per TENANT_ADMIN", "", "artefatto del giro del 31/10: identificativo non valido, non è un problema d'accesso"),
    (r"Canale riservato", "", "non è un difetto: falso positivo sul testo della pagina pubblica (D-12, V4b §1)"),
    (r"skill-categories", "P-8", ""),
    (r"parola d'errore", "V-6,S-6", ""),
    (r"V2 ha scelto a mano", "", "errore della matrice attesa V2, non del sistema"),
    (r"build-plan", "V-15", ""),
    (r"enterprise-typing", "V-5", ""),
    (r"organization-units risponde|org chart aperto", "", "non è un difetto: organigramma aperto a tutti come rubrica aziendale (decisione di Enzo del 2026-08-16)"),
    (r"GET /v1/positions risponde", "S-7", ""),
    (r"system-health", "S-3", ""),
    (r"menu assente per dominio", "S-1", ""),
    (r"permesso mancante nel ruolo", "P-7,S-25", ""),
]

FORMATTAZIONE = {  # riga del file (intestazione = 1) -> voci
    4: "F-1", 5: "F-1", 6: "F-1", 7: "F-1", 8: "F-1", 9: "F-1", 10: "F-1", 11: "F-1", 12: "F-1", 13: "F-1",
    14: "F-1,F-2", 15: "F-1", 18: "F-1", 19: "V-8", 21: "V-7", 22: "F-1,S-4", 23: "F-1", 24: "V-9", 25: "V-9",
    26: "F-1", 27: "V-9", 28: "F-1", 29: "V-10", 30: "F-3", 31: "F-3", 34: "F-8", 35: "V-11", 36: "V-11",
    37: "V-11", 39: "F-9", 40: "F-4,S-12", 41: "F-4,S-12", 46: "V-15", 47: "V-5",
}
CONTRATTI = {2: "P-8", 3: "S-11", 4: "S-11", 10: "S-11", 11: "S-11", 12: "S-12", 13: "S-11", 14: "P-8"}
PRONTEZZA = {
    2: "A-9", 3: "A-9", 4: "A-9", 6: "A-9", 7: "A-10", 8: "A-10", 9: "S-12", 10: "S-12", 12: "A-10",
    14: "A-10", 15: "A-1", 16: "A-5", 18: "M-9", 19: "M-10", 20: "M-10", 21: "M-10", 22: "M-6", 23: "A-10",
    24: "M-8", 25: "V-15", 26: "A-13", 27: "A-13", 28: "A-11", 30: "A-1", 33: "M-10", 34: "S-13,A-10",
}
FUNZIONI = {  # riga di V7 copertura.tsv -> voce
    6: "G-1", 7: "G-2", 8: "G-3", 9: "G-4", 10: "G-5", 11: "G-6", 15: "G-7", 21: "G-8", 25: "G-9", 26: "G-10",
    27: "G-11", 28: "G-12", 31: "G-13", 35: "G-14", 37: "G-15", 38: "G-16", 41: "G-17,S-7", 45: "G-18",
    46: "G-19", 50: "G-20", 60: "G-21", 63: "G-22", 71: "G-23", 72: "G-24", 73: "G-25", 74: "G-26",
    77: "G-27", 80: "G-28", 82: "G-29", 83: "G-30", 89: "G-31", 90: "G-32", 91: "G-33",
}
DEBITI = {
    "#266": ("G-5", ""), "#265": ("G-4", ""), "#264": ("G-43", ""),
    "#263": ("", "contratto dati con il datastore: non è interfaccia di advanced, programma del consolidamento"),
    "#271": ("", "onda 2 del programma PE-6: sessioni dedicate (.programmi), fuori dal mandato di questo thread"),
    "#254": ("A-13", ""), "#159": ("A-8", ""),
    "#205": ("", "Tenant Builder, coda dei domini: lavoro sul datastore, non sulle pagine"),
    "#198": ("G-43", ""), "#206": ("", "Tenant Builder P4, estrattori e ingestori: nessuna pagina, GATED"),
    "#149": ("", "regola di metodo sul lab, non tocca le interfacce"),
    "#76": ("", "piano zero pendenze: contenitore di altre voci già mappate"),
    "#79": ("G-41", ""), "#214": ("A-13", ""), "#8": ("G-34", ""), "#39": ("G-8", ""), "#52": ("M-10", ""),
    "#4": ("", "pagina prezzi: decisione commerciale di Enzo, non interfaccia del prodotto"),
    "#29": ("G-36", ""), "#32": ("G-36", ""), "#33": ("G-36", ""),
    "#74": ("", "fatto: GET amministrativa delle notifiche esiste"), "#75": ("", "fatto: ciclo di vita dei team nell'API; la pagina è G-37"),
    "#126": ("G-12", ""), "#43/#44/#45": ("", "fatto: modifica dei cataloghi e di persone e organizzazione"),
    "#51": ("", "fatto: whistleblowing con custode; isolamento provato dalla sentinella"),
    "#54": ("G-42", ""), "#57": ("", "fatto: scheda di salute dell'organizzazione; la vedrà Enzo nel giro P-5"),
    "#211": ("P-3", ""), "D-56": ("", "strumento locale di Windows, non tocca le interfacce"),
    "D-34": ("", "risolto: competenze categorizzate"), "D-33": ("G-41", ""), "D-84": ("", "risolto S1061"),
    "D-66": ("G-39", ""), "D-65": ("", "risolto S1027"), "D-68": ("S-22", ""), "D-26": ("", "risolto S987: rinnovo silenzioso"),
    "D-27": ("F-6", ""), "D-47": ("", "risolto S1010"), "D-76": ("", "risolto S1038"), "D-58": ("", "risolto"),
    "D-70": ("", "risolto S1027"), "D-71": ("", "risolto S1027"), "D-82": ("", "risolto S1058"),
    "D-50": ("S-9", ""), "D-63": ("S-18", ""), "ADR-0049": ("V-3,G-23", ""), "ADR-0045": ("G-7", ""),
    "ADR-0044": ("G-9", ""), "ADR-0046": ("M-1", ""), "ADR-0047/0048": ("G-35", ""), "C5/C6/C8": ("A-14", ""),
    "AC-0..AC-15": ("P-5,G-32", ""),
    "piano 121 U-1": ("", "console del datastore: fuori da advanced"), "piano 122": ("", "pagina dei vuoti del datastore: fuori da advanced"),
    "S-1/S-2/S-3": ("", "rossi del datastore: fuori da advanced"),
}
TEMI_V10 = {
    "1": ("", "chiuso: comportamento voluto"), "2": ("S-14", ""), "3": ("P-5,P-6", ""), "4": ("", "fatto, disco della VM"),
    "5": ("S-14,A-1", ""), "6": ("P-6", ""), "7": ("", "fatto in produzione il 31/10"), "8": ("K-1", ""),
    "9": ("V-3,G-10", ""), "10": ("A-4", ""), "11": ("P-8", ""), "12": ("P-3", ""), "13": ("V-15", ""),
    "14": ("S-1", ""), "15": ("F-1,F-2,F-3", ""), "16": ("", "in corso nel thread «Correggere i difetti delle pagine»"),
    "17": ("S-7,G-42,A-1,M-11", ""), "18": ("V-1,V-4,S-6", ""), "19": ("S-7,S-8,V-5,S-3,S-2,V-12,V-13", ""),
}
DECISIONI_V9 = {"1": ("", "chiusa il 31/10"), "2": ("S-14", ""), "3": ("A-4", ""), "4": ("P-5,P-6", ""),
                "5": ("S-7", ""), "6": ("G-42", ""), "7": ("A-1", ""), "8": ("M-11", "")}
RACCOMANDAZIONI_V9 = {"1": ("", "chiusa: D-01 ritirato; documentazione nel thread «Correggere i difetti delle pagine»"),
                      "2": ("S-14", ""), "3": ("A-4", ""), "4": ("P-8,V-5", ""), "5": ("V-15", ""), "6": ("P-5,F-9", ""),
                      "7": ("P-3", ""), "8": ("A-1,A-2,A-5,A-9,A-10,S-12", ""), "9": ("A-11,A-16", ""), "10": ("A-14", ""),
                      "11": ("G-9,G-23,G-10,G-29,G-11,G-44,G-45", ""), "12": ("G-42,G-21,S-2", ""),
                      "13": ("F-1,F-2,F-3,V-11", ""), "14": ("S-1,S-3,P-3", ""), "15": ("M-6,M-9,M-10,M-11,M-8", ""),
                      "16": ("M-20", "")}
PRONTEZZA_V4 = {"M-1": "A-1", "M-2": "A-2", "M-3": "A-7", "M-4": "A-5", "M-5": "A-4", "M-6": "A-3", "M-7": "A-6"}
PROVE_V4 = {"T-1": ("V-14", ""), "T-2": ("S-20", ""), "T-3": ("S-23", ""), "T-4": ("P-5,S-17,S-18", ""),
            "T-5": ("P-9", ""), "T-6": ("S-9", ""), "T-7": ("S-16", ""), "T-8": ("", "superata: USER a ogni utente (e5edee8)"),
            "T-9": ("", "chiusa: PEOPLE_MANAGER per mandato; il giro V12 lo ha visitato"),
            "T-10": ("P-5,P-9", ""), "T-11": ("", "fatta dal giro V12 con gli indirizzi veri"), "T-12": ("A-15", ""),
            "T-13": ("", "fatta: utenze sospese (PR #130)")}
INTEGRABILITA = {"1": "A-9", "2": "M-6", "3": "M-7", "4": "M-8", "5": "M-9", "6": "M-10", "7": "M-11",
                 "8": "A-11", "9": "M-13", "10": "M-14"}
MERCATO = {3: "M-3", 5: "M-2", 6: "M-16", 8: "M-19", 11: "M-1", 13: "G-13", 14: "G-15", 16: "G-21", 24: "M-15",
           25: "M-16", 27: "M-17", 28: "G-24", 29: "M-17", 31: "M-4", 32: "M-5", 33: "F-7", 34: "M-12",
           37: "M-10", 38: "A-9", 39: "M-18", 40: "M-9", 42: "G-29", 43: "F-6"}
TABELLE_SPECIFICHE = {
    "sys_branches": "G-1", "sys_organization_unit_history": "G-2", "sys_assessment_results": "G-19",
    "sys_assessments": "G-19", "sys_assessment_methods": "G-19", "sys_user_consents": "G-11",
    "sys_model_predictions": "G-20", "sys_predictive_models": "G-20", "sys_engagement_feedback": "G-22",
    "sys_mentorship_sessions": "G-12", "sys_mentorship_programs": "G-12", "sys_mentor_match_scores": "G-12",
    "sys_tenant_processes": "G-23", "sys_tenant_process_steps": "G-23", "sys_tenant_process_activity_rules": "G-23",
    "sys_gdpr_data_map": "G-29", "sys_gdpr_requests": "G-29", "sys_position_succession_relevance": "G-6",
    "sys_nine_box_grid": "G-41", "sys_kpi_measurements": "G-41,A-16",
}
PAGINE_SPECIFICHE = {
    "/": "V-16,S-10", "/admin/mfa-policy": "S-15,V-13,S-14", "/admin/roles": "S-19,S-14",
    "/analytics/org-network": "S-2", "/analytics/overtime": "S-2,V-7,V-11", "/analytics/skills-by-category": "S-2",
    "/analytics/skills-group-share": "S-2", "/analytics/attendance": "V-11", "/app": "V-4,S-4",
    "/approvals": "V-1,V-2,V-3,S-5,A-8", "/approvals/[id]": "S-5,A-8", "/compensation-intelligence": "S-2,V-8,F-1",
    "/consolidation": "P-5,G-32,G-33", "/content": "S-5", "/content/[id]": "G-44", "/dashboard/[famiglia]": "F-9",
    "/dashboard": "V-9,V-14", "/demo": "S-4", "/dev/agent": "S-4,S-5", "/engagement": "V-11,G-22",
    "/gaps": "S-2,F-3", "/generated-origins": "V-9,F-1,G-42", "/goals": "G-36,F-8", "/insights/skill-gap": "S-2",
    "/insights/succession-readiness": "S-2", "/investors": "S-4,F-1", "/kpis": "S-2", "/leads": "S-5",
    "/login": "V-4,G-34,M-10", "/me/analytics": "V-16,V-11,F-1", "/me/approvals": "V-16,V-1",
    "/me/delegations": "G-10,A-5", "/me/gaps": "F-3", "/me/security": "F-1,S-14", "/me/surveys": "V-16",
    "/me/time-off": "F-1,G-14", "/okrs": "G-36,F-8", "/org-director": "P-5", "/org-director/advisor": "P-5",
    "/org-director/health": "P-5", "/org-director/vrio": "P-5", "/organization": "G-1,G-2,G-4,M-3",
    "/performance": "V-16,F-1,G-36,S-24", "/positions": "S-7,M-2,G-4", "/positions/[positionId]/learning": "F-3",
    "/process-owner": "G-9", "/processes": "G-23,M-17", "/projects/[id]": "F-8", "/provenance": "V-9,F-1,A-14",
    "/recruiting": "S-5,G-42,P-5", "/recruiting/applications/[id]": "S-5,F-1,F-2", "/recruiting/candidates": "S-5,G-42",
    "/recruiting/postings": "S-5,G-42", "/recruiting/requisitions": "S-5,G-42", "/seed-acquisition/runs": "S-24",
    "/system-health": "S-3,V-9,F-3", "/talent-review": "G-36,F-1", "/tenant-blueprints": "P-5,V-10",
    "/tenant-blueprints/[id]": "V-10,P-5", "/tenant-blueprints/[id]/versions/[n]/build": "V-15,V-16,F-1,P-5",
    "/tenant-blueprints/[id]/versions/[n]/diff": "P-5", "/tenants/[tenantId]/enterprise-typing": "V-5,S-5",
    "/time-off": "F-1,G-36,G-14", "/users": "S-6", "/users/[userId]": "S-6,V-6,F-1",
    "/visualizations": "F-1", "/whistleblowing": "S-10", "/whistleblowing-console": "S-5,P-9", "/privacy": "G-11,G-29",
}
TRASVERSALI = "S-1,S-25,F-1,F-4,F-5,F-6,P-3"


def pagine() -> None:
    app = os.path.join(RADICE, "apps/web/src/app")
    trovate = []
    for d, _, files in os.walk(app):
        if "page.tsx" in files:
            rel = os.path.relpath(d, app)
            parti = [p for p in rel.split(os.sep) if p != "." and not (p.startswith("(") and p.endswith(")"))]
            trovate.append("/" + "/".join(parti))
    for route in sorted(trovate):
        if route.startswith("/showcase"):
            aggiungi("pagine di main", route, "vetrina di marca", "S-4")
            continue
        specifiche = PAGINE_SPECIFICHE.get(route, "")
        voci = ",".join(v for v in [specifiche, TRASVERSALI if route not in ("/demo", "/investors") else ""] if v)
        aggiungi("pagine di main", route, "pagina dell'applicazione web" + ("" if specifiche else " (solo voci trasversali: nessun rilievo specifico nell'analisi)"), voci)


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    base = sys.argv[1]

    pagine()

    for k, (v, m) in DIFETTI.items():
        aggiungi("difetti V4/V9(m)/V12", k, "difetto", v, m)
    for x in tsv(base, "V2_permessi/incoerenze.tsv"):
        aggiungi("V2 incoerenze.tsv", x["id"], x["descrizione"], INCOERENZE[x["id"]], INC_MOTIVI.get(x["id"], ""))
    for x in tsv(base, "V1_inventario/anomalie.tsv"):
        aggiungi("V1 anomalie.tsv", x["id"], x["tipo"] + ": " + x["oggetto"], ANOMALIE_TIPO.get(x["tipo"], ""))
    for i, x in enumerate(tsv(base, "V4_confronto/pagine_attese_vs_viste.tsv"), 2):
        if x["esito"] == "coerente":
            aggiungi("V4 pagine_attese_vs_viste.tsv", f"riga {i}", "coerente", "", "coerente: nessun rilievo")
            continue
        if x["esito"].startswith("non valutabile"):
            aggiungi("V4 pagine_attese_vs_viste.tsv", f"riga {i}", x["url_giro"] + " " + x["sigla"], "F-9" if "codice" in x["esito"] else "",
                     "" if "codice" in x["esito"] else "non valutabile nel giro del 31/10, superato dal giro V12")
            continue
        voci = motivo = ""
        for patt, v, m in CAUSE:
            if re.search(patt, x["causa_probabile"]):
                voci, motivo = v, m
                break
        aggiungi("V4 pagine_attese_vs_viste.tsv", f"riga {i}", f"{x['url_giro']} {x['sigla']} {x['esito']}", voci, motivo)
    for i, x in enumerate(tsv(base, "V4_confronto/concessioni_attese_vs_reali.tsv"), 2):
        d = x["differenza"]
        if d == "uguale":
            aggiungi("V4 concessioni_attese_vs_reali.tsv", f"riga {i}", "uguale", "", "uguale: nessun rilievo")
        elif d.startswith("non confrontabile"):
            aggiungi("V4 concessioni_attese_vs_reali.tsv", f"riga {i}", x["ruolo"] + " " + x["permesso"], "P-6")
        else:
            aggiungi("V4 concessioni_attese_vs_reali.tsv", f"riga {i}", x["ruolo"] + " " + x["permesso"], "S-21")
    for i, x in enumerate(tsv(base, "V6_qualita/formattazione.tsv"), 2):
        aggiungi("V6 formattazione.tsv", f"riga {i}", x["pagina"] + ": " + x["aspetto"], FORMATTAZIONE.get(i, ""),
                 "esito ok nell'analisi" if x["esito"] == "ok" else "")
    for i, x in enumerate(tsv(base, "V6_qualita/contratti.tsv"), 2):
        aggiungi("V6 contratti.tsv", f"riga {i}", x["endpoint"] + " " + x["campo"], CONTRATTI.get(i, ""),
                 "schema coerente secondo l'analisi" if x["rischio"].startswith("OK") else "")
    for i, x in enumerate(tsv(base, "V6_qualita/prontezza_agenti.tsv"), 2):
        aggiungi("V6 prontezza_agenti.tsv", f"riga {i}", x["criterio"], PRONTEZZA.get(i, ""),
                 "esito ok nell'analisi" if x["esito"] == "ok" else "")
    for i, x in enumerate(tsv(base, "V7_lacune/copertura.tsv"), 2):
        aggiungi("V7 copertura.tsv", f"riga {i}", x["funzione"], FUNZIONI.get(i, ""),
                 "coperta in UI: valgono le voci trasversali delle sue pagine" if x["stato"] == "coperta in UI" else "")
    for x in tsv(base, "V7_lacune/debiti.tsv"):
        v, m = DEBITI.get(x["id originale"], ("", ""))
        aggiungi("V7 debiti.tsv", x["id originale"], x["titolo"], v, m)
    for i, x in enumerate(tsv(base, "V8_mercato/matrice_funzioni.tsv"), 2):
        h = x["Heuresys"]
        aggiungi("V8 matrice_funzioni.tsv", f"riga {i}", x["funzione"], MERCATO.get(i, ""),
                 "" if i in MERCATO else ("coperta in Heuresys secondo il confronto" if h.startswith("coperta") else ""))
    for k, v in INTEGRABILITA.items():
        aggiungi("V8 integrabilita.md §9", f"proposta {k}", "esposizione per integrarsi", v)
    for x in tsv(base, "V5_database/copertura_tabelle.tsv"):
        c = x["classe"]
        if c == "in interfaccia":
            aggiungi("V5 copertura_tabelle.tsv", x["oggetto"], c, "", "già in interfaccia")
        elif c.startswith("tecnica"):
            aggiungi("V5 copertura_tabelle.tsv", x["oggetto"], c, "", "tabella tecnica o di servizio: non si mostra")
        elif c == "vuota":
            aggiungi("V5 copertura_tabelle.tsv", x["oggetto"], c, "G-42")
        else:
            aggiungi("V5 copertura_tabelle.tsv", x["oggetto"], c, TABELLE_SPECIFICHE.get(x["oggetto"], "G-41"))
    for k, (v, m) in TEMI_V10.items():
        aggiungi("V10 registro dei temi", f"tema {k}", "tema", v, m)
    for k, (v, m) in DECISIONI_V9.items():
        aggiungi("V9 sezione (b)", f"decisione {k}", "decisione per Enzo", v, m)
    for k, (v, m) in RACCOMANDAZIONI_V9.items():
        aggiungi("V9 sezione (j)", f"raccomandazione {k}", "raccomandazione", v, m)
    aggiungi("V9 sezione (l)", "composizione da dati", "interfacce composte dai dati", "K-1,K-2,K-3")
    for k, v in PRONTEZZA_V4.items():
        aggiungi("V4 prontezza_agenti.md", k, "mancanza per gli agenti", v)
    for k, (v, m) in PROVE_V4.items():
        aggiungi("V4 LEGGIMI prove dal vivo", k, "prova da fare", v, m)
    for k, v in {"perimetro: performance-reviews per MANAGER e due capi": "S-24",
                 "perimetro: seed-acquisition-runs per DATA_STEWARD": "",
                 "accuratezza: kpi-definitions 233 contro 0": "P-3",
                 "chiamate 403 sugli endpoint elencati": "S-25",
                 "osservazione /admin/mfa-policy": "S-15",
                 "limite 1: persona HRMS_MANAGER, TENANT_ADMIN, ORG_DIRECTOR": "P-5",
                 "limite 2: quattro ruoli senza titolare": "P-6",
                 "limite 3: tenant di piattaforma": "P-6"}.items():
        aggiungi("V12 esito ed esiti grezzi", k, "rilievo del giro con persone vere", v,
                 "" if v else "non è una fuga: il campo descrive fonti di caricamento, non persone (V12 punto 3)")
    for k, (v, m) in {"v_direzione_del_dato_violata": ("A-14", ""),
                      "v_persona_senza_secondo_fattore": ("S-14", ""),
                      "v_registro_provenienza_orfano": ("", "registro di provenienza: dato, non interfaccia; resta informativa (V5 sentinelle §2)"),
                      "62 viste vuote": ("", "devono restare a zero: sono controlli, non rilievi"),
                      "v_agente_persone_per_conversazione": ("A-12", "")}.items():
        aggiungi("V5 sentinelle.md", k, "sentinella", v, m)
    for k, v in {"1379 date grezze": "F-1", "893 decimali col punto": "F-1", "487 numeri senza separatore": "F-1",
                 "312 codici grezzi": "F-2", "80 UUID": "F-3", "paginazione inglese in /dashboard/tenant": "V-9",
                 "organico 167 contro 158": ""}.items():
        aggiungi("V6 VIVO forma e accuratezza", k, "misura dal vivo", v,
                 "" if v else "corretto su main (V10 tema 12)")

    for k, v in {"agenti AI per ruolo e compito (Oracle, ServiceNow, Workday)": "A-7",
                 "cambi proposti dall'AI con revisione umana (Oracle)": "A-8",
                 "accesso degli agenti via MCP con i permessi dell'utente (ADP, Celonis)": "A-11",
                 "riassunto AI di casi e note (ServiceNow)": "M-4",
                 "spiegazione AI della busta paga con avviso di possibile errore (JetHR)": "M-21",
                 "organigramma con colonne scelte, trascinamento, in pagina iniziale (SAP)": "M-3,K-1",
                 "rubrica sociale con profili (Oracle)": "M-1",
                 "indicatori visivi semplici, semafori (Zucchetti)": "F-5",
                 "ruoli di lettura e di autore dei cruscotti (Zucchetti)": "K-1",
                 "report standard e personalizzabili (ADP, Personio)": "M-22",
                 "percorsi guidati per gli eventi di lavoro (Workday, SAP)": "M-23",
                 "azioni di massa (UKG, ServiceNow)": "M-24",
                 "notifiche personalizzate (Factorial, ADP)": "G-8",
                 "automazioni di flusso (Factorial, Personio)": "G-24",
                 "presa visione delle policy (ADP)": "M-25",
                 "campi personalizzati (ADP, JetHR)": "M-26",
                 "note spese con lettura dei documenti (Factorial)": "",
                 "scrivania virtuale con avvisi e circolari (Zucchetti, TeamSystem)": "M-25",
                 "sicurezza dell'app mobile e attivazione su invito (Workday, TeamSystem)": "F-7",
                 "strumenti per sviluppatori, scoperta delle API (ADP)": "A-9",
                 "multilingua (Factorial, Signavio)": "F-1",
                 "simulatore del costo del personale e budget (JetHR)": "M-16",
                 "suggerimenti di modelli di processo (Signavio)": "M-17",
                 "accessibilità: nessuna dichiarazione nei fornitori": "F-6"}.items():
        aggiungi("V8 raccolta (18 file)", k, "capacità dei fornitori non presente nella matrice", v,
                 "" if v else "note spese: fuori dal perimetro HR di Heuresys (nessuna funzione di spesa nel prodotto)")

    os.makedirs(QUI, exist_ok=True)
    with open(os.path.join(QUI, "copertura.tsv"), "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, delimiter="\t", lineterminator="\n")
        w.writerow(["fonte", "riferimento", "oggetto", "esito", "voci_del_piano", "motivo_se_escluso"])
        w.writerows(righe)

    per_fonte: dict[str, Counter] = {}
    for r in righe:
        per_fonte.setdefault(r[0], Counter())[r[3]] += 1
    print("fonte\ttotale\tcon voce\tescluse con motivo\tda classificare")
    for fonte, c in per_fonte.items():
        print(f"{fonte}\t{sum(c.values())}\t{c['voce']}\t{c['escluso']}\t{c['DA-CLASSIFICARE']}")
    tot = Counter(r[3] for r in righe)
    print(f"TOTALE\t{len(righe)}\t{tot['voce']}\t{tot['escluso']}\t{tot['DA-CLASSIFICARE']}")
    for r in righe:
        if r[3] == "DA-CLASSIFICARE":
            print("DA-CLASSIFICARE:", r[0], r[1], r[2][:100])
    return 1 if tot["DA-CLASSIFICARE"] else 0


if __name__ == "__main__":
    sys.exit(main())
