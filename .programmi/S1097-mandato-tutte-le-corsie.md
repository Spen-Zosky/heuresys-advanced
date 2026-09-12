# S1097 — mandato «tutti da P1 a P3, #198, #41, hold e fuori registro, in autonomia»

*Enzo, 2026-09-12: «esegui tutti da P1 a P3, #198, #41, hold a fuori registro. Procedi in
autonomia e automaticamente prendendo decisioni per mio conto, nell'ordine che ritieni più
appropriato. l'unico guardiano che comanda è quello della capienza.»*

> **stato**: IN CORSO
> **registro di sessione** — cronaca di ciò che si fa, non il programma di una voce: non
> dichiara `item` di proposito (D-92). Le fasi che restano aperte a fine sessione vivono già nel
> piano della loro voce: questo file le nomina, non le possiede.

**Confine di sessione dichiarato all'inizio (R24 §4).** Il mandato porta 5 ACTIVE + 2 GATED +
9 HOLD + 4 fuori registro = **20 voci**. Stima totale ~950k contro una capienza utile misurata di
~600k (residuo 597k alla soglia del 75%, meno ~100k di chiusura → ~500k). **Non sono tutte
completabili qui.** Il taglio lo fa il solo criterio nominato: il guardiano. Ogni voce si chiude
**a fase intera**, mai a metà.

**Fuori dal mandato per natura**: `#250` (WAIT-INPUT — la DELETE del fattore TOTP di Enzo resta
sua: è un dato suo, e il register lo dichiara; Enzo non l'ha nominata) · la open-Q **SOSPESA da
Enzo** (custodia della chiave / rotazione `MFA_ENCRYPTION_KEY`: una sospensione esplicita non si
scavalca con una delega generica) · l'igiene di `C:\Git\` (**cancellazione**: divieto assoluto senza
il suo sì esplicito).

**Misura di apertura** (`guardiano.py`, 2026-09-12 20:25): contesto **15.3%** · finestra 5h
**5.0%** · verdetto testuale: `✓ si continua — contesto: mancano 596,853 token · 5h: mancano 75.0 punti`.

**Reperto d'apertura che cambia il confine**: il boot dava viva la sessione
`ux-design-shared-1e918fae` (pid 16400). Misurato: `Get-Process 16400` → **`PowerToys.AlwaysOnTop`,
avviato 2026-09-12 08:52**; il registro è del 2026-09-07. Il pid è stato riusato dopo un riavvio:
**quella sessione è morta**, il repository `ux-design-shared` è **libero** e `#159` F2 rientra nel
confine (era fuori in S1096 per questa sola ragione).

---

## Ordine deciso, e perché

Prima le voci piccole e misurabili che tengono verdi i cancelli (igiene, `#214`, `#149`, `#79`);
poi i fuori-registro eseguibili (piccoli, documentali o un endpoint); poi i HOLD, che sono per
lo più **decisioni** da scrivere e tre lavori veri; poi la catena che sblocca il GATED più
grosso (`#205` F2 → F3 → `#198` T9b); poi `#159` F2 (grosso, standalone, repo ora libero);
`#41` in coda perché è una misura e una decisione, non un lavoro.

| # | voce | perché qui | budget |
|---|---|---|---|
| 1 | igiene: derivati 2/3 superati | il boot legge da lì | ~5k |
| 2 | **`#214`** F6 — quattordicesimo perimetro | procedura consolidata; ⚠ `candidate-applications` è comparso in testa alla coda «senza dato di persona»: va misurato PRIMA, è la stessa forma del difetto `engagement` | ~50k |
| 3 | **`#149`** F4 — consegne | `check_verifica_consegne.py` + inbox del lab: se nulla è arrivato, la fase resta aperta per costruzione | ~5k |
| 4 | **`#79`** F3 — cancello di esposizione | si ri-esegue dopo ogni lavoro che popola tabelle (2, 6, 9) | ~5k |
| 5 | fuori registro — headline migrazioni auto-derivata alla chiusura | pattern ripetuto a ogni handoff | ~20k |
| 6 | fuori registro — endpoint di lettura per `sys_valutazione_condivisione_eccezioni` (568 righe senza API) | cancello #79: un dato che nessuna API espone non è nel prodotto | ~60k |
| 7 | HOLD `#240` — i due worktree gov: misura e decisione | ~10k |
| 8 | HOLD `#233` — `lab_inbox --ingest` fonde invece di duplicare | difetto a monte, dormiente ma noto | ~30k |
| 9 | HOLD `#232` — le 29 classificazioni in `sys_compensation_bands`: colonna di specie | modellazione decisa qui; ADR-0035 (emendare il file che crea) | ~50k |
| 10 | HOLD `#76` — la sessione preliminare di verifica del piano zero-pendenze | decisione di Enzo: prima la verifica; qui si fa la verifica, non le ondate | ~80k |
| 11 | HOLD `#206` `#4` `#8` `#39` `#52` — decisioni scritte, non lavori | ognuno aspetta un input di business o un processo non ancora sperimentabile: si conferma HOLD con la ragione datata | ~10k |
| 12 | **`#205`** F2 — la fase «indirizzi» deve saper cercare (sitemap/ricerca nel gateway) + corsa su `positions` | la catena che sblocca #198 | ~150k |
| 13 | **`#205`** F3 — strato di forma | dipende da 12 | ~60k |
| 14 | **`#198`** T9b — modello riempito, costruzione gemello → produzione | il GATED che 12-13 sbloccano | ~120k |
| 15 | **`#159`** F2 — il componente in `ux-design-shared` | repo libero (misurato); grosso e standalone | ~250k |
| 16 | **`#41`** — misura del costo di `--update` intero e decisione | dipende dalla finestra 5h | ~20k |

