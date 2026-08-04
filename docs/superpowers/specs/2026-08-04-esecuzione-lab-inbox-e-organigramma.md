# Piano di esecuzione — canale lab, ingestione, ricostruzione dell'organigramma

**Sessione**: S1043 (canonica) · **Aperto**: 2026-08-04 · **Committente**: Enzo (batch delegato)
**Confine di sessione dichiarato all'apertura**: tutte e quattro le voci sono completabili in questa
sessione. Nessuna è dichiarata fuori.

## Ordine di lavoro ricevuto

1. Eseguire **#96** — installare `lab_inbox` (copia in `docs/kb/tools/`, cablaggio in
   `session_start.py`, check in `handoff_lint.py`).
2. Ingerire le **13 consegne** con `python docs/kb/tools/lab_inbox.py --ingest`.
3. Applicare le **8 migrazioni** dell'organigramma nell'ordine del `LEGGIMI.md`, verificando a ogni
   passo. Referto di riferimento letto prima di iniziare:
   `<lab>/2026-08-04--referto-verifica-incrociata.md`.

## Tabella dei deliverable

| id | Cosa | Chi | Cosa significa fatto | Stato |
|---|---|---|---|---|
| **V1** | `lab_inbox` installato + cablato al boot + check nel lint | Claude | boot canonico che stampa la sezione LAB INBOX con le consegne reali; `handoff_lint` verde | ✅ |
| **V2** | 13 consegne ingerite nel registro | Claude | 13 blocchi `#99`…`#111` nel registro con `lab-id`, 13 file spostati in `inbox/ingerite/`, lint verde | ✅ |
| **V3** | 8 migrazioni `000244`→`000251` applicate | Claude | ledger `sys_schema_migrations` con le 8 righe; il filo delle 161 assegnazioni attive intatto dopo ognuna | ⬜ |
| **V4** | Verdetto finale dell'organigramma | Claude | `sys.fn_organization_integrity_violations()` tutte a zero + `verifica_incrociata.py` ri-eseguita e confrontata con la baseline | ⬜ |

---

## Simulazione a 5 domande — V1 (installare e cablare `lab_inbox`)

**Precondizioni.** Verificate: `<lab>/tools/lab_inbox.py` esiste (7.800 byte) · `docs/kb/tools/`
esiste · `docs/kb/SOT_BACKLOG.md` esiste e la sua sezione `🗂 Action register` comincia col blocco
`- **#94` alla riga 15.

**Meccanismo — letto, non supposto.** `_radici()` distingue le due installazioni guardando
`basename(dirname(QUI))`. Installato in `docs/kb/tools`: `dirname(QUI)` = `docs/kb`, basename `kb` →
ramo repo → `repo = dirname(docs)` = radice del repo, `lab = <padre repo>/heuresys-design-lab`.
Su questa macchina fa `D:\heuresys-advanced` e `D:\heuresys-design-lab`: entrambi corretti.
`riassunto()` esce con stringa vuota se `INBOX` non è una directory → sui cloni VM/linux-pc, dove il
lab non esiste, non stampa nulla e non fallisce.

**Propagazione.** `docs/kb/tools/` è versionato: `git pull` porta il file su VM e linux-pc. Là il lab
non c'è, quindi il cablaggio è inerte per costruzione — nessun altro canale di propagazione serve.
`handoff_lint.py` gira anche in CI (`.github/workflows/state-lint.yml`, runner self-hosted OCI): là
il lab non esiste, quindi il check nuovo deve essere silenzioso e mai bloccante. L'import va protetto
da `try/except`: un difetto di `lab_inbox` non può abbattere il cancello della SoT.

**Chi.** Claude, per intero.

**Guardia.** Non distruttiva. Il rischio vero non è qui ma in V2 (`--ingest` riscrive la SoT):
la guardia è committare V1 **prima** di eseguire V2, così il registro ha un punto di ritorno pulito.

## Simulazione a 5 domande — V2 (ingerire le 13 consegne)

**Precondizioni.** V1 committata. 13 file `.md` in `<lab>/inbox/` — da verificare uno per uno che
abbiano `lab-id` **e** blocco ```` ```markdown ````, perché `consegne()` marca `valida` solo con
entrambi e `riassunto()` classifica le altre come «malformate» invece di ingerirle.

**Meccanismo — letto, non supposto.** `prossimo_id()` prende il massimo `#id` del registro e somma 1:
il massimo misurato è **98**, quindi le nuove partono da **#99**. `ingerisci()` inserisce il testo
`registro[:m.start()]` + nuovi blocchi + resto, dove `m` è il **primo** `- **#` in ordine di file: la
riga 15, che sta dentro l'Action register e dopo il blocco esplicativo. Punto d'inserimento corretto.
Ogni blocco riceve in coda `- lab-id: <id>`, ed è quella riga la tracciatura.

**Propagazione.** `SOT_BACKLOG.md` è SoT versionata e solo la CLI la scrive: commit. I file spostati
in `<lab>/inbox/ingerite/` stanno fuori dal repo e non si propagano — è voluto, sono il registro del
lab.

