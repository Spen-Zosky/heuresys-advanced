# Mandato S1068 — #213 investigata, #214 su `positions`, poi P3 → P1 → P2

> **mandato di ciclo**, non programma di voce → vive in `.programmi/mandati/`, fuori dal radar di
> `programmi.py`. **stato**: IN CORSO
> **aperto**: 2026-08-17, sessione canonica S1068
> **mandato di Enzo** (verbatim): «#213 hanno una codifica strana e io non riesco a capire di cosa
> si tratta quindi non so decidere. investiga · #214 apri positions · procedi con P3 e poi con
> tutti i P1 e P2»

**Regole che valgono su tutto**: ⭐ **PUNTO FISSO** — ogni numero variabile si ri-misura in questa
sessione, incluse le affermazioni positive · `#149` — nulla di ciò che il lab ha consegnato è
verificato · **DoD live** (ADR-0026) — nessuno step si chiude su green-test.

---

## Confine di sessione, dichiarato all'inizio (R24 §4)

Il blocco «tutti i P1 e P2» somma stime per **~15-20 sessioni** (`#143` ~4-6 · `#54` ~5-7 ·
`#159` ~3-4 · `#132` ~2 · `#142` ~1-2 · `#211` ~1). **Non si chiude in questa sessione, e non
sarà presentato come se stesse per chiudersi.** Si avanza nell'ordine, ogni voce con commit ed
evidenza; alla soglia del guardiano (contesto ≥ 75% **oppure** finestra 5h ≥ 80%) si interrompe,
si registra il punto di ripresa, si committa, si pusha, si chiude.

Misura di apertura: contesto **7.4%** (73.953 / 1.000.000) · finestra 5h **27.0%** · verdetto
dello strumento **«si continua»**.

## L'ordine chiesto ha una dipendenza che lo capovolge — e va detto subito

«P3 e poi P1 e P2» **non è eseguibile alla lettera**, perché le due voci P3 sono bloccate da due
voci P1:

| P3 | bloccata da | quindi |
|---|---|---|
| `#205` Tenant Builder 2b/2c | ⛔ `#132` (P1) | si chiude **dopo** F4 |
| `#197` marchio `materialized_from` | seconda condizione = **T9 di `#198`** (P1) | si chiude **dopo** F3 |

Perciò l'ordine reale è: **i due mandati diretti → P1 nell'ordine → ogni P3 nel momento in cui
la sua dipendenza cade → il resto di P2.** L'intento («fai tutto») è rispettato; è la sequenza
che i vincoli tecnici impongono, non una scelta di comodo.

---

## Fasi

- [x] **F0 precondizioni misurate** — 2026-08-17 · `61de0faf`. Atlante rigenerato (97 moduli · 598
  route · 117 pagine · 107 schemi · 273 tabelle). Il «gap i18n» era di nuovo **due righe di
  collaudo E2E** (`E2E-JOBFAM/JOBROLE-1786964765376`, create alle 11:06 UTC dalla suite completa
  di S1067): **seconda volta di fila**. Estensione misurata su TUTTE le colonne `*_code` di TUTTE
  le tabelle base di `sys` → 2 residui, nessun altro. Ritiro con giornale
  `staging.e2e_residui_undo_s1068`, guardia (due FK `SET NULL` + due `CASCADE`: serviva davvero) e
  post-condizione su ciò che non doveva cambiare. **Guardia provata capace di fallire**: rieseguita
  a lavoro fatto si ferma con «NIENTE DA RITIRARE». 17→16 famiglie, 177→176 ruoli, 315 posizioni
  invariate, gap i18n 2→0
- [x] **F1 `#213`** — 2026-08-17 · mig. `000321`. **L'investigazione ha sciolto la domanda da sé**:
  il tenant legacy dei due corsi in inglese è **SmartFood** (nello stesso seed possiede
  `CRS-smartfood-*`, `CERT-smartfood-*`, le ISO/FSSC alimentari) — erano il corredo della stessa
  azienda i cui 35 corsi food/energy furono purgati dalla `000241`, sfuggiti perché né il codice né
  il nome dicono food. `PATH-heuresys-1/2/3` sono la copia morta dei `PATH-rtl-bank-*` vivi.
  Esito: 6 rimossi (coi 10 passi dei doppioni) + `SUST-CONS-001` a Heuresys System. Prova LIVE con
  due attori: **66 = 16 + 50**, prima era 72 = 15 + 52 + **5 di nessuno**. Sentinella provata con
  una riga-sonda. **Due mie ipotesi smentite dalla misura**, e la seconda dalla prova generale sul
  linux-pc, che ha bocciato la prima stesura. **In più**: la `000280` era verde sulla CI e rossa in
  produzione — `DISTINCT ON` senza tie-break; ordine reso totale lì e nei due gemelli di
  `verify-storia36.sql`. Ha prodotto `#215`
