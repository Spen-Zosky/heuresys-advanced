# storia36 — Convenzioni del repo per i deliverable C0 (Task D)

Analisi read-only eseguita 2026-07-27 (DB via tunnel `localhost:5433`, `heuresys_advanced`).
Scopo: fissare le convenzioni a cui devono aderire seed SQL, batteria verify ed entrypoint bash di storia36.

---

## 1. Le viste di integrità e come `db:validate` decide successo/fallimento

`package.json` → `"db:validate": "pwsh -File db/scripts/validate_database.ps1"` (twin bash: `db/scripts/validate_database.sh`, stesse liste — verificato che `.ps1` righe 63-73 e `.sh` righe 35-52 coincidono).

**6 viste STRUTTURALI** (schema `sys`) — righe > 0 = violazione schema/invariante → `exit 1` (bloccante):

| # | Vista |
|---|---|
| 1 | `sys.v_orphan_position_assignments` |
| 2 | `sys.v_tenant_boundary_violations` |
| 3 | `sys.v_canonical_outside_sys` |
| 4 | `sys.v_active_primary_assignment_per_user` |
| 5 | `sys.v_visualization_node_in_canonical_node` |
| 6 | `sys.v_inbox_resource_consistency` |

**3 viste INFORMATIONAL** (WARN, non bloccanti): `sys.v_positions_without_job_role`, `sys.v_pip_completeness`, `sys.v_reward_gate_completeness`.

Meccanica del validate (`validate_database.sh`):
- Per ogni vista: esiste in `information_schema.views`? no → `SKIP`; sì → `SELECT count(*)`; strutturale con count≠0 → `FAIL` + `fail=1`; informational con count≠0 → `WARN`.
- Se `fail≠0` → `exit 1`. Se tutte SKIP → exit 0 ("migrations not yet applied").
- **Parte 2 — twice-run proof**: ri-esegue `migrate.sh` e confronta due `pg_dump --schema-only --no-owner --no-acl --schema=sys --schema=brownfield --schema=staging --schema=audit`; diff (al netto delle righe `\restrict`/`\unrestrict`) deve essere vuoto, altrimenti `exit 1`. Flag `--skip-twice-run` per saltarla.
- Conseguenza per storia36: le tabelle `staging.storia36_*` entrano nello scope del dump (`--schema=staging`) → i loro DDL DEVONO essere idempotenti (`CREATE TABLE IF NOT EXISTS`) o il twice-run proof resta comunque verde perché il DDL non cambia; i DATI non sono nel dump (schema-only), ma il registro runs cattura il delta dati.

## 2. Convenzioni seed

### Layout directory (`db/seeds/`)
- Sottodirectory per iniziativa: `rtl-rebuild/`, `reconciliation/`, `brownfield/`, `sdbi/`, `rtl-banking-skills/`, **`storia36/`** (già creata, contiene `00_foundation.sql`).
- File numerati `NN_snake_case.sql` a 2 cifre in ordine di esecuzione (`00_…` → `16_…`); i seed emessi da un generatore hanno suffisso `.generated.sql` (es. `16_user_pay_slips.generated.sql`); gli step non-SQL mantengono il numero (`00_extract_legacy_subset.sh`, `11_….py`). Un `README.md` per directory documenta ordine, decisioni e checklist pre-run.
- Payload estratto/riproducibile in `extracted/` (gitignored).

