# WS-T5 — Data & DBMS architecture
Agente: Engineering (avversariale) | Modello: Claude Sonnet 5 | Data: 2026-09-28
HEAD: `5faa2bc2ca78c40bec603e77df9da176c6971337`

> Rivalidazione della due diligence T5 di giugno (HEAD `ce26608`, 2026-06-17). ~1978 commit di delta, schema cresciuto da ~150 a **250 tabelle** `sys.*`, 447 migrazioni applicate (max `000452` su disco). Metodo: query live via tunnel SSH :5433 (sola lettura, solo SELECT) + `python docs/kb/tools/db_health.py`. Nessuna scrittura sul DB.

---

## Sintesi

Il data layer resta **strutturalmente solido e sensibilmente migliorato** rispetto a giugno. Il finding più grave del baseline (T5-001, auth token bloat: 39.463 token/9 utenti, partial index inutilizzato) è **completamente risolto**: oggi la tabella conta **173 token totali su 23 utenti**, l'housekeeping gira quotidianamente (ultimo autovacuum 2026-09-27), e il partial index `active_idx` è ora effettivamente usato dal planner (Bitmap Index Scan, 0.182ms). Il secondo finding (T5-002, FK tenant_id senza indice) è migliorato ma non chiuso: 47 FK tenant_id residue senza indice leading (era 50), su un universo di FK totali cresciuto da ~287 a 648 (261 senza indice in totale).

Il layer di conoscenza ESCO ha subito un **saneamento deliberato**: il catalogo skill è sceso da 21.939 a **14.031** dopo la rimozione di 7.846 record "junk" (entità non-skill mis-importate dal legacy, mig `000160`, S1006) — non è un data-loss, è un miglioramento di qualità del dato documentato nel SoT. Copertura embedding resta 100% (14.031/14.031, `voyage-4-lite`), e l'uso reale degli indici HNSW è cresciuto molto: skill da 363 a **1.157** scansioni, occupation da 597 a **2.965**. `job_role`/`user_profile` HNSW restano a 0 scansioni, invariato da giugno (feature non ancora a regime su quegli oggetti).

Il registro di riconciliazione dead-schema è migliorato (NO_SOURCE da 21 a **1**, ogni riga senza dati ha una `rationale` esplicita — 0 tabelle morte non spiegate), e sono comparse **due nuove famiglie di sentinelle** (viste `v_*` in italiano, es. `v_registro_provenienza_orfano`, `v_direzione_del_dato_violata`) che tracciano la provenienza dei dati (nativo/importato/ibrido, I23) — un livello di governance dati che non esisteva a giugno. Il costo di questa crescita: colonne dichiarate e mai riempite salite a **284** (non misurate a giugno con questo metodo) e JSONB pervasivo cresciuto da 176 a **236** colonne, entrambi segnali di un DB che cresce più velocemente della sua bonifica — coerente con la retorica del progetto stesso ("residuo da bonificare").

---

## Claim del venditore rivalidati

