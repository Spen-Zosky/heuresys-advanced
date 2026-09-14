# 251 — Il contatore di persone distinte per conversazione dell'agente

> **item**: #251 · **priorità**: P1 · **stima**: ~1 sessione
> **stato**: NON AVVIATO
> **nasce-da**: ADR-0040 (dottrina ratificata da Enzo il 2026-09-14), primo dei tre passi che precedono l'apertura `#254`. Include **M7** del piano di miglioramento del 2026-09-08.

## Decisioni già prese (non si ri-chiedono)

- La soglia si misura in **persone distinte**, non in righe (dottrina §3, misurato l'8 settembre).
- **25 / 40 sono valori iniziali** di RTL Bank, non costanti: si scrivono accanto al criterio e al comando che li ri-deriva (`docs/kb/xtras/soglie-agente-persone-distinte.sql`), mai come letterali nudi nel codice.
- Gli **attori di audit** (`createdByUserId`, `reviewedByUserId`, `performedByUserId`, `cancelledByUserId`, `publishedByUserId`, `actorUserId`) **non sono soggetti** e non si contano (criterio S1078).

## Fattibilità, misurata in S1101 (2026-09-14) — ADR-0040 §4

- **(a) SÌ senza toccare l'API**: ogni lettura passa da `HeuresysClient.call` (`apps/agent-gateway/src/heuresys-client.ts`); la risposta è JSON conforme a `packages/shared/src/schemas`, dove l'id di persona sta sotto 26 nomi che finiscono in `UserId` (`grep -rhoE "\b[a-zA-Z]*[uU]ser_?[iI]d\b" packages/shared/src/schemas | sort | uniq -c`).
- **(b) lo stato vive nella richiesta**: una conversazione = una `POST /agent` (`server.ts`) = una `runHrAgent` (`sdk-agent.ts`) = una `query()` senza `resume`. Un insieme in chiusura, creato in `runHrAgent` e passato al client, basta. Limite: se il web un giorno usa `resume`, il contatore deve seguire quell'id.

## Fasi

- [ ] **F1 — Decidere quale misura genera i valori** — le tre stampate dal file SQL (posizioni per unità 38 · persone per unità 9 · persone per catena 158, p90 21,4, al 2026-09-14). Il criterio dell'ADR dice «l'unità più grande»: la fase sceglie la lettura e la scrive nel codice come funzione che legge il dato, non come numero. **fatto =** la funzione esiste e restituisce 25/40 su RTL Bank oggi, con il test che lo dimostra.
- [ ] **F2 — L'aggancio in `call`** — un raccoglitore che percorre il JSON di risposta e aggiunge a un `Set<string>` gli UUID sotto i nomi `*UserId` **meno** gli attori di audit; l'elenco delle esclusioni è una costante dichiarata con la ragione. **fatto =** test a esiti opposti: una risposta con `createdByUserId` non conta; una con `subjectUserId` conta; un `userId` ripetuto conta una volta.
- [ ] **F3 — Il livello per conversazione** — `runHrAgent` crea l'insieme e lo espone al gate (`#252` lo legge) e al diario: ogni voce del diario porta `persone_distinte` al momento della decisione. **fatto =** una corsa che legge 1 · 7 · 38 · 160 persone (le quattro domande della dottrina) stampa quei numeri nel diario, e `pnpm test` del gateway è verde.
- [ ] **F4 — La prova che può fallire** — sabotaggio dichiarato: contando anche gli attori di audit, il test di F2 va rosso; ripristinato, verde. **fatto =** la coppia rosso/verde è nella cronaca.

## Cronaca
