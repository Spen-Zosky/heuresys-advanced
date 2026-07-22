# cli-prompt — Asse professione ISCO-08 + CP2021 (bilingue) — PROPOSTA di implementazione (Cowork → CLI)

> Data: 2026-07-22 · Autore: Cowork (Claude Opus, supervisore/architetto, read-only sulla SoT) · Progetto: heuresys-advanced

## 0. Natura di questo documento — LEGGERE PRIMA DI TUTTO

Questo NON è un mandato: è la **proposta di implementazione** di Cowork. È **tua responsabilità** (CLI = unico writer/committer di `docs/kb` e delle migration) **valutare** criticamente la proposta contro lo schema live reale, verificarne l'evidenza, e **decidere tu** se, come e quanto implementarla. Sei libero di modificarla, spezzarla, rinviarla o rifiutarne parti; le decisioni architetturali e la numerazione reale delle migration sono tue.

Cowork ha operato **read-only**: nessuna migration creata/applicata, nulla scritto in `docs/kb/*` fuori da `COWORK_INBOX.md`. I dati e il DDL che trovi qui sono materiale grezzo da vagliare, non verità da applicare alla cieca.

Nota protocollo: per heuresys-advanced il ciclo `cowork_code_exchange` (PROMPT/PLAN/EXEC/REPORT) è **congelato**; lavori in diretta. Riconcilia usando `docs/kb/` e marca le entry di `COWORK_INBOX.md` come `[RICONCILIATA <sha>]` quando decidi.

## 1. Punto di partenza

