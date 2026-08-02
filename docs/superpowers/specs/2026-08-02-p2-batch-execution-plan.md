# Piano di esecuzione — batch P2 + P3 (S1040 →)

**Mandato**: Enzo, 2026-08-02 — *"procedi con tutti i punti di P2"* (S1040), **esteso in S1041 a *"esegui i batch P2 e P3"***.
**Regime**: batch-delegation (esecuzione end-to-end autonoma; commit a ogni voce chiusa, si apre la successiva senza chiedere).
**Autorità di stato**: le due tabelle sotto. Lo stato si legge da qui, non dalla memoria di sessione.

## Confine dichiarato

Effort sommato dal register: **~15-20 sessioni per P2**, **~6-8 per P3** → **~21-28 sessioni complessive**. Il batch **non** è completabile in una sessione, né in poche. Ogni voce è però indipendente e chiude con un commit atomico + prova LIVE: una sessione che si interrompe lascia N voci chiuse e la prima aperta identificata da queste tabelle.

## Ordine adottato (decisione tecnica)

**P2**: dal rischio-integrità più alto e costo minore verso il costo maggiore; F2/F3 prima di F4 perché l'AI Advisor cita le loro scorecard; audit 100X e GTM in coda perché sono trasversali e beneficiano del lavoro sopra.