| Claim | Esito | Evidenza |
|---|---|---|
| RD-08: 0 ENUM nativi | CONFERMATO | `SELECT count(*) FROM pg_type WHERE typtype='e'` = **0** (DB intero, non solo `sys`) |
| PIP = VIEW mai JSONB blob (I9) | CONFERMATO | `sys_position_intelligence_profiles_v` = **VIEW**, nessuna tabella fisica `*position_intelligence*` |
| Migration ledger sha256 + idempotenza | CONFERMATO | `sys.sys_schema_migrations`: colonne `migration_id, file_name, sha256 char(64), applied_at, applied_by, duration_ms`; **447 righe**; `db/scripts/migrate-if-pending.sh` e `prova-idempotenza.sh` presenti su disco |
| ESCO skill catalog + occupation-skill requirements | CONFERMATO CON DELTA SPIEGATO | `sys_skills` = **14.031** (era 21.939 a giugno: -7.846 junk record rimossi, mig `000160`, documentato in SOT_STATE S1006 — non un data-loss); `sys_occupation_skill_requirements` = **126.051** (invariato) |
| pgvector HNSW embeddings attivi | CONFERMATO (uso cresciuto) | 4 indici HNSW `m=16, ef_construction=64, vector_cosine_ops` invariati; scansioni: skill **1.157** (era 363), occupation **2.965** (era 597), job_role/user_profile **0/0** (invariato) |
| Auth token bloat 39.463/9 utenti, housekeeping non risolutivo (T5-001, giugno) | **SMENTITO oggi — risolto** | `sys_auth_refresh_tokens`: **173 righe totali / 23 utenti distinti**, 172 attivi di cui 157 non scaduti; `EXPLAIN ANALYZE` mostra **Bitmap Index Scan su `active_idx`** (0.182ms), non più Seq Scan; `last_autovacuum = 2026-09-27` (quotidiano) |
| FK index coverage: 50 tenant_id senza indice (T5-002, giugno) | PARZIALE (migliorato) | **47** FK tenant_id senza indice leading oggi (era 50); FK totali senza indice **261** su **648** totali (universo cresciuto ~2.3× da giugno con la crescita a 250 tabelle) |
| Dead-schema = 0 (reconciliation registry terminale) | CONFERMATO (migliorato) | `v_reconciliation_status`: **231 POPULATED / 17 EXCLUDE / 1 NO_SOURCE** (era 21 NO_SOURCE) = 249 totali; **0** righe `has_rows=false` senza `rationale` |
| 7 validation views strutturali = 0 righe | CONFERMATO | `db_health.py`: tutte le sentinelle strutturali storiche (`v_orphan_position_assignments`, `v_tenant_boundary_violations`, `v_canonical_outside_sys`, `v_active_primary_assignment_per_user`, `v_inbox_resource_consistency`, `v_visualization_node_in_canonical_node`, `v_positions_without_job_role`) = **[ok] 0** |
| D-18: 1 riga attiva/utente nelle score tables | CONFERMATO | `sys_flight_risk_scores`: **176/176** (count/distinct utenti) = 1:1, invariato dal pattern di giugno |
| Schema discipline (CHECK invece di ENUM) | CONFERMATO (cresciuto) | CHECK constraints = **2.377** (da `db_health.py`; il numero di giugno, 234, era misurato solo su un sottoinsieme — lo schema è cresciuto di ~65 tabelle) |

---

## Finding

### T5-101 — RISOLTO: auth token bloat (era T5-001, High)
- **Severità**: Info (era High)
- **Tipo**: strength (era risk)
- **Evidenza**: `sys.sys_auth_refresh_tokens` conta **173 righe / 23 utenti distinti** (era 39.463/9); `EXPLAIN (ANALYZE, BUFFERS)` su una query filtrata per utente mostra `Bitmap Heap Scan` + `Bitmap Index Scan on sys_auth_refresh_tokens_active_idx` (Execution Time 0.182ms) — il partial index è ora effettivamente scelto dal planner, non più ignorato. `pg_stat_user_tables`: `last_autovacuum = 2026-09-27 02:01`, 6 tuple morte su 173 vive. Timer `heuresys-advanced-auth-housekeeping.service/.timer` gira quotidianamente alle 02:00 (`deploy/systemd/`).
- **Impatto**: L'hot-path auth (`POST /v1/auth/refresh`) non è più a rischio di degrado con la crescita dei tenant reali; il pattern di pulizia quotidiana mantiene la tabella piccola.
- **GA-blocker**: N/A
- **Confidence**: Alta

