# FINDINGS / WS-C — Dati & persistenza (S-100X-A4)

> Audit forense **read-only** del workstream Dati & persistenza. Metodo: ispezione repo (`db/migrations/`, `db/scripts/`, `scripts/backup-db.sh`, `scripts/dr-drill.sh`, `deploy/systemd/`, `deploy/README.md`) + query live read-only sul DB PROD OCI via tunnel `:5433` (`pg_catalog`/`pg_stat_*`/`information_schema` + la view `sys.v_reconciliation_status`). Evidenza: `path:linea` reali + query psql con output reale. **Zero modifiche a codice/schema/CI/deploy, zero scritture DB** (solo SELECT / `\d` / cataloghi). Data: 2026-06-16 (S-100X-A4). Classificazione: `AUDIT_PROTOCOL.md`.
>
> **Caveat di misura (vincolante per i §index)**: `SELECT stats_reset FROM pg_stat_database WHERE datname='heuresys_advanced'` → **NULL** (nessun reset esplicito; gli `idx_scan` sono cumulativi dalla vita del cluster, NON azzerati dal re-apply migration odierno delle 17:43). Il contatore è **vivo** (358 indici con `idx_scan>0`, max 12.512.695 su `sys_user_skill_evidence`), quindi `idx_scan=0` su un indice **non-PK/non-unique** è un segnale reale; su un **PK/unique** può solo significare "tabella mai letta per chiave/per vincolo" (tipico delle audit/embedding tables append-only), non "indice rimovibile". I finding distinguono i due casi.

## Headline (cosa cambia rispetto al seed, a WS-G e a WS-F)

