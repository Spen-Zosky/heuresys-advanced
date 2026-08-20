# 220 — Remediation forense W1 · Messa in sicurezza

> **item**: #220 · **priorità**: P1 · **stima**: ~120-180k token (1 sessione dedicata)
> **stato**: IN CORSO
> **capofila del programma #220-#223**: questo file porta fonte, metodo vincolante e decisioni
> di Enzo per **tutti e quattro**. Il dettaglio delle onde W2/W3/W4 vive nei rispettivi file e
> **non si ricopia qui** — due copie della stessa tabella divergono, ed è successo.

**Nato**: S1075 (2026-08-20), sessione di solo piano. **Fonte**: `D:\heuresys-datastore\docs\03_evidenza_advanced\01_DOSSIER_FORENSE.md` (misure 2026-08-19) + registro `D:\heuresys-datastore\docs\01_fattori_critici\00_REGISTRO_FATTORI_CRITICI.md` (88 rilievi: 29 A / 40 M / 19 B; 79 non risolti dopo le decisioni di oggi). Le query di misura ripetibili: `D:\heuresys-datastore\docs\00_preface\07_QUERY_DI_MISURA.md`.

Ogni rilievo porta un ID stabile (`F1-01`, `A-07`, …): usarlo sempre, così piano e registro restano confrontabili. **Ogni rilievo va ri-misurato al momento della presa in carico** (#149) — il dossier stesso lo impone (§0: tre errori documentati dell'autore).

## Le altre tre onde — indice, non copia

| item | onda | file | effort |
|---|---|---|---|
| `#221` | W2 · Recuperi (NACE, crosswalk) | `.programmi/221-remediation-w2-recuperi.md` | ~80-120k |
| `#222` | W3 · Integrità e contenuti dei cataloghi | `.programmi/222-remediation-w3-integrita-contenuti.md` | ~150-250k |
| `#223` | W4 · Pipeline, separazione ruoli, prestazioni | `.programmi/223-remediation-w4-pipeline-ruoli.md` | ~120-200k |

**Ordine vincolante fra le onde**: `#221` W2.1/W2.2 partono **solo dopo** F1 di questa voce
(W1.1). Finché le FK dei crosswalk sono `CASCADE`, un ritiro di catalogo azzererebbe di nuovo
il crosswalk appena ripristinato — si rifarebbe lo stesso lavoro due volte.

## Verifiche già eseguite (S1075, sul vivo)

- **F1-01 CONFERMATO**: 4 FK `CASCADE` sui due crosswalk (`pg_constraint` → `confdeltype=c`); crosswalk 0 righe.
- **F7-03 RIDIMENSIONATO**: 7.427→92 moduli = purghe deliberate versionate (mig `000197`, `000200`, `000235`, `000241`). Ripristinare violerebbe I12. Resta la chiusura documentale.
- **F3-09 RIDIMENSIONATO**: `deploy-watch` è oneshot, `TimeoutStartSec=3600` — sforare i 5 min ritarda, non rompe. Resta la catena che ricresce; `@migrate: once` esiste già (27 occorrenze in 24 file).
- **F8-01 SMENTITO IN PARTE**: `heuresys-backup-pull.timer` ATTIVO su linux-pc, 7 dump giornalieri ×124MB in `~/heuresys-backups/prod/`, disco 48%. La copia fuori sede esiste (pull); manca il push dalla VM e la riconciliazione repo↔realtà (unit in `deploy/systemd/archive/`).
- Materiale di recupero presente: `D:\heuresys-datastore\_recupero_20260716\` (crosswalk 5.730 · NACE 1.066 · vedi `PROVENIENZA.md` lì dentro).
- **NON VERIFICATO**: `BACKUP_OFFHOST_SSH` nei due `.env` (lettura del `.env` PC negata in sessione) → F5 qui sotto.

## Decisioni di Enzo (2026-08-20, vincolanti — non si ri-chiedono)

1. **NACE + crosswalk ATECO↔NACE: SI RIPRISTINANO** (F7-01/F7-04) — prima F1-01, poi NACE, poi crosswalk.
2. **F8-02 (PITR): STATUS QUO ACCETTATO** — RPO 24h (dump notturno + pull linux-pc). Chiuso `RISOLTO` nel registro datastore. Non rientra nel programma.
3. **Il registro datastore lo aggiorna la CLI** man mano che chiude rilievi (stato + data + misura; dopo ogni modifica: `bash docs/_meta/verifica_vault.sh` nel vault deve restare verde — verificato 2026-08-20).

## Metodo per ogni voce (vincolante — Metodo di bonifica S1049)

misura live della precondizione al momento (mai ereditata) → migrazione emendativa (ADR-0035: si emenda il file che crea; `@migrate: once` per le one-shot) → `bash db/scripts/ci-rehearsal.sh` su linux-pc → post-condizione su ciò che NON doveva cambiare → rollback dichiarato (`staging.*_undo` o ragione scritta) → commit atomico → query del dossier rieseguita in prod, esito incollato testuale → stato aggiornato nel registro datastore.

## Fasi

- [x] **F1 Le due che chiudono un varco di lettura** — FATTO 2026-08-20 · mig 000337+000338 · in prod: 4/4 FK `confdeltype=r` · 12/12 `has_table_privilege`=f, `codex_auditor` conserva 256 oggetti · budget ~40k · rilievi `F1-01`, `F5-05`
      Vanno per prime per due ragioni diverse, entrambe stringenti: la prima **sblocca `#221`**,
      la seconda è un segreto leggibile da un'identità che non dovrebbe vederlo.
      · **W1.1** — 4 FK dei crosswalk da `CASCADE` a `RESTRICT`. **fatto =** `confdeltype=r`
        misurato in produzione su tutte e quattro.
      · **W1.2** — revoca `SELECT` su `sys_auth_credentials`, `sys_auth_mfa_recovery_codes`,
        `sys_auth_password_reset_tokens`, `sys_user_bank_details`, `sys_user_pay_slips` e
        `v_mfa_secrets_in_cleartext` a `codex_auditor` e `gov_worker` — **emendando il file che
        CREA i grant** (ADR-0035: una `REVOKE` a valle viene disfatta al deploy dopo). Nota in
        `.codex-review/service/access/CLAUDE_INTEGRATION.md`. **fatto =** la query dei grant
        torna vuota.
- [ ] **F2 Gli occhi che oggi sono chiusi** — budget ~45k · rilievi `F5-03`, `F5-02`, `F5-07`
      Il database non registra chi fa cosa sui cataloghi, e non conserva traccia delle
      connessioni. Sono due assenze, non due difetti: nulla è rotto, semplicemente non si vede.
      · **W1.3** — logging server (`logging_collector`, `log_connections`,
        `log_min_duration_statement`) con rotazione, dimensionato sul disco (23GB liberi misurati
        S1075 — **ri-misurare**, è un dato che varia). **fatto =** `SHOW` + un file di log vivo.
      · **W1.4** — trigger di audit e `updated_at` sui 15 cataloghi (oggi 0 audit, 5/15
        timestamp). **fatto =** 15/15 + una riga di prova comparsa in `audit.*`.
- [ ] **F3 Chi può connettersi — e due anomalie da capire prima di toccare** — budget ~30k · rilievo `F5-06`
      · **W1.5** — `REVOKE CONNECT FROM PUBLIC`. **L'indagine viene prima**: `lls` (di un altro
        progetto?) e `heuresys_backup` (`BYPASSRLS` senza alcun grant) vanno spiegati, o la
        revoca spegne qualcosa che serve. **fatto =** ACL misurata; le due anomalie risolte
        oppure dichiarate `WAIT-INPUT` con la domanda precisa.