### Stile interno (modelli: `rtl-rebuild/01_tenancies.sql`, `reconciliation/04_registry.sql`, `storia36/00_foundation.sql`)
- **Header commento** con: path/nome file, cosa fa, decisione/piano di riferimento, dichiarazione di idempotenza ("twice-run = delta 0" / "2nd run updates in place").
- `\set ON_ERROR_STOP on` in testa (i runner passano comunque `-v ON_ERROR_STOP=1`).
- Transazione esplicita `BEGIN; … COMMIT;` quando il file tocca `sys.*` (01_tenancies, i generated). I file solo-staging + DO block possono ometterla (il DO è atomico).
- **Idempotenza — mai INSERT cieco**: `ON CONFLICT (…) DO NOTHING` (import append-only), `ON CONFLICT … DO UPDATE` (registry upsert), `WHERE NOT EXISTS (…)` (quando manca un indice univoco), `CREATE TABLE IF NOT EXISTS` + eventuale `TRUNCATE`+`\copy` per gli staging load.
- **ID deterministici**: `uuid_generate_v5(<namespace>::uuid, '<PREFIX>::<chiave-naturale>')` — MAI `md5()::uuid` (memoria `reference_deterministic_seed_uuid_rfc4122`: zod4 rifiuta → 500 sul read). storia36 ha già fissato il namespace DNS `6ba7b810-9dad-11d1-80b4-00c04fd430c8` con name `'STORIA36::<cluster>::<chiave-naturale>'` (header di `00_foundation.sql`); i generated seed usano un namespace custom per tabella. Per il twice-run diff vuoto i generated fissano anche `created_at`/`updated_at` a literal `TIMESTAMPTZ` costanti.
- **Chiavi di provenance nei dati**: prefissi namespaced nelle colonne naturali — `user_external_code = 'LEGACY_EMP::'||employees.id` (ADR-0024/I14, MAI `LEGACY:'||users.id`), `'ATTEND::RTL_BANK_REFERENCE::'||id`, `'CUSTOM::'||code`, `'LEGACY_SURVEY::'||id`; legacy-id conservato in `*_metadata->>'legacy_*_id'`.
- **DO block finale di verifica** in ogni seed: conta il risultato e `RAISE NOTICE` (informativo, es. 01_tenancies) o `RAISE EXCEPTION` se il conteggio viola l'atteso (fail-loud, es. 04_registry `IF v_total <> 65 THEN RAISE EXCEPTION`). `00_foundation.sql` usa il pattern più maturo: DO block che misura before/after, scrive il delta nel registro runs, poi un secondo DO block di post-condizioni che verifica la SPEC (copertura finestra, coerenza is_workday, range volumetrico) con `RAISE EXCEPTION` parametrici e `RAISE NOTICE` di OK finale.
- **psql vars**: i seed NON usano `\set`/`:var` per parametri (solo `ON_ERROR_STOP`); i generatori (`gen-*.sql`) usano `\pset format unaligned` + `\pset tuples_only on` + `SELECT format($tmpl$…$tmpl$, …)` per emettere SQL su stdout (pattern generator → `.generated.sql`).
- Commenti inline `-- VERIFY:` / `-- CHECK:` dove un vincolo DB è assunto; valori CHECK-enum citati accanto alla colonna.

### `db/scripts/gen-pay-slips-seed.sql` (generatore, gira sul DB LEGACY)
Emette su stdout il seed idempotente (v5 PK deterministico + `ON CONFLICT DO NOTHING` + timestamp fissi + normalizzazione whitespace `''→NULL`); si pipe-a in `db/seeds/rtl-rebuild/16_user_pay_slips.generated.sql` e si applica ad `heuresys_advanced`. Per storia36 il pattern generatore serve solo se si legge dal legacy; i seed sintetici storia36 girano direttamente sull'advanced.

## 3. Convenzioni script bash → pattern per `db/scripts/storia36.sh`

Modelli: `migrate.sh`, `validate_database.sh`, `create_local_database.sh` — pattern identico e consolidato:

