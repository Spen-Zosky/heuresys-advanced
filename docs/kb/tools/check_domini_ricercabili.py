#!/usr/bin/env python3
"""check_domini_ricercabili.py — #205 F1: la CODA dei domini ricercabili, ri-derivata dal
catalogo reale a ogni esecuzione. Gemello dichiarato di `check_concetti_agente.py`.

    python docs/kb/tools/check_domini_ricercabili.py            # la coda
    python docs/kb/tools/check_domini_ricercabili.py --selftest # autoprova a esiti opposti

LA DOTTRINA (decisioni vincolanti di `.programmi/205-tenant-builder-2b-2c.md`):
  1. 2b non e' una scelta di domini: e' una CODA. Si progetta una coda, mai un menu.
  2. Tre prove meccaniche, e ognuna deve saper dire di NO:
       R1  e' contenuto di un'azienda    -> la tabella porta una colonna `%tenant_id`
                                           (il metro di E18). Un catalogo senza tenant e'
                                           una CLASSIFICAZIONE aperta a ogni settore (I21):
                                           non si ricerca per un cliente, e' di tutti;
       R2  esiste una fonte AMMESSA       -> `sys_research_sources` porta almeno una riga
           che ne parla                      APPROVED per un dominio dichiarato che ha quella
                                           tabella come destinazione (`domains/*.ts`);
       R3  non descrive una persona       -> nessuna colonna e' il SOGGETTO di un dato di
                                           persona: `%user_id` che non sia un attore
                                           (`created_by`, `approved_by`, `_by_user_id`...),
                                           ne' nome/cognome/email/telefono/nascita.
                                           «quali competenze una posizione RICHIEDE» passa;
                                           «quali competenze Marco POSSIEDE» no.
  4. L'ordine e' per RICADUTA: quante altre tabelle di tenant referenziano questa (FK
     entranti). Un dominio che ne sblocca molti altri va prima. A parita', piu' fonti.
  ⚠ R2 NON e' riscritta al potenziale (il piano lo vieta): resta «esiste». Ma non ESCLUDE
     dalla coda: la SPACCA. Chi passa R1+R3 e' un dominio ricercabile; R2 dice se e'
     PERCORRIBILE OGGI o se ASPETTA UNA FONTE. E' cio' che il 2026-09-08 mancava per dare
     senso alla coda: con una fonte per dominio R2 «li ammetterebbe tutti e cinque» — vero,
     e infatti quei cinque sono la testa; il resto della coda e' cio' che aspetta.

LA DECISIONE DELEGATA (Enzo, 2026-09-12: «prendendo decisioni per mio conto»). Il piano
lasciava a Enzo «che cosa passa esattamente a un cliente nuovo: la sola struttura o anche le
tassonomie». Deciso qui, e reso meccanico da R1: le TASSONOMIE non passano perche' non hanno
bisogno di passare — sono gia' di tutti (I21, cataloghi senza `tenant_id`). Cio' che si
ricerca per un cliente e' cio' che gli appartiene: struttura e contenuto di tenant. E' la
lettura piu' coerente con I21 e con la 000336 («sottoprodotto dei clienti, non catalogo
anticipato»); se Enzo la ribalta, cambia R1 e non questo commento.

L'AUTOPROVA (`--selftest`) usa TABELLE VERE, non fixture: per ciascuna prova un caso che deve
passare e uno che deve essere escluso, misurati sul database. Se una delle sei attese non
regge, lo strumento esce ROSSO: un criterio che non sa dire di no tre volte non e' un
criterio, e' un elenco con una funzione davanti.

Esce 0 con la coda; 2 = NON MISURABILE (database o codice non leggibili); 1 = selftest rosso.
"""
import os
import re
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
DOMINI_TS = os.path.join(REPO, "apps", "api", "src", "modules", "research", "domains")
PONTE_TS = os.path.join(REPO, "apps", "api", "src", "modules", "research", "ponte.ts")

