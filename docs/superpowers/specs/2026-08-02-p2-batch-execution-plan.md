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
| **P2-06** | **#57** — F3 OHI org-health scorecard | Claude | Come sopra | ✅ **DONE** — vedi esito sotto |
| **P2-07** | **#58** — F4 AI Advisor prescrittivo fase-1 (read-only, citations obbligatorie) | Claude | Ogni raccomandazione porta una citazione verificabile a un dato reale; nessun output senza fonte | ✅ **DONE** — fase A (motore + API + audit) e fase B (pagina + i18n + E2E) |
| **P2-08** | **#54** — E5 recruiting/ATS (cluster `/recruiting`) | Claude | A fasi con commit atomici; ogni fase chiude con prova LIVE | `TODO` |
| **P2-09** | **#9/#10/#11** — audit forense 100X (WS-L + triage + gate) | Claude | WS-L eseguito, triage deciso per riga, gate meccanico verde | ✅ **DONE** — vedi esito sotto |
| **P2-10** | **#4** — GTM v1-deferrals (follow-up del primo deliverable) | Claude (parte non-pricing) | Deliverable follow-up chiuso; i numeri prezzi/tier restano `WAIT-INPUT` su Enzo (item #4 WAIT-INPUT, distinto) | ✅ **DONE** — vedi esito sotto |
| **P2-11** | **#79** — cancello di esposizione | Claude | **Non è una voce discreta**: `check_exposure.py` gira come gate su OGNI voce sopra che popola tabelle. Chiude quando chiude il batch. | `CONTINUO` |
| **P2-12** | **#87** — il genitore di un'unità organizzativa può stare in un altro tenant | Claude | Guardia nel service su create **e** update + test che tenta l'aggancio cross-tenant e attende errore tipizzato + prova LIVE | ✅ **DONE** — vedi esito sotto |

## Tabella delle voci — P3 (aggiunta S1041)

| id | cosa | chi | cosa significa fatto | stato |
|---|---|---|---|---|
| **P3-01** | **#84** — le rules path-scoped si caricano quando servono? | Claude | Verifica **sul campo**, non a memoria: prova falsificabile che apra un file sotto un path governato da una rule e misuri se la rule è entrata in contesto. Esito scritto, positivo o negativo | ✅ **DONE** — esito positivo, vedi sotto |
| **P3-02** | **#38** — B6 inbox push SSE (da polling 30s) | Claude | Endpoint SSE reale + client che lo consuma al posto del polling, test, prova LIVE con evento che arriva senza refresh | ✅ **DONE** — vedi esito sotto |
| **P3-03** | **#53** — E4 payroll ops read-extended | Claude | API+test+pagina+E2E su dati payroll reali | ✅ **DONE** — vedi esito sotto |
| **P3-04** | **#45** — C3 editing tenant & piattaforma (chiude la serie C) | Claude | CRUD reale su tenant/piattaforma, test, UI, E2E, `check_exposure.py` verde | ✅ **DONE** — vedi esito sotto |
| **P3-05** | **#50** — D4 legacy knowledge graph (`kg_nodes`/`kg_edges`, 139k) | Claude | Ingestione verificata sul volume reale + superficie che lo espone; nessun conteggio citato a memoria | `TODO` |
| **P3-06** | **#88** — il peso economico delle posizioni è un campo vuoto | Claude | Indagine con misura, poi **decisione tecnica presa ed eseguita** (popolare o ritirare): nessuno progetta più su un campo vuoto | ✅ **DONE** — vedi esito sotto |