```bash
#!/usr/bin/env bash
# =============================================================================
# db/scripts/storia36.sh
# -----------------------------------------------------------------------------
# <cosa fa in 1-3 righe; riferimento al piano docs/superpowers/plans/...>
# =============================================================================
set -euo pipefail

ENV_FILE="${1:-$(cd "$(dirname "$0")/../.." && pwd)/.env}"
[[ -f "$ENV_FILE" ]] || { echo "[storia36] .env not found at $ENV_FILE" >&2; exit 1; }

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

: "${POSTGRES_HOST:?missing}"
: "${POSTGRES_PORT:?missing}"
: "${POSTGRES_DB:?missing}"
: "${POSTGRES_USER:?missing}"
: "${POSTGRES_PASSWORD:?missing}"

export PGPASSWORD="${POSTGRES_PASSWORD}"
PSQL=(psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1)

SEED_DIR="$(cd "$(dirname "$0")/../seeds/storia36" && pwd)"
for f in "$SEED_DIR"/*.sql; do
  echo "[storia36] applying $(basename "$f")"
  "${PSQL[@]}" -f "$f"        # migrate.sh usa -1 (single-tx) — adottarlo se il seed non ha già BEGIN/COMMIT propri
done
```

Punti fissi del pattern (tutti e tre gli script li rispettano):
- `#!/usr/bin/env bash` + banner commento con path del file + `set -euo pipefail`.
- **Connessione SEMPRE da `.env`** alla root del repo (arg `$1` opzionale per un env file alternativo), MAI host/porta hardcoded: `set -a; source "$ENV_FILE"; set +a`, guard `: "${VAR:?missing}"` sulle 5 variabili `POSTGRES_HOST/PORT/DB/USER/PASSWORD`, `export PGPASSWORD`, array `PSQL=(psql -h … -v ON_ERROR_STOP=1)` invocato come `"${PSQL[@]}"`. (Nel runtime attivo Option B l'`.env` punta al tunnel `localhost:5433`.)
- Path relativi allo script (`$(dirname "$0")/..`), mai assoluti (memoria `feedback_no_absolute_paths`, cross-machine PC/VM/linux-pc).
- Flag opzionali parsati a mano dal loop `for arg in "$@"` (stile `validate_database.sh --skip-twice-run`); prefisso log `[nomescript]`; messaggi d'errore su `>&2`; exit code parlante; riepilogo finale `OK: …`.
- Idempotente e safe-to-rerun per contratto (dichiarato in `db/scripts/README.md` e in CLAUDE.md: "Every db/scripts/*.{ps1,sh} is idempotent").
- Nota: i canonici hanno twin `.ps1` per Windows; per storia36 il piano prevede il solo `.sh` (eseguibile da Git Bash, che è la shell del CLI su Windows) — coerente con `migrate-if-pending.sh` che esiste solo in versione bash.

## 4. Schema `staging` — stato attuale e collisioni

`\dt staging.*` (live, 2026-07-27): **32 tabelle**, due soli namespace:
- `rtl_*` (14): `rtl_certifications, rtl_employee_attendance, rtl_employee_certifications, rtl_employee_contracts, rtl_employee_module_completions, rtl_employee_skill_assessments, rtl_employee_skill_profiles, rtl_employee_skills, rtl_employees, rtl_org_units, rtl_salary_band_assignments, rtl_salary_bands, rtl_tenant_custom_skills, rtl_users` — mirror all-text dei CSV estratti dal legacy (`CREATE TABLE IF NOT EXISTS` + `TRUNCATE` + `\copy`, colonne tutte `text`, nessun vincolo).
- `wave1_*` (18): `wave1_activity_classification_mappings, wave1_activity_classifications, wave1_blueprint_process_registry, wave1_compensation_bands, wave1_esco_occupation_mappings, wave1_job_families, wave1_job_roles, wave1_learning_modules, wave1_learning_path_steps, wave1_learning_paths, wave1_process_kpi_templates, wave1_skill_aliases, wave1_skill_categories, wave1_skill_families, wave1_skill_learning_mappings, wave1_skill_taxonomy_edges, wave1_skills, wave1_user_certifications`.

**Nessuna tabella `storia36_*` esiste ancora nel DB** → zero collisioni per `staging.storia36_runs` / `staging.storia36_calendar` (già definite in `db/seeds/storia36/00_foundation.sql`, non ancora applicate). La convenzione di namespace per-iniziativa (`<iniziativa>_*`) è rispettata dal prefisso `storia36_`.

**Convenzioni di provenance esistenti**:
- In staging: nessuna colonna di provenance dedicata (le tabelle SONO la copia della sorgente; la provenance è il prefisso del nome tabella).
- Nei target `sys.*`: prefissi namespaced nelle chiavi naturali (`LEGACY_EMP::`, `CUSTOM::`, `ATTEND::…::`, `OLDDB::…::`) + legacy-id in `*_metadata->>'legacy_*_id'` + `tenant_metadata` arricchito (`rebuilt_at`, `legacy_tenant_id`).
- Audit run-level: `sys.sys_schema_migrations` (upsert per file con `sha256/applied_at/applied_by/duration_ms`, scritto da `migrate.sh`) è il precedente diretto del nuovo **`staging.storia36_runs`** (`run_id, cluster_code C0..C12 con CHECK regex, seed_file, rows_written, executed_at, twice_run_delta` — la 2ª corsa DEVE registrare `twice_run_delta=0`).

## 5. Batterie di verifica esistenti (modello per `verify-storia36.sql`)

- **Non esiste alcun `db/scripts/verify*.*`** (verificato: `ls db/scripts/verify*` vuoto; glob repo-wide `*verif*` trova solo node_modules/log). La batteria verify di storia36 sarà la PRIMA con quel nome → nessun vincolo di naming ereditato; il piano/task-list la chiama `verify-storia36.sql` (gate G1-G6).
- I modelli reali di "verifica in SQL" nel repo sono due:
  1. **DO block fail-loud in coda ai seed** — `RAISE EXCEPTION 'msg con %', var` quando l'atteso è violato, `RAISE NOTICE` di riepilogo quando passa. Esempi: `reconciliation/04_registry.sql` righe 90-100 (`IF v_total <> 65 THEN RAISE EXCEPTION`), `storia36/00_foundation.sql` sezione 3 (post-condizioni sulla SPEC: copertura, coerenza, range volumetrico — le prove POSSONO fallire, memoria `feedback_evidence_must_be_falsifiable`).
  2. **Loop bash count-su-vista** di `validate_database.sh` (PASS/FAIL/SKIP + exit code, `psql -tAc`).
- Stile raccomandato per `verify-storia36.sql` (composizione dei due modelli): un file psql con `\set ON_ERROR_STOP on` + un DO block per gate G1..G6, ciascuno con conteggi live → `RAISE EXCEPTION 'G<N> <nome>: <dettaglio %>'` sul fail e `RAISE NOTICE 'G<N> OK: …'` sul pass; l'exit code di psql (≠0 su EXCEPTION grazie a ON_ERROR_STOP) è il segnale per l'entrypoint bash. Asserire INVARIANTI derivate dalla fonte, non fotografie hardcoded (memoria `feedback_no_hardcoded_test_data`); dove serve un numero atteso, derivarlo (es. `v_expected := ('2026-07-31'::date - '2023-08-01'::date)+1`).
- Le 6 viste strutturali di §1 restano il gate esterno: l'entrypoint deve chiudere con `bash db/scripts/validate_database.sh --skip-twice-run` (o replicare il loop sulle 6 viste) dopo i seed.

---

### Riferimenti file (repo-relative)
- `package.json` righe 21-35 (script `db:*`)
- `db/scripts/validate_database.sh` · `db/scripts/validate_database.ps1` (liste viste identiche)
- `db/scripts/migrate.sh` · `db/scripts/create_local_database.sh` (pattern bash canonico)
- `db/scripts/gen-pay-slips-seed.sql` (pattern generatore)
- `db/seeds/rtl-rebuild/README.md` (convenzioni idempotenza/crosswalk/tenant-safety, run order)
- `db/seeds/rtl-rebuild/01_tenancies.sql` · `db/seeds/reconciliation/04_registry.sql` (stile seed + DO verify)
- `db/seeds/storia36/00_foundation.sql` (fondazione C0 già scritta: runs registry + calendario + post-condizioni)