1. **🟠 HIGH C-1 — 243/494 FK single-colonna in `sys.*` non hanno un indice di supporto** (misurato). Di queste, **56 sono `*_tenant_id`** (il filtro d'isolamento I5 = FK+middleware, presente in QUASI OGNI query API) **senza alcun indice che inizi con `tenant_id`**, incluse tabelle grandi (`sys_source_lineage_records` 70 MB/69k righe, `sys_skills` 40 MB/22k, `sys_auth_refresh_tokens` 21 MB/46k, `sys_auth_login_events` 18 MB/57k); altre **78 sono business-FK su join hot-path**; 109 sono audit-actor (`created_by`/`updated_by`, basso valore). **NB**: le tabelle core già coperte da indici compositi `(tenant_id, …)` (es. `sys_users` ha `tenant_email_uq` + `tenant_status_idx`) sono **correttamente escluse** dal conteggio — il finding è reale per le 56 residue.
2. **🟠 HIGH C-2 — crescita auth-audit illimitata, nessun pruning**: `sys_auth_refresh_tokens` = **46.348 righe per soli 9 utenti** (~5.150/utente), di cui **37.554 ancora "attive"** (né `used_at` né `revoked_at`) — token di test/CI/E2E mai ripuliti; non esiste **alcun** job/migration/repo di cleanup (`grep DELETE.*refresh_token|prune.*token` = 0 hit). Degrada il **partial `active_idx`** che è esattamente la hot-path del refresh. `sys_auth_login_events` (57k righe, append-only audit) ha lo stesso pattern senza retention. È la **stessa classe di D-18** (append-without-bound) ma sulle tabelle AUTH, e D-18 fu chiuso solo per le insights-score.
3. **Il quadro Backup/DR è MOLTO più maturo di quanto WS-G (F-10/R5) lasciasse intendere** — va riconciliato: esiste `scripts/backup-db.sh` (pg_dump -Fc + retention 14g + off-host opt-in + fail-loud su dump corto) cablato a un **timer systemd giornaliero** (`heuresys-advanced-backup.timer`, 01:30, `Persistent=true`) **e** `scripts/dr-drill.sh` (restore-in-scratch + RPO/RTO + row-count check vs prod + drop). **R5 + 3.7 sono shipped.** I gap residui sono **off-host non configurato di default** e **drill non schedulato** (vedi C-5/C-6), non "zero backup".
4. **Squash/consolidation migration: assessment = NON consolidare ora (DOSSIER, low-priority)**. 127 file (`000001..000128`, gap `000035` cosmetico) tracciati da `sys.sys_schema_migrations` (sha256 + duration + UNIQUE su `file_name`). Costo idempotenza reale: 68 file usano `IF NOT EXISTS`, 71 `ON CONFLICT`; i 6 senza guard sono ALTER/relax-CHECK o DELETE-collapse **naturalmente** re-runnable. Il `migrate.sh` **ri-applica TUTTI i file ad ogni run** (no skip-logic), ma il deploy PROD usa `migrate-if-pending.sh` (sha-gated) → il costo reale a deploy è O(pending). Squashare rompe la proprietà twice-run-empty-diff e il ledger sha256 storico, con beneficio quasi nullo (i 127 file applicano in <1s ciascuno, il deploy è già gated).
5. **Asset forti confermati**: **dead-schema = ZERO** (la `v_reconciliation_status` classifica 148 POPULATED / 21 NO_SOURCE / 9 EXCLUDE / 1 REFERENCE_ONLY → **0 tabelle vuote non-intenzionali**); **RD-08 perfetto** (0 ENUM nativi in tutto il DB); **RD-09 ~totale** (32 colonne `date` corrette, 370 `timestamptz`, solo 3 `*_date` timestamptz borderline-legittime); **D-18 RISOLTO e verificato live** (score-table: righe == distinct-user, 1 riga attiva/soggetto); **integrità FK = 0 orfani** (constraint-enforced); nessun **vero** indice duplicato (l'unico hit è un partial-unique distinto).

---

## Gruppo A — Index coverage (hot-path join & filter)

### F-WS-C-1 — 243/494 FK single-colonna senza indice di supporto; 56 sono `tenant_id` (filtro I5) su tabelle anche grandi
- Severità: **HIGH** | Flag: **QUICK-WIN** (tenant_id subset) / DOSSIER (full set)
- Evidenza (query live):
  - `SELECT count(*) FROM pg_constraint WHERE contype='f' AND connamespace='sys'::regnamespace` = **494** FK totali; **243** single-col senza indice leading sulla FK-col (`NOT EXISTS … i.indkey[0]=conkey[1]`).
  - Breakdown: **audit-actor 109** (`created_by`/`updated_by`/`validated_by`/`assessor`) · **business-FK join hot-path 78** · **`tenant_id` filter hot-path 56**.
  - Le 56 `tenant_id` NON hanno **alcun** indice che inizi con `tenant_id` (verificato: `tenant_cols_with_no_leading_index_at_all = 56`). Top per dimensione: `sys_source_lineage_records.source_lineage_tenant_id` (70 MB / 69.482), `sys_skills.skill_tenant_id` (40 MB / 21.939), `sys_auth_refresh_tokens.auth_refresh_token_tenant_id` (21 MB / 43.699), `sys_auth_login_events.auth_login_event_tenant_id` (18 MB / 57.180), `sys_learning_modules` (6,4 MB), `sys_learning_paths` (5,5 MB), poi decine di KPI/assessment/comp/succession da 100-1.000 kB.
  - Controprova (escluse correttamente): `sys_users` ha `sys_users_tenant_email_uq (user_tenant_id, lower(email))` + `sys_users_tenant_status_idx (user_tenant_id, user_status)` → la query single-leading le **non** flagga (il filtro tenant è già servito dal prefisso del composito).
- Impatto: **perf** (ogni list/filter API filtra per tenant — I5; su tabelle 18-70 MB un seq-scan per tenant è il costo nascosto) + robustezza (degrada con la crescita dati)
- Baseline: 243 FK senza indice (56 tenant + 78 business + 109 audit); le 4 più grandi scommano ~149 MB di heap+idx scansionabili per tenant senza indice.
- Proposta: **QUICK-WIN** per il subset tenant_id+business sulle ~6 tabelle >5 MB (additivo, `CREATE INDEX CONCURRENTLY`, zero rischio schema — non tocca contratti/Zod); **DOSSIER** per la policy completa (indicizzare anche gli audit-actor `created_by`/`updated_by` ha costo-scrittura non nullo e basso valore di lettura → probabile WON'T-DO selettivo). I `tenant_id` su tabelle piccole (<200 kB) sono trascurabili oggi. **Verify-first**: misurare il plan reale (`EXPLAIN` di una list-by-tenant) prima/dopo su `sys_skills`/`sys_source_lineage_records`.

### F-WS-C-2 — Indici candidati "unused" (idx_scan=0): 74 non-PK/non-unique, ma il segnale richiede una baseline pulita per i casi piccoli
- Severità: **LOW** | Flag: NOTE (verify-first) + 1 QUICK-WIN sicuro
- Evidenza (query live, `stats_reset=NULL` → cumulativi, contatore vivo): **220** indici `sys.*` con `idx_scan=0` (di cui **74** non-PK/non-unique). I più grossi a 0 scan:
  - `sys_source_lineage_records_natural_key_idx` (10 MB, non-unique) — candidato pruning forte (10 MB di indice mai usato per scan; verificare che non serva a un upsert `ON CONFLICT`).
  - HNSW pgvector mai scansionati: `sys_job_role_embeddings_hnsw_idx` (1,6 MB), `sys_user_profile_embeddings_hnsw_idx` (368 kB) — coerenti con feature semantic-search non ancora a regime; **non rimuovere** (sono il razionale della feature, scan=0 = workload assente, non indice morto).
  - PK a 0 scan su append-only (`sys_auth_login_events_pkey`, `sys_occupation_skill_requirements_pkey`, embedding `_pkey`) — atteso (tabelle scritte/lette per altro indice, mai per PK); **non azionabile**.
  - `sys_skills_skill_kind_idx` (320 kB), `sys_attendance_unvalidated_idx` (112 kB), trigram `sys_skill_aliases_label_trgm_idx` (72 kB) — candidati review solo dopo una finestra di osservazione con baseline.
- Impatto: footprint (indici mai usati = scrittura + spazio sprecati) — modesto in assoluto
- Baseline: 74 indici non-PK a 0 scan; il singolo più grande `natural_key_idx` = 10 MB.
- Proposta: **QUICK-WIN sicuro** = solo `sys_source_lineage_records_natural_key_idx` (10 MB) DOPO aver verificato che nessun `INSERT … ON CONFLICT (natural_key)` lo richieda (grep nel repo lineage) — è l'unico ad alto-spazio/zero-uso non legato a feature in-progress. Tutto il resto: **NOTE** — `SELECT pg_stat_reset()` (decisione Enzo, azzera i contatori) + finestra di 2-4 settimane di workload PROD reale prima di qualsiasi drop. Mai droppare HNSW/PK su questa sola base.

### F-WS-C-3 — ASSET: nessun vero indice duplicato; l'unico "hit" è un partial-unique distinto
- Severità: INFO | Flag: ASSET
- Evidenza: la query "stesso `indrelid`+`indkey`" ritorna **1** sola coppia su `sys_user_position_assignments`: `sys_upa_user_idx` (btree semplice su `user_id`, non-unique) vs `sys_upa_one_primary_active_per_user` (UNIQUE su `user_id` **WHERE kind='PRIMARY' AND status='ACTIVE'**). Stessa colonna-chiave ma **predicati e ruoli diversi** (uno è il lookup generale, l'altro impone l'invariante "1 posizione primaria attiva per utente") → **non** ridondanti.
- Proposta: **NESSUNA azione** — è una buona pratica (constraint via partial-unique-index), non un duplicato.

---

## Gruppo B — Crescita & data-integrity smells

### F-WS-C-4 — Auth-audit tables crescono senza limite: 46k refresh-token per 9 utenti (37k "attivi"), 57k login-event, zero pruning
- Severità: **HIGH** | Flag: **QUICK-WIN** (job di pruning) / DOSSIER (retention policy)
- Evidenza (query live): `sys_auth_refresh_tokens` = **46.348 righe / 9 distinct user** (~5.150/utente), di cui **37.554 attive** (`used_at IS NULL AND revoked_at IS NULL`), 8.434 revoked, 1.039 scadute. Il partial index `sys_auth_refresh_tokens_active_idx … WHERE used_at IS NULL AND revoked_at IS NULL` copre quindi 37k righe **per lo più test/CI leak** (i 9 utenti sono le personas seedate + admin che fanno migliaia di login nei test/E2E). `sys_auth_login_events` = **57.180 righe** append-only (18 MB). Nessun cleanup esiste: `grep -rliE 'DELETE.*refresh_token|prune.*token|cleanup.*token|expired.*token' db/migrations apps/api/src deploy/systemd scripts` = **0 hit**. (Integrità OK: orfani rt→user = 0.)
- Impatto: perf (il partial active_idx degrada → lo `SELECT … active` del refresh-rotation scandisce 37k voci invece di ~poche decine reali) + footprint (39 MB combinati di token+event quasi tutti dead) + robustezza (crescita monotona, stessa classe D-18 ma su AUTH)
- Baseline: 46.348 rt (37.554 "attivi" gonfi) + 57.180 login-event; 0 job di retention.
- Proposta: **QUICK-WIN** = job di housekeeping (timer systemd come backup/insights, oppure step in `backup-db.sh`-adjacent) che `DELETE FROM sys_auth_refresh_tokens WHERE revoked_at IS NOT NULL OR expires_at < now() - interval '30 days'` + retention su `login_events` (es. >180g) — scope-safe, atomico, idempotente. **Verify-gate**: post-run `count(*) FILTER (WHERE used_at IS NULL AND revoked_at IS NULL)` deve crollare verso il #sessioni-vive reali (~decine), e la suite auth resta verde. **DOSSIER** per la policy formale (finestra GDPR/audit sui login-event — cross-ref skill `hrms-compliance`/retention). NB: parte del leak è una **test-hygiene** debt (i test non puliscono i refresh-token) → si lega a WS-F F-WS-F-6 (residue-leak).

### F-WS-C-5 — ASSET con gap: backup schedulato (R5) + DR drill (3.7) SHIPPED, ma off-host non-default e drill non schedulato
- Severità: **MEDIUM** | Flag: **QUICK-WIN** (drill schedulato) / DOSSIER (off-host destination)
- Evidenza:
  - **Backup**: `scripts/backup-db.sh:32-42` `sudo -u postgres pg_dump -Fc` → file timestamped, **fail-loud** su dump <1 kB (`:37-41`), retention `BACKUP_RETENTION_DAYS=14` prune scoped (`:46`), off-host **opt-in** `BACKUP_OFFHOST_SSH` best-effort (`:50-56`). Cablato a `deploy/systemd/heuresys-advanced-backup.timer` (`OnCalendar=*-*-* 01:30:00`, `Persistent=true`, RandomizedDelaySec=300) + `.service` (oneshot, User=ubuntu, TimeoutStartSec=900).
  - **DR**: `scripts/dr-drill.sh` restora il **latest** dump in uno scratch DB, stampa **RPO** (età backup, `:28-30`) + **RTO** (tempo restore, `:32-40`), confronta row-count scratch-vs-prod su 4 tabelle core (`:45-50`), poi droppa lo scratch (non distruttivo per prod). "A backup never restored is not a backup" (`:3-4`).
- Gap residui: (a) **off-host disabilitato di default** → senza `BACKUP_OFFHOST_SSH` il dump vive solo sull'host PROD = stesso SPOF della VM (WS-G F-2); (b) il **dr-drill è on-demand**, nessun timer → il "restore esercitato" della DoD dipende da una run manuale; (c) backup-dir = `pg_dump_snapshots/scheduled` **sotto il repo root** (gitignored ma sullo stesso disco del DB).
- Impatto: robustezza (DR reale parzialmente non-automatica) — **molto meno grave del "zero backup" implicato da WS-G F-10/R5**, da riconciliare nel dossier.
- Proposta: **QUICK-WIN** = timer systemd settimanale per `dr-drill.sh` (es. dopo il backup domenicale) che fa fallire/allerta se RPO o row-count diverge → chiude la DoD "restore esercitato". **DOSSIER** (couples WS-G F-2 SPOF + D-08): destinazione off-host reale (bucket OCI Object Storage o il twin `linux-pc`) — è una decisione infra/costo di Enzo.

### F-WS-C-6 — ASSET: D-18 (append-with-latest-wins sulle score-table) RISOLTO e verificato live
- Severità: INFO | Flag: ASSET
- Evidenza (query live): `sys_flight_risk_scores` 159 righe / **159 distinct user**; `sys_talent_scores` 154/**154**; `sys_readiness_scores` 90/**90** → **1 sola riga attiva per soggetto, zero accumulo storico**. Coerente con `DEBT_REGISTER.md:25` D-18 = **RISOLTO** S977 (delete-then-insert atomico in `apps/api/src/modules/insights/repository.ts` + mig `000094` one-time collapse: flight-risk 10428→158, succession 11088→462, skill-gap 1848→154; idempotente).
- Proposta: **NESSUNA azione** — confermato chiuso. **NB**: il pattern-fix di D-18 è esattamente il template per risolvere C-4 (auth-token bloat): la stessa disciplina delete-bounded va estesa alle tabelle AUTH.

---

## Gruppo C — Migrations: consolidamento, idempotenza, ledger

### F-WS-C-7 — DOSSIER (low-priority): squash/consolidation dei 127 file — beneficio quasi nullo, costo invariante alto
- Severità: **LOW** | Flag: DOSSIER
- Evidenza (misurata):
  - **127** file `000001..000128` (gap `000035` cosmetico, documentato); ledger `sys.sys_schema_migrations` = **127** righe distinte (UNIQUE su `file_name`), con `sha256` + `applied_at` + `duration_ms` (top duration osservate 53-99 ms/file — l'intera catena è sub-secondo per file).
  - Costo idempotenza: **68** file con `IF NOT EXISTS`, **71** con `ON CONFLICT`, **0** `DO $$` (`db/migrations/*.sql`). I **6** file senza guard esplicito (`000032` relax-CHECK, `000038`/`000041` nullable-FK, `000044`/`000056` reclassify, `000094` insights-collapse) sono **naturalmente re-runnable** (ALTER DROP/ADD CONSTRAINT, DELETE-collapse → 2° run = 0 righe).
  - **Discriminante chiave**: `db/scripts/migrate.sh:40-64` **ri-applica OGNI file ad ogni invocazione** (nessuna skip-logic — l'INSERT nel ledger è un `ON CONFLICT DO UPDATE` di audit, non un gate). MA il deploy PROD usa `db/scripts/migrate-if-pending.sh` (sha-gated: confronta `file_name:sha256` col ledger, `:36-55`) → a deploy reale gira **solo il pending**. Il `migration_id` seriale a **7445** prova le molte ri-applicazioni full storiche (dev/test), non un costo di deploy.
- Impatto: footprint/DX (127 file da leggere) — basso; nessun impatto perf/robustezza
- Baseline: 127 file, catena twice-run-empty-diff provata (ADR/registro), deploy O(pending).
- Proposta: **DOSSIER, raccomandazione = NON squashare ora**. Conservativa: lasciare la catena, è gated a deploy e idempotente. Evolutiva (se mai il count infastidisce): un baseline-snapshot `000000_baseline.sql` (pg_dump dello schema corrente) + archiviare i 1xx storici **senza** cancellarli dal ledger (preserva sha256 audit) — ma rompe la twice-run-empty-diff property e va re-provato. Radicale (squash distruttivo): sconsigliato — perde lo storico sha256 e il valore è marginale. Decide Enzo se/quando.

### F-WS-C-8 — ASSET: ledger migration robusto (sha256 + duration + UNIQUE file_name) + wrapper sha-gated per il deploy
- Severità: INFO | Flag: ASSET
- Evidenza: `sys.sys_schema_migrations` (`migration_id` serial PK, `file_name` UNIQUE, `sha256 char(64)` NOT NULL, `applied_at timestamptz`, `applied_by`, `duration_ms`) + indici `applied_at_idx` / `file_name_uq`. `migrate-if-pending.sh:36-55` confronta `file_name:sha256` → rileva sia file nuovi sia **drift di contenuto** di un file già applicato (sha mismatch ⇒ pending ⇒ riapplica). Override `DB_MIGRATE=force|skip|auto`.
- Proposta: **NESSUNA azione** — è il pattern corretto. (Il solo `migrate.sh` no-skip-logic è intenzionale per dev/reset; il gating sta nel wrapper.)

---

## Gruppo D — Schema discipline (invarianti)

### F-WS-C-9 — ASSET: dead-schema = ZERO (ogni tabella vuota è registrata come intenzionale)
- Severità: INFO | Flag: ASSET
- Evidenza (`sys.v_reconciliation_status`): **148 POPULATED** (tutte con righe) · **21 NO_SOURCE** (vuote intenzionali — nessun source legacy) · **9 EXCLUDE** · **1 REFERENCE_ONLY**. Query "vuote NON in {EXCLUDE,NO_SOURCE,REFERENCE_ONLY}" = **0 righe**. Le **28** voci storiche `NEEDS_DECISION` hanno **tutte `has_rows=t`** (popolate via derivazione sanzionata, es. `sys_position_skill_requirements` via peer-group-prevalence S978 mig 000096). → **Nessuna tabella "morta"**: ogni vuoto è classificato con razionale.
- Proposta: **NESSUNA azione** — la reconciliation-registry è un asset di governance dati notevole; mantenerla aggiornata quando si aggiungono tabelle.

### F-WS-C-10 — ASSET: RD-08 (no ENUM) perfetto; RD-09 (date vs timestamptz) ~totale, 3 borderline legittimi
- Severità: INFO (RD-08) / **LOW** (RD-09) | Flag: ASSET + NOTE
- Evidenza: **RD-08** — `SELECT count(*) FROM pg_type WHERE typtype='e'` = **0** in tutto il DB (zero ENUM nativi; i categorici sono `varchar(N)+CHECK`, es. il CHECK a 6 valori su `auth_refresh_token_revoke_reason`). **RD-09** — colonne `*_at`/`*_date`: 370 `timestamptz`, **32 `date`** (corretto), 4 varchar, 1 text. Le **3** uniche `*_date` che sono `timestamptz`: `sys_engagement_surveys.survey_{start,end}_date` e `sys_mentorship_sessions.session_date` — **plausibilmente legittime** (finestre di survey e orari di sessione possono richiedere time-of-day) → smell cosmetico, non bug.
- Proposta: RD-08 **NESSUNA azione** (perfetto). RD-09 **NOTE** — se le 3 colonne sono concettualmente date-only, rinominarle/convertirle a `date` in una migration additiva; altrimenti rinominarle senza `_date` per chiarezza. Bassa priorità, decide Enzo.

### F-WS-C-11 — ASSET: integrità FK pulita (0 orfani, constraint-enforced; I5 = FK+middleware, NO RLS)
- Severità: INFO | Flag: ASSET
- Evidenza: spot-check `sys_auth_refresh_tokens → sys_users` orfani = **0** (le FK sono `ON DELETE RESTRICT`/enforced). Coerente con I5 (isolamento = FK + middleware filter, **mai** RLS — non flaggato come bug: è invariante). Nessun catalogo `pg_policy` per RLS atteso né cercato come difetto.
- Proposta: **NESSUNA azione**.

---

## Quick wins (QW-C*) — CLASS-A estraibili (indipendenti, low/zero rischio)

- **QW-C1** — indici additivi `CREATE INDEX CONCURRENTLY` sulle ~6 tabelle >5 MB con `tenant_id`/business-FK senza indice (`sys_source_lineage_records`, `sys_skills`, `sys_auth_refresh_tokens`, `sys_auth_login_events`, `sys_learning_modules`, `sys_learning_paths`) [F-WS-C-1]. **Gate**: `EXPLAIN (ANALYZE)` di una list-by-tenant su `sys_skills`/`sys_source_lineage_records` mostra Index Scan post-fix (era Seq Scan); `pnpm test` API verde; migration additiva idempotente (`IF NOT EXISTS`).
- **QW-C2** — job di housekeeping auth-token/login-event (timer systemd o step adiacente al backup): `DELETE` refresh-token revoked/expired >30g + retention login-event >180g [F-WS-C-4]. **Gate**: post-run `count(*) FILTER (WHERE used_at IS NULL AND revoked_at IS NULL)` su refresh-token crolla verso il #sessioni-vive reale (~decine, era 37.554); orfani restano 0; suite auth (`auth.integration`, refresh-rotation) verde.
- **QW-C3** — timer systemd settimanale per `dr-drill.sh` con alert su RPO/row-count divergente [F-WS-C-5]. **Gate**: una run del timer produce `[dr-drill] PASS` con RTO registrato e row-count match; un drift fa exit non-zero/log WARN visibile.
- **QW-C4** — drop del solo `sys_source_lineage_records_natural_key_idx` (10 MB, idx_scan=0) DOPO grep che nessun `ON CONFLICT (natural_key)` lo usi [F-WS-C-2]. **Gate**: `grep -r "ON CONFLICT.*natural_key" apps/api/src` su lineage = 0 hit; pipeline di ingestion lineage gira senza errori post-drop; `pg_total_relation_size('sys.sys_source_lineage_records')` cala di ~10 MB.

> Tutti i QW restano **doc-only in questa fase A** (read-only). Sono candidati per la fase E (esecuzione) su go di Enzo, su branch, con i gate sopra.

---

## ASSET confermati (NON regredire senza dossier)

- **Reconciliation-registry governa il dead-schema**: `v_reconciliation_status` 148 POPULATED / 21 NO_SOURCE / 9 EXCLUDE / 1 REFERENCE_ONLY → **0 tabelle vuote non-intenzionali** [F-WS-C-9].
- **RD-08 perfetto** (0 ENUM nativi, categorici = varchar+CHECK) + **RD-09 ~totale** (32 `date` corretti, 3 borderline) [F-WS-C-10].
- **D-18 chiuso e verificato live** (score-table: 1 riga attiva/soggetto, no accumulo) [F-WS-C-6] — è il template per risolvere C-4.
- **Backup/DR shipped** (R5 timer giornaliero pg_dump -Fc + retention + fail-loud; 3.7 dr-drill con RPO/RTO/row-count) [F-WS-C-5] — riconcilia/supera WS-G F-10.
- **Migration ledger robusto** (sha256 + duration + UNIQUE file_name) + **deploy sha-gated** (`migrate-if-pending.sh`) [F-WS-C-8]; catena twice-run-empty-diff idempotente (68 IF NOT EXISTS / 71 ON CONFLICT).
- **Integrità FK pulita** (0 orfani, ON DELETE RESTRICT; I5 = FK+middleware, no RLS) [F-WS-C-11]; **0 veri indici duplicati** [F-WS-C-3].

---

## Baseline Dati & persistenza (misure reali — aggiorna `BASELINE_METRICS.md`)

| Metrica | Valore reale | Comando/Fonte |
|---|---|---|
| File migration | **127** (`000001..000128`, gap 000035 cosmetico) | `ls db/migrations/*.sql \| wc -l` = 127 |
| Ledger migration | **127** righe (UNIQUE file_name; sha256+duration); `migration_id` serial @ 7445 (ri-apply storiche) | `SELECT count(*) FROM sys.sys_schema_migrations` |
| Idempotenza migration | 68 `IF NOT EXISTS` · 71 `ON CONFLICT` · 6 senza-guard (naturalmente re-runnable) | `grep -rl … db/migrations` |
| Deploy migrate | `migrate.sh` re-runna TUTTO; PROD usa `migrate-if-pending.sh` sha-gated → O(pending) | `db/scripts/migrate{,-if-pending}.sh` |
| FK totali (sys) | **494** | `pg_constraint contype='f'` |
| FK single-col SENZA indice | **243** (audit 109 · business 78 · tenant_id 56) | `pg_constraint` ⋈ `pg_index` |
| `tenant_id` FK senza alcun indice leading | **56** (max `sys_source_lineage_records` 70 MB, `sys_skills` 40 MB) | query custom |
| Indici idx_scan=0 | **220** tot · **74** non-PK/non-unique (max `…natural_key_idx` 10 MB) — `stats_reset=NULL`, contatore vivo | `pg_stat_user_indexes` |
| Indici duplicati veri | **0** (1 hit = partial-unique distinto) | `pg_index` group by indkey |
| Top tabella per size | `sys_skill_embeddings` **290 MB** (286 MB idx HNSW / 3,7 MB heap, 20.592 righe) | `pg_total_relation_size` |
| Refresh-token | **46.348 righe / 9 utenti** (37.554 "attivi" leak) — **0 pruning** | `count(*)` + grep cleanup = 0 |
| Login-event | **57.180 righe** append-only (18 MB) — **0 retention** | `count(*)` |
| Dead-schema | **0** vuote non-intenzionali (21 NO_SOURCE/9 EXCLUDE/1 REF intenzionali) | `v_reconciliation_status` |
| ENUM nativi (RD-08) | **0** | `pg_type typtype='e'` |
| `date` vs `timestamptz` (RD-09) | 32 `date` · 370 `timestamptz` · 3 `*_date` timestamptz borderline | `information_schema.columns` |
| Orfani FK (spot) | **0** (constraint-enforced) | LEFT JOIN check |
| Backup/DR | R5 timer giornaliero (pg_dump -Fc, retention 14g, off-host opt-in) + 3.7 dr-drill (RPO/RTO/row-count) | `scripts/backup-db.sh` + `dr-drill.sh` + `deploy/systemd/*backup*` |

**Insight chiave**: la persistenza è **strutturalmente sana** (0 dead-schema, RD-08/09 rispettati, FK integri, D-18 chiuso, backup+DR shipped). Le 2 leve a maggior impatto sono entrambe di **crescita/perf non governata**: (1) **243 FK senza indice** di cui 56 sono il filtro tenant I5 su tabelle fino a 70 MB → seq-scan nascosti; (2) **auth-audit unbounded** (46k token/9 utenti, 57k login-event, zero pruning) che degrada il partial active_idx del refresh-rotation. Backup/DR riconcilia/supera la lettura pessimista di WS-G F-10.

---

## Roll-up → candidati (decide Enzo per-finding; questo è un audit, non un fix)

**Dossier (richiedono decisione Enzo):**
- D — **policy indici FK completa** (tenant_id+business prioritari; audit-actor probabile WON'T-DO selettivo) [F-WS-C-1].
- D — **retention/pruning auth-audit** (refresh-token + login-event) — couples test-hygiene WS-F F-WS-F-6 + retention GDPR [F-WS-C-4].
- D — **off-host backup destination** (bucket OCI / twin linux-pc) — couples WS-G F-2 SPOF + D-08 [F-WS-C-5].
- D — **squash migration**: raccomandazione = NON ora; opzioni baseline-snapshot vs squash distruttivo [F-WS-C-7].

**Quick-wins CLASS-A** (eseguibili su go, gate espliciti sopra): QW-C1 indici tenant/business su 6 tabelle >5 MB · QW-C2 housekeeping auth-token/login-event · QW-C3 dr-drill schedulato · QW-C4 drop `natural_key_idx` (10 MB) verify-first.

**Note (verifica, non fix):** 74 indici non-PK idx_scan=0 → `pg_stat_reset()` + finestra di osservazione prima di qualsiasi drop oltre QW-C4 [F-WS-C-2]; 3 colonne `*_date` timestamptz → confermare semantica date-only vs time-of-day [F-WS-C-10].

**Asset da NON regredire**: reconciliation-registry (0 dead-schema) · RD-08/09 · D-18 chiuso · backup+DR shipped · ledger sha256 + deploy gated · FK integri · 0 indici duplicati.

---

*Audit S-100X-A4 — read-only, ispezione repo + query live read-only (tunnel :5433). Nessuna modifica a codice/schema/CI/deploy, zero scritture DB. I finding qui confluiscono nel registro dossier 100X — decisione per-finding di Enzo. Cross-ref: WS-G (F-10/R5 backup → riconciliato: backup+DR shipped; F-2 SPOF off-host) + WS-F (F-WS-F-6 residue-leak → couples l'auth-token bloat C-4) + DEBT D-18 (RISOLTO, template per C-4).*
