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
- [ ] **F3 La separazione delle identità: migrator, applicazione, sola lettura** — budget ~60k · rilievi `F5-01`, `F4-08`
      **La voce grossa dell'onda.** Oggi una sola identità fa tutto: migra, serve l'API, legge.
      Separarla tocca il deploy, i due `.env` e il pool dell'API — cioè tre cose che, sbagliate
      insieme, lasciano la produzione senza database.
      **Non si apre senza la simulazione R24 completa scritta**: precondizioni, meccanismo letto
      nel codice del pool e negli script di deploy, propagazione su VM e linux-pc, guardia, e la
      via di ritorno se l'API non si riconnette.
      **fatto =** tre identità distinte, l'API gira con quella meno potente che le basta, e un
      deploy completo passa da capo.
- [ ] **F4 La memoria del database, su una macchina che non è solo sua** — budget ~25k · rilievi `F8-06`, `F8-14`
      `shared_buffers` è a 128MB su 11GB. Sembra un aumento ovvio e **non lo è**: la VM ospita
      sette progetti, quindi la memoria che si prende qui la si toglie a qualcun altro.
      **Prima si misura la RAM realmente libera**, poi si decide il valore, poi si pianifica e si
      annuncia il restart.
      **fatto =** valore nuovo attivo dopo restart + la macchina ancora sana con tutti i servizi su.
- [ ] **F5 La copia locale che tace da cinque settimane** — budget ~20k · rilievo `F8-09`
      Il database sulla porta 5435 è vecchio di 5 settimane e **non lo dice a nessuno**: chi lo
      interroga misura luglio credendo di misurare oggi. Serve un segnale di staleness, non
      necessariamente un aggiornamento.
      **fatto =** interrogare la copia stantia produce un avviso visibile, non un numero muto.
- [ ] **F6 Tre cose che il progetto dichiara e la realtà smentisce** — budget ~20k · rilievi `A-03`, `A-10`, `A-11`
      · `A-03` — 3 sorgenti dichiarate contro **5** presenti nel database.
      · `A-10` — una tabella vuota che occupa 944 kB.
      · `A-11` — 7 numeri stantii nella documentazione di progetto. Questi **non si aggiornano**:
        si sostituiscono con il comando che li ri-deriva (⭐ IL PUNTO FISSO — non si cristallizza).
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