- [x] **F2 `#214`** — 2026-08-17 · `positions` aperto (8 operazioni, tutte letture) **e il buco del
  criterio chiuso**, che si è rivelato **tre buchi della stessa forma** — «più classi», resource non
  classificate, nessuna classe leggibile: tutti *assenza di misura letta come assenza di rischio*.
  Effetto: la coda «neutra» da **31 a 16**, con 14 dichiarati NON MISURABILI. Prova LIVE con tre
  domande: la terza chiede `users`, che non è aperto → `hrx_entity_query = deny` e tentativo di
  aggiramento via `Bash = deny`. **Dichiarato ciò che la prova NON misura**: gli strumenti di
  dominio `hrx_positions_upsert/_delete` esistevano già dietro approvazione umana, e la domanda (2)
  è passata per assenza di tentativi → criterio duplice, il secondo letto dalla mappa. Suite
  gateway 92/92 dopo aver corretto `atlas-resolver.test.ts`, che **duplicava una SoT** e si era
  rotto per un'adozione riuscita; ora deriva l'atteso e resta capace di fallire (sabotato → rosso)
- [x] **F3a `#198` T7** — 2026-08-17 · mig. `000322` + due pagine + il contrassegno dei segnaposto in
  tre superfici. **Il piano del lab metteva il registro dove `TENANT_ADMIN` non arriva**, e la misura
  dei permessi l'ha dimostrato prima di scrivere una riga → pagina autonoma. Due difetti
  pre-esistenti trovati dalla **seconda passata** della prova generale (traduzione orfana ricreata a
  ogni deploy + etichetta EN che confondeva il fascicolo col modello). E2E **10/10, zero flaky**
  dopo tre cause distinte: dev server stale (il `307` di `curl` non lo rivela), accoppiamento fra
  test, e un campo letto prima che la riga fosse nel DOM. Prova live con due attori: **6/6**
- [ ] **F3b `#198` T9** — la prova che chiude la parte: un'azienda vera costruita e archiviata.
  **Pretende il campo di prova** (E27: prima sul gemello del linux-pc, poi in produzione), che è
  G4 del mandato precedente e non è ancora fatto → si apre dopo, o resta al prossimo ciclo
- [ ] **F4 `#197`** (P3) — si chiude quando T9 esiste
- [ ] **F5 `#132` F0 → F1** — i sei parametri della ricerca + il vincolo fascia↔numero; poi dove
  vive il contenuto di un modello (tocca `db/**` → **prova generale sul linux-pc prima del push**)
- [ ] **F6 `#205`** (P3) — si chiude quando cade il gate di `#132`
- [ ] **F7 `#211` la cura ①** — la sessione scade a metà corsa: rinnovo dentro la corsa o
  `storageState` per blocco
- [ ] **F8 `#142` F3b** — i dati dentro le viste
- [ ] **F9 `#143` F2** — modello dati «una squadra è un progetto»
- [ ] **F10 `#159` F2** — il ponte gateway↔pagine
- [ ] **F11 `#54` F2** — modello dati recruiting/ATS
- [ ] **F12 `#79`** — cancello di esposizione: si applica **dentro** ogni fase che popola tabelle,
  non è una fase a sé che si spunta a parte

---

## Simulazione obbligatoria, prima di eseguire (R24 §3)

*Le fasi da F3 in poi si simulano nel momento in cui si aprono, non adesso: una simulazione
scritta ora su un terreno che F1-F2 possono cambiare è un'ipotesi su un'ipotesi.*

### F0 — precondizioni
- **Precondizioni**: nessuna. `build_atlas.py` legge il repo.
- **Meccanismo**: `build_atlas.py` rigenera `docs/kb/atlas/`; lo STALENESS SELF-CHECK confronta i
  file di sorgente cambiati **dopo** il commit dell'atlante (non `commit == HEAD` — `#194`). Per
  l'i18n: il gap va **letto dalla query che lo produce**, non dal messaggio della dashboard.
- **Propagazione**: file versionati → il commit li porta ai cloni.
- **Chi**: io. · **Guardia**: rigenerazione idempotente, non distruttiva.

### F1 — `#213`
- **Precondizioni**: le 5 righe devono esistere **adesso** con `tenant_id IS NULL AND
  is_global = false` (misurato: **5**). E nessuna di esse deve avere step/assegnazioni/requisiti
  di posizione (misurato: **0 · 0 · 0** su tutte e cinque).
- **Meccanismo**: migrazione nuova nella catena. Il file che le **crea** è
  `docs/archive/etl-brownfield-ritirato/…/wave1_skilgro.sql` — **archiviato, fuori dalla catena**,
  quindi ADR-0035 è soddisfatto senza emendarlo: nessun file della catena le ricrea. *Da
  verificare con un grep sulla catena viva prima di scrivere la migrazione, non da assumere.*
