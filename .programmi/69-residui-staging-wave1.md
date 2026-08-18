# 69 — Bonifica dei residui `staging.wave1_*` nell'advanced

> **item**: #69
> **stato**: NON AVVIATO

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

- [ ] **F1 I 18 residui del prefisso `staging.wave1_`** — budget ~50k
      Stanno nel **nostro** DBMS (≈720 kB), non nel legacy: bonificabili subito, nessuna
      dipendenza aperta. ⚠ **ADR-0035**: ritirare non è cancellare — la catena si ri-applica a
      ogni deploy, quindi va emendato **il file che li crea** (o marcato `-- @migrate: once`), e
      solo *in aggiunta* rimosso l'esemplare. Il costo si misura **in file da emendare** e va
      contato prima di iniziare. Elenco esplicito delle 18 tabelle, **mai un carattere jolly**.
- [ ] **F2 La prova generale, e la sentinella che le tiene fuori** — budget ~25k
      `bash db/scripts/ci-rehearsal.sh` (obbligatoria su ogni tocco a `db/**`). La prova deve
      valere **18 adesso e 0 dopo**: se valesse 0 già adesso misurerebbe la cosa sbagliata.

## Fuori da questo item, e sono cose diverse

- **La rotazione di `POSTGRES_PASSWORD`**, condivisa fra advanced e stack evo, è **D-60**: un tema
  di sicurezza **indipendente** dall'import, che resta aperto anche col rubinetto chiuso.
- **Lo spegnimento del legacy**: uscito per decisione, non rinviato.

## Chiuso quando

Nessuna tabella `staging.wave1_*` esiste nel DBMS, il file che le crea è stato emendato (non solo
l'esemplare rimosso), e la prova generale è verde su due passate.
