# 69 — Bonifica dei residui `staging.wave1_*` nell'advanced

> **item**: #69
> **stato**: CHIUSO

Era «Fase 3 Blocco E — chiusura brownfield lato DBMS legacy». **Ri-titolato il 2026-08-14**: lo
spegnimento del legacy è uscito dall'item per decisione di Enzo, e ciò che resta sta tutto nel
**nostro** DBMS.

## Il blocco è caduto, e va detto perché

Era `⛔ decisione Wave-3 (#17, HOLD)`, che avrebbe riusato il legacy come sorgente. La direzione
di Enzo del 2026-08-14 — *«nessun dato riferito al brownfield deve essere rimesso in circolo»*,
invariante **I12** riscritto — toglie al legacy ogni ruolo di sorgente. Nessun lavoro futuro lo
riuserà, quindi non c'è più niente da attendere.

## Decisione di Enzo (2026-08-14): lo spegnimento ESCE dall'item

*«Non è necessario, perché adesso abbiamo dato al progetto il vincolo di non attingere più dal
legacy e il DBMS di progetto è autosufficiente.»* Concordata **su misura, non per adesione** —
le quattro ragioni, che valgono ancora e non vanno ri-discusse:

1. **Il vincolo rende lo spegnimento ridondante come prevenzione**: ciò che impedisce un import
   nuovo è il cancello `check_no_legacy_ingest.py` (ADR-0038), non l'assenza fisica del database.
   Spegnere sarebbe una seconda serratura sulla stessa porta.
2. **Il costo di tenerlo è di ordine trascurabile.** ⚠ I due numeri (dimensione del database,
   spazio libero) **non si scrivono qui**: variano, e cristallizzarli li rende falsi il giorno
   dopo — è esattamente com'era nato il «disco all'86%» del dossier di inizio agosto.
3. **Spegnerlo romperebbe servizi vivi e sani**: quel container è la base dati di uno stack di
   container tutti `Up (healthy)` — gateway, enrichment, redis, più l'exporter che alimenta
   Grafana e Prometheus. Nessuno c'entra con l'ingestione: pagherebbero per una pulizia che non
   li riguarda.
4. **ADR-0038 conserva apposta la consultazione del legacy per i CONCETTI**, e nella sola sessione
   della decisione è servita due volte (`#50` e `#54`).

## Fasi

- [x] **F1 I 18 residui del prefisso `staging.wave1_`** — **FATTA 2026-08-19 (S1072)** ·
      mig. **`000332`**, elenco esplicito delle diciotto, mai un carattere jolly.

      **⚠ IL PERMESSO DI TOGLIERLE NON VIENE DAL FATTO CHE SIANO VUOTE**, e questa voce
      rischiava proprio quell'errore. Due migrazioni le avevano già incontrate e **lasciate
      dov'erano**, ognuna con la sua ragione scritta:
      · la `000193` — *«staging.wave1_* → gated dalla decisione Wave-3 (#17, HOLD Enzo)»*;
      · la `000283` — *«appartengono all'area di appoggio della funzionalità brownfield, che la
        fase 3 ritira e la fase 4 rimuove. Toglierle qui romperebbe la funzionalità prima del
        suo ritiro»*, e aggiungeva la frase che vale ancora: **«una tabella vuota non è una
        tabella inutilizzata — è l'ingresso di un processo che in questo momento non sta
        girando»**.
      Entrambe le condizioni sono cadute, e **misurate** invece che ricordate: `#17` è
      **`WON'T-DO`** dal 2026-08-14 (era un import dal legacy, vietato da **I12**), e lo schema
      `brownfield` **non esiste più** — `#164` F4 l'ha ritirato con la `000297`, cioè
      esattamente la fase che la `000283` diceva di aspettare.

      **Il costo in file da emendare, contato prima di iniziare: ZERO.** `000030` e `000034`
      — i due che le creano — portano **già** il marcatore `-- @migrate: once` (messo da `#164`
      F4) e **non hanno guardie vive** (zero `RAISE EXCEPTION`, misurato). Metà del lavoro di
      ADR-0035 era già fatta, e restava solo la rimozione degli esemplari.

      **Cosa si rompe: niente, verificato leggendo.** I quattro file che contengono «wave1»
      (`db/seeds/reconciliation/52_*.sql`, `populate-i18n-wave1-gaps.sql`,
      `extract-wave1-legacy.sh`, un test di integrazione) nominano **file** con quel nome —
      dump del legacy, CSV di traduzioni — **non queste tabelle**. Più: **0** chiavi esterne
      in entrata, **0** viste che le nominano, **0** righe in tutte e diciotto.
- [x] **F2 La prova generale, e la sentinella che le tiene fuori** — **FATTA 2026-08-19 (S1072)**.
      Prova generale sul linux-pc **VERDE**, due passate, e le sentinelle passano da **21 a 22**:
      la nuova è stata raccolta **da sé**.

      **La sentinella non è uno script da ricordarsi di lanciare, è una vista.**
      `sys.v_staging_wave1_residue` — e `db_health.py` scopre le sentinelle **da `pg_views`**,
      pretendendo che ognuna torni zero righe. Basta che esista perché entri nella batteria
      che gira alla prova generale e a ogni avvio di sessione: nessun elenco da tenere
      aggiornato a mano. ⚠ Interroga `pg_class`, **non** un elenco di nomi: una
      `staging.wave1_qualcosa_di_nuovo` creata domani comparirebbe da sola — un elenco fisso
      avrebbe protetto solo le diciotto che conoscevo io.

      ✅ **«18 adesso e 0 dopo», e la prova lo dimostra invece di prometterlo**: tolti i
      diciotto `DROP` dalla migrazione, la prova generale diventa **ROSSA** con
      *«000332: restano 18 tabelle wave1 in staging»* — il numero esatto che la fase chiedeva.
      Se la post-condizione avesse detto 0 anche prima, starebbe misurando la cosa sbagliata.

## Fuori da questo item, e sono cose diverse

- **La rotazione di `POSTGRES_PASSWORD`**, condivisa fra advanced e stack evo, è **D-60**: un tema
  di sicurezza **indipendente** dall'import, che resta aperto anche col rubinetto chiuso.
- **Lo spegnimento del legacy**: uscito per decisione, non rinviato.

## Chiuso quando

Nessuna tabella `staging.wave1_*` esiste nel DBMS, il file che le crea è stato emendato (non solo
l'esemplare rimosso), e la prova generale è verde su due passate.
