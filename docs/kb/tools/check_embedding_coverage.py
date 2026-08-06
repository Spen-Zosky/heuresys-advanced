#!/usr/bin/env python3
"""
check_embedding_coverage.py — copertura del substrato semantico, con esito binario.

Perche' esiste
--------------
Il substrato vettoriale (pgvector, quattro tabelle `sys.sys_*_embeddings`) e'
popolato, ma nessuno strumento del progetto diceva **quanto**. La domanda «i
vettori ci sono tutti?» si rispondeva a mano, con `count(*)` scritti al momento,
e la risposta invecchiava appena qualcuno aggiungeva una competenza o un ruolo.
Peggio: un corpus scoperto non produce un errore — produce risultati di ricerca
semantica silenziosamente piu' poveri, perche' cio' che non ha vettore non puo'
essere trovato.

Due denominatori, non uno
-------------------------
Contare le righe della tabella sorgente da' una percentuale **falsa**, perche' il
backfill non embedda tutto: scarta le righe senza nome, e per le occupazioni
lavora su URI distinti. Per i profili persona la differenza e' ancora piu' netta:
il profilo si deriva da chi ha almeno una competenza con evidenza, quindi una
persona senza competenze **non e' scoperta, e' fuori corpus**.
Questo script riporta entrambi i numeri e calcola la percentuale su quello
giusto — le definizioni sono copiate da `apps/api/src/modules/semantic-matching/
repository.ts` (`readSkillCorpus`, `readJobRoleCorpus`, `readOccupationCorpus`,
`deriveUserProfiles`) e vanno tenute allineate a quelle.

Esito binario: exit 1 se un corpus e' sotto il 100% degli eleggibili **oppure**
se in una tabella compare piu' di un modello di embedding (vettori di modelli
diversi non vivono nello stesso spazio: confrontarli da' somiglianze sbagliate).
Exit 2 se il database non risponde — non misurato non e' «tutto bene».

Nessun numero e' scritto a mano: tutto si ri-deriva dal database vivo.
Sola lettura, idempotente, nessuna dipendenza esterna.

Uso:
    python docs/kb/tools/check_embedding_coverage.py
    python docs/kb/tools/check_embedding_coverage.py --json <file>
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys

PSQL = ["psql",
        "-h", os.environ.get("PGHOST", "localhost"),
        "-p", os.environ.get("PGPORT", "5433"),
        "-U", os.environ.get("PGUSER", "heuresys"),
        "-d", os.environ.get("PGDATABASE", "heuresys_advanced"),
        "-At", "-F", "\t"]

# Ogni corpus dichiara: come si contano le righe SORGENTE grezze, come si contano
# quelle ELEGGIBILI (la definizione che usa davvero il backfill), e dove vivono i
# vettori. La query e' una sola: una connessione, non quattro.
CORPUS_SQL = """
WITH
skills AS (
  SELECT 'skills' AS corpus,
         (SELECT count(*) FROM sys.sys_skills)                                          AS grezze,
         (SELECT count(*) FROM sys.sys_skills
           WHERE skill_name IS NOT NULL AND btrim(skill_name) <> '')                    AS eleggibili,
         (SELECT count(*) FROM sys.sys_skill_embeddings)                                AS con_vettore,
         (SELECT count(DISTINCT model_id) FROM sys.sys_skill_embeddings)                AS modelli,
         (SELECT coalesce(string_agg(DISTINCT coalesce(model_id,'(nullo)'), ', '),'-')
            FROM sys.sys_skill_embeddings)                                              AS elenco_modelli,
         (SELECT coalesce(min(created_at)::date::text,'-') FROM sys.sys_skill_embeddings) AS piu_vecchio,
         (SELECT coalesce(max(created_at)::date::text,'-') FROM sys.sys_skill_embeddings) AS piu_recente
),
job_roles AS (
  SELECT 'job_roles',
         (SELECT count(*) FROM sys.sys_job_roles),
         (SELECT count(*) FROM sys.sys_job_roles
           WHERE job_role_name IS NOT NULL AND btrim(job_role_name) <> ''),
         (SELECT count(*) FROM sys.sys_job_role_embeddings),
         (SELECT count(DISTINCT model_id) FROM sys.sys_job_role_embeddings),
         (SELECT coalesce(string_agg(DISTINCT coalesce(model_id,'(nullo)'), ', '),'-')
            FROM sys.sys_job_role_embeddings),
         (SELECT coalesce(min(created_at)::date::text,'-') FROM sys.sys_job_role_embeddings),
         (SELECT coalesce(max(created_at)::date::text,'-') FROM sys.sys_job_role_embeddings)
),
occupations AS (
  SELECT 'occupations',
         (SELECT count(*) FROM sys.sys_esco_occupation_mappings),
         (SELECT count(DISTINCT esco_occupation_mapping_esco_uri)
            FROM sys.sys_esco_occupation_mappings
           WHERE esco_occupation_mapping_esco_label IS NOT NULL
             AND btrim(esco_occupation_mapping_esco_label) <> ''),
         (SELECT count(*) FROM sys.sys_esco_occupation_embeddings),
         (SELECT count(DISTINCT model_id) FROM sys.sys_esco_occupation_embeddings),
         (SELECT coalesce(string_agg(DISTINCT coalesce(model_id,'(nullo)'), ', '),'-')
            FROM sys.sys_esco_occupation_embeddings),
         (SELECT coalesce(min(created_at)::date::text,'-') FROM sys.sys_esco_occupation_embeddings),
         (SELECT coalesce(max(created_at)::date::text,'-') FROM sys.sys_esco_occupation_embeddings)
),
user_profiles AS (
  -- Eleggibile = chi ha almeno una competenza con evidenza CHE ABBIA un vettore:
  -- e' esattamente il FROM/JOIN di deriveUserProfiles. Una persona senza
  -- competenze non e' scoperta, e' fuori corpus.
  SELECT 'user_profiles',
         (SELECT count(*) FROM sys.sys_users),
         (SELECT count(DISTINCT ev.user_skill_evidence_user_id)
            FROM sys.sys_user_skill_evidence ev
            JOIN sys.sys_skill_embeddings se ON se.skill_id = ev.user_skill_evidence_skill_id
            JOIN sys.sys_users u ON u.user_id = ev.user_skill_evidence_user_id),
         (SELECT count(*) FROM sys.sys_user_profile_embeddings),
         (SELECT count(DISTINCT model_id) FROM sys.sys_user_profile_embeddings),
         (SELECT coalesce(string_agg(DISTINCT coalesce(model_id,'(nullo)'), ', '),'-')
            FROM sys.sys_user_profile_embeddings),
         (SELECT coalesce(min(created_at)::date::text,'-') FROM sys.sys_user_profile_embeddings),
         (SELECT coalesce(max(created_at)::date::text,'-') FROM sys.sys_user_profile_embeddings)
)
SELECT * FROM skills
UNION ALL SELECT * FROM job_roles
UNION ALL SELECT * FROM occupations
UNION ALL SELECT * FROM user_profiles;
"""

COLONNE = ["corpus", "grezze", "eleggibili", "con_vettore", "modelli",
           "elenco_modelli", "piu_vecchio", "piu_recente"]


def interroga() -> list[dict]:
    try:
        out = subprocess.run(PSQL + ["-c", CORPUS_SQL], capture_output=True,
                             text=True, timeout=120, encoding="utf-8", errors="replace")
    except (OSError, subprocess.TimeoutExpired) as e:
        print(f"[ERRORE] psql non eseguibile o in timeout: {e}", file=sys.stderr)
        sys.exit(2)
    if out.returncode != 0:
        print(f"[ERRORE] database non raggiungibile:\n{out.stderr.strip()}", file=sys.stderr)
        sys.exit(2)

    righe = []
    for linea in out.stdout.strip().splitlines():
        campi = linea.split("\t")
        if len(campi) != len(COLONNE):
            continue
        r = dict(zip(COLONNE, campi))
        for k in ("grezze", "eleggibili", "con_vettore", "modelli"):
            r[k] = int(r[k])
        r["scoperte"] = max(0, r["eleggibili"] - r["con_vettore"])
        r["pct"] = (100.0 * r["con_vettore"] / r["eleggibili"]) if r["eleggibili"] else 100.0
        righe.append(r)
    return righe


def main() -> int:
    ap = argparse.ArgumentParser(description="Copertura del substrato semantico (sola lettura).")
    ap.add_argument("--json", metavar="FILE", help="scrive il referto anche come JSON")
    args = ap.parse_args()

    righe = interroga()
    if not righe:
        print("[ERRORE] nessuna riga letta: la query non ha prodotto risultati", file=sys.stderr)
        return 2

    print("=" * 100)
    print(" COPERTURA DEL SUBSTRATO SEMANTICO — ri-derivata dal database vivo")
    print("=" * 100)
    print(f"{'corpus':<15}{'sorgente':>10}{'eleggibili':>12}{'con vett.':>11}"
          f"{'scoperte':>10}{'%':>8}  {'modelli':<22}{'dal':<12}{'al':<12}")
    print("-" * 100)

    allarmi: list[str] = []
    for r in righe:
        stato = "  " if (r["scoperte"] == 0 and r["modelli"] <= 1) else "!!"
        print(f"{stato}{r['corpus']:<13}{r['grezze']:>10}{r['eleggibili']:>12}"
              f"{r['con_vettore']:>11}{r['scoperte']:>10}{r['pct']:>7.1f}%  "
              f"{r['elenco_modelli']:<22}{r['piu_vecchio']:<12}{r['piu_recente']:<12}")
        if r["scoperte"] > 0:
            allarmi.append(f"{r['corpus']}: {r['scoperte']} righe eleggibili senza vettore "
                           f"({r['pct']:.1f}% di copertura)")
        if r["modelli"] > 1:
            allarmi.append(f"{r['corpus']}: {r['modelli']} modelli diversi nella stessa tabella "
                           f"({r['elenco_modelli']}) — i vettori non sono confrontabili fra loro")

    print("-" * 100)
    print("«sorgente» = righe della tabella grezza · «eleggibili» = quelle che il backfill embedda davvero")
    print("(le due colonne divergono per costruzione: vedi l'intestazione di questo file)")

    if args.json:
        with open(args.json, "w", encoding="utf-8") as fh:
            json.dump({"corpora": righe, "allarmi": allarmi}, fh, ensure_ascii=False, indent=2)
        print(f"referto JSON: {args.json}")

    if allarmi:
        print("\nESITO: SCOPERTO")
        for a in allarmi:
            print(f"  - {a}")
        return 1
    print("\nESITO: copertura piena e modello unico su tutti i corpus")
    return 0


if __name__ == "__main__":
    sys.exit(main())
