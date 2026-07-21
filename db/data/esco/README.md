# ESCO dataset (v1.2.0, IT) — input di riferimento per l'i18n dei dati

**Provenienza**: dataset ufficiale ESCO (European Skills, Competences, Qualifications and Occupations) v1.2.0, classificazione, lingua **italiano**, formato CSV. Scaricabile pubblicamente dal portale ESCO della Commissione Europea (sezione *Download*, `ESCO dataset - v1.2.0 - classification - it - csv.zip`).

**Uso**: fonte autoritativa multilingua per il bilinguismo dei dati di riferimento (ADR-0029). Le competenze `sys.sys_skills` sono joinate per `skill_esco_uri = conceptUri`.

## Cosa è versionato e cosa no

- **Versionato**: `convert-esco-csv-to-tsv.py` (convertitore), i loader `db/scripts/populate-*-it.sql`, questo README.
- **NON versionato** (gitignored — grande, ri-scaricabile/rigenerabile): il dump `.zip`, i `.csv` estratti, i `.tsv` generati.

## Rigenerazione dei TSV (per un DB fresco / nuovo ambiente)

```bash
# 1. estrai i CSV rilevanti dal dump nella cartella scratch
unzip -o "ESCO dataset - v1.2.0 - classification - it - csv.zip" \
  skills_it.csv skillGroups_it.csv broaderRelationsSkillPillar_it.csv -d db/data/esco/
# 2. converti in TSV puliti (rimuove tab/newline dai campi testo)
py db/data/esco/convert-esco-csv-to-tsv.py db/data/esco
# → skills_it.tsv, skillgroups_it.tsv, broader_it.tsv
```

## Lingue

Usiamo **IT** (canonico in-row) + **EN** (in `sys_reference_translations`). Entrambi i dump ufficiali ESCO v1.2.0 servono: `- it - csv.zip` (canonico) e `- en - csv.zip` (traduzioni EN). Rigenerare i TSV EN come per l'IT: `unzip ... skills_en.csv skillGroups_en.csv` → `py convert-esco-csv-to-tsv.py` produce anche `skills_en.tsv`/`skillgroups_en.tsv` (adattare i nomi file). (Il dump `- es -` spagnolo NON è usato.)

## Loader

- `db/scripts/populate-skill-descriptions-it.sql` — descrizioni competenze IT in-row + EN in `sys_reference_translations` (13.933 skill, idempotente).
- `db/scripts/populate-skill-ontology-it.sql` — nodi-gruppo + gerarchia + skill→gruppo + edge IS-A (ADR-0030).
- `db/scripts/populate-en-from-esco.sql` — bilinguismo EN completo: nomi+descrizioni skill EN + gruppi EN (dal dump `- en -`).

I file CSV chiave del dump: `skills_it.csv` (13.939 competenze: uri/label/descrizione), `skillGroups_it.csv` (gruppi), `broaderRelationsSkillPillar_it.csv` (relazioni broader skill→gruppo e gruppo→gruppo), `skillsHierarchy_it.csv` (gerarchia a livelli).
