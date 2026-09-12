# S1096 — mandato «tutte le voci P1→P3, poi i debiti aperti e i due gated, in autonomia»

*Enzo, 2026-09-12: «esegui tutti da P1 a P3, poi i debiti aperti e i due gated. tutto in
autonomia e automaticamente prendendo decisioni per mio conto, nell'ordine che ritieni più
appropriato. l'unico guardiano che comanda è quello della capienza.»*

> **stato**: IN CORSO
> **registro di sessione** — cronaca di ciò che si fa, non il programma di una voce: non
> dichiara `item` di proposito (ragione in `S1093-mandato-p1-p3-gated.md` e in D-92). Le fasi
> che restano aperte a fine sessione **vivono già nel piano della loro voce**: questo file non
> le possiede, le nomina.

**Confine di sessione dichiarato all'inizio (R24 §4).** Il mandato porta 10 voci (5 ACTIVE, 2
debiti, 2 GATED, più il bundle Cowork fase 4 nominato nel menu). Stima totale ~900k contro una
capienza utile di ~480k (residuo misurato 577k alla soglia, meno ~100k di chiusura). **Non sono
tutte completabili qui.** Il taglio lo fa il solo criterio nominato: il guardiano (contesto ≥ 75%
**oppure** finestra 5h ≥ 80%). Ogni voce si chiude **a fase intera**, mai a metà. Già fuori dal
confine per ragione propria: `#159` F2 — il repository `ux-design-shared` è occupato da una
sessione parallela viva (`ux-design-shared-1e918fae`, misurato al boot); si riconsidera solo se
quella sessione chiude prima della fine di questa.

**Fuori dal mandato per natura**: `#250` (WAIT-INPUT: la DELETE del fattore TOTP di Enzo resta
sua — è una cancellazione di un dato suo, e il register lo dichiara).

**Misura di apertura** (`guardiano.py`, 2026-09-12 15:50): contesto **~12%** · finestra 5h
**10.0%** · verdetto testuale: `✓ si continua — contesto: mancano 577,432 token · 5h: mancano
70.0 punti`.

---

## Ordine deciso, e perché

Prima il presidio che deve scattare **prima** di eseguire (`#149` sulle consegne p3/p4, che sono
le fonti di `#198`); poi le voci piccole e misurabili; poi la catena che sblocca il GATED più
grosso — `#205` F2 e `#198` T9b sono lo stesso cammino (ricerca sui domini di contenuto →
proposte approvate → modello pieno → costruzione), quindi si percorrono in fila; i debiti e
`#41` in coda perché non sbloccano niente.

| # | voce | perché qui | budget |
|---|---|---|---|
| 1 | igiene: derivati 2/3 superati · drift RBAC-map | il boot legge da lì | ~5k |
| 2 | **`#149`** F4 — le 4 consegne NON-VERIFICATO | presidio: scatta prima di `#198`, che poggia su p3/p4 | ~100k |
| 3 | **`#214`** F6 — tredicesimo perimetro | procedura consolidata | ~40k |
| 4 | **`#79`** F3 — il buco dichiarato del cancello (migrazioni che popolano tabelle nuove) | piccolo, e il cancello serve in 5-6 | ~30k |
| 5 | **`#205`** F2 → F3 — `positions` percorso sul gateway; strato di forma | testa della coda; stessa catena di 6 | ~140k |
| 6 | **`#198`** T9b — modello riempito dalla ricerca, costruzione sul gemello poi in produzione | il GATED che la catena 5 sblocca | ~120k |
| 7 | **D-91** ①②④ — regola di prefisso `docs/archive/`, versioni derivate, README gateway | documentale, misurabile | ~30k |
| 8 | **D-90** — `posso-uscire.sh` incrocia i processi vivi | strumento di chiusura | ~30k |
| 9 | **`#41`** graphify top-up | dipende dal limite di spesa: si prova, si misura | ~20k |
| 10 | **`#159`** F2 | fuori confine (repo occupato) — si riconsidera in coda | ~250k |
| — | Bundle Cowork fase 4 (B13-B16) | solo progettazione, se resta capienza; non è nel register P1-P3 | ~40k |

## Registro deliverable

Stato: `[ ]` da fare · `[x]` FATTA con data ed evidenza · `NON FATTA (ragione)`.

- [x] **F1 Igiene** — **fatto =** `build_derivati.py` verde; RBAC-map in `SOT_STATE §0` = live — FATTA 2026-09-12 · derivati 3/3 (`e7138744`); il drift era un falso del grassetto (`**1015** map`), corretta la forma: staleness check 9/9 OK
- [x] **F2 `#149` F4 — 4 consegne** — **fatto =** ogni consegna citata porta un esito diverso da NON-VERIFICATO, scritto nel file e letto da `check_verifica_consegne.py` — FATTA 2026-09-12 · 3 CONFERMATO + 1 PARZIALE (p3: smentito «tutte le 70.959 righe OLDDB::»); strumento VERDE exit 0
- [x] **F3 `#214` F6 — tredicesimo perimetro** — **fatto =** riga in `agent-perimetri.json`, migrazione in produzione, sentinella a 0, `db_health` verde — FATTA 2026-09-12 · `skill-categories`, mig `000407`; gemello VERDE 44/44; produzione 12 s «380 applied»; sentinella 0; `db_health` exit 0; coda 13 aperti · 44 in coda
- [ ] **F4 `#79` F3 — il buco del cancello** — **fatto =** `check_exposure.py` conta anche le tabelle popolate da migrazione; autoprova a esiti opposti; verde sul processo
- [ ] **F5 `#205` F2 — `positions` percorso** — **fatto =** corsa di ricerca eseguita, proposte decise e applicate, registro fonti aggiornato
- [ ] **F6 `#205` F3 — lo strato di forma** — **fatto =** frase riconoscibile cercata nello strato di forma → zero riscontri
- [ ] **F7 `#198` T9b** — **fatto =** `sys_blueprint_content_*` > 0; costruzione 11/11 sul gemello; poi in produzione con archiviazione (E28)
- [ ] **F8 D-91** — **fatto =** ①②④ corretti con prova; D-91 → RISOLTO
- [ ] **F9 D-90** — **fatto =** `posso-uscire.sh` non conta sé stesso e incrocia i pid; D-90 → RISOLTO
- [ ] **F10 `#41`** — **fatto =** 52/52 chunk o la ragione misurata
- [ ] **F11 `#159` F2** — fuori confine dichiarato (repo occupato)

## Simulazione a 5 domande (R24 §3) — per voce, prima di partire

Si scrive qui sotto **prima** di aprire ciascuna voce.

| voce | precondizioni · meccanismo · propagazione · chi · guardia | cosa la misura ha detto |
|---|---|---|
| F1 | tunnel su · `build_derivati.py` + forma qualificata in §0 · commit · io · nessuna scrittura distruttiva | il drift RBAC era un falso del grassetto |
| F3 | atlante fresco · candidato per rischio crescente + porte misurate + mig con sentinella provata rossa (modello 000405) · gemello → VM → `db_health` · io · post-condizione per impronta | fra job-roles e skill-categories la distanza da una persona NON è la stessa: la categoria è un livello di tassonomia, il ruolo si ricopre |
| F2 | 4 file in `inbox/ingerite/` · misura sul vivo + marker letto da `check_verifica_consegne.py` · lab fuori repo, piano #149 nel repo · io · solo scritture di testo | p3 poggiava su un numero falso (OLDDB 64.482/70.959) con conclusione giusta |

## Fuori da questo ciclo — presentate una volta sola (R24 §5)