# Le destinazioni dei domini di contenuto (#132 F5, mig 000335: «la casa dei processi e'
# quella vecchia»). Un dominio senza destinazione qui e' un dominio che questo strumento
# non sa misurare — e lo dice, non lo salta.
DESTINAZIONE = {
    "organization_units": "sys_organization_units",
    "positions": "sys_positions",
    "skills": "sys_skills",
    "kpis": "sys_kpi_definitions",
    "business_processes": "sys_blueprint_process_registry",
    "research_sources": "sys_research_sources",
}

# R3 — le colonne che fanno di una riga «una persona». Il criterio e' l'INDIRIZZO e i
# campi anagrafici, non un nome di tabella: un nome si indovina, una colonna si misura.
RE_SOGGETTO = re.compile(
    r"(^|_)(user_id|person_id|employee_id|candidate_id|email|first_name|last_name|"
    r"phone|birth_date|date_of_birth|fiscal_code|tax_code|iban)$")
# ⚠ E un ATTORE non e' un soggetto — la distinzione gia' fatta per `link_created_by` e
# `feedback_reviewed_by_user_id` in #214: chi esamina non e' chi e' esaminato. Vale anche per
# il RESPONSABILE di un oggetto organizzativo: `position_owner_user_id` e
# `organization_unit_manager_user_id` dicono chi risponde di un POSTO o di un'UNITA', non
# chi la posizione o l'unita' descrivono (I1: position owner != incumbent). La prima corsa
# dell'autoprova ha escluso `sys_positions` proprio per l'owner: era il criterio a essere
# troppo largo, non la posizione a essere una persona.
RE_ATTORE = re.compile(r"(^|_)(created|updated|approved|decided|reviewed|submitted|"
                       r"assigned|requested|granted|revoked|deleted|closed|signed|"
                       r"published|resolved)_by(_user_id)?$|_by_user_id$|_actor_user_id$|"
                       r"(^|_)(owner|manager|responsible|approver|assessor|reviewer|"
                       r"interviewer|sponsor|mentor|coach)_user_id$")


def ceco(cosa, rimedio):
    print(f"\n  NON MISURABILE: {cosa}\n  -> {rimedio}")
    sys.exit(2)


def psql(sql):
    cmd = ["psql", "-h", os.environ.get("PGHOST", "localhost"), "-p", os.environ.get("PGPORT", "5433"),
           "-U", os.environ.get("PGUSER", "heuresys"), "-d", os.environ.get("PGDATABASE", "heuresys_advanced"),
           "-At", "-F", "\t", "-c", sql]
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=60, encoding="utf-8")
    except (OSError, subprocess.TimeoutExpired) as e:
        ceco(f"psql non risponde ({e})", "tunnel :5433 su? `ssh -fN -L 5433:localhost:5432 oracle-vm-default`")
    if out.returncode != 0:
        ceco(f"psql: {out.stderr.strip()[:200]}", "il database non ha risposto: senza di lui la coda non si deriva")
    return [r.split("\t") for r in out.stdout.strip().split("\n") if r]


def domini_dichiarati():
    """Le chiavi dei domini dal codice (`chiave: "x"`), non da questo file."""
    if not os.path.isdir(DOMINI_TS):
        ceco(f"manca {DOMINI_TS}", "il modulo research e' stato spostato: adeguare DOMINI_TS")
    chiavi = set()
    for f in os.listdir(DOMINI_TS):
        if f.endswith(".ts"):
            with open(os.path.join(DOMINI_TS, f), encoding="utf-8") as fh:
                chiavi |= set(re.findall(r'chiave:\s*"([a-z_]+)"', fh.read()))
    if not chiavi:
        ceco("nessun dominio letto da domains/*.ts", "la forma `chiave: \"...\"` e' cambiata: adeguare la lettura")
    return chiavi