- **Propagazione**: `db/migrations/**` → ci vuole `ci-rehearsal.sh` sul linux-pc prima del push.
- **Chi**: io per la bonifica. **Enzo per una sola riga**: se `LEAD-PROD-001` («Leadership for
  Production Supervisors», industria manifatturiera) va purgata come i 35 food/energy della
  `000241`, o tenuta. Le altre quattro non hanno una scelta di prodotto dentro.
- **Guardia**: la guardia **non eredita** la misura di adesso — ri-conta assegnazioni, evidenze,
  requisiti e step al momento dell'esecuzione, e si ferma se ne trova una. Post-condizione che
  protegge ciò che **non** doveva cambiare: i 5 `PATH-rtl-bank-*` con le loro **199 assegnazioni
  di 124 persone** ci sono ancora. Rollback: giornale `staging.*_undo` con le righe **prima**
  della cancellazione.

### F3 — `#198` T7 (simulazione fatta al momento di aprirla, 2026-08-17)
- **Precondizioni verificate, non assunte**: le 4 rotte di T6 esistono
  (`POST …/versions/:n/build-plan` con `tenant_blueprint:read` · `POST …/apply` con `:write` ·
  `GET /v1/generated-origins` e `/summary` con `provenance:read`) · i tipi shared ci sono
  (`BuildPlanPreview`, `ApplyVersionResponse`, `GeneratedOrigin*`) · **il piano del lab sbaglia due
  cose**: (a) il percorso è `(authenticated)`, non `(admin)`; (b) mette il registro sotto
  `/tenant-blueprints/[id]/origins`, ma `tenant_blueprint:read` **ce l'ha solo `PLATFORM_ADMIN`**
  mentre `provenance:read` ce l'ha **anche `TENANT_ADMIN`** (misurato su
  `sys_auth_role_permissions`) → annidata lì, la pagina sarebbe irraggiungibile proprio da metà dei
  ruoli che ne hanno il permesso, e la prova che il piano stesso chiede (un `TENANT_ADMIN` che vede
  il registro della propria azienda) non potrebbe passare. Il registro diventa una pagina **autonoma**
  `/generated-origins`, accanto a `/provenance` che ha lo stesso permesso e risponde alla stessa
  domanda; il fascicolo vi rimanda pre-filtrato.
- **Meccanismo**: due pagine client con TanStack Query + primitive `@heuresys/ui` (nessun componente
  nuovo riutilizzabile qui — vive in `ux-design-shared`), i18n `blueprints` in parità it/en, e una
  migrazione per la voce di menu, perché `check_pagine_raggiungibili.py` pretende una **porta** per
  ogni pagina autenticata senza parametri (quelle con `[id]` sono escluse da sé: la pagina di
  costruzione ricade lì). L'isolamento per azienda **non** si aggiunge in pagina: è già nel service
  (`tenantFilter`: platform vede tutto, tenant-admin la propria — I5, mai RLS).
- **Propagazione**: `apps/web` + una migrazione → commit, e `ci-rehearsal.sh` prima del push.
- **Chi**: io.
- **Guardia**: `apply` apre una richiesta di approvazione **vera a persone reali**. Il bottone esiste
  solo con `tenant_blueprint:write` **e** versione `APPROVED`, e la prova live **non lo premerà in
  produzione** — esattamente il limite che T6 aveva già dichiarato per sé.

### F2 — `#214`
- **Precondizioni**: atlante **fresco** (F0), e `positions` deve comparire fra i **neutri** di
  `check_concetti_agente.py` — cioè passare V1 (ha GET), V2 (non è presidio), V3 (almeno una
  pagina lo mostra) e non toccare le 4 classi riservate. **Da leggere dall'output, non da
  presumere**: se `positions` risultasse *riservato* o *senza superficie*, l'apertura cambia
  natura e si torna da Enzo.
- **Meccanismo**: riga in `docs/kb/agent-perimetri.json` (fonte unica letta sia da
  `check_concetti_agente.py` sia da `build_agent_operations.py`) → rigenerare le operazioni →
  prova LIVE col gateway e login reale.
- **Propagazione**: file versionato + eventuale generato → commit.
- **Chi**: io (la decisione l'ha già data Enzo).
- **Guardia**: `sola_lettura: true`. La prova deve poter fallire: il diario del gate deve
  mostrare le decisioni, e una lettura fuori perimetro deve essere **rifiutata** — se passasse,
  l'apertura non è un perimetro, è un'assenza di perimetro.

---

## Esito del ciclo (R24 §6 — letto da questa tabella, non dalla memoria)

*(da compilare a chiusura)*

---

## Registro delle scoperte — fuori da questo ciclo (R24 §5)

| Scoperta | Misura | Stato |
|---|---|---|
