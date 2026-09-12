# S1095 — mandato «tutte le voci P1→P3, in autonomia»

*Enzo, 2026-09-12: «esegui tutti da P1 a P3 in autonomia e automaticamente prendendo decisioni
per mio conto, nell'ordine che ritieni più appropriato. l'unico guardiano che comanda è quello
della capienza.»*

> **stato**: IN CORSO
> **registro di sessione** — cronaca di ciò che si fa, non il programma di una voce: non
> dichiara `item` di proposito (la ragione è scritta in `S1093-mandato-p1-p3-gated.md`, e in
> D-92). Le fasi che restano aperte a fine sessione **vivono già nel piano della loro voce**
> (`.programmi/<id>-*.md`): questo file non le possiede, le nomina.

**Confine di sessione dichiarato all'inizio (R24 §4).** Il menu porta 9 voci più l'igiene. Tre
sono stimate oltre una sessione ciascuna (`#54` F4 ~250k · `#159` F2 ~250k, metà in un altro
repository · `#205` F1-F3 ~200k). **Non sono tutte completabili qui**, e il taglio lo fa il solo
criterio che Enzo ha nominato: il guardiano (contesto ≥ 75% **oppure** finestra 5h ≥ 80% →
si interrompe, si committa, si chiude). Ogni voce si chiude **a fase intera**, mai a metà.

**Misura di apertura** (`guardiano.py`, 2026-09-12 06:05): contesto **12.1%** · finestra 5h
**11.0%** · verdetto testuale: `✓ si continua — contesto: mancano 628,985 token · 5h: mancano
69.0 punti`.

---

## Ordine deciso, e perché

Massimizza le voci **chiuse** per token speso: prima ciò che è piccolo e misurabile, poi ciò
che sblocca la lettura dello stato, poi i lavori grossi con la capienza ancora alta.

| # | voce | perché qui | budget |
|---|---|---|---|
| 1 | igiene: derivati 3/3 superati · pagine NON MISURABILE | il boot legge da lì; un dashboard superato misura il passato | ~5k |
| 2 | **D-92** — `#246` F4 (il rapporto scritto) + `S1093-mandato` riconciliato | due piani mentono sul loro stato; è la coerenza del registro da cui leggo tutto il resto | ~30k |
| 3 | **`#169`** F3/F4 — la misura che manca | B18 (S1095) ha **acceso** l'enforcement MFA: il «secondo corno violato» di F4 potrebbe essere superato oggi. Si misura con un login vero; se regge, la voce si chiude | ~30k |
| 4 | **`#214`** F6 — il dodicesimo perimetro | procedura consolidata (coda → migrazione-sentinella → gemello → VM → db_health) | ~40k |
| 5 | **`#54`** F4 — frontend `/recruiting` + E2E | trascina `#79` F3 (cancello di esposizione) sullo stesso lavoro | ~250k |
| 6 | **`#205`** F1→F3 | gate caduto; la decisione «da quali siti si impara» è delegata dal mandato di oggi | ~200k |
| 7 | **`#159`** F2 — il componente in `ux-design-shared` | l'unica metà rimasta è in un altro repo, con ciclo di pubblicazione: la più cara da aprire e da lasciare a metà | ~250k |
| 8 | **`#149`** F4 | continuativo: si chiude *su* una consegna citata; si applica dentro le voci sopra | ~30k |
| — | Bundle Cowork fase 4 (B13-B16) | non è una voce del register P1-P3: fuori dal mandato, nominato una volta | — |

## Registro deliverable

Stato: `[ ]` da fare · `[x]` FATTA con data ed evidenza · `NON FATTA (ragione)`.

- [x] **F1 Igiene** — **fatto =** `build_derivati.py` verde; `check_pagine_raggiungibili.py` con esito misurato — FATTA 2026-09-12 · derivati 3/3 rigenerati (`b11520f2`); pagine: 79 autenticate, «ogni pagina autenticata ha una porta» (il NON MISURABILE del boot era un timeout, non un rosso)
- [x] **F2 D-92 — `#246` F4 e `S1093` riconciliato** — **fatto =** la quota a termine è un numero letto da `db_health`; `S1093-mandato` dichiara dove vivono F8-F10; D-92 → RISOLTO — FATTA 2026-09-12 · `#246` F4 era già fatta (`b17a8135`, mig `000377`) e mai spuntata: spuntata, piano CHIUSO; `S1093` F8/F10 riportate ai piani `#54`/`#159`, F9 caduta (`#143` DONE); D-92 RISOLTO nel registro; `programmi.py --verifica` 51/51 senza difetti
- [x] **F3 `#169` — F3 spuntata sull'evidenza esistente, F4 secondo corno rimisurato con enforcement acceso** — **fatto =** login con sola chiave madre **non completa** l'accesso; `verify-separazione-totp` 0 derivabili; suite verde — FATTA 2026-09-12 · `verify-derived-login.mjs federica.marchetti@rtl-bank.org` in produzione → passo 2, **HTTP 401, 0 cookie**; politiche MFA `enabled=true` su entrambi i clienti (B18); voce **DONE** nel register e archiviata (`compatta_register --esegui`); piano CHIUSO. ⚠ Scoperta fuori ciclo: `enzo.spenuso@` ha fattore TOTP casuale + 0 codici di recupero → serve ri-enrollment
- [x] **F4 `#214` F6 — dodicesimo perimetro** — **fatto =** riga in `agent-perimetri.json`, migrazione in produzione, sentinella a 0, `db_health` verde — FATTA 2026-09-12 · `operating-models`, mig `000405`; gemello VERDE 43/43; produzione 21 s «378 applied»; sentinella 0; `db_health` exit 0; coda 12 aperti · 38 in coda
- [x] **F5 `#54` F4 — frontend `/recruiting` + E2E con login reale** — **fatto =** pagine su dati reali, E2E verde, `check_exposure.py` verde (`#79` F3) — FATTA 2026-09-12 · 5 pagine + `/jobs` pubblica; API `public-job-postings` 4/4 sul gemello (sondata); mig `000406` in produzione (19 s); `recruiting.spec.ts` **16/16** in prod-mode, drift 0; `check_exposure` 0 lacune; voce `#54` CHIUSA (4/4)
- [ ] **F6 `#205` F1-F3** — **fatto =** strumento con autoprova a esiti opposti, primo dominio percorso, prova della frase a zero riscontri
- [ ] **F7 `#159` F2 — il componente** — **fatto =** componente in `@heuresys/ui`, la pagina `dev/agent` lo consuma, typecheck e lint verdi
- [x] **F8 `#149` F4** — **fatto =** almeno una consegna citata verificata avversarialmente nel file — FATTA 2026-09-12 · `guardia-psql-opzioni-raggruppate`: 5 affermazioni misurate, esito PARZIALE scritto nel file e letto dallo strumento

## Simulazione a 5 domande (R24 §3) — per voce, prima di partire

Si compila qui sotto **prima** di aprire ciascuna voce, non a fine ciclo.

