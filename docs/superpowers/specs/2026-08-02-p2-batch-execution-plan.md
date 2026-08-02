# Piano di esecuzione — batch P2 (S1040 →)

**Mandato**: Enzo, 2026-08-02 — *"procedi con tutti i punti di P2"*.
**Regime**: batch-delegation (esecuzione end-to-end autonoma; commit a ogni voce chiusa, si apre la successiva senza chiedere).
**Autorità di stato**: questa tabella. Lo stato si legge da qui, non dalla memoria di sessione.

## Confine dichiarato

Effort sommato dal register: **~15-20 sessioni**. Il batch **non** è completabile in una sessione. Ogni voce è però indipendente e chiude con un commit atomico + prova LIVE: una sessione che si interrompe lascia N voci chiuse e la prima aperta identificata da questa tabella.

## Ordine adottato (decisione tecnica)

Dal rischio-integrità più alto e costo minore verso il costo maggiore; F2/F3 prima di F4 perché l'AI Advisor cita le loro scorecard; audit 100X e GTM in coda perché sono trasversali e beneficiano del lavoro sopra.

## Tabella delle voci

| id | cosa | chi | cosa significa fatto | stato |
|---|---|---|---|---|
| **P2-01** | **#83** — l'API non impedisce i cicli nell'organigramma | Claude | Guardia ricorsiva nel service (o vincolo DB) + integration test che tenta il ciclo e attende errore tipizzato + prova LIVE su :5433 | ✅ **DONE** — vedi esito sotto |
| **P2-02** | **#36** — B5 visualization: versioning + export engine | Claude | Endpoint versioning + export reali, test integrazione, pagina che li usa, E2E verde, `check_exposure.py` verde | ✅ **DONE** (`3dfbbc5f`) |
| **P2-03** | **#37** — B2 reward-gate engine sui variable-pay | Claude | Engine reale sui record live, API + test, UI, E2E, esposizione verificata | ✅ **DONE** (`2a78c40c` + `de7b3002`) |
| **P2-04** | **#49** — D5 employee timeline | Claude | Timeline alimentata da dati reali, API+test+pagina+E2E | ✅ **DONE** (`66c12f64` + `daad5cad` + `37002011`) |
| **P2-05** | **#56** — F2 VRIO scorecard (`/org-director/vrio`) | Claude | Scorecard calcolata su dati reali, non euristica inventata; API+test+pagina+E2E | `TODO` |
| **P2-06** | **#57** — F3 OHI org-health scorecard | Claude | Come sopra | `TODO` |
| **P2-07** | **#58** — F4 AI Advisor prescrittivo fase-1 (read-only, citations obbligatorie) | Claude | Ogni raccomandazione porta una citazione verificabile a un dato reale; nessun output senza fonte | `TODO` |
| **P2-08** | **#54** — E5 recruiting/ATS (cluster `/recruiting`) | Claude | A fasi con commit atomici; ogni fase chiude con prova LIVE | `TODO` |
| **P2-09** | **#9/#10/#11** — audit forense 100X (WS-L + triage + gate) | Claude | WS-L eseguito, triage deciso per riga, gate meccanico verde | `TODO` |
| **P2-10** | **#4** — GTM v1-deferrals (follow-up del primo deliverable) | Claude (parte non-pricing) | Deliverable follow-up chiuso; i numeri prezzi/tier restano `WAIT-INPUT` su Enzo (item #4 WAIT-INPUT, distinto) | `TODO` |
| **P2-11** | **#79** — cancello di esposizione | Claude | **Non è una voce discreta**: `check_exposure.py` gira come gate su OGNI voce sopra che popola tabelle. Chiude quando chiude il batch. | `CONTINUO` |

## Simulazione a 5 domande — compilata prima di ogni voce

### P2-01 (#83) — compilata 2026-08-02

- **Precondizioni**: tunnel :5433 up (verificato al boot), modulo `organization-units` esistente con service+repository, suite vitest funzionante.
- **Meccanismo**: guardia nel service su `update` quando cambia il parent. Da leggere *davvero* prima di scrivere: come il repository espone la discendenza (esiste già una CTE ricorsiva per l'albero? la UI ne usa una via API?) — se esiste, la riuso; se non esiste, la aggiungo nel repository, non nel service.
- **Propagazione**: se serve una migration (vincolo/trigger DB) va nel flusso migration normale e arriva sui cloni col deploy. Se la guardia è solo applicativa, nessun artefatto da propagare oltre al commit.
- **Chi**: Claude, interamente. Nessun input di Enzo.
- **Guardia**: il test deve essere *falsificabile* — deve fallire contro il codice attuale (che permette il ciclo) e passare dopo. Caso limite da coprire: self-parent (A→A) e ciclo indiretto profondo (A→B→C, poi A sotto C).

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

---

*Le simulazioni delle voci successive si compilano appena prima di eseguirle, non in anticipo.*