## Registro deliverable

Stato: `[ ]` da fare · `[x]` FATTA con data ed evidenza · `NON FATTA (ragione)`.

- [x] **F1 Igiene** — **fatto =** `build_derivati.py` verde, staleness check tutto OK — FATTA 2026-09-12 · derivati 3/3 (`696d7022`)
- [x] **F2 `#214` F6** — **fatto =** `candidate-applications` misurato (classe corretta se necessario); riga in `agent-perimetri.json`, migrazione in produzione, sentinella a 0, `db_health` verde — FATTA 2026-09-12 · `candidates`+`candidate-applications` erano un falso neutro (permesso `job-requisition` condiviso): ESCLUSI nel criterio; quattordicesimo perimetro `job-roles`, mig `000408`; gemello VERDE 45/45; produzione 12 s «381 applied»; sentinella 0; `db_health` exit 0; coda 14 aperti · 41 in coda
- [x] **F3 `#149` F4** — **fatto =** `check_verifica_consegne.py` verde e inbox misurata — FATTA 2026-09-12 · strumento VERDE exit 0; nessun file nel lab più nuovo del registro S1096 (`find -newer`): niente è arrivato, la fase resta aperta per costruzione
- [x] **F4 `#79` F3** — **fatto =** `check_exposure.py` exit 0 dopo i lavori che popolano — FATTA 2026-09-12 · dopo la 000408: «Nessuna lacuna di esposizione», exit 0; si ri-esegue dopo F6/F9
- [x] **F5 headline migrazioni** — **fatto =** strumento che ri-deriva la headline in `SOT_STATE §0`, con autoprova, agganciato alla chiusura — FATTA 2026-09-12 · `aggiorna_numeri_sot.py` (6 forme: utenti, RBAC, tenant, tabelle, migrazioni, skill; stessa grammatica che il boot legge), selftest 8/8 a esiti opposti, `--check` ha trovato il drift vero 404/407→405/408 e l'ha riscritto; Passo A di CHIUSURA.md lo invoca; open-Q chiusa
- [x] **F6 endpoint eccezioni di condivisione** — **fatto =** rotta `/v1/...` in sola lettura con scope HR, test di integrazione verde sul gemello, deroga tolta da `exposure_waivers.txt`, cancello verde — FATTA 2026-09-12 · il registro esce con la valutazione che copre (`condivisioneEccezione` nel contratto, non mascherato: governo del percorso) + filtro `soloEccezioni`; 4 test nuovi, **9/9 sul gemello**; deroga tolta, `check_exposure` 0 lacune; pagina `/performance` mostra «eccezione dichiarata il …» col motivo nel title (i18n IT/EN, parity 3335); spec E2E esteso. ⏳ E2E **non eseguito qui**: due corse locali rosse per due cause diverse — ① il proxy dev di `next.config.js` si mordeva la coda (`process.env.PORT` = porta del WEB sotto `next dev`): **corretto**, `/api/readyz` 307→200; ② tunnel degradato (7,8 s per una `count` su 164 righe, VM a load 0.05): login 500 su timeout pg. Si legge dalla CI e dalla verifica lunga sul linux-pc
- [x] **F7 `#240`** — **fatto =** contenuto dei due worktree misurato, decisione scritta nel register — FATTA 2026-09-12 · alberi puliti; l'unico contenuto (rito di sessione, 67 righe MVP_4) è **superato da main** (versione più vecchia; file archiviato con B20). Resta solo la rimozione = cancellazione → **WAIT-INPUT** con l'input preciso (il tuo sì)
- [x] **F8 `#233`** — **fatto =** `--ingest` idempotente: due corse = un blocco; prova a esiti opposti — FATTA 2026-09-12 · la premessa non era più vera (rifiuto delle proposte di aggiornamento da `7911dde8`, 2026-08-16); aggiunta la prova `lab_inbox.py --selftest` 6/6, sabotata → 1/6 ROSSO; instradata nel cancello (L0). `#233` → DONE (archivio)
- [x] **F9 `#232`** — **fatto =** colonna di specie nel file che crea + migrazione emendativa, prova generale verde, produzione — FATTA 2026-09-12 · mig `000409` (`kind` + CHECK «una BAND ha un importo», provata a esiti opposti; giornale 29 righe); contratto+filtro; test 19/19 sul gemello (ha colto il service che non inoltrava `kind`); produzione 12 BAND/7 CCNL/22 UNION; `#232` → DONE
- [ ] **F10 `#76`** — **fatto =** verifica del piano scritta: cluster ancora validi / superati / già fatti, con numeri
- [x] **F11 decisioni HOLD** — **fatto =** cinque righe nel register con ragione e data — FATTA 2026-09-12 · `#206 #4 #8 #39 #52`: HOLD confermati con riga `riesaminata-2026-09-12` e la ragione misurata (trigger non scattati; prezzi e SMTP sono input di Enzo; nessun cliente chiede SSO)
- [ ] **F12 `#205` F2** — **fatto =** la fase «indirizzi» legge la sitemap/cerca; corsa su `positions` con proposte decise e applicate
- [ ] **F13 `#205` F3** — **fatto =** frase riconoscibile → zero riscontri nello strato di forma
- [ ] **F14 `#198` T9b** — **fatto =** azienda non bancaria costruita dal modello generato, prove 11/11 sul gemello poi in produzione
- [ ] **F15 `#159` F2** — **fatto =** componente pubblicato in `@heuresys/ui`, la console dev lo consuma, secondo consumatore montato
- [x] **F16 `#41`** — **fatto =** costo misurato e decisione (esecuzione o WON'T-DO motivato) — FATTA 2026-09-12 · `cost.json`: 3.931.957 token di input per il run del 2026-07-05; finestra 5h al 31% → un `--update` la porterebbe oltre l'80% da solo. **WON'T-DO**: l'atlante è la SoT, graphify una vista parallela letta dal solo `build_graph_hub.py`; un grafo fresco è lavoro a richiesta, non pendenza

## Simulazione a 5 domande (R24 §3) — per voce, prima di partire

Si scrive qui sotto **prima** di aprire ciascuna voce.

| voce | precondizioni · meccanismo · propagazione · chi · guardia | cosa la misura ha detto |
|---|---|---|
| F1 | tunnel su · `build_derivati.py` · commit · io · nessuna scrittura DB | i derivati erano già aggiornati nel contenuto: solo il registro era indietro |
| F3 | lab montato in `D:/heuresys-design-lab` · `check_verifica_consegne.py` + `find -newer` · — · io · sola lettura | niente di nuovo dal 2026-09-12 16:16 |
| F4 | cancello verde al boot · `check_exposure.py` · — · io · sola lettura | la 000408 crea una vista, non popola: 0 lacune |
| F5 | `status_dashboard.sec_db` importabile · regex per forma sulla sola §0 + selftest con fixture · CHIUSURA.md Passo A · io · una forma assente esce 2, mai riscrittura altrove; Delta datati intoccati per costruzione | il primo `--check` ha trovato il drift che io stesso avevo appena creato con la 000408 |
| F6 | tabella creata da 000396 (presente anche nel clone: popolata da migrazione, non da script) · subquery JSON nel repository + filtro `soloEccezioni` + campo nel contratto, non mascherato (governo del percorso, non giudizio) · deploy normale · io · `chi_sorveglia`: 2 sentinelle BLOCCANTI (non toccate: sola lettura), 1 deroga #79 (tolta), 0 test (ora 4) | il file che crea è la 000396; nessun modulo la leggeva; il clone la ha |
| F7 | worktree presenti · `git log main..ramo`, `git diff --stat`, `git status` · register · io; la rimozione è di Enzo · nessuna scrittura | i due commit «unici» sono versioni più vecchie di ciò che main ha già |
| F8 | HRX_REPO/HRX_LAB onorati da `_radici()` · selftest in processo figlio su lab finto + sabotaggio · verify_gate L0 · io · il selftest scrive solo in un tempdir | il difetto era già corretto da un mese; mancava la prova |
| F9 | `chi_sorveglia sys_compensation_bands`: 1 sentinella (000325, non toccata), 5 test, 3 seed scrittori, creatore 000019 · ALTER + UPDATE per elenco esplicito + CHECK · gemello → VM · io · guardia ri-verificata al momento (una BAND senza importo fuori elenco blocca), post-condizione per impronta, undo in staging | le 29 righe non hanno consumatori: la specie mancava, non il posto |
| F11 | register leggibile · riga datata per blocco, lint · commit · io (le decisioni di business restano di Enzo: prezzi, SMTP) · sola scrittura di testo | i cinque trigger sono tutti «manual» o dipendenti da #198: nessuno è scattato |
| F16 | `cost.json` presente · lettura del costo misurato + `chi_sorveglia graph.json` · register + archivio · io · nessuna esecuzione (costerebbe la finestra 5h) | 3,9M token misurati, non stimati; 5h al 31% |
| F2 | atlante fresco · candidato per rischio crescente + porte misurate + mig con sentinella provata rossa (modello 000407) · gemello → VM → `db_health` · io · post-condizione per impronta; `chi_sorveglia data-classes.ts` = F7 test + `check_concetti_agente` | la testa della coda era un FALSO: tre moduli sotto un permesso solo, e la dichiarazione copriva anche i due che descrivono persone |

## Fuori da questo ciclo — presentate una volta sola (R24 §5)

