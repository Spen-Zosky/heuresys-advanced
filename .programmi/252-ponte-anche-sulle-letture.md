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

---

## Simulazione R24 (S1113, 2026-09-26) — le cinque domande, prima di eseguire

| domanda | risposta misurata |
|---|---|
| **Precondizioni** | `#251` DONE (register riga 27, commit `ae9b9310`); `docs/kb/agent-soglie-persone.json` esiste e porta `massimoPosizioniPerUnita=38` · `p90PersonePerCatena=21,4` → soglie **25 / 40**; l'unico chiamante di produzione di `makeCanUseTool` è `sdk-agent.ts`, che collega **sempre** un contatore (misurato: `grep -rn makeCanUseTool` → 2 riscontri di produzione, 1 in `sdk-agent.ts` + la definizione) |
| **Meccanismo** | `apps/agent-gateway/src/write-gate.ts`, ramo `classe === "read"` (riga ~222). Oggi: `allow` + `READ_AUTO_ALLOW` sempre. Il livello si legge dal `LettoreContatore` già iniettato da `#251` (`opts.persone`), letto **al momento della decisione** — non è un campo nuovo da costruire |
| **Propagazione** | nessun artefatto generato, nessuna migrazione, nessun file di stato. Solo codice (`agent-gateway`, `apps/web/src/lib` + pagina + due chiavi i18n in `it`/`en`). ⚠ `AgentPanel` vive in `@heuresys/ui` (repo `ux-design-shared`, con una sessione viva): **non si tocca** — la pagina compone `approvalDesc`, che il pannello già riceve come etichetta |
| **Chi** | io, interamente. Nessun input di Enzo |
| **Guardia** | niente di distruttivo. Il verso pericoloso qui è l'opposto: un gate che *non* si ferma. Perciò **fail-closed su tre casi**: livello `confermato`, livello `non-misurato` (D2 di `#251`), e **contatore assente** — «non l'ho misurato» non è «va bene» |

## Decisioni tecniche di questa voce (vale il veto di Enzo)

- **D5 — l'assenso vale per la CONVERSAZIONE, il diniego per la singola chiamata.** L'assenso: I22 lo impone («chi conferma legge tutto il tenant») — ri-chiedere a ogni lettura sarebbe un tetto travestito. Il diniego no, e la ragione è asimmetrica per costruzione: fra i dinieghi c'è il **timeout**, che non è un atto umano; memorizzarlo trasformerebbe un guasto di rete in una conversazione sigillata. Il verso conservativo su entrambi i lati.
- **D6 — una sola richiesta in volo per conversazione.** Due letture concorrenti oltre soglia attendono la **stessa** promessa: altrimenti l'umano vedrebbe due pannelli per un solo superamento. È anche il «ponte interpellato una volta» di F1.
- **D7 — contatore assente = si chiede.** Stessa dottrina di `AtlasOperationResolver` (l'ignoto non è un permesso) e stessa forma del difetto che `#251` F0c ha corretto: un cancello verde *senza aver guardato*. Nessun interruttore per disattivarlo.
- **D8 — la ragione `READ_AUTO_ALLOW` non cambia sotto soglia.** Il livello è già un campo proprio del diario (`livelloPersone`, `#251`): arricchire la stringa duplicherebbe il dato in una forma non interrogabile.