**Chi.** Claude.

**Guardia.** `--blocchi` prima di `--ingest` (mostra esattamente cosa scriverebbe, senza scrivere) ·
`handoff_lint.py` dopo, che sui blocchi nuovi verifica vocabolario (S2) e metadati (H1). Se un blocco
arriva con uno status fuori dal vocabolario chiuso, il lint lo blocca prima del commit.

## Simulazione a 5 domande — V3 (le 8 migrazioni)

**Precondizioni.** Tunnel `:5433` su e DB raggiungibile (boot hook) · ultima migrazione su disco
`000243`, quindi **`000244`→`000251` sono liberi** e il numero dichiarato dal `LEGGIMI.md` non va
cambiato · le 8 dipendono l'una dall'altra e lo verificano da sé.

**Meccanismo — letto, non supposto.** Ogni file ha **una** coppia `BEGIN;`/`COMMIT;` e da 6 a 11
blocchi con `RAISE EXCEPTION`: se un conteggio non torna la transazione si annulla per intero e il
database resta al passo precedente. Il rollback in coda a ciascun file è **commentato**, quindi
applicarlo non lo esegue. Non uso `migrate.sh` per applicarle (ri-esegue tutti i 241 file esistenti,
overhead puro e nessuna verifica intermedia): applico **una per una** con
`psql -v ON_ERROR_STOP=1 -f`, verifico, e solo dopo registro la riga nel ledger
`sys.sys_schema_migrations` con la stessa forma che usa `migrate.sh` (file_name + sha256 + durata).
Il controllo che compare in tutte e otto è **161 assegnazioni attive**: è il filo che dimostra che
nessuna persona viene aggiunta o perduta lungo la ricostruzione.

**Propagazione.** `db/migrations/` è versionato → commit. Il database di produzione è **uno solo**
(la VM), quindi non c'è un secondo DB da migrare in questo ciclo; il clone 1:1 sul linux-pc è una
copia di lettura che si riallinea col suo pull notturno dei backup — non è un passo di questo piano
e viene dichiarato come tale, non taciuto.

**Chi.** Claude.

**Guardia.** Prima di toccare qualunque cosa: **snapshot** `pg_dump` delle tabelle
dell'organigramma (unità, tipi, posizioni, assegnazioni) in `[Backup]` fuori dal repo, con
timestamp. La guardia regge sul caso limite che conta — se una migrazione a metà catena fallisce,
le precedenti sono già committate e lo snapshot è l'unico ritorno allo stato di partenza; il
rollback per-file esiste ma va eseguito a ritroso. Nessuna migrazione viene lanciata prima che lo
snapshot sia scritto e la sua dimensione verificata.

## Simulazione a 5 domande — V4 (verdetto)

**Precondizioni.** V3 completa (8/8 nel ledger).

**Meccanismo.** `SELECT * FROM sys.fn_organization_integrity_violations();` — funzione creata dalla
fase 8, attesa tutte le righe a zero. Poi `python <lab>/tools/verifica_incrociata.py` ri-eseguita e
confrontata con `<lab>/artefatti/verifica-incrociata-baseline.json`: **X10 e X7c devono scendere**,
**X11a deve restare a zero**, **X12 diventa eseguibile** perché la colonna `LINEA`/`STAFF` che le
mancava la introduce la `000244`.

**Propagazione.** Il confronto è un referto, sta nel lab. Ciò che entra nel repo è il verdetto e
l'eventuale voce nuova nel registro.

**Chi.** Claude. La *decisione* sulle 545 valutazioni che seguono l'albero vecchio **non** è mia:
è una scelta di Enzo e va presentata col numero, una volta sola, fuori da questo ciclo.

**Guardia.** Il confronto con la baseline può fallire: se una famiglia che doveva scendere non
scende, si dichiara con il numero invece di chiudere in verde.

---

## Fuori da questo ciclo (registro separato — presentati una volta sola a fine ciclo)

Voci emerse leggendo referto e `LEGGIMI.md`, che **non** entrano in "cosa resta" e non bloccano la
chiusura:

1. **Le 545 valutazioni** che portano come valutatore il capo secondo l'albero delle posizioni:
   rimapparle o dichiararle storia è una decisione di Enzo.
2. **Le 8 promozioni** (da 3A3L/3A4L a capo di unità) da formalizzare come passaggi di inquadramento.
3. **`martina.gentile`** perde la Direzione Rischi: da confermare o compensare.
4. **Cablare `fn_organization_integrity_violations()` in `db_health.py`** come sentinella permanente.
5. **Sei difetti indipendenti dall'organigramma** già misurati: aggancio delle fasce apicali (X3a),
   fasce doppie `LEGACY_BAND::`, cataloghi muti (X5d, X6d), `Supply Chain` come reparto di una banca
   (X6a, tocca I21), titolare degli obiettivi mai registrato (X6c), assegnazione duplicata (X9b).