**P3 interleaved, non accodato**: `P3-01` (#84, ~10 min, pura verifica) va **subito**, prima di P2-05, perché costa quanto un caffè e riguarda l'affidabilità del mio stesso setup — rimandarlo di venti sessioni sarebbe assurdo. Le altre P3 vanno **dopo** il grosso di P2, perché #45/#50/#53 toccano superfici che P2-08 (recruiting) e P2-09 (audit 100X) possono modificare: farle prima significherebbe rifarle.

## Tabella delle voci

| id | cosa | chi | cosa significa fatto | stato |
|---|---|---|---|---|
| **P2-01** | **#83** — l'API non impedisce i cicli nell'organigramma | Claude | Guardia ricorsiva nel service (o vincolo DB) + integration test che tenta il ciclo e attende errore tipizzato + prova LIVE su :5433 | ✅ **DONE** — vedi esito sotto |
| **P2-02** | **#36** — B5 visualization: versioning + export engine | Claude | Endpoint versioning + export reali, test integrazione, pagina che li usa, E2E verde, `check_exposure.py` verde | ✅ **DONE** (`3dfbbc5f`) |
| **P2-03** | **#37** — B2 reward-gate engine sui variable-pay | Claude | Engine reale sui record live, API + test, UI, E2E, esposizione verificata | ✅ **DONE** (`2a78c40c` + `de7b3002`) |
| **P2-04** | **#49** — D5 employee timeline | Claude | Timeline alimentata da dati reali, API+test+pagina+E2E | ✅ **DONE** (`66c12f64` + `daad5cad` + `37002011`) |
| **P2-05** | **#56** — F2 VRIO scorecard (`/org-director/vrio`) | Claude | Scorecard calcolata su dati reali, non euristica inventata; API+test+pagina+E2E | ✅ **DONE** — vedi esito sotto |
| **P2-06** | **#57** — F3 OHI org-health scorecard | Claude | Come sopra | `TODO` |
| **P2-07** | **#58** — F4 AI Advisor prescrittivo fase-1 (read-only, citations obbligatorie) | Claude | Ogni raccomandazione porta una citazione verificabile a un dato reale; nessun output senza fonte | `TODO` |
| **P2-08** | **#54** — E5 recruiting/ATS (cluster `/recruiting`) | Claude | A fasi con commit atomici; ogni fase chiude con prova LIVE | `TODO` |
| **P2-09** | **#9/#10/#11** — audit forense 100X (WS-L + triage + gate) | Claude | WS-L eseguito, triage deciso per riga, gate meccanico verde | `TODO` |
| **P2-10** | **#4** — GTM v1-deferrals (follow-up del primo deliverable) | Claude (parte non-pricing) | Deliverable follow-up chiuso; i numeri prezzi/tier restano `WAIT-INPUT` su Enzo (item #4 WAIT-INPUT, distinto) | `TODO` |
| **P2-11** | **#79** — cancello di esposizione | Claude | **Non è una voce discreta**: `check_exposure.py` gira come gate su OGNI voce sopra che popola tabelle. Chiude quando chiude il batch. | `CONTINUO` |

## Tabella delle voci — P3 (aggiunta S1041)

| id | cosa | chi | cosa significa fatto | stato |
|---|---|---|---|---|
| **P3-01** | **#84** — le rules path-scoped si caricano quando servono? | Claude | Verifica **sul campo**, non a memoria: prova falsificabile che apra un file sotto un path governato da una rule e misuri se la rule è entrata in contesto. Esito scritto, positivo o negativo | ✅ **DONE** — esito positivo, vedi sotto |
| **P3-02** | **#38** — B6 inbox push SSE (da polling 30s) | Claude | Endpoint SSE reale + client che lo consuma al posto del polling, test, prova LIVE con evento che arriva senza refresh | `TODO` |
| **P3-03** | **#53** — E4 payroll ops read-extended | Claude | API+test+pagina+E2E su dati payroll reali | `TODO` |
| **P3-04** | **#45** — C3 editing tenant & piattaforma (chiude la serie C) | Claude | CRUD reale su tenant/piattaforma, test, UI, E2E, `check_exposure.py` verde | `TODO` |
| **P3-05** | **#50** — D4 legacy knowledge graph (`kg_nodes`/`kg_edges`, 139k) | Claude | Ingestione verificata sul volume reale + superficie che lo espone; nessun conteggio citato a memoria | `TODO` |

## Simulazione a 5 domande — compilata prima di ogni voce

### P2-01 (#83) — compilata 2026-08-02

- **Precondizioni**: tunnel :5433 up (verificato al boot), modulo `organization-units` esistente con service+repository, suite vitest funzionante.
- **Meccanismo**: guardia nel service su `update` quando cambia il parent. Da leggere *davvero* prima di scrivere: come il repository espone la discendenza (esiste già una CTE ricorsiva per l'albero? la UI ne usa una via API?) — se esiste, la riuso; se non esiste, la aggiungo nel repository, non nel service.
- **Propagazione**: se serve una migration (vincolo/trigger DB) va nel flusso migration normale e arriva sui cloni col deploy. Se la guardia è solo applicativa, nessun artefatto da propagare oltre al commit.
- **Chi**: Claude, interamente. Nessun input di Enzo.
- **Guardia**: il test deve essere *falsificabile* — deve fallire contro il codice attuale (che permette il ciclo) e passare dopo. Caso limite da coprire: self-parent (A→A) e ciclo indiretto profondo (A→B→C, poi A sotto C).

### P2-05 (#56 · F2 VRIO) — compilata 2026-08-02, **dopo** aver misurato il database

**Misure fatte prima di progettare** (il dossier F2 è risultato in parte impreciso, come B2/B5 in S1040):

| affermazione del dossier | misura reale |
|---|---|
| «capability entity MLCE (esiste)» | **Non esiste** un'entità capability. `sys_capability_scores` è un punteggio su un soggetto (EMPLOYEE/POSITION/ORG_UNIT/ORG); `capability_maturity.capability_ref` è varchar libero, valorizzato solo a `'OVERALL'` (20 righe su 20). |
| «economic_weight (Value)» | Esiste in tre sedi ma **`sys_positions.position_economic_weight` è NULL su 177/177 posizioni** e `sys_position_economic_weight` ha 24 righe. Inutilizzabile come base del Value. |
| rarità/imitabilità = «giudizi da raccogliere via form» | Non necessario in fase 1: **entrambe sono derivabili** da dati già presenti (possessori, proficiency 1-6, verifica, evidenze). Il form umano resta un'aggiunta futura, non un prerequisito. |

**Sostituzione decisa**: la base del Value diventa la **fascia retributiva** — `sys_position_compensation_profiles` → `sys_compensation_bands`, copertura **172/181 posizioni attive (95%)**, 9 fasce da 34.000 a 220.000 EUR. È la stessa fonte già usata da **F1 `essentialRanking` (#55)**, quindi F2 resta coerente con F1 invece di introdurre una seconda nozione di "valore".

- **Precondizioni**: tunnel :5433 up (verificato); modulo `capability-composition` esistente con F1 già spedito (pesi dichiarati in `@heuresys/shared`); `sys_skill_groups` popolato; pagina `/org-director` esistente (solo `page.tsx`, nessuna sottorotta).
- **Meccanismo**: **unità di analisi = `skill_group`** (la "capability"), non la singola skill — 19 gruppi hanno dati reali su RTL, granularità giusta per una scheda board-ready (14.041 skill non lo sono). Le 4 dimensioni sono tutte derivate, ognuna con la sua fonte:
  - **V** percentile del valore economico medio delle posizioni che richiedono le skill del gruppo + quota di criticità (base F1, aggregata a gruppo);
  - **R** `1 − possessori_distinti / organico_tenant` (158 su RTL);
  - **I** profondità della padronanza: media del rank posseduto su 6, corretta dalla quota di possessi **verificati** e dalle **evidenze** documentate (`sys_user_skill_evidence`, 902 righe);
  - **O** quota delle coppie (posizione, skill) richieste davvero coperte da un incumbent che possiede la skill.
  Il verdetto è la **classificazione di Barney**, non una media inventata: `!V` → svantaggio · `V,!R` → parità · `V,R,!I` → vantaggio temporaneo · `V,R,I,!O` → vantaggio inutilizzato · `V,R,I,O` → vantaggio sostenibile. Soglie e pesi esportati come costanti da `@heuresys/shared`, come `ESSENTIAL_CAPABILITY_WEIGHTS` di F1.
- **Propagazione**: nessuna migration (si legge, non si scrive). Nessun artefatto oltre al commit; niente da portare a mano sui cloni.
- **Chi**: Claude, interamente. Nessun input di Enzo — le soglie sono decisione tecnica, non di business.
- **Guardia**: la scorecard è **read-only**, quindi il rischio non è distruttivo ma di *falso segnale*. La prova deve poter fallire: il caso di controllo è **«banca, finanza e assicurazioni»**, richiesto da **77 posizioni** e posseduto da **0 persone** — deve uscire con R alta, O = 0 e verdetto **non** sostenibile. Se uscisse "vantaggio sostenibile", il calcolo è sbagliato. Secondo controllo: ogni dimensione espone i propri numeri grezzi, così un valore si può ricalcolare a mano dalla riga.

---

## Esiti

### P2-01 (#83) — ✅ DONE 2026-08-02

**Cosa c'era**: `updateOuPartial` scriveva `organization_unit_parent_id` senza alcun controllo. La FK garantisce che il genitore *esista*, non che l'albero resti un albero. Nessun CHECK, nessun trigger (verificato su `\d sys.sys_organization_units` live).

**Cosa è stato fatto**:
- `repository.parentWouldCreateCycle()` — risalita ricorsiva degli antenati del candidato genitore; se incontra l'unità stessa, è un ciclo. Clausola `CYCLE` di PG16 così la risalita resta finita anche su un albero già corrotto.
- Guardia in `service.update()` → `ConflictError` 409 `OU_PARENT_CYCLE`.

**Prove (falsificabili)**:
- I 3 test di ciclo (self / figlia diretta / discendente profonda) sono stati eseguiti **prima** della correzione: 4 rossi su 9. Il quarto rosso è la prova del danno — dopo il PATCH l'unità aveva davvero come genitore la propria discendente. Dopo la correzione: **9/9 verdi**.
- Controprova inclusa: uno spostamento legittimo verso l'alto deve continuare a rispondere 200 (e risponde) — la guardia rifiuta i cicli, non i riordini.
- **LIVE** su :3001 con login reale `federica.marchetti@rtl-bank.org` (password derivata + TOTP), organigramma RTL reale (25 unità): spostare "Divisione Risk & Compliance" sotto la sua figlia "Direzione AML/Antiriciclaggio" → **409 OU_PARENT_CYCLE**; sotto se stessa → **409**; albero verificato intatto dopo i tentativi.
- Dato reale controllato: **0 unità in ciclo** oggi sul database (la guardia previene, non ripara — non c'era nulla da riparare).
- `typecheck` + `typecheck:test` puliti.

**Fuori da questo ciclo (registro delle scoperte, non pendenze)**:
1. La FK sul genitore **non impone lo stesso tenant**: un `parentId` di un altro tenant sarebbe accettato. È un buco di isolamento diverso dal ciclo, non incluso nello scope di #83.
2. `create` non valida affatto il `parentId` (nessun ciclo possibile alla nascita, ma vale il punto 1).

### P2-02 (#36) — ✅ DONE 2026-08-02 (`3dfbbc5f`)

Versionamento dei grafi + motore di export. Dettaglio nel messaggio di commit. Prova LIVE sull'organigramma RTL (158 nodi): v2 creata copiando 158 nodi / 157 archi / 1 layout / 158 posizioni, **0** archi che puntano fuori dalla nuova versione, **0** nodi condivisi con la v1; export SVG 29.836 byte, Mermaid 10.658, ReactFlow 71.932 scaricati via HTTP; PNG → 409 onesto. E2E con download verificato sul file scaricato. `check_exposure.py`: 73/73, 0 lacune.

### P2-03 (#37) — 🟡 PARZIALE 2026-08-02 (`2a78c40c`)

**Il dossier era stale**: dava `reward_gates`/`gate_results`/`payout_curves` a 0; il database vivo ne ha **3283 / 3283 / 3**. Le tabelle c'erano, mancava il motore.

Fatto: `reward-engine.ts` (curve LINEAR/CAPPED/STEPPED/SIGMOID + aggregazione dei cancelli, funzioni pure), endpoint `GET /v1/compensation/variable-pay/:id/evaluation`, 17 test unitari + 4 di integrazione che derivano l'atteso dalla curva letta dal DB. LIVE su 182 calcoli reali; prova falsificabile su Roberta Gallo / CONDUCT_GATE (ALLOW 0.55 → BLOCKED → fattore 0 → deroga → 0.55 → ripristino identico).

Completata con `de7b3002`: pannello "Valuta" su `/compensation-intelligence` (curva + spiegazione, cancelli, deroghe, fattore finale; motivo esplicito quando il calcolo è importato senza curva) + 2 prove E2E con login reale. La seconda è andata **rossa alla prima esecuzione** e ha fatto bene: leggeva il pannello ancora in caricamento e concludeva a torto che nessun calcolo avesse una curva (i dati dicono 49 su 50 nella prima pagina).

### P2-04 (#49) — ✅ DONE 2026-08-02

Tre commit, uno per fase. **Dati** (`66c12f64`): mig 000222 `sys.sys_user_timeline_events` + `import-d5-timeline.sh` sul modello di D2 — 4641 righe legacy → **2683 importate su 161 persone**, dal 2005-09-13 al 2026-04-15; le 1958 non importate sono di dipendenti che in v5 non esistono (atteso, dottrina D1/D2); ri-eseguito senza duplicati. Registrato nel registry brownfield come wave-2. **API** (`daad5cad`): modulo `user-timeline` + `/v1/me/timeline`, org-gated (I18) perché la storia contiene variazioni retributive e valutazioni; 9 test con attese derivate dal DB vivo. **Interfaccia** (`37002011`): un pannello per due superfici + 3 E2E, inclusa la controprova che il dipendente riceve 403 sulla superficie amministrativa.

Scoperta registrata nel test: `occurredAt` esce in ISO 8601 (millisecondi) mentre PostgreSQL tiene i microsecondi — rimandare indietro `lastEventAt` tale e quale come estremo superiore taglia 10 righe su 2664.

### P2-05 (#56 · F2 VRIO) — ✅ DONE 2026-08-02

**Cosa è stato costruito**: unità di analisi = **skill group** (19 in gioco su RTL); quattro dimensioni tutte derivate da righe reali; verdetto = classificazione di Barney. Schema `vrio-scorecard.ts` con soglie e pesi esportati, `loadVrioInputs` (una query, quattro CTE), `computeVrio` pura, `GET /v1/capability/composition/vrio` (`capability:read`, `orgGate: aggregate` — nessun dato per-persona esce), pagina `/org-director/vrio`, migration **000224** che registra la voce nel registry UI (la sidebar è DB-driven: senza questa riga la pagina esisterebbe ma non sarebbe raggiungibile).

**Il disegno iniziale era sbagliato e la prova LIVE l'ha dimostrato.** Prima versione, soglie assolute a 0,5 sui valori grezzi → distribuzione **10 SUSTAINED_ADVANTAGE / 9 DISADVANTAGE, zero in mezzo**. Causa misurata sui dati veri: rarità grezza non scende mai sotto 0,50 (il gruppo più diffuso ha 79 possessori su 158), organizzazione quasi sempre >0,8, imitabilità sempre >0,6 (rank medio ~4,7 su 6). Tre assi su quattro dicevano "presente" per tutti, e il verdetto **collassava sul solo Valore**: quattro dimensioni di facciata, una sola reale. Una scorecard del genere avrebbe dichiarato a un consiglio «dieci vantaggi competitivi sostenibili».

**Due correzioni, entrambe di modello e non di taratura**:
1. **Percentili invece di soglie assolute** — ogni dimensione è ora il rango della propria misura grezza sull'insieme delle capability del tenant. Le grezze restano in `evidence` (`valueRaw`, `rarityRaw`, …), quindi non si perde nulla e ogni numero resta ricalcolabile a mano.
2. **Nuovo verdetto `CAPABILITY_GAP`** — «nessuno la possiede» produceva rarità grezza 1,00 e veniva letto come *rarissima*. Ma una capability che l'organizzazione richiede e nessuno ha non è un asset raro: è un buco. Ora è classificata prima che la lattice venga consultata.

Distribuzione dopo la correzione, sugli stessi dati: **2 sostenibili · 1 inutilizzato · 2 temporanei · 5 parità · 8 svantaggi · 1 gap**.

**Prove (falsificabili)**:
- **11 test di integrazione verdi**, fra cui due che esistono solo per impedire il ritorno del difetto: *«ogni dimensione discrimina — nessuna marca l'intero insieme come presente»* e *«ogni dimensione è il percentile della propria grezza — ordine preservato»*. Contro la prima implementazione sarebbero rossi.
- **Caso di controllo derivato dal DB, non nominato**: la query cerca *qualunque* gruppo richiesto da posizioni e posseduto da nessuno. Su RTL è **«banca, finanza e assicurazioni»** — 77 posizioni, 0 possessori, in una banca. Deve uscire `CAPABILITY_GAP` con `rarityRaw = 1` (la trappola visibile) e non può essere nessuna forma di vantaggio.
- **LIVE** su :3001 con login reale `federica.marchetti@rtl-bank.org` (password derivata + TOTP): HTTP 200, 19 capability classificate su 158 persone.
- **E2E 10/10** con login reale: la pagina rende la stessa classificazione che l'API calcola (conteggi per verdetto confrontati uno a uno con la risposta, non con letterali), il gap appare come gap, e un dipendente senza `capability:read` non ottiene una scorecard vuota — che si leggerebbe come «questa organizzazione non ha capability».
- Il primo run E2E è andato **rosso** e ha fatto bene: `StatusPill` viene da `@heuresys/ui` e non inoltra `data-testid`, quindi il verdetto non era agganciabile. Risolto con un wrapper locale — la libreria condivisa non si tocca da questo repo.
- Migration 000224 applicata due volte di seguito sul database vivo: una sola riga, nessun duplicato.
- `typecheck`, `typecheck:test`, `pnpm lint`, `i18n:check` (2776 chiavi × 2 locale) puliti · `check_exposure.py` **73/73, 0 lacune**.

**Fuori da questo ciclo (registro delle scoperte, non pendenze)**:
1. **F1 normalizza la maturità su 5 mentre la scala dei livelli arriva a 6** (`avgRank / 5` in `loadEssentialRankInputs`): un possesso a livello MASTER produce maturità 1,2, poi tagliata a 1. Non l'ho toccato — cambierebbe gli output di F1 senza mandato. F2 usa la costante esplicita `VRIO_MAX_PROFICIENCY_RANK = 6`.
2. Metà delle skill in gioco ha `skill_category_id` nullo (29 su 58 possedute): la categoria non è un livello di aggregazione utilizzabile oggi, il gruppo sì.
3. `sys_positions.position_economic_weight` è NULL su tutte le 177 posizioni, e `sys_position_economic_weight` copre 24 posizioni: chi progetta su quel campo progetta sul vuoto.

### P3-01 (#84) — ✅ DONE 2026-08-02 · esito **POSITIVO**

**Domanda**: le rules spostate da `CLAUDE.md` a `.claude/rules/*.md` con frontmatter `paths` (S1039) si caricano quando servono? Metà era già misurata: al boot **non** si caricano (`/context` in S1039 → 3 memory file, nessuna rule), quindi `paths` è onorato *in negativo*. Mancava la prova *in positivo*.

**Prova eseguita in S1041** (osservazione diretta del contesto, non `/context` che è interattivo):

| accesso | rule entrata | controllo negativo |
|---|---|---|
| `Read apps/api/src/modules/organization-units/service.ts` | `api-module-pattern.md` (`paths: apps/api/**`) | `db-migrations.md` **non** è entrata |
| `Read db/migrations/…` | `db-migrations.md` (`paths: db/**`) | le altre tre **non** sono entrate |

**Falsificabilità**: se il meccanismo non funzionasse, dopo il primo Read non sarebbe comparso nulla — ed è esattamente ciò che si osserva al boot. Il caricamento è quindi *lazy e selettivo*, non "tutto o niente".

**Conclusione**: nessuna azione. L'ipotesi di ripiego del register (*"se non compare mai, spostare il contenuto in una skill invocabile"*) **decade**. Le 4 rules restano dove sono.

**Dettaglio minore emerso**: il match scatta sul **path richiesto**, non sull'esistenza del file — un Read verso un path inesistente sotto `db/` ha comunque caricato `db-migrations.md`. Innocuo, ma spiega perché una rule può comparire senza che il file sia stato letto davvero.

---

*Le simulazioni delle voci successive si compilano appena prima di eseguirle, non in anticipo.*