### T5-001 (rinumerato, ex T5-002) — FK index coverage: 47 tenant_id FK residue, 261 FK totali senza indice su 648
- **Severità**: Medium (invariata)
- **Tipo**: functional-debt
- **Evidenza**: Query `pg_constraint`/`pg_index` → **261** FK single-col senza indice di supporto su **648** FK totali nello schema `sys` (era 237/~287 a giugno); di queste, **47** hanno `%tenant_id%` come colonna leading (era 50). Il rapporto percentuale (261/648 ≈ 40%) è sostanzialmente invariato rispetto a giugno (237/287 ≈ non misurato allo stesso modo, ma la % di tenant_id scoperte è scesa lievemente: 50/~56 → 47/~53 circa).
- **Impatto**: Le tabelle residue sono presumibilmente ancora piccole (non ri-misurato singolarmente in questo audit), quindi il rischio pratico resta futuro/di scala, non attuale. Lo schema è cresciuto di ~100 tabelle da giugno senza che questo gap si sia proporzionalmente ridotto: ogni nuovo modulo ha una probabilità non nulla di introdurre una FK tenant_id senza indice se lo sviluppatore non applica il pattern esplicitamente.
- **GA-blocker**: No
- **Remediation**: Migration additiva batch (`CREATE INDEX IF NOT EXISTS`) sulle 47 FK residue, prioritizzando i moduli ad alto traffico di lettura per-tenant. Aggiungere un cancello CI che segnali ogni nuova FK `*_tenant_id` priva di indice al momento della migration. Effort: S (indici) + S (cancello CI).
- **Best-practice ref**: PostgreSQL FK indexing best practice; pattern già stabilito internamente (mig 000130 di giugno)
- **Confidence**: Alta

### T5-002 (rinumerato, ex T5-003) — ASSET: knowledge representation ESCO risanata e più usata (14.031 skill puliti, HNSW scan 3-8× più attivi)
- **Severità**: Info (asset)
- **Tipo**: strength
- **Evidenza**: `sys_skills` = 14.031 (14.026 con `skill_kind`, 14.003 con `skill_esco_uri`), sceso da 21.939 dopo la rimozione di 7.846 record junk (`OLDDB::<table>::<uuid>`, entità non-skill mis-importate, mig `000160`, S1006 — archiviati in `audit.skills_junk_archive`, reversibile); `sys_skill_taxonomy_edges` = **18.438** edge (era 11.965, +54%); `sys_esco_occupation_embeddings` scan **2.965** (era 597), `sys_skill_embeddings` scan **1.157** (era 363) — segnale di adozione reale crescente del semantic matching, non solo di presenza dei dati.
- **Impatto**: Il pulling del catalogo junk migliora la precisione del semantic search (meno rumore nei risultati kNN); la crescita degli scan HNSW conferma che la feature non è solo teorica ma è effettivamente interrogata dal prodotto in uso.
- **GA-blocker**: N/A
- **Confidence**: Alta

### T5-003 (rinumerato, ex T5-004) — ASSET: schema discipline confermata su scala cresciuta (0 ENUM, 2.377 CHECK, 250 tabelle, 447 migrazioni)
- **Severità**: Info (asset)
- **Tipo**: strength
- **Evidenza**: `pg_type WHERE typtype='e'` = 0 su tutto il DB; CHECK constraints = 2.377 (crescita coerente con lo schema, che è passato da ~150 a 250 tabelle `sys.*`); ledger migrazioni 447 righe con sha256/applied_by/duration_ms; `db/scripts/migrate-if-pending.sh` e `prova-idempotenza.sh` presenti; sentinelle strutturali storiche tutte a 0 (`db_health.py`).
- **Impatto**: La disciplina di schema non si è degradata nonostante una crescita di ~65% del numero di tabelle in 3 mesi — segnale di un pattern applicato con consistenza, non solo dichiarato.
- **GA-blocker**: N/A
- **Confidence**: Alta

### T5-004 (rinumerato, ex T5-005) — JSONB cresciuto da 176 a 236 colonne: pattern deliberato, ma la bonifica non tiene il passo della crescita
- **Severità**: Low (invariata)
- **Tipo**: functional-debt
- **Evidenza**: `information_schema.columns WHERE data_type='jsonb'` = **236** colonne (era 176, +34%, più veloce della crescita tabelle +65%... in realtà proporzionalmente simile). Nessuna violazione I9 (PIP resta VIEW).
- **Impatto**: Nessun impatto immediato; il trend conferma che ogni nuovo modulo aggiunge in media ~1 colonna JSONB, e senza un catalogo esplicito dei casi da normalizzare (proposto a giugno) il debito continua a crescere silenziosamente.
- **GA-blocker**: No
- **Remediation**: Invariata da giugno — catalogare i JSONB non-metadata e decidere normalizzazione/GIN index caso per caso. Effort: M.
- **Confidence**: Media

