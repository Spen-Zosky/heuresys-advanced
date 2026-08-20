# #220-#223 — Remediation dal dossier forense heuresys-datastore

**Nato**: S1075 (2026-08-20), sessione di solo piano. **Fonte**: `D:\heuresys-datastore\docs\03_evidenza_advanced\01_DOSSIER_FORENSE.md` (misure 2026-08-19) + registro `D:\heuresys-datastore\docs\01_fattori_critici\00_REGISTRO_FATTORI_CRITICI.md` (88 rilievi: 29 A / 40 M / 19 B; 79 non risolti dopo le decisioni di oggi). Le query di misura ripetibili: `D:\heuresys-datastore\docs\00_preface\07_QUERY_DI_MISURA.md`.

Ogni rilievo porta un ID stabile (`F1-01`, `A-07`, …): usarlo sempre, così piano e registro restano confrontabili. **Ogni rilievo va ri-misurato al momento della presa in carico** (#149) — il dossier stesso lo impone (§0: tre errori documentati dell'autore).

## Verifiche già eseguite (S1075, sul vivo)

- **F1-01 CONFERMATO**: 4 FK `CASCADE` sui due crosswalk (`pg_constraint` → `confdeltype=c`); crosswalk 0 righe.
- **F7-03 RIDIMENSIONATO**: 7.427→92 moduli = purghe deliberate versionate (mig `000197`, `000200`, `000235`, `000241`). Ripristinare violerebbe I12. Resta la chiusura documentale.
- **F3-09 RIDIMENSIONATO**: `deploy-watch` è oneshot, `TimeoutStartSec=3600` — sforare i 5 min ritarda, non rompe. Resta la catena che ricresce; `@migrate: once` esiste già (27 occorrenze in 24 file).
- **F8-01 SMENTITO IN PARTE**: `heuresys-backup-pull.timer` ATTIVO su linux-pc, 7 dump giornalieri ×124MB in `~/heuresys-backups/prod/`, disco 48%. La copia fuori sede esiste (pull); manca il push dalla VM e la riconciliazione repo↔realtà (unit in `deploy/systemd/archive/`).
- Materiale di recupero presente: `D:\heuresys-datastore\_recupero_20260716\` (crosswalk 5.730 · NACE 1.066 · vedi `PROVENIENZA.md` lì dentro).
- **NON VERIFICATO**: `BACKUP_OFFHOST_SSH` nei due `.env` (lettura del `.env` PC negata in sessione) → W1.7.

## Decisioni di Enzo (2026-08-20, vincolanti)

1. **NACE + crosswalk ATECO↔NACE: SI RIPRISTINANO** (F7-01/F7-04) — prima F1-01, poi NACE, poi crosswalk.
2. **F8-02 (PITR): STATUS QUO ACCETTATO** — RPO 24h (dump notturno + pull linux-pc). Chiuso `RISOLTO` nel registro datastore. Non rientra nel programma.
3. **Il registro datastore lo aggiorna la CLI** man mano che chiude rilievi (stato + data + misura; dopo ogni modifica: `bash docs/_meta/verifica_vault.sh` nel vault deve restare verde — verificato oggi).

## Metodo per ogni voce (vincolante — Metodo di bonifica S1049)

misura live della precondizione al momento (mai ereditata) → migrazione emendativa (ADR-0035: si emenda il file che crea; `@migrate: once` per le one-shot) → `bash db/scripts/ci-rehearsal.sh` su linux-pc → post-condizione su ciò che NON doveva cambiare → rollback dichiarato (`staging.*_undo` o ragione scritta) → commit atomico → query del dossier rieseguita in prod, esito incollato testuale → stato aggiornato nel registro datastore.

## #220 — W1 · Messa in sicurezza (~120-180k, 1 sessione)

| id | rilievi | cosa | fatto = |
|---|---|---|---|
| W1.1 | F1-01 | 4 FK crosswalk `CASCADE`→`RESTRICT` | `confdeltype=r` misurato in prod |
| W1.2 | F5-05 | revoca SELECT su `sys_auth_credentials`, `sys_auth_mfa_recovery_codes`, `sys_auth_password_reset_tokens`, `sys_user_bank_details`, `sys_user_pay_slips`, `v_mfa_secrets_in_cleartext` a `codex_auditor` e `gov_worker` — emendando il file che CREA i grant; nota in `.codex-review/service/access/CLAUDE_INTEGRATION.md` | query grant = vuota |
| W1.3 | F5-03 | logging server (`logging_collector`, `log_connections`, `log_min_duration_statement`) con rotazione, disco-aware (23GB liberi misurati) | `SHOW` + log file vivo |
| W1.4 | F5-02, F5-07 | trigger audit + `updated_at` sui 15 cataloghi (oggi 0 audit, 5/15 timestamp) | 15/15 + riga di prova in `audit.*` |
| W1.5 | F5-06 | `REVOKE CONNECT FROM PUBLIC`; indagine PRIMA su `lls` (altro progetto?) e `heuresys_backup` (BYPASSRLS senza grant) | ACL misurata; anomalie risolte o WAIT-INPUT |
| W1.6 | F8-10, F4-04 | `track_functions=pl` + `pg_stat_statements.max`↑ (restart PG pianificato e annunciato) | `SHOW` post-restart |
| W1.7 | F8-01, F8-03 | formalizzare il pull linux-pc (unit fuori da `archive/`, doc offsite); check `BACKUP_OFFHOST_SSH` nei due `.env` | unit tracciate dove girano; registro emendato |
| W1.8 | F4-07 | `ANALYZE` su requisiti/embeddings/skills + verifica autovacuum | `last_analyze` di oggi |

## #221 — W2 · Recuperi (~80-120k) — W2.1/W2.2 solo DOPO W1.1

| id | rilievi | cosa | fatto = |
|---|---|---|---|
| W2.1 | F7-04 | ripristino NACE 1.066 (preferito: `reference_sync` se ha la sorgente; fallback CSV con `@migrate: once` + undo) | 1.066 misurate, gerarchia integra |
| W2.2 | F7-01 | ripristino crosswalk 5.730 (3.890 dirette + 1.840 rimappate su ATECO 2025 per codice) | conteggio + 0 orfani + impronta = CSV |
| W2.3 | F7-02 | datazione onesta dei vettori ricalcolati (provenienza o timestamp reale, documentato) | tracciabilità misurabile |
| W2.4 | F7-03 | chiusura documentale (purghe deliberate); misurare se i 59 corsi food con 199 assegnazioni esistono ancora → se sì, domanda a Enzo | registro aggiornato con evidenza |
| W2.5 | F7-06 | verifica famiglie/ruoli rimaneggiati (referto 27 del vault) | confermato/smentito con misura |
| W2.6 | F8-11, F8-12 | refresh `heuresys_ci` da prod DOPO i recuperi (`clone-vm-db.sh`) | conteggi ci = prod |

## #222 — W3 · Integrità e contenuti (~150-250k, multi-sessione)

F1-04 indice UNIQUE su `skill_esco_uri` · F1-06 tre indici FK mancanti · F1-07 CHECK su `entity_table` + sentinella orfani traduzioni · F1-03/F2-05 normalizzazione `skill_group_uri` nei metadati (13.178 righe, undo journal) · F6-01 traduzioni EN/DE ATECO già nei metadati → `sys_reference_translations` + `sys_translatable_field` · F6-03 70 URI ESCO contraffatti → `CUSTOM::` (misurare prima chi li referenzia) · F6-02 103 canonici in inglese · F6-04 5 codici settore → ATECO 2025 · F6-07 ricollegare 286 competenze dagli archi, curare le 84 isolate · F6-09 4 ridondanze vere · F2-01 consolidamento canale ruolo↔occupazione (64 FK + 111 metadata, 0 sovrapposti, su 176 ruoli) · F6-10 tipografia · F1-05/F1-08/F1-09 pulizie basse (ri-misurare `idx_scan` prima).

## #223 — W4 · Pipeline, ruoli, prestazioni (~120-200k)

F3-02 UPDATE condizionale in `upsertEscoSkillHierarchy` (`modules/reference-sync/repository.ts`) · F3-09 `@migrate: once` sulle migrazioni pesanti (000120 = 65,4s in testa; misura catena prima/dopo) · F5-01/F4-08 separazione ruoli migrator/app/readonly (voce grossa: deploy, `.env`, pool API — simulazione R24 completa prima) · F8-06/F8-14 `shared_buffers` (RAM 11GB misurata, VM condivisa fra 7 progetti — misurare la libera) · F8-09 segnale staleness copia locale · A-03 (3 sorgenti dichiarate vs 5) · A-10 (tabella vuota 944kB) · A-11 (7 numeri stantii nella doc di progetto).

## Fuori perimetro advanced (dichiarato, NON pendenze)

- **EREDITATO** (li evita il progetto datastore per costruzione): F2-03, F2-04, F2-08, F6-08.
- **Gated sui DP del progetto datastore** (decisioni di Enzo, in quel progetto — `docs/00_preface/17_DOMANDE_DI_PROGETTO.md`): F3-01/03/04/05/07 (DP-03), F2-06, F2-07, F1-02 (DP-01), F2-02/A-05 (ISCO), F4-02 (DP-09), A-02, A-07, A-08, A-09, F8-05, F8-15.
- **RISOLTI nel registro**: F3-06, F4-01, F4-06, F7-05, F7-08, F8-02 (decisione 2026-08-20), F8-04, F8-07, F8-08.
- **POSITIVI da conservare** (§9 del dossier): guardie fail-loud di reference-sync, salto per impronta, UUID v5 deterministici, prova di ripristino settimanale, zero SECURITY DEFINER, integrità gerarchica, matrice requisiti.
