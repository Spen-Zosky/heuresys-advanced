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

- [ ] **F0 precondizioni misurate** — atlante fresco (lo pretende `check_concetti_agente.py`, e
  la dashboard lo dà SUPERATO: 16 file cambiati dopo `5ec40cf3`) + i 2 campi con gap i18n EN
  (in S1067 il «gap» era una riga di collaudo E2E residua: **da ri-misurare, non da assumere**)
- [ ] **F1 `#213`** — i cinque percorsi senza titolare: **investigazione chiesta da Enzo**, poi
  bonifica. Serve una vista-sentinella che valga **5 adesso e 0 dopo**
- [ ] **F2 `#214`** — apre `positions` (decisione di Enzo). Riga in `agent-perimetri.json` con
  `decisione` + `data`, poi rigenerare le operazioni e provare LIVE
- [ ] **F3 `#198` T7 → T9** — le due pagine nel prodotto, poi il controllo incrociato. `resume-from: T7`
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