- [ ] **F4 Le due che pretendono un restart annunciato** — budget ~20k · rilievi `F8-10`, `F4-04`
      · **W1.6** — `track_functions=pl` e `pg_stat_statements.max` più alto. Richiedono il
        riavvio di PostgreSQL: **pianificato e annunciato**, non di passaggio. **fatto =** `SHOW`
        dopo il restart.
- [ ] **F5 La copia fuori sede: dichiarare ciò che già gira** — budget ~25k · rilievi `F8-01`, `F8-03`
      · **W1.7** — il pull su linux-pc **esiste ed è attivo** (misurato S1075): il difetto non è
        l'assenza del backup, è che le unit vivono in `deploy/systemd/archive/`, cioè il repo
        dichiara una realtà diversa da quella che gira. Portarle dove stanno davvero, documentare
        l'offsite, e verificare `BACKUP_OFFHOST_SSH` nei due `.env` (**non verificato**: la
        lettura del `.env` del PC fu negata in S1075). **fatto =** unit tracciate dove girano;
        registro emendato.
- [ ] **F6 Le statistiche su cui il pianificatore decide** — budget ~15k · rilievo `F4-07`
      · **W1.8** — `ANALYZE` su requisiti, embeddings e skills, più la verifica che autovacuum
        stia davvero lavorando su quelle tabelle. **fatto =** `last_analyze` in giornata.

## Le prove che devono poter fallire

- **F1/W1.1** — la post-condizione non è «le FK sono `RESTRICT`», è **anche** che il crosswalk
  ripristinato in `#221` sopravviva a un ritiro di catalogo. Finché non c'è crosswalk da
  proteggere, la prova è solo strutturale: dichiararlo, non spacciarla per funzionale.
- **F1/W1.2** — se dopo la revoca `codex_auditor` legge ancora una di quelle tabelle, il grant
  era altrove (ruolo ereditato, `PUBLIC`): la query dei grant va fatta **dall'identità**, non
  solo su `role_table_grants`.
- **F2/W1.4** — un trigger installato non è un trigger che scrive: la prova è una **riga vera**
  comparsa in `audit.*` dopo una modifica reale, non la presenza del trigger in `pg_trigger`.
- **F3/W1.5** — una revoca che non rompe niente **subito** può rompere un job notturno. La prova
  regge solo dopo un ciclo completo dei job schedulati.

## Chiuso quando

Le 6 fasi sono spuntate con evidenza, le query del dossier rieseguite in produzione danno
l'esito atteso incollato testualmente, e i rilievi `F1-01`, `F5-02`, `F5-03`, `F5-05`, `F5-06`,
`F5-07`, `F8-01`, `F8-03`, `F8-10`, `F4-04`, `F4-07` sono aggiornati nel registro datastore.

## Fuori perimetro advanced (dichiarato, NON pendenze)

- **EREDITATO** (li evita il progetto datastore per costruzione): F2-03, F2-04, F2-08, F6-08.
- **Gated sui DP del progetto datastore** (decisioni di Enzo, in quel progetto — `docs/00_preface/17_DOMANDE_DI_PROGETTO.md`): F3-01/03/04/05/07 (DP-03), F2-06, F2-07, F1-02 (DP-01), F2-02/A-05 (ISCO), F4-02 (DP-09), A-02, A-07, A-08, A-09, F8-05, F8-15.
- **RISOLTI nel registro**: F3-06, F4-01, F4-06, F7-05, F7-08, F8-02 (decisione 2026-08-20), F8-04, F8-07, F8-08.
- **POSITIVI da conservare** (§9 del dossier): guardie fail-loud di reference-sync, salto per impronta, UUID v5 deterministici, prova di ripristino settimanale, zero SECURITY DEFINER, integrità gerarchica, matrice requisiti.
