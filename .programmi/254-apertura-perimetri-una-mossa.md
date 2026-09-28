# 254 — L'apertura di tutti i perimetri in una mossa sola

> **item**: #254 · **priorità**: P1 · **stima**: ~1 sessione dopo le tre
> **stato**: NON AVVIATO
> **sbloccata**: S1116 (2026-09-28) — `#253` (ultima del terzetto ADR-0040 §5) è CHIUSA
> **nasce-da**: ADR-0040 (dottrina ratificata da Enzo il 2026-09-14). Terzo e ultimo passo dopo
> `#251` (contatore persone distinte, DONE) e `#252` (ponte anche sulle letture, DONE).

## Il fatto

`atlas-resolver.ts` e `mcp-tools.ts` oggi filtrano le letture dell'agente su
`agent-perimetri.json` (sedici perimetri aperti uno alla volta, in ordine di rischio crescente).
Col freno ADR-0040 attivo (persone distinte per conversazione, non tipo di dato), quel filtro è
superato: il tetto è sull'USO, non sul dato. Aprire tutti i perimetri in una mossa sola non
allarga il buco che già esiste (il tetto per chiamata di `#251`/`#252` lo copre).

## Cosa resta chiuso comunque

- Tutto ciò che RBAC nega alla persona (il freno non bypassa i permessi).
- Le cinque eccezioni di ADR-0036 §5 (whistleblowing per primo, sentinella
  `sys.v_whistleblowing_fuori_dal_custode`, mig `000414`).

## Fasi

- [ ] **F1 — Il risolutore smette di filtrare** — `atlas-resolver.ts` e `mcp-tools.ts` non
  filtrano più le letture su `agent-perimetri.json`. **fatto =** una lettura su un concetto
  fuori dai sedici perimetri storici risponde secondo RBAC, non secondo il file.
- [ ] **F2 — Il file cambia mestiere** — `agent-perimetri.json` resta la fonte unica per le
  SCRITTURE e la cronaca datata delle sedici aperture; non serve più per le letture.
  **fatto =** `check_concetti_agente.py` passa da coda di apertura a misura (non blocca più
  l'apertura di un concetto nuovo, la registra).
- [ ] **F3 — Prova finale** — `scripts/live-perimetro.ts` con una persona reale e il secondo
  fattore, quattro domande: le tre di sempre più «oltre la soglia si ferma» (già provata da
  `#252`). **fatto =** tutte e quattro verdi sul vivo, incluse le due eccezioni (whistleblowing
  nega comunque, oltre soglia si ferma comunque).

## Chiuso quando

`live-perimetro.ts` con le quattro domande è verde sul vivo, e `check_concetti_agente.py` non
tratta più un concetto nuovo come da aprire.
