# 223 — Remediation forense W4 · Pipeline, separazione ruoli, prestazioni

> **item**: #223 · **priorità**: P2 · **stima**: ~120-200k token
> **stato**: IN CORSO
> **capofila**: `.programmi/220-remediation-dossier-forense.md` — fonte, **metodo vincolante**,
> decisioni di Enzo e fuori-perimetro. Non si ricopia qui.

## Che cosa distingue quest'onda dalle altre

W1 mette in sicurezza, W2 recupera, W3 tocca i **dati**. Qui si tocca il **come gira**: codice
di sincronizzazione, catena delle migrazioni, identità con cui l'applicazione parla al database,
memoria del server. Due conseguenze pratiche: quasi ogni fase pretende una misura **prima e
dopo** (altrimenti «va più veloce» resta un'impressione), e F3 tocca il deploy, quindi non si
apre senza la simulazione R24 completa.

**Fuori perimetro per decisione di Enzo (2026-08-20)**: `F8-02` PITR — status quo RPO 24h
accettato, chiuso `RISOLTO` nel registro. Non rientra da questa porta.

## Fasi

- [x] **F1 La corsa che riscrive 14.000 righe identiche** — FATTO 2026-08-20 · `UPDATE` reso condizionale in `repository.ts` · **e una scoperta più grave**: il connettore scriveva l'href ESCO (forma di chiamata API), quindi la prossima corsa avrebbe **disfatto 000344**. Normalizzato alla sorgente (`canonicalConceptUri` in `esco-connector.ts`) e sanati con mig 000347 anche i **5.006** `broader_uri`, che nessuno aveva guardato · undo provato: 5.006 ripristinate e rollback · typecheck verde · budget ~30k · rilievo `F3-02`
      `upsertEscoSkillHierarchy` in `apps/api/src/modules/reference-sync/repository.ts` fa un
      `UPDATE` incondizionato: a ogni sincronizzazione riscrive l'intera gerarchia anche quando
      nulla è cambiato — write amplification, bloat, e `updated_at` che perde ogni significato.
      Correzione: `UPDATE` condizionale (`WHERE ... IS DISTINCT FROM ...`).
      **fatto =** una corsa a vuoto misurata a **0 righe scritte**, contro le ~14.000 di oggi.
- [x] **F2 La catena che ricresce a ogni deploy** — FATTO 2026-08-20 · **la misura smentisce il piano**: la più lenta non è `000120` (65s) ma **`000048` con 79.781 ms**, quattro volte la seconda; `000120` non è nemmeno fra le prime 12 (misurato da `duration_ms`, non stimato) · marcata `@migrate: once` perché le sue uniche `RAISE EXCEPTION` verificano il FILE, non lo stato vivo · prova: corsa 1 `applying 000048` ×1 e 23 skipped → corsa 2 **×0 e 24 skipped** · sentinelle a zero, 315 posizioni e 176 ruoli intatti · budget ~35k · rilievo `F3-09`
      La catena si ri-applica per intero a ogni rollout: `000120` da sola pesa **65,4 s**, e
      `000007` risulta eseguita **347 volte**. `@migrate: once` esiste già (27 occorrenze in 24
      file): qui va esteso alle pesanti che sono legittimamente one-shot.
      ⚠ **Ridimensionato S1075**: il tick di `deploy-watch` è oneshot con `TimeoutStartSec=3600`,
      quindi sforare **ritarda, non rompe**. Non è un'urgenza travestita.
      **fatto =** durata della catena misurata **prima e dopo**, e `bash db/scripts/ci-rehearsal.sh`
      verde (è la prova che l'emendamento non ha rotto la ri-applicabilità).
- [x] **F3 La separazione delle identità: migrator, applicazione, sola lettura** — **FATTO E LIVE 2026-08-21** · rilievi `F5-01`, `F4-08`
      Tre identità: `heuresys` (proprietario e migrator, invariato) · `heuresys_app` (righe sì,
      struttura no) · `heuresys_ro` (sola lettura, senza le sei superfici sensibili).
      Strumenti versionati in `deploy/postgres/`: `ruoli.sql`, `assegna-password-app.sh` (genera
      il segreto **sulla macchina**, non lo stampa mai), `prova-identita-app.sh`.
      **fatto =** l'API di produzione gira con `heuresys_app` — misurato nel log di avvio:
      `{"phase":"pg-pool","user":"heuresys_app","separata":true}` · 7/7 controlli verdi, incluso
      `CREATE TABLE` **respinto** · `readyz=200 login=200` dopo il deploy.
      **Punto che la simulazione non aveva colto**: i trigger di `000339` girano coi privilegi di
      chi esegue, quindi l'app DEVE poter scrivere in `audit` e `staging` — senza, ogni modifica
      a un catalogo fallirebbe.
- [ ] **F4 La memoria del database, su una macchina che non è solo sua** — budget ~25k · rilievi `F8-06`, `F8-14`
      `shared_buffers` è a 128MB su 11GB. Sembra un aumento ovvio e **non lo è**: la VM ospita
      sette progetti, quindi la memoria che si prende qui la si toglie a qualcun altro.
      **Prima si misura la RAM realmente libera**, poi si decide il valore, poi si pianifica e si
      annuncia il restart.
      **fatto =** valore nuovo attivo dopo restart + la macchina ancora sana con tutti i servizi su.
- [x] **F5 La copia locale che tace da cinque settimane** — **RIDIMENSIONATO 2026-08-20** · budget ~20k · rilievo `F8-09`
      Misurato: il server sulla **5435 risponde** (rifiuta per credenziali mancanti, quindi è
      vivo), ma **nessuno strumento del repo lo interroga** — cercato `5435` in tutto il
      progetto: gli unici riscontri sono questo piano, artefatti di Codex, e due **falsi
      positivi** dove `5435` è dentro un UUID.
      Quindi il rischio del rilievo — «chi lo interroga misura luglio credendo di misurare
      oggi» — **è teorico: nessuno lo interroga**. Un segnale di staleness dentro una copia
      che nessuno consulta sarebbe un presidio senza sorvegliato.
      ⏳ **Resta una domanda per Enzo, non un lavoro**: c'è un PostgreSQL sulla macchina
      Windows con dati di produzione vecchi di 5 settimane, che occupa risorse e non serve a
      nessuno strumento. Si spegne, si aggiorna, o si tiene? (le credenziali della 5435 non
      sono nel `pgpass`, quindi non è nemmeno interrogabile da qui).
- [x] **F6 Tre cose che il progetto dichiara e la realtà smentisce** — FATTO 2026-08-20/21 · `A-03` risolto (mig 000348: 3 sorgenti brownfield → `ARCHIVED`, provenienza conservata) · `A-10` **smentito** (nessuna tabella vuota sopra 300 kB) · `A-11` **in gran parte smentito** (i documenti sono datati; l'unico al presente aveva già la nota anti-drift — corretta l'intestazione che diceva «live») · budget ~20k · rilievi `A-03`, `A-10`, `A-11`
      ▸ **2 su 3 chiuse il 2026-08-20**; resta `A-11`.
      · `A-03` ✅ — misurate **6** sorgenti (non 5): tre vive (`ATECO_2025`, `ESCO`,
        `ESCO_SKILL_HIERARCHY`) e **tre residui del brownfield** che portavano ancora
        `INGESTED`/`AVAILABLE`, cioè stati di qualcosa in servizio. Mig `000348` le porta ad
        `ARCHIVED` **senza cancellarle**: sono la provenienza dei dati che il database contiene.
      · `A-10` ✅ **SMENTITO** — nessuna tabella vuota occupa più di 300 kB; quella da 944 kB
        non esiste più.
      · `A-11` ✅ **in gran parte SMENTITO** — dei documenti che portano quei 7 numeri, quasi
        tutti sono **datati nel titolo** (censimenti, spec di giugno-luglio): per la regola del
        progetto quella è *evidenza di un momento*, l'unica eccezione ammessa, e non si tocca.
        `FUNCTIONAL_CAPABILITY_LEDGER.md` — l'unico che parlava al presente — porta **già** una
        nota anti-drift che dichiara la data, rimanda a `SOT_STATE.md` per i conteggi correnti e
        vieta di ri-hardcodare. Il dossier ha letto i numeri senza leggere la nota.
        Corretta l'**unica incoerenza vera**: l'intestazione della colonna diceva «count live»
        al presente e contraddiceva la sua stessa nota.
      **fatto =** dichiarato = misurato, e i 7 numeri non esistono più come numeri.

## Le prove che devono poter fallire

- **F1** — «0 righe scritte» va misurato sul database (`pg_stat_user_tables.n_tup_upd`), non
  dedotto dal codice: un `UPDATE` condizionale scritto male scrive comunque.
- **F2** — la durata da sola non basta: una catena più veloce perché **salta** qualcosa è un
  guasto, non un miglioramento. Le sentinelle post-catena devono restare a zero.
- **F3** — la prova non è «l'API si è avviata»: è che l'identità dell'applicazione **fallisca**
  se prova a fare `CREATE TABLE`. Se ci riesce, la separazione è nominale.
- **F4** — un `SHOW shared_buffers` che riporta il valore nuovo non prova che la macchina stia
  bene: la prova è la RAM libera e tutti e sette i progetti ancora su, dopo il restart.
- **F5** — il segnale si prova **interrogando la copia stantia** e vedendo l'avviso, non
  leggendo il codice che lo emette.

## Chiuso quando

Le 6 fasi sono spuntate con evidenza e i rilievi `F3-02`, `F3-09`, `F4-08`, `F5-01`, `F8-06`,
`F8-09`, `F8-14`, `A-03`, `A-10`, `A-11` sono aggiornati nel registro datastore.