def misura():
    colonne = psql("""SELECT table_name, column_name FROM information_schema.columns
                       WHERE table_schema='sys' AND table_name LIKE 'sys\\_%' ORDER BY 1, ordinal_position""")
    tab = {}
    for t, c in colonne:
        tab.setdefault(t, []).append(c)
    if not tab:
        ceco("nessuna tabella sys_* letta", "information_schema vuoto: database sbagliato?")

    fk = psql("""SELECT r.relname, f.relname FROM pg_constraint c
                  JOIN pg_class r ON r.oid=c.conrelid JOIN pg_class f ON f.oid=c.confrelid
                  JOIN pg_namespace n ON n.oid=r.relnamespace
                 WHERE n.nspname='sys' AND c.contype='f' AND r.relname<>f.relname""")
    fonti = psql("""SELECT research_source_domain, count(*) FROM sys.sys_research_sources
                     WHERE research_source_status='APPROVED' GROUP BY 1""")
    fonti = {d: int(n) for d, n in fonti}
    chiavi = domini_dichiarati()
    senza_dest = sorted(k for k in chiavi if k not in DESTINAZIONE)
    dest_di = {DESTINAZIONE[k]: k for k in chiavi if k in DESTINAZIONE}

    esito = {}
    for t, cols in tab.items():
        r1 = any(c.endswith("tenant_id") for c in cols)
        soggetti = [c for c in cols if RE_SOGGETTO.search(c) and not RE_ATTORE.search(c)]
        r3 = not soggetti
        dominio = dest_di.get(t)
        r2 = bool(dominio and fonti.get(dominio, 0) > 0)
        esito[t] = dict(r1=r1, r2=r2, r3=r3, soggetti=soggetti, dominio=dominio,
                        fonti=fonti.get(dominio, 0) if dominio else 0)
    # ricaduta: FK entranti da tabelle di tenant
    ricaduta = {t: 0 for t in tab}
    for figlia, madre in fk:
        if madre in ricaduta and figlia in esito and esito[figlia]["r1"]:
            ricaduta[madre] += 1
    for t in esito:
        esito[t]["ricaduta"] = ricaduta[t]
    return esito, senza_dest, fonti


def coda(esito):
    ricercabili = {t: e for t, e in esito.items() if e["r1"] and e["r3"]}
    chiave = lambda kv: (-kv[1]["ricaduta"], -kv[1]["fonti"], kv[0])
    pronti = sorted(((t, e) for t, e in ricercabili.items() if e["r2"]), key=chiave)
    in_attesa = sorted(((t, e) for t, e in ricercabili.items() if not e["r2"]), key=chiave)
    di_persona = sorted(t for t, e in esito.items() if e["r1"] and not e["r3"])
    cataloghi = sorted(t for t, e in esito.items() if not e["r1"])
    return pronti, in_attesa, di_persona, cataloghi