### T5-005 (nuovo) — Colonne dichiarate e mai riempite: 284, metrica ora tracciata da `db_health.py` ma non ancora un cancello
- **Severità**: Low
- **Tipo**: tech-debt
- **Evidenza**: Sonda `db_health.py`: "colonne dichiarate e mai riempite: **284**". Non misurata con questo metodo esatto a giugno (il baseline T5 non copriva questa sonda), ma il memory-index del progetto la cita da agosto come "240 colonne morte" — la cifra è cresciuta di ~44 colonne in ~1.5 mesi.
- **Impatto**: Colonne mai popolate sono superficie morta che complica letture/migrazioni future e nasconde possibili feature incomplete o abbandonate. Il trend crescente (non decrescente) indica che la bonifica dichiarata dal progetto ("il residuo va bonificato") non sta ancora vincendo sulla crescita.
- **GA-blocker**: No
- **Remediation**: Estrarre l'elenco completo (`db_health.py` lo misura ma non lo elenca) e classificare ciascuna come: feature non ancora attivata, colonna orfana da rimuovere (ADR-0035, ritiro via migration emendata), o falso positivo (popolata solo in path condizionali rari). Effort: M.
- **Confidence**: Media (la cifra è misurata dallo strumento ufficiale del progetto, non da questo audit indipendente)

### T5-006 (nuovo, asset) — Governance di provenienza dato (I23) formalizzata: registro di riconciliazione più pulito, nuove sentinelle di direzione-dato
- **Severità**: Info (asset)
- **Tipo**: strength
- **Evidenza**: `v_reconciliation_status`: **231 POPULATED / 17 EXCLUDE / 1 NO_SOURCE** (era 21 NO_SOURCE a giugno) — ogni riga con `has_rows=false` porta una `rationale` esplicita (0 eccezioni). Nuove sentinelle apparse dopo giugno: `v_registro_provenienza_orfano` (11 tabelle/15.054 righe, dichiarato INFORMATIVE fino a chiusura mandato X-6), `v_direzione_del_dato_violata` (1 riga, dichiarata non-violazione reale — 20 righe seed storico su una tabella nativa), `v_source_lineage_normalizzata` (70.959 righe, l'intero registro di provenienza riesposto). Questo corrisponde all'invariante I23 (ogni tabella dati-cliente è nativa/importata/ibrida) che non esisteva nel CLAUDE.md di giugno.
- **Impatto**: Il progetto ha aggiunto un intero strato di tracciabilità della provenienza del dato dopo l'audit di giugno — un controllo raro in prodotti pre-revenue, utile sia per audit di compliance (GDPR/data lineage) sia per il debug di dati anomali.
- **GA-blocker**: N/A
- **Confidence**: Alta

---

## Score del pilastro

Score: 79 | Confidence: Alta

Motivazione: il finding più grave di giugno (auth token bloat, T5-001) è completamente risolto con evidenza live (index ora usato dal planner, housekeeping quotidiano attivo, tabella 227× più piccola). Il layer ESCO/pgvector è stato sia risanato (rimozione junk) sia più intensamente utilizzato (scan HNSW 3-8× più frequenti). È comparso un intero strato di governance sulla provenienza del dato (I23) che eleva la maturità complessiva. Il punteggio non sale oltre "Forte" basso perché: (a) il gap di FK index coverage persiste quasi invariato in termini assoluti (47 tenant_id ancora scoperte) mentre lo schema è cresciuto del 65%, segno che il pattern di remediation di giugno non è diventato un cancello sistemico; (b) le colonne mai riempite sono cresciute (240→284) e i JSONB pure (176→236), indicando che la bonifica dichiarata dal progetto rincorre la crescita invece di precederla. Nessun finding Critical o High residuo su questo pilastro.

---

*Audit read-only — nessuna modifica a codice/schema/CI/deploy, zero scritture DB. Tunnel SSH :5433 attivo per tutta la durata dell'audit. Output: solo questo file WS-T5.md.*
