# 252 — Il ponte di approvazione umana si aggancia anche alle letture oltre la soglia alta

> **item**: #252 · **priorità**: P1 · **stima**: ~1 sessione (dopo `#251`)
> **stato**: NON AVVIATO
> **nasce-da**: ADR-0040 R2, secondo passo. Il ponte esiste ed è provato per le scritture (`apps/agent-gateway/src/approval-bridge.ts`, `canUseTool` in `write-gate.ts`, evento `approval_required` gestito da `apps/web/src/lib/use-agent-stream.ts`); per le letture oggi è `READ_AUTO_ALLOW` sempre.

## Decisioni già prese (non si ri-chiedono)

- **Non è un tetto**: chi conferma legge tutto il tenant (I22). Oltre 40 l'agente si ferma e chiede; fra 26 e 40 non si ferma, il diario registra il numero; fino a 25 silenzio.
- Si **riusa** `canUseTool`: la decisione resta in un posto solo. Negata o scaduta → `deny` nel diario con la ragione (`READ_OVER_THRESHOLD_DENIED`), come per le scritture.
- Il gate non decide da solo quante persone ci sono: **legge il contatore di `#251`**. Senza `#251` questa voce non parte.

## Fasi

- [ ] **F1 — Il gate legge il livello** — `makeCanUseTool` riceve il contatore; su una lettura, se il livello è «confermato» instrada al ponte con un payload che dica **quante persone e quale concetto** (identificatori, mai dati); altrimenti `allow` con la ragione arricchita dal livello. **fatto =** `write-gate.test.ts` esteso: sotto soglia `allow`, sopra soglia il ponte viene interpellato una volta; approvato → `allow`, negato → `deny`; timeout → `deny`.
- [ ] **F2 — Il web mostra la richiesta** — l'evento `approval_required` esistente porta già `tool` e `input` redatti: si aggiunge il campo del numero di persone, e il pannello lo dice in una riga. **fatto =** la pagina `/dev/agent` mostra «l'agente ha toccato N persone, vuoi continuare?» e i due bottoni funzionano.
- [ ] **F3 — La prova live con la quarta domanda** — `scripts/live-perimetro.ts`: le tre domande di sempre più «chi è candidabile in tutta l'azienda», che deve **fermarsi**. Login con persona reale e secondo fattore. **fatto =** la corsa è verde e il diario mostra la richiesta di conferma e l'esito.
- [ ] **F4 — La prova che può fallire** — sabotaggio dichiarato: con la soglia alzata a 1000 la quarta domanda non si ferma e il criterio va rosso; ripristinata, verde. **fatto =** coppia rosso/verde nella cronaca.

## Cronaca