def stampa(esito, senza_dest, fonti):
    pronti, in_attesa, di_persona, cataloghi = coda(esito)
    print("=" * 92)
    print(" #205 — DOMINI RICERCABILI: la coda, ri-derivata dal catalogo reale")
    print(" R1 contenuto d'azienda · R2 esiste una fonte ammessa · R3 non descrive una persona")
    print("=" * 92)
    print(f"  tabelle sys_* (oggi)             {len(esito)}")
    print(f"  cataloghi aperti (R1 no, I21)     {len(cataloghi)}   restano di tutti: non si ricercano per un cliente")
    print(f"  di persona (R1 si', R3 no)        {len(di_persona)}   mai ricercabili: descrivono chi, non che cosa")
    print(f"  RICERCABILI (R1+R3)               {len(pronti) + len(in_attesa)}")
    print(f"    percorribili OGGI (R2 si')      {len(pronti)}")
    print(f"    aspettano una fonte (R2 no)     {len(in_attesa)}")
    print(f"  fonti APPROVED per dominio        {', '.join(f'{d}={n}' for d, n in sorted(fonti.items())) or 'nessuna'}")
    if senza_dest:
        print(f"  ⚠ domini dichiarati SENZA destinazione qui: {', '.join(senza_dest)} — non misurabili da questo strumento")
    # un dominio con una fonte APPROVED la cui destinazione NON e' contenuto di tenant: la
    # fonte c'e', ma cio' che produrrebbe non appartiene a un cliente. Misurato il
    # 2026-09-12: `business_processes` -> `sys_blueprint_process_registry`, senza tenant_id.
    fuori = [f"{e['dominio']} -> {t}" for t, e in esito.items()
             if e["dominio"] and e["fonti"] > 0 and not (e["r1"] and e["r3"])]
    if fuori:
        print(f"  ⚠ domini CON fonte ma destinazione non ricercabile (R1/R3): {', '.join(sorted(fuori))}")
    print("-" * 92)
    print("  PERCORRIBILI OGGI — per ricaduta (FK entranti da tabelle di tenant), poi per fonti:")
    for t, e in pronti:
        print(f"    {t:44s} ricaduta {e['ricaduta']:3d} · fonti {e['fonti']} · dominio `{e['dominio']}`")
    print("-" * 92)
    print("  ASPETTANO UNA FONTE — i primi venti per ricaduta (la coda intera e' piu' lunga):")
    for t, e in in_attesa[:20]:
        print(f"    {t:44s} ricaduta {e['ricaduta']:3d}")
    if len(in_attesa) > 20:
        print(f"    … e altre {len(in_attesa) - 20}")
    print("-" * 92)
    print("  DI PERSONA (esclusi da R3), i primi dieci con la colonna che li esclude:")
    for t in di_persona[:10]:
        print(f"    {t:44s} {', '.join(esito[t]['soggetti'][:3])}")
    print("=" * 92)


# Le sei attese dell'autoprova, su tabelle VERE. Ognuna e' un fatto misurabile che puo'
# smettere di essere vero — e allora lo strumento deve dirlo, non adattarsi.
ATTESE = [
    ("R1 passa", "sys_positions", "r1", True),
    ("R1 esclude un catalogo senza tenant", "sys_operating_model_catalog", "r1", False),
    ("R2 passa dove c'e' una fonte APPROVED", "sys_positions", "r2", True),
    ("R2 esclude una tabella di tenant senza dominio", "sys_teams", "r2", False),
    ("R3 passa (una posizione non e' una persona)", "sys_positions", "r3", True),
    ("R3 esclude cio' che una persona possiede", "sys_user_skills", "r3", False),
    ("R3 passa su un'unita' (il manager e' un attore)", "sys_organization_units", "r3", True),
    ("R3 esclude una valutazione (ha un soggetto)", "sys_assessments", "r3", False),
]


def selftest(esito):
    rossi = 0
    for nome, tabella, prova, atteso in ATTESE:
        e = esito.get(tabella)
        if e is None:
            print(f"  [!!] {nome}: la tabella `{tabella}` non esiste piu' — l'attesa va aggiornata")
            rossi += 1
            continue
        ok = e[prova] is atteso
        print(f"  [{'OK' if ok else '!!'}] {nome}: `{tabella}` {prova}={e[prova]} (atteso {atteso})")
        rossi += 0 if ok else 1
    # e la controprova sul criterio stesso: un attore NON e' un soggetto
    ok = bool(RE_ATTORE.search("approved_by_user_id")) and bool(RE_ATTORE.search("position_owner_user_id")) and not bool(RE_ATTORE.search("hired_user_id")) and not bool(RE_ATTORE.search("assessment_subject_user_id"))
    print(f"  [{'OK' if ok else '!!'}] R3 distingue l'attore (approved_by, owner) dal soggetto (hired, subject)")
    rossi += 0 if ok else 1
    print(f"\n  {len(ATTESE) + 1 - rossi}/{len(ATTESE) + 1} attese verdi")
    return 1 if rossi else 0


def main(argv):
    esito, senza_dest, fonti = misura()
    if "--selftest" in argv:
        return selftest(esito)
    stampa(esito, senza_dest, fonti)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
