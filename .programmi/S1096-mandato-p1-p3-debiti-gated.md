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
- [x] **F4 `#79` F3 — il buco del cancello** — **fatto =** `check_exposure.py` conta anche le tabelle popolate da migrazione; autoprova a esiti opposti; verde sul processo — FATTA 2026-09-12 · seconda fonte (86 tabelle da migrazione), 3 vie di lettura nuove, autoprova 13 su 13, `exposure_waivers.txt` nato con 7 deroghe motivate; 140 popolate · 133 lette · 7 esentate · 0 scoperte, exit 0
- [ ] **F5 `#205` F2 — `positions` percorso** — **fatto =** corsa di ricerca eseguita, proposte decise e applicate, registro fonti aggiornato — **NON FATTA (ragione misurata)**: percorsa sul gemello (`percorri-dominio.mts`, 2 difetti corretti, 8 fonti registrate) ma `organization_units` e `positions` danno **0 proposte** — la fase «indirizzi» indovina i percorsi (4/8 → 404) e nessuna pagina ammessa descrive una società di consulenza; la fonte di settore non viene riproposta. Dettaglio nel piano `#205`
- [ ] **F6 `#205` F3 — lo strato di forma** — **NON FATTA**: dipende da F2 (serve una proposta approvata del cliente A)
- [ ] **F7 `#198` T9b** — **NON FATTA**: il modello `MGMT_CONSULTING_SMALL` resta vuoto perché F5 non produce; costruire oggi = archetipo bancario = «un'altra banca». ⚠ Il trigger del register («`content_units` > 0») è **già scattato** (33/71/132/73 dal bundle fase 4, 2026-09-10) ma per il modello BANCARIO: va riscritto sul modello di destinazione
- [x] **F8 D-91** — **fatto =** ①②④ corretti con prova; D-91 → RISOLTO — FATTA 2026-09-12 · `build_index.py` regola `docs/archive/` + selftest 5/5, 85 file da live ad archive; Next.js 15→16 in 4 documenti vivi (misurato 16.3.3); README del gateway per verbo (distribuito: NO, misurato); `2ce836fa`
- [x] **F9 D-90** — **fatto =** `posso-uscire.sh` non conta sé stesso e incrocia i pid; D-90 → RISOLTO — FATTA 2026-09-12 · verdetto sui processi vivi (involucri della CLI in `ps -ef`), registro come dettaglio, sé stesso dall'intestazione su stdout; selftest 7/7; provato sul vivo ATTENDI(4)→USCITA SICURA; `3af67b80`
- [ ] **F10 `#41`** — **fatto =** 52/52 chunk o la ragione misurata — **NON FATTA (ragione misurata, scritta nel register)**: dal run del 2026-07-05 sono cambiati 1.433 file di codice, i 26 chunk sono superati; il solo top-up sensato è un `--update` intero (~3,9M token sulla finestra 5h) — lavoro da sessione dedicata, non da coda
- [ ] **F11 `#159` F2** — **NON FATTA**: fuori confine dichiarato all'inizio (repo `ux-design-shared` occupato da una sessione viva per tutta la sessione) e, alla fine, capienza: guardiano `mancano 227k`, la fase ne chiede ~250k più la chiusura

## Simulazione a 5 domande (R24 §3) — per voce, prima di partire

Si scrive qui sotto **prima** di aprire ciascuna voce.

| voce | precondizioni · meccanismo · propagazione · chi · guardia | cosa la misura ha detto |
|---|---|---|
| F1 | tunnel su · `build_derivati.py` + forma qualificata in §0 · commit · io · nessuna scrittura distruttiva | il drift RBAC era un falso del grassetto |
| F3 | atlante fresco · candidato per rischio crescente + porte misurate + mig con sentinella provata rossa (modello 000405) · gemello → VM → `db_health` · io · post-condizione per impronta | fra job-roles e skill-categories la distanza da una persona NON è la stessa: la categoria è un livello di tassonomia, il ruolo si ricopre |
| F4 | cancello verde oggi · seconda fonte + tre vie di lettura + autoprova · commit · io · nessuna scrittura DB; `chi_sorveglia check_exposure.py` = nessuno | 11 scoperte grezze, 3 falsi (costante, funzione, trigger), 1 falso del rollback commentato; 7 deroghe |
| F5 | catena ricerca accesa (gemello) · corsa → decisione → apply via API · E27 gemello prima · io · WARNING/FAILED mai approvate a mano | claude di gemello e VM scaduti; DNS di casa; 2 difetti del motore; poi il limite della fase «indirizzi» |
| F8 | i 3 reperti misurati di nuovo (START_HERE già riscritto; 85 file d'archivio vivi; nessuna unit systemd) · edit + `build_index.py --selftest` · commit · io · — | START_HERE non aveva più il difetto; il numero 79 era cresciuto a 85 |
| F9 | `posso-uscire.sh` invocato da CHIUSURA.md · processi vivi da `ps -ef` (involucro CLI) + intestazione su stdout · commit · io · selftest a esiti opposti | 4 task MIEI appesi su un prompt di password erano davvero vivi: il registro diceva 5, i processi 4 |
| F2 | 4 file in `inbox/ingerite/` · misura sul vivo + marker letto da `check_verifica_consegne.py` · lab fuori repo, piano #149 nel repo · io · solo scritture di testo | p3 poggiava su un numero falso (OLDDB 64.482/70.959) con conclusione giusta |

## Fuori da questo ciclo — presentate una volta sola (R24 §5)

- **Il `claude` del gemello e della VM ha la sessione OAuth scaduta** (misurato: «OAuth session expired and could not be refreshed»): `claude login` là è interattivo, e le credenziali non si clonano (forward-only). Finché resta così, la catena della ricerca gira solo con il modello su Windows. Vuoi ri-loggare le due macchine?
- **La fase «indirizzi» della ricerca indovina i percorsi** (4/8 → 404 in ogni corsa di oggi): per i domini di contenuto di un settore diverso dal bancario servirebbe uno strumento di ricerca o una sitemap nel gateway. Lo vuoi nel prossimo ciclo?
- **Le 8 fonti registrate oggi stanno sul gemello** (clone: si perderanno al prossimo `clone-vm-db.sh`); in produzione il registro resta a 5. Le proposte di fonte (corse `7550b570`, `1c830468`, `1fad2338`) sarebbero da presentare a te.

- **`sys_valutazione_condivisione_eccezioni` ha 568 righe e nessuna API la espone** (trovato estendendo il cancello #79). Oggi è in deroga come «attestazione di governo»; se HR deve vedere quali valutazioni sono coperte da eccezione, serve un endpoint. Lo vuoi nel prossimo ciclo?