> **Voci aggiunte in S1041** (P2-12, P3-06): non sono scoperte nuove, sono item già `ACTIVE` nel register (#87 P2, #88 P3) che il mandato *«esegui i batch P2 e P3»* include e che questa tabella non mappava ancora.

## Simulazione a 5 domande — compilata prima di ogni voce

### P2-01 (#83) — compilata 2026-08-02

- **Precondizioni**: tunnel :5433 up (verificato al boot), modulo `organization-units` esistente con service+repository, suite vitest funzionante.
- **Meccanismo**: guardia nel service su `update` quando cambia il parent. Da leggere *davvero* prima di scrivere: come il repository espone la discendenza (esiste già una CTE ricorsiva per l'albero? la UI ne usa una via API?) — se esiste, la riuso; se non esiste, la aggiungo nel repository, non nel service.
- **Propagazione**: se serve una migration (vincolo/trigger DB) va nel flusso migration normale e arriva sui cloni col deploy. Se la guardia è solo applicativa, nessun artefatto da propagare oltre al commit.
- **Chi**: Claude, interamente. Nessun input di Enzo.
- **Guardia**: il test deve essere *falsificabile* — deve fallire contro il codice attuale (che permette il ciclo) e passare dopo. Caso limite da coprire: self-parent (A→A) e ciclo indiretto profondo (A→B→C, poi A sotto C).

### P2-07 (#58 · F4 AI Advisor) — compilata 2026-08-02

**Decisione tecnica presa prima di scrivere codice: la fase 1 è un motore prescrittivo DETERMINISTICO, non un LLM.**

Il criterio di chiusura della voce è *«ogni raccomandazione porta una citazione verificabile a un dato reale; nessun output senza fonte»*. Un modello linguistico non può **garantire** quella proprietà: può citare, ma può anche inventare, e non esiste test che lo escluda in modo stabile. Un motore a regole che deriva le raccomandazioni dalle scorecard F1/F2/F3 la garantisce **per costruzione** — la citazione non è un'aggiunta al testo, è l'input da cui la raccomandazione nasce, e un test può verificare che ogni riga citata esista davvero e porti il valore dichiarato.

L'agent-gateway resta dov'è (già live, non gated): la formulazione in linguaggio naturale è **fase 2**, e vale solo se costruita *sopra* raccomandazioni già tracciabili. Invertire l'ordine — LLM prima, tracciabilità poi — è il modo tipico in cui un "advisor" diventa un generatore di frasi plausibili.

- **Precondizioni**: F1 `essential-ranking` (#55, già spedito), **F2 VRIO** e **F3 org-health** (chiusi in questa sessione, P2-05/P2-06) — le tre fonti che l'advisor cita. Tutte e tre espongono già evidenza per riga, il che rende le citazioni possibili senza toccarle.
- **Meccanismo**: regole esplicite sopra le tre scorecard, ognuna con precondizione e citazioni. Esempi che i dati reali già producono: una capability `CAPABILITY_GAP` con N posizioni scoperte → azione di reclutamento/formazione, citando VRIO (`holders=0`, `positionsRequiring=77`) e F1 (priorità di investimento della skill); un'unità `LAGGING` con `retention` bassa → azione di ritenzione, citando OHI (indice, dimensione, `sampleSize`). Ogni raccomandazione porta: regola applicata, entità, fonte (endpoint + campo + valore letto), priorità derivata. **Nessuna prosa generata.**
- **Propagazione**: nuova pagina o pannelli dentro `/org-director` → serve la riga nel registry UI come per 000224/000225, se pagina nuova.
- **Chi**: Claude, interamente.
- **Guardia**: il test che deve poter fallire non è «l'advisor produce suggerimenti» ma **«ogni citazione è verificabile»**: per ogni raccomandazione, il test ri-legge la fonte citata dall'API e confronta il valore dichiarato con quello vero. Una citazione a un'entità inesistente, o con un valore diverso, è un fallimento. Secondo controllo: **zero raccomandazioni senza citazioni** — un output senza fonte non deve poter esistere nemmeno come caso limite.

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

### P2-06 (#57 · F3 OHI) — compilata 2026-08-02, **dopo** aver misurato il database

**Copertura misurata per unità organizzativa** (26 OU con persone assegnate, 161 persone):

| fonte | OU coperte | volume |
|---|---|---|
| flight-risk | **26 / 26** | 162 score, valori 0,00–83,33 (media 35,0) |
| engagement | 23 / 26 | 862 risposte, **796 complete** |
| goal | 23 / 26 | 2.624 goal (1.060 COMPLETED · 860 IN_PROGRESS · 350 ON_TRACK · 235 AT_RISK · 118 CANCELLED) |
| presenze | 23 / 26 | 116.639 righe (PRESENT 94.995 · REMOTE 10.539 · VACATION 6.349 · SICK 2.659 · ABSENT 17) |
| performance review | 23 / 26 | 550 review con rating continuo |
| maturità capability | 20 / 26 | già calcolata dal motore Maturity |

L'indice è quindi **calcolabile su dati veri**, non su una gamba muta come temeva il dossier (che consigliava di aspettare D2 — non serve).

**Trappola trovata nei dati, da gestire esplicitamente**: `sys_engagement_survey_responses.response_answers` contiene **due forme JSON diverse** nello stesso campo:
- forma A — `{"value": 4, "question_id": "q1", "question_type": "rating"}` → 1.015 elementi;
- forma B — `{"rating": 2, …}` / `{"nps": 6, …}` / `{"text": "…", …}` → 1.779 rating + 593 nps + 593 testi.

Leggere solo `value` catturerebbe **1.015 valutazioni su 2.794 (36%)** e produrrebbe un engagement falsamente basato su un terzo del campione. Peggio: le **scale non coincidono** — in forma A anche `question_type:'nps'` porta `value` su **1–5**, mentre in forma B `nps` sta su **0–10**. Vanno normalizzate separatamente, e gli item `text` esclusi dalla media (in forma A portano un `value` numerico residuo che non è una misura).

- **Precondizioni**: tunnel :5433 up; motore Maturity già popolato (20 OU); modulo `capability-composition` come sede naturale o modulo nuovo `org-health` — da decidere leggendo l'ingombro, non a priori.
- **Meccanismo**: indice composito per OU su **6 dimensioni** (engagement · esecuzione dei goal · ritenzione da flight-risk · stabilità dalle presenze · performance · maturità), pesi dichiarati ed esportati da `@heuresys/shared`. Ogni dimensione che manca per un'OU **esce dal denominatore** e la copertura lo dichiara: mai un valore inventato al posto di un dato assente.
- **Propagazione**: se la pagina è nuova serve una riga nel registry UI (`sys_ui_interfaces`) come per il VRIO — la sidebar è DB-driven, senza quella riga la pagina non è raggiungibile.
- **Chi**: Claude, interamente.
- **Guardia**: la lezione di P2-05 va applicata **in anticipo, non a posteriori**. Il test di dispersione entra nella suite dal primo colpo: l'indice deve **variare fra le OU** e ogni dimensione deve avere varianza non nulla; un indice che dà a tutte le unità lo stesso punteggio non misura niente. Secondo controllo: un'OU con dati mancanti deve mostrare copertura ridotta, **non** un punteggio pieno.

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

### P2-06 (#57 · F3 OHI) — ✅ DONE 2026-08-02

**Cosa è stato costruito**: modulo API nuovo `org-health` (repository + service + routes), `GET /v1/org-health` (`org_director:read`, `orgGate: aggregate` — l'aggregato è per unità, nessuna cifra per-persona esce), pagina `/org-director/health`, migration **000225** per il registry UI. Indice composito su **6 dimensioni** (coinvolgimento · esecuzione · ritenzione · presenza · performance · maturità) con pesi dichiarati ed esportati.

**Regola di onestà nel calcolo**: una dimensione senza dati **esce dal denominatore** invece di valere zero — contarla zero punirebbe un'unità per una lacuna nella strumentazione, non nella salute. Quanto del modello era disponibile si legge in `coverage`, e sotto il 50% l'unità non riceve alcuna fascia: un indice calcolato su una scheggia del modello non è un punteggio basso, è un punteggio ignoto.

**Trappola nei dati, trovata misurando**: `response_answers` contiene **due forme JSON** nello stesso campo. Leggere solo `value` avrebbe raccolto **1.015 valutazioni su 2.794 (36%)**, e le scale non coincidono (in forma A anche `nps` sta su 1–5, in forma B su 0–10). Le due forme sono normalizzate separatamente e le risposte testuali escluse — in forma A portano un `value` numerico che è un residuo, non una misura.

**La prova LIVE ha fatto emergere un secondo difetto, più sottile di quello di P2-05.** Il test di dispersione passava (i valori variano), ma l'indice vive **tutto fra 70,8 e 81,7**: ogni unità risultava STRONG o HEALTHY, **zero WATCH, zero CRITICAL**. Mediare sei dimensioni poco correlate comprime la varianza, e le fasce assolute (75/60/45) tagliano fuori dall'intervallo utile. Un consiglio avrebbe letto «nessun problema da nessuna parte» — rassicurazione senza contenuto.

**Correzione**: non spostare le soglie, ma riconoscere che *«siamo sani?»* e *«dove intervengo per primo?»* sono **due domande diverse**. Accanto alla fascia assoluta ora c'è il **posizionamento relativo** per terzili (`LEADING`/`MIDDLE`/`LAGGING`) più il percentile, e la risposta pubblica la **dispersione osservata** (min/mediana/max/ampiezza) perché senza conoscere il range si sovra-interpreta mezzo punto di differenza. Nessuna delle due letture sostituisce l'altra: la sola fascia non è azionabile, il solo rango bollerebbe come critica un'unità semplicemente ultima.

Distribuzione dopo la correzione: **8 LAGGING · 7 MIDDLE · 8 LEADING** su 23 unità. «Direzione Infrastrutture» emerge come prima da guardare (indice 70,8, performance 0,41, ritenzione 0,56) — informazione che la sola fascia non dava.

**Prove (falsificabili)**:
- **12 test di integrazione verdi**, fra cui il test di dispersione **scritto prima di vedere i risultati** (era la guardia dichiarata nella simulazione) e quello che pretende che i tre terzili non collassino in un solo bucket.
- Il composito è verificato **contro la sua stessa formula** riga per riga, e i pesi efficaci delle dimensioni presenti devono rinormalizzare a 1.
- Verifica esplicita che una dimensione assente abbia `sampleSize = 0` **e** `effectiveWeight = 0` — cioè che non pesi affatto, invece di pesare per zero.
- **LIVE** su :3001 con login reale `federica.marchetti@rtl-bank.org`: HTTP 200, 23 unità, indice di organizzazione **75,38**.
- **E2E 11/11** con login reale, fra cui la prova che **entrambe** le letture arrivano in pagina (un'unità `LAGGING` con fascia assoluta sana — il caso che la fascia da sola non sa esprimere) e che una dimensione mancante si rende come assenza, non come zero.
- Migration 000225 applicata due volte: una sola riga. `typecheck`, `typecheck:test`, `lint`, `i18n:check` (2809 chiavi × 2 locale) puliti · `check_exposure.py` **73/73, 0 lacune**.
- Il lint ha colto una stringa non tradotta (`n={sample}`) prima del commit: corretta, non aggirata.

**Fuori da questo ciclo (registro delle scoperte, non pendenze)**:
1. Il dossier F3 consigliava di aspettare **D2 (engagement storico)** per non calcolare «su gamba muta». La misura dice il contrario: 23 OU su 26 hanno già engagement, obiettivi, presenze e valutazioni; 26 su 26 hanno il rischio di uscita. La dipendenza non serviva.
2. La compressione della varianza è **strutturale** in ogni indice composito di questo tipo: vale per qualunque scorecard futura che medi molte dimensioni: la fascia assoluta va sempre affiancata da una lettura relativa.

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

### P2-12 (#87) — ✅ DONE 2026-08-02

**Simulazione compilata prima di scrivere** (precondizioni misurate, non presunte): il tenant HEURESYS ha **3 unità reali** (`HS-CORP`/`HS-MGMT`/`HS-PROD`), quindi l'aggancio cross-tenant è provabile su dati veri invece che su una fixture costruita per l'occasione. Nessuna migration: la correzione è applicativa, coerente con **I5** (isolamento = FK + filtro applicativo, mai RLS).

**Cosa c'era**: la FK sul genitore garantisce che la riga *esista*, non che appartenga allo stesso tenant. `create` non validava `parentId` **affatto**; `update` validava solo il ciclo (#83). Un `parentId` di un altro tenant veniva quindi accettato da entrambi, innestando l'albero di un tenant su quello di un altro.

**Decisione tecnica — due forme dello stesso rifiuto, di proposito**: un attore tenant-scoped riceve **404 `OU_PARENT_NOT_FOUND`**, identico alla risposta per un genitore inesistente, perché un'unità fuori dal proprio tenant non deve diventare osservabile attraverso un codice d'errore. Un `PLATFORM_ADMIN`, che vede già cross-tenant, riceve **409 `OU_PARENT_TENANT_MISMATCH`**: mascherare gli costerebbe la diagnosi senza nascondergli nulla. Il confronto è contro il tenant **dell'unità**, non dell'attore, così regge anche quando il platform admin opera su un tenant terzo.

**Prove (falsificabili)**: i 5 test sono stati eseguiti **prima** della correzione — **4 rossi su 14**, ognuno con la sua forma di danno:

| caso | prima | dopo |
|---|---|---|
| CREATE sotto un genitore di un altro tenant | **201 creata** | 404 `OU_PARENT_NOT_FOUND` |
| PATCH verso un genitore di un altro tenant | **200 applicata** | 404 `OU_PARENT_NOT_FOUND` |
| CREATE sotto un genitore inesistente | **500** (violazione FK nuda) | 404 `OU_PARENT_NOT_FOUND` |
| PLATFORM_ADMIN, stesso tentativo | **200 applicata** | 409 `OU_PARENT_TENANT_MISMATCH` |
| controprova: genitore nello stesso tenant | 201 | 201 (invariata) |

- Il genitore estraneo è **risolto dal database dentro il test** (`tenant <> quello dell'attore`), non scritto come UUID: se un giorno il secondo tenant sparisse, la fixture fallisce a voce alta invece di passare a vuoto.
- **LIVE** su :3001 con login reale `federica.marchetti@rtl-bank.org` (password derivata + TOTP), contro `HS-CORP` reale: CREATE **404**, PATCH **404**, genitore inesistente **404**, controprova nel proprio tenant **201**, e `parentId` ancora `null` dopo il rifiuto — il rifiuto non lascia la riga scritta a metà.
- Le righe create dalla prova live sono state rimosse (residuo verificato: **0**).
- `typecheck`, `typecheck:test`, `pnpm lint` puliti · `check_exposure.py` **73/73, 0 lacune**.
- Dato reale controllato: **0 unità con genitore fuori tenant** oggi — come per #83, la guardia previene, non ripara.

### P3-06 (#88) — ✅ DONE 2026-08-02

**L'indagine ha trovato più di quanto il register dichiarasse: le sedi sono TRE**, con nomi quasi identici e semantiche incompatibili.

| sede | copertura misurata | scala | cos'è davvero |
|---|---|---|---|
| `sys_positions.position_economic_weight` | **0 su 181** | — | mai popolata, eppure letta come massa di aggregazione |
| `sys_position_compensation_profiles.economic_weight` | 13 su 172 | 0,5–1,0 | un fattore di peso, sulla scala giusta ma quasi vuoto |
| `sys_position_economic_weight` (tabella) | 24 posizioni | **333–568** | **punti di job evaluation legacy** (`metadata.legacy.source_table = job_evaluations`) |

**La trappola**: l'azione che sembrava ovvia — *«popola la colonna dalla tabella dedicata, che i dati ce li ha»* — era la peggiore possibile. Quei valori sono punti di job evaluation, **due ordini di grandezza** sopra la scala 0,5–2,0 del fattore di criticità che la colonna affianca. Sarebbero entrati senza errori, senza test rossi, e avrebbero distorto ogni aggregato di unità organizzativa. Il nome comune fra le tre sedi è ciò che rende l'errore naturale.

**Il danno che c'era già**: `COALESCE(economic_weight, criticalityFactor, 1)` cadeva **sempre** sul ripiego, e la criticità è `MEDIUM` su **160 posizioni su 181** — quindi il roll-up per unità era una media **non pesata** travestita da media pesata. Misurato sul database vivo prima di toccare nulla: **2 sole masse distinte** su tutte le posizioni.

**Decisione tecnica (Claude, come da mandato)**: la base economica è la **fascia retributiva** — `sys_position_compensation_profiles` → `sys_compensation_bands`, **169 su 177** posizioni RTL, 9 fasce da 34.000 a 220.000 EUR. È la stessa fonte già usata da F1 (essential ranking) e F2 (VRIO): la piattaforma resta con **una sola** nozione di valore economico invece di tre. Normalizzata per **percentile dentro il tenant**, non su scala assoluta in EUR — un valore di fascia non significa nulla da solo, e il percentile è ciò che rende il peso confrontabile fra tenant con livelli retributivi diversi (stesso ragionamento della correzione di P2-05). Una posizione senza fascia ricade sulla criticità, **mai su zero**, che la cancellerebbe in silenzio dalla media della sua unità.

**La colonna non è stata eliminata**: un `DROP` è irreversibile e non serviva. La migration **000227** la lascia in schema con un `COMMENT` che dice a chi la incontra di non progettarci sopra, e ne mette uno anche sulla tabella dei punti di job evaluation — perché il prossimo a passare di lì merita di trovare la trappola già disinnescata invece di riscoprirla.

**Prove (falsificabili)** — i 4 test girati **prima** della correzione, con il sorgente messo da parte e i test lasciati al loro posto: **3 rossi su 4**.

| controllo | contro il codice precedente | dopo |
|---|---|---|
| la massa assume più dei 4 valori che la criticità può produrre | **3 distinti** (impossibile superare 4) | 10 distinti |
| due posizioni `MEDIUM` in fasce diverse hanno massa diversa | 9 fasce → **1 sola massa** | 9 fasce → 9 masse |
| la massa cresce con la fascia (ordine preservato) | max = min | ordinamento rispettato |
| chi non ha fascia ricade sulla criticità, mai su zero | già verde | resta verde |

Il quarto test era verde da prima, ed è giusto così: non era quello il difetto.

- **LIVE** su :3001 con login reale `federica.marchetti@rtl-bank.org`, ricalcolo vero (`POST /v1/capability/composition/recompute` → 200, 340 score: 158 employee, 158 posizioni, 23 unità, 1 organizzazione).
- **Il confronto è controllato, non impressionistico**: gli score che stavano in tabella erano *stale* e leggerli come "prima" avrebbe raccontato un cambiamento enorme e falso. Ho quindi ricalcolato **due volte sullo stesso dataset**, prima col sorgente precedente e poi con quello nuovo: mediana per unità **61,38 → 59,00**, massimo **78,49 → 78,88**, masse distinte **3 → 10**. L'effetto reale è contenuto e spiegabile; il salto apparente era un artefatto.
- Caso che mostra il modello al lavoro: in «Direzione Back Office» la posizione scoperta (valore 0,00) è anche la più pagata e ora pesa **0,316** contro lo 0,137 delle altre cinque — prima pesava quanto loro. Un buco costoso adesso si vede.
- Un'unità a 0,00 (`Divisione Legal & Compliance`) **non** è un effetto del cambiamento: ha una sola posizione figlia, che vale 0 per copertura di competenze dell'incumbent. Verificato sul lineage prima di attribuirlo al peso.
- 15/15 sulla suite del modulo · **46/46** sulle cinque suite che condividono queste fondamenta (scope, F1, F2, F3, maturity) · migration 000227 applicata **due volte**, idempotente · `typecheck`, `typecheck:test`, `lint` puliti · `check_exposure.py` 73/73.
- Registrazione della migration: il runner canonico ri-applica tutte e 225 le migration a ogni giro (>7 min, va oltre il tempo massimo di un comando), quindi l'ho registrata con la **stessa semantica del runner** — applicazione in transazione singola + upsert con `sha256`. Disco e database restano allineati: **225 file, 225 applicate**, ultima `000227`.

**Fuori da questo ciclo (registro delle scoperte, non pendenze)**:
1. Le altre due sedi restano popolate a metà ed esposte in lettura dal modulo `compensation`. Non alimentano calcoli, quindi non rientravano in questa voce; ma `sys_position_compensation_profiles.economic_weight` (13 su 172) è un candidato naturale al ritiro con lo stesso ragionamento.
2. Gli score di capability in tabella possono restare **stale a lungo** senza che nulla lo segnali: non c'è un `computed_at` confrontato con l'ultima modifica dei dati sorgente, né un job che ricalcoli. Chi apre la pagina non ha modo di sapere se sta guardando ieri o due mesi fa.

### P2-07 (#58 · F4 AI Advisor) — 🟡 FASE A CHIUSA 2026-08-02

**Costruito**: schema condiviso `advisor-suggestions.ts` (regole, citazioni, soglie esportate), motore puro `engine.ts` a **5 regole** sopra F1/F2/F3, validatore, modulo API `advisor` con `GET /v1/advisor/suggestions` (deriva → **registra** → risponde) e `GET /v1/advisor/audit` (rilegge la traccia), migration **000228** per `sys.sys_advisor_suggestions`.

**Il vincolo è nel tipo, non in un test**: `citations` ha `.min(1)` nello schema Zod **e** un `CHECK` sul database — un suggerimento senza fonte non è un caso da testare, è un valore che non esiste. Le fonti si leggono **attraverso i service** delle tre scorecard, non con query proprie: l'advisor deve citare esattamente ciò che l'utente vede, e una seconda query diventerebbe una seconda verità alla prima modifica.

**I test sanno fallire — provato con due sabotaggi indipendenti**:

| sabotaggio | chi lo intercetta | esito |
|---|---|---|
| una citazione con valore falsato (`holders + 1`) | il **validatore** del motore lo scarta | rosso sul caso di controllo: il buco di capability non riceve più raccomandazione |
| valore falsato **dopo** la validazione (aggira il primo strato) | il **test**, che rilegge dall'endpoint HTTP citato | rosso: «expected 7 to be less than or equal to 0.011» |

I due strati sono indipendenti per costruzione: il validatore rilegge dagli oggetti in memoria, il test dalla risposta HTTP.

**La prova live ha trovato un difetto che i test verdi non mostravano.** Primo giro: 9 raccomandazioni, **8 dalla stessa regola**, e tre regole su cinque mute. Invece di accettarlo, ho misurato perché:

1. **`ESSENTIAL_MASTERY_FRAGILE` non poteva scattare mai**: agganciava F1 a F2 **per nome**, ma F1 elenca skill («Leadership», «Innovazione») e F2 gruppi («contabilità e fiscalità») — **0 coincidenze su 10** sui dati veri. Codice che sembrava scritto e non era raggiungibile. Corretto col legame reale `sys_skills.skill_group_id`, portato da F1 fino all'advisor (campo nuovo `skillGroupId`, additivo).
2. **`UNUSED_ADVANTAGE_DEPLOY` aveva una soglia che contraddiceva la sua stessa fonte**: filtravo per quota assoluta di requisiti coperti (<0,6), ma l'unico caso reale ne ha **17 su 20 (0,85)** ed è comunque `UNUSED_ADVANTAGE`, perché F2 giudica per **percentile** fra le capability del tenant. Due verità sullo stesso dato. Soglia **ritirata**: il criterio è il verdetto di F2.
3. **`INSUFFICIENT_COVERAGE_INSTRUMENT`** è corretta e inerte: copertura minima osservata **0,90** contro soglia 0,50. Nessun caso oggi, precondizione verificabilmente assente.

Dopo le correzioni: **10 raccomandazioni, 3 regole attive**, 0 scartate.

**Perché la quinta regola tace ancora, misurato e non presunto**: **40 delle 62 skill richieste dalle posizioni non hanno un gruppo** (`skill_group_id` nullo). Il ponte ora è corretto — un test lo dimostra — ma le capability essenziali del tenant sono in larga parte non classificate, e l'unica classificata ha 0 possessori (è un buco, che copre l'altra regola). È una lacuna di **dati**, non di codice.

**Prove**: **12 test verdi**, fra cui «ogni citazione è verificabile» (rilegge ogni valore dall'endpoint che la citazione dichiara, con un contatore che impedisce al test di passare senza aver controllato nulla), «la traccia è registrata prima di essere mostrata», «ri-derivare non fa crescere la tabella», «ogni regola o produce, o ha la precondizione dimostrabilmente assente» — quest'ultimo è la guardia contro il codice morto travestito da capability. **44/44** sulle quattro suite delle fonti. **LIVE** su :3001 con login reale: 10 raccomandazioni con le loro fonti, `/audit` rilegge 10 righe. Migration 000228 applicata due volte, idempotente. `typecheck`, `typecheck:test`, `lint` puliti.

**FASE B — chiusa 2026-08-02.** Pagina `/org-director/advisor` (stessa struttura di VRIO e Salute organizzativa), 29 chiavi i18n IT/EN in parità, migration **000230** per il registry UI — la sidebar è guidata dal database, senza quella riga la pagina esisterebbe ma non sarebbe raggiungibile.

**Le fonti sono rese in pagina, non riassunte**: ogni raccomandazione mostra le sue citazioni con endpoint, soggetto, campo e valore. È la proprietà per cui la capability esiste, quindi è quella che l'E2E protegge — e anche qui la prova sa fallire: sostituendo l'elenco delle fonti con il loro **conteggio** (il modo più naturale in cui una UI «pulisce» una tabella densa) il test diventa rosso, `locator resolved to 0 elements`. Una pagina che riassume le fonti passerebbe qualunque test di rendering e avrebbe perso il senso della funzione.

Gli altri due E2E coprono difetti che un test di rendering non vede: che il consiglio sia una **frase leggibile** e non una chiave di traduzione non risolta (`advisor.rule.xxx`) né un segnaposto non interpolato (`{{...}}`), e che un dipendente senza `org_director:read` **non** ottenga una tabella vuota — che si leggerebbe come «non c'è nulla da fare in questa organizzazione», una conclusione falsa e rassicurante.

**E2E 12/12 verdi** con login reale (`test:e2e:node22`, D-36 su Node 24) · `i18n:check` **2838 chiavi × 2 locale** in parità · typecheck web + `lint` puliti · migration 000230 applicata due volte, idempotente.

Una chiave i18n rimasta orfana dopo la prova di sabotaggio (`citationsToggle`) è stata rimossa da entrambi i locale invece di essere lasciata lì.

**Fuori da questo ciclo (registro delle scoperte, non pendenze)**:
1. **Il cancello di esposizione non vede le tabelle scritte dal runtime**: `check_exposure.py` deriva le «tabelle scritte» dai soli **seed SQL** (`INSERT INTO sys.…` nei file di `db/seeds/`). `sys_advisor_suggestions` è scritta dal codice applicativo, quindi resta fuori dal suo perimetro — qui è esposta da `/v1/advisor/audit`, ma il cancello non l'avrebbe segnalata se non lo fosse stata.
2. **40 su 62 skill richieste senza gruppo**: limita F2 e rende inerte una regola dell'advisor. Si lega alla scoperta di P2-05 (metà delle skill in gioco senza categoria).

### P3-02 (#38 · B6 posta in arrivo in tempo reale) — ✅ DONE 2026-08-02

**Decisione tecnica: il push nasce dal DATABASE, non dal server.** Il trigger `NOTIFY` (mig **000231**) avvisa alla scrittura; l'API ha **un solo** client dedicato in `LISTEN` per processo e inoltra agli stream SSE aperti. L'alternativa — far interrogare il database all'API ogni pochi secondi — avrebbe soltanto **spostato** il sondaggio dal browser al server, moltiplicandolo per il numero di processi invece che di schede.

Tre scelte che meritano il perché:
- **Un canale unico con il destinatario nel payload**, non un canale per utente: `LISTEN` per sessione farebbe crescere le connessioni al database con gli utenti collegati.
- **Client dedicato, mai dal pool**: una connessione in `LISTEN` resta occupata per definizione; restituirla al pool la renderebbe disponibile ad altre query che poi la rilascerebbero, **perdendo l'ascolto in silenzio**. Ed è chiusa allo spegnimento del processo, perché `closePool()` non la tocca.
- **L'evento non porta il contenuto della notifica**, solo il fatto che qualcosa è cambiato: chi riceve rilegge da `/v1/me/inbox`, dove valgono permessi e filtro per tenant. Un canale che trasportasse il contenuto sarebbe una seconda superficie di lettura da proteggere.

**Il ripiego è dichiarato, non implicito**: finché il flusso è aperto il sondaggio è spento; se il flusso non si apre o cade, riparte a 60s. Senza, un ambiente in cui SSE non passa lascerebbe la posta ferma **senza alcun segnale** — peggio del sondaggio che sostituisce.

**Prove (falsificabili)**:
- **5 test di integrazione**. Il principale misura il tempo fra la scrittura e l'arrivo dell'evento: **sotto i 5 secondi**, dove il vecchio sondaggio ne prendeva fino a 30. **Rimuovendo i due trigger dal database il test va in timeout a 15s** — cioè misura davvero il push e non un caricamento qualsiasi. Trigger ripristinati e riverificati (2 attivi, 5/5 verdi).
- Coperti anche: l'evento all'aggiornamento (il conteggio dei non letti non resta indietro), **l'isolamento fra utenti** (il flusso di uno non riceve gli eventi di un altro), il **rilascio della sottoscrizione alla chiusura** (senza, ogni scheda chiusa lascerebbe un ascoltatore morto: una perdita che cresce con l'uso e si vede solo dopo giorni), e il 401 per chi non è autenticato.
- **E2E 2/2 con login reale**: un amministratore invia davvero (`POST /v1/notifications`), e la notifica compare nella pagina del dipendente **senza alcun reload**. Il secondo E2E verifica che il flusso attraversi il **proxy Next** leggendo il primo pezzo del corpo — un proxy che accumula consegna gli header e poi tace, ed è il modo tipico in cui SSE funziona nei test di integrazione e muore in produzione. Nessun test lato API può accorgersene, perché lì il proxy non c'è.
- 18/18 sulle quattro suite di posta in arrivo e notifiche · `typecheck` × 3 · `lint` · `check_exposure` 73/73 · mig 000231 applicata due volte, idempotente.

**Due difetti trovati durante il lavoro, entrambi corretti**:
1. Senza `reply.hijack()` Fastify considera la risposta conclusa al ritorno dell'handler e **chiude il socket**: il client vedeva `other side closed` invece del flusso.
2. Il lint ha colto una scrittura su un `ref` **durante il render** nell'hook client — una scrittura in una fase che React può ripetere o interrompere. Spostata in un effetto.

Il primo fallimento dei test era invece un difetto **del test**, non del codice: usavo una priorità (`NORMAL`) che il `CHECK` non ammette, l'inserimento falliva e il timeout somigliava a un push rotto. I valori sono ora derivati dai dati reali.

Il teardown E2E è stato esteso: la notifica inviata a ogni corsa non ha una cancellazione lato prodotto (la posta si legge e si archivia, non si elimina), quindi senza pulizia le righe si accumulerebbero di una per corsa.

### P2-10 (#4 · GTM W4) — ✅ DONE 2026-08-03

Quattro deliverable, tutti misurati prima di pianificare invece che presunti dal register.

**1. Le richieste di contatto si possono lavorare.** `lead_status` esisteva dal primo deliverable GTM e **nessuna superficie sapeva cambiarlo**: ogni richiesta restava `NEW` per sempre — un archivio, non una pipeline. Ora: permesso `leads:update` (mig **000232**) dato agli stessi ruoli che già leggono i lead, **ri-derivati con una sotto-query invece che elencati** (se domani `leads:read` va a un altro ruolo, la migration non resta indietro); `PATCH /v1/leads/:leadId`; pagina `/leads` con filtro per stato e voce nel registry UI.

**Solo lo stato è modificabile.** Nome, azienda, e-mail e messaggio sono ciò che la persona ha dichiarato di sé, e il consenso raccolto vale su *quei* valori: una superficie che potesse riscriverli renderebbe il consenso una dichiarazione su un dato non più verificabile. Un test lo fissa — si passano anche `email` e `name`, e restano quelli di prima.

**2. L'honeypot non è più muto.** La trappola anti-bot scattava e non lasciava traccia. Ora un contatore Prometheus `honeypot_trips_total{surface}` — **un contatore e non un log**: su un sito esposto il valore informativo non è il singolo evento ma l'andamento, e un log per tentativo è rumore che nessuno rilegge. La risposta al bot resta identica; l'osservabilità è per noi. Coperte **entrambe** le superfici pubbliche (lead e whistleblowing): lasciarne una muta darebbe una lettura parziale di quanto il sito viene sondato.

**3. L'informativa privacy dichiarava una cosa che il sistema non faceva.** È la scoperta della voce. Il testo pubblico prometteva, dal primo deliverable GTM, conservazione «non oltre 24 mesi» — ma **`sys_leads` non era nel registro `sys_gdpr_data_map`**, quindi la sweep di conservazione non l'ha mai toccata. Non era ancora una violazione solo perché il lead più vecchio risale a pochi mesi fa.

Nessun cancello automatico poteva coglierlo: **nessuno confronta ciò che un'informativa dichiara con ciò che il registro applica**. È emerso leggendo il testo pubblico e chiedendosi se fosse vero. Corretto con la mig **000233**: finestra di 730 giorni — *non* una scelta nuova, esattamente quella già promessa al pubblico. Provato LIVE: `POST /v1/gdpr/retention/run` in simulazione ora riporta `sys.sys_leads` fra le tabelle spazzate (`retentionDays: 730`, 0 righe scadute oggi).

L'informativa è stata poi riscritta **completa** (art. 13 GDPR: titolare, dati, natura del conferimento, finalità, base giuridica, destinatari, conservazione, diritti, reclamo al Garante, sicurezza) e ogni affermazione è verificata contro il sistema: l'elenco dei dati corrisponde ai campi di `LeadCreateSchema`; «a nessuno» sui destinatari è vero perché il modulo lead **non invia e-mail né chiama servizi esterni** (verificato, non presunto).

**Un elemento resta fuori, dichiarato**: l'eventuale trasferimento dei dati fuori dallo SEE dipende dalla regione dell'infrastruttura, che **non è confermabile dal repository**. Non l'ho dichiarato né in un senso né nell'altro: in un documento legale, un'affermazione comoda e non verificata è peggio di un'omissione. → **`blocked-on-Enzo`: la regione OCI del runtime di produzione.**

**4. Accessibilità delle pagine pubbliche.** Erano l'unica parte del sito senza controllo, ed è la parte che vede chi non ci conosce ancora. Il register chiedeva «Lighthouse ≥95»; ho usato **axe-core**, già in casa e base del punteggio di accessibilità di Lighthouse: dà le violazioni per nome invece di un numero, è deterministico e non aggiunge dipendenze. **L'asticella è più alta, non più bassa**: zero violazioni `critical` *e* `serious`. Il blocco gira con stato di autenticazione **vuoto** — con la sessione di un'altra persona si misurerebbe la versione autenticata del sito.

**Prove**: 17/17 sulla suite lead (25/25 con whistleblowing) · **E2E 4/4** gestione lead, incluso quello che conta — il cambio di stato **sopravvive a un ricaricamento**, perché una `select` che aggiorna solo lo stato del componente è indistinguibile da una che funziona finché qualcuno non ricarica; lo stato iniziale viene ripristinato, quelle righe sono richieste reali · **E2E 5/5 a11y pubbliche**, tutte pulite · **E2E 3/3 informativa** (tutte le sezioni rese, nessuna chiave non risolta, i 24 mesi e il reclamo presenti) · `i18n:check` **2874 × 2** in parità · typecheck ×3 · `lint` · `check_exposure` 73/73 · migration 000232 e 000233 applicate due volte, idempotenti.

**Tre difetti erano nei TEST, non nel codice** — vale la pena registrarli perché sono modi tipici di sbagliare:
1. sei fixture create dal form pubblico facevano scattare il rate-limit (5/minuto, giustamente) e il test falliva con **429**, raccontando un difetto inesistente;
2. mi aspettavo **401** senza sessione, ma nella catena il CSRF viene prima del permesso: risponde **403**;
3. il controllo «nessuna chiave di traduzione non risolta» usava un pattern approssimativo che intercettava la citazione legittima **`www.garanteprivacy.it`**.

**Fuori da questo ciclo (registro delle scoperte, non pendenze)**:
1. `.next/dev/types/routes.d.ts` era **corrotto** (voci del tipo senza separatori) perché il server di sviluppo è stato interrotto a metà scrittura durante i run E2E: il typecheck falliva su un file generato. Rigenerato. Se ricapita, è quello.
2. Nessuno verifica che le **dichiarazioni pubbliche** (informativa, termini) siano sostenute dal comportamento del sistema. Qui è emerso a mano; un controllo automatico non esiste.

### P2-09 (#9/#10/#11 · residuo audit 100X) — ✅ DONE 2026-08-03

Il residuo era **D-03 + D-04 + unit-layer F-A07**. Misurato ogni rilievo prima di eseguirlo, e il primo si è rivelato **falso**.

**D-03 — la premessa non regge alla verifica.** Il rilievo diceva «81/96 subpath export inutilizzati» e proponeva di rimuoverli. Misura reale: **104 export su 104 file, zero rotti, zero mancanti, ognuno punta al proprio file**. Il pattern scritto a mano non ha prodotto una sola deriva in tutta la storia del repository, e un export non importato non costa niente — non entra nei bundle, non allunga la compilazione, non crea rischio. Rimuovere 88 righe sane avrebbe reso incoerente il pattern dei moduli (il CLAUDE.md prescrive di aggiungere il subpath a *ogni* modulo nuovo) in cambio di nulla di misurabile.

**Il rischio vero era l'opposto**: non che ce ne siano troppi, ma che uno resti indietro. Una rinomina o un modulo aggiunto senza export produce una rottura che **nessun typecheck vede**, perché il subpath è una stringa dentro un JSON. Oggi la deriva è zero; niente la impediva domani. Ho quindi scritto il gate che la rende impossibile — `test/unit/shared-exports-integrity.unit.test.ts`, nell'unit layer (nessun DB, millisecondi, gira in CI prima della suite lenta). Falsificabilità provata: aggiungendo uno schema senza dichiararne l'export **2 test diventano rossi**, e il messaggio nomina il file colpevole. Rimosso il file di prova, 67/67 verdi.

Il secondo pezzo di D-03 — «paginationSchema factory» — era **già fatto**: `paginationFields` esiste ed è usata da **74 schemi**. I 4 punti che dichiarano `limit` a mano hanno `limit` **senza** `offset`: non sono paginazione ma «quanti me ne dai» (top-N, query lente, match). Usare la factory lì aggiungerebbe un parametro che quegli endpoint non implementano.

**D-04 — qui il difetto era reale e grosso.** Misura: **113 pagine, 1 solo confine d'errore (alla radice), 0 stati di caricamento**. Il confine radice cattura tutto e proprio per questo **sostituisce l'intera applicazione**: un guasto su una singola pagina faceva sparire barra laterale e intestazione, lasciando l'utente su una schermata la cui unica uscita è il tasto «indietro» del browser.

Corretto con **due file**, non centotredici: `(authenticated)/error.tsx` e `(authenticated)/loading.tsx`. Stando sotto il layout autenticato, il guasto resta confinato all'area di contenuto e la navigazione sopravvive — un `error.tsx` per rotta sarebbe lo stesso comportamento ripetuto 113 volte. Lo stato di caricamento è uno **scheletro** e non un centrifugatore: occupa lo spazio che il contenuto occuperà, così la pagina non salta quando arriva; `aria-busy` più testo per i lettori di schermo, perché un'animazione muta non comunica nulla a chi non la vede.

**Prove**: E2E 2/2 (8/8 col setup) su server caldo — con l'endpoint della pagina che risponde 500, la barra laterale **resta visibile**, il guasto è dichiarato invece di apparire come una lista vuota, e **da lì si naviga altrove e l'applicazione funziona**: è la prova che il guasto è confinato. Il primo run è fallito sul compile-on-demand del server appena avviato, non sul codice (comportamento già noto e documentato in `a11y.spec.ts`).

**Limite dichiarato**: il confine di React scatta su errori di *render*, che non so forzare dall'esterno in modo affidabile senza piazzare codice di prova nel prodotto. L'E2E inietta quindi il guasto dove è realistico (l'API che fallisce) e misura l'effetto osservabile; la posizione del file garantisce il resto, ed è deterministica — Next usa sempre il confine più vicino.

**F-A07 (= D-64)**: la fondazione dell'unit layer era **già risolta in S1027**, con «estensione naturale: migrare qui la logica pura man mano». Il gate di integrità aggiunto sopra è esattamente quella estensione: unit layer da 9 a 10 file, da 63 a 67 test.

**Fuori da questo ciclo (registro delle scoperte, non pendenze)**:
1. Un rilievo d'audit può invecchiare male: D-03 descriveva un fatto vero (l'85% dei subpath non è importato) e ne traeva una conclusione sbagliata (spreco da potare). Vale la pena, per i rilievi ereditati, ri-misurare *la premessa* e non solo eseguire l'azione proposta.
2. Le pagine restano tutte client-side con TanStack Query: `loading.tsx` copre la navigazione fra segmenti, non l'attesa dei dati dentro la pagina, che resta gestita dagli stati di caricamento dei componenti.

### P3-03 (#53 · E4 fasce retributive) — ✅ DONE 2026-08-03

**La scoperta viene prima del lavoro.** `sys_compensation_bands` conteneva **87 righe di cui 75 senza alcun valore economico** e 43 col nome uguale al codice (`OLDDB::ccnl_levels::<uuid>`): un import precedente aveva portato le chiavi e non i dati. Solo 12 erano utilizzabili e **9 davvero usate** dalle posizioni — ed è la stessa tabella che P3-06 (#88) aveva appena reso base economica del modello di aggregazione.

**Dati.** Il legacy ha 41 fasce **complete al 100%**. Importate le **19 che appartengono a un tenant realmente esistente** in v5 (RTL Bank 12, Heuresys 7); le altre 22 sono di EcoNova e SmartFood, **tenant mai migrati**, e importarle avrebbe creato righe senza titolare — la stessa contaminazione che il progetto ha già dovuto bonificare altrove. Lo script conta le escluse e le dichiara invece di ignorarle in silenzio. Il crosswalk dei tenant **esisteva già** in `tenant_metadata->>'legacy_tenant_id'`: nessun UUID scritto a mano.

Esito misurato: le 75 righe prive di importi **non appartengono a nessun tenant** (né sono marcate globali), quindi restano fuori da qualunque lettura per costruzione; RTL Bank ha ora 24 fasce tutte con importi, Heuresys 7. Le righe non sono state cancellate: rimuoverle è distruttivo su dati di produzione e richiede una decisione esplicita.

**API.** `GET /v1/compensation/bands`. Le fasce esistevano e nessuna API le elencava: si vedevano solo di riflesso, risolte per una singola posizione. `withValueOnly` è **true di default** — una fascia senza importi non è una fascia, e mostrarla si legge come «esiste ma non so quanto vale» — ma la risposta pubblica `totalIncludingValueless`, così le escluse sono dichiarate.

**Pagina.** Pannello in `/compensation-intelligence` con minimo, centro, massimo e **ampiezza in percentuale**: due fasce con lo stesso centro e ampiezze diverse si governano in modo diverso.

**Prove**: 17/17 su `compensation-read` (5 nuovi), 15/15 sulle altre due suite del modulo, **E2E 3/3** con login reale. I test che contano: nessuna riga priva di importi entra nel catalogo, e **in pagina non compaiono mai i prefissi tecnici** `LEGACY_BAND::` / `OLDDB::` — il difetto delle 87 righe preesistenti era esattamente il nome uguale al codice, che sarebbe finito a schermo. Import ri-eseguito: 19 su 106 invariate, 0 righe nuove nel registro brownfield (dove il dominio entra come wave-2 accanto a D1/D2/D5). `i18n:check` 2885×2 · typecheck ×3 · lint · `check_exposure` 73/73.

**Due errori miei, corretti**:
1. Ho scritto una migration per aggiungere un vincolo di unicità cercandolo in `pg_constraint` e non trovandolo — ma l'unicità **c'era già** dalla migration 000019 come `CREATE UNIQUE INDEX`, che in `pg_constraint` non compare. Migration rimossa prima del commit; disco e registro restano allineati.
2. Avevo dimenticato la dichiarazione `orgGate` sulla rotta nuova, e **l'applicazione si è rifiutata di avviarsi** (`ORG_GATE_MISSING`, guardia D-51) invece di esporre in silenzio una risorsa di classe sensibile. È il tipo di guardia che ripaga il giorno in cui distrae chi la incontra.

**Fuori da questo ciclo (registro delle scoperte, non pendenze)**:
1. **75 fasce orfane** restano in tabella: nessun tenant, nessun importo, nessun uso. La rimozione è distruttiva e aspetta una decisione.
2. Il legacy ha anche `merit_cycles` (53), `merit_recommendations` (208), `salary_history` (317), `employee_benefits` (24) e `market_salary_data` (84): materiale per un'estensione di E4 che questa voce non copriva.

### P3-04 (#45 · C3 tenant & piattaforma) — ✅ DONE 2026-08-03

Stessa diagnosi di C1 (#44), su un'altra superficie: **le API di scrittura esistevano da MVP-1 e nessuna pagina le chiamava**. Aprire un'azienda cliente, archiviarla o proporre un blueprint voleva dire passare dal database.

**Aziende clienti** (`/tenants`): pannello di creazione (codice, nome, ragione sociale, paese) e comando di archiviazione con conferma che nomina l'azienda — archiviare la toglie dall'operatività, e un clic per sbaglio sulla riga sbagliata non deve poterlo fare. Il codice è dichiarato immutabile nel testo del pannello, perché lo è nel contratto.

**Blueprint** (`/blueprints`): proposta di attivazione di una variante, con l'elenco delle attivazioni registrate. L'attivazione nasce **`PROPOSED`, mai `ACTIVE`**: rendere una variante il modello di riferimento di un'azienda è una decisione, non l'effetto collaterale di un clic su un elenco. È la parte che un'implementazione frettolosa sbaglierebbe, e un test la fissa.

**Cancello doppio**, come in C1: i pannelli si nascondono a chi non ha il permesso, ma l'autorità resta il service — e due test lo **dimostrano** invece di darlo per scontato, chiamando `POST /v1/tenants` e `POST /v1/blueprint-activations` da una sessione senza permessi e attendendo 401/403. Nascondere un pulsante non è una protezione, è cortesia verso chi non potrebbe usarlo.

**Prove**: **E2E 8/8** (19/19 coi setup). Le scritture sono **reali su un ambiente di produzione**: l'azienda di prova viene creata, verificata dopo un **ricaricamento** (un form che aggiorna solo lo stato del componente sembra funzionare finché nessuno ricarica), archiviata, riverificata `ARCHIVED`. Il teardown globale rimuove sia l'azienda sia l'attivazione proposta: la cancellazione dal prodotto è volutamente soft, quindi il residuo non sparirebbe da solo. Verificato dopo il run: **0 aziende di prova residue** (le due reali intatte e `ACTIVE`) e **1 sola attivazione**, quella vera. Il filtro del teardown è mirato (`PROPOSED` + metadati vuoti) e non può toccare l'attivazione reale, che porta metadati.

`i18n:check` 2916×2 · typecheck ×3 · lint.

Un difetto colto dal typecheck: l'import di `DataColumn` era duplicato dopo l'innesto del pannello, perché la pagina importava già `DataTablePanel` dallo stesso modulo.

**Fuori da questo ciclo (registro delle scoperte, non pendenze)**:
1. Il dossier C3 nominava anche il **wizard di materializzazione da archetipo** (`tenant-materialization`, oggi solo API/MCP): non è stato costruito. È una procedura guidata a più passi, non un pannello, e merita una voce propria.

---

*Le simulazioni delle voci successive si compilano appena prima di eseguirle, non in anticipo.*