Espandi **`cli-next.zip`** (in `D:\enzospenuso\Downloads\`) e leggi PRIMA **`MANIFEST.md`**. Contenuto dell'archivio:
- `heuresys_classificazioni_reconciliation_2026-07-22.md` — riconciliazione + audit + gap + design (DDL PROPOSED, con diagrammi).
- `occupation_classifications_seed_IT_2026-07-22.csv` — BASE IT-canonico (2121 righe).
- `occupation_reference_translations_EN_FULL_2026-07-22.csv` — overlay EN (2121 righe).
- `000202_reference_translation_coverage_PROPOSED.sql` — vista di copertura i18n (DDL PROPOSED).
- `occupation_classifications_bilingual_2026-07-22.csv` — vista IT+EN (solo ispezione).

## 2. Contesto (parti da zero)

DB Postgres locale `:5433` (db `heuresys_advanced`, schema `sys.*`), repo `D:\heuresys-advanced`. Asse ATTIVITÀ economica (ATECO 2025 + NACE + crosswalk) già completo nel DB. La proposta aggiunge l'asse PROFESSIONE come catalogo di prima classe (ISCO-08 gerarchico + CP2021 nazionale), **bilingue** (IT canonico in-row + overlay EN), simmetrico all'asse attività. Oggi l'ISCO esiste solo come attributo `esco_occupation_mapping_isco_code`; nessun catalogo ISCO gerarchico né CP2021.

## 3. File da leggere prima di decidere (path assoluti)

- `D:\heuresys-advanced\docs\kb\COWORK_INBOX.md` → entry **2026-07-22** ("Asse professione", "i18n coverage gate", note avanzamento): è la proposta completa, evidence-based.
- `heuresys_classificazioni_reconciliation_2026-07-22.md` (nello zip) → audit + gap + DDL PROPOSED.
- Per allineamento pattern/invarianti: `db/migrations/000007` (activity_classifications), `000010` (esco_occupation_mappings), `000112` (crosswalk deterministico), `000190` (`sys_reference_translations` + `sys_translatable_field`); `docs/architecture/adr/0029` (i18n), `0016` (indipendenza catalogo ESCO), `0023` (no-PII).

## 4. Riferimenti metodologici e formali seguiti da Cowork

- **Governance**: SoT di stato = `docs/kb` (CLI-owned); Cowork read-only; proposte solo via `COWORK_INBOX`. Ogni asserzione è **evidence-based** (`verified-by`: comando + output + timestamp).
- **Audit sistematico**: enumerazione, grep sistematici, conteggi esatti, verifica **live sul DB** `:5433`; nessuna assunzione (R5 test-before-claim, R10 no-hallucination); **secret hygiene** R11 (password mai loggata: `.env` parsato in-process, usata solo via env var).
- **Design** allineato ai pattern esistenti: naming `sys.sys_<entity>`, PK uuid `gen_random_uuid()`, `scheme`/`code`/`parent_code`, unique `(scheme,code)`, parent index parziale, `metadata jsonb`, trigger `sys_set_updated_at()`. Invarianti: **I3/I4** (nessun nuovo schema di dominio — riuso `sys.*`), **ADR-0016** (catalogo occupazioni indipendente da `job_role`, additivo non-breaking), **ADR-0023** (no-PII globale), **ADR-0029** (i18n: IT canonico in-row + overlay EN in `sys_reference_translations`, registry-driven).
- **Fonti dati ufficiali**: struttura ISCO-08 ILO (EN); titoli ISCO-08 **IT via ESCO API** (`ec.europa.eu/esco/api`, `language=it`, walk dell'albero, 619/619, 0 errori); CP2021 Istat/INAIL (IT); ATECO/NACE già nel DB. Traduzioni EN del CP2021 generate via **LLM** (non ufficiali — CP2021 non ha EN ufficiale), marcate `source='LLM'`; EN ISCO da ILO/ESCO marcate `source='HARVEST'`.
- **Definition of Done** (regola Enzo): nessun task è "done" senza dimostrazione **live E2E su dati reali**; migration-apply o input umano mancanti → stato `blocked-on-Enzo`, mai "done".

## 5. Proposta di implementazione (da valutare, non da applicare ciecamente)

### 5.1 Schema (DDL PROPOSED — numerazione INDICATIVA; max attuale 000199 → riassegnala tu)
- `sys.sys_occupation_classifications` (scheme `ISCO_08`/`CP_2021`/`ESCO?`; `code`, `parent_code`, `level`, `name`, `metadata`; CHECK scheme; unique `(scheme,code)`; parent idx; trigger). Dettaglio DDL nel doc §6.1.
- `sys.sys_occupation_classification_mappings` (source/target FK self-referencing; `kind` EXACT/NARROWER/BROADER/RELATED/APPROXIMATE; `confidence`; unique pair). Gemella di `000007 §2`. Doc §6.2.
- Aggancio ESCO **additivo non-breaking**: VIEW `sys_esco_isco_resolved` (LEFT JOIN su `split_part(esco_occupation_mapping_isco_code,'.',1)`) e/o FK nullable opzionale (valuta tu — ADR-0016). Doc §6.3.
- `000202_reference_translation_coverage_PROPOSED.sql` (nello zip): `fn_reference_translation_coverage()` + vista `v_reference_translation_coverage`, registry-driven — gate di completezza EN complementare alla vista orfani di `000190`.

### 5.2 Dati (dallo zip)
- **BASE** `occupation_classifications_seed_IT_...csv` (`scheme,code,parent_code,level,name`) → INSERT in `sys_occupation_classifications` con `name` = valore IT canonico in-row. ISCO_08 619 + CP_2021 1502.
- **OVERLAY EN** `occupation_reference_translations_EN_FULL_...csv` (`entity_table,entity_ref,field,locale,text,source`) → INSERT in `sys_reference_translations`; `entity_ref = <scheme>:<code>` → **risolvi `entity_id`** da `(scheme,code)` DOPO il load del BASE.

### 5.3 Registrazione i18n
INSERT in `sys.sys_translatable_field`: `(sys_occupation_classifications, occupation_classification_id, 'name', occupation_classification_name, canonical_locale='it')`. Valuta se registrare anche `'description'` (il seed porta solo `name`).

### 5.4 Ordine proposto
apply DDL → load BASE → load OVERLAY (resolve id) → register field → esegui gate coverage.

## 6. Verifiche post-esecuzione (output numerico atteso — usale per validare la TUA implementazione)

- `SELECT scheme, count(*) FROM sys.sys_occupation_classifications GROUP BY 1;` → **ISCO_08 = 619, CP_2021 = 1502**.
- ISCO per livello: **10 / 43 / 130 / 436**. CP2021 per livello: **9 / 40 / 130 / 510 / 813**.
- Overlay per queste entity in `sys_reference_translations` (locale `en`): **2121** (619 ISCO `HARVEST` + 1502 CP `LLM`).
- Integrità: `SELECT count(*) FROM sys.v_reference_translation_orphans;` → invariato (0 sulle nuove entity).
- **GATE**: `SELECT * FROM sys.v_reference_translation_coverage WHERE missing > 0;` → **VUOTO** per il campo `name` dell'asse professione.
- DoD live: endpoint (es. `GET /v1/occupation-classifications?scheme=ISCO_08`, o come decidi di esporlo) che restituisce l'albero reale IT/EN via `x-locale`.

## 7. Punti che DEVI valutare/decidere tu (Cowork NON li decide)

1. **Numerazione reale** delle migration (000200/000201/000202 sono placeholder).
2. **Strategia di load**: connettore idempotente stile `istat-ateco-connector.ts` vs migration seed/COPY; meccanica di resolution `entity_id` per gli overlay.
3. **Qualità traduzioni EN del CP2021**: sono **LLM-generate, non ufficiali** → decidi tu il livello di QA/accettazione e se rivederle/rigenerarle. Le EN ISCO sono autorevoli (ILO/ESCO).
4. **Aggancio ESCO**: VIEW vs FK additiva.
5. **CHECK scheme**: includere `'ESCO'` o limitare a `ISCO_08`/`CP_2021`.
6. Se/come popolare `description` (il seed non la porta).
7. Item collaterale della proposta: **qualità dati NACE legacy** (L2/L3 = 88/305) — confermare currency vs NACE Rev 2.1 su RAMON o deprecare i base a favore di `ATECO_2025` (asse canonico, mig 000119).
8. Riconciliazione: marca le entry `COWORK_INBOX` 2026-07-22 come `[RICONCILIATA <sha>]`.

## 8. Vincoli / divieti

- **Nessuna migration applicata senza go di Enzo** (DoD: apply mancante → `blocked-on-Enzo`).
- Rispetta gli invarianti (I3/I4 no nuovi schemi; ADR-0023 no-PII; naming `sys.*`).
- Non trattare i CSV come autoritativi alla cieca: **verificali contro fonti/DB** prima del commit.
- Secret hygiene (R11): nessuna credenziale in commit/log.

## 9. Gestione errori

- Se un conteggio non matcha l'atteso → **FERMA**, documenta, non forzare.
- Se il design confligge con lo schema reale → **prevale lo schema reale**: adatta la proposta e annota la deviazione nel commit/inbox.
- Se dopo 2 tentativi un passo non si risolve → fermati e riporta.

— Fine. Questa è una proposta: la decisione finale di implementazione è tua.
