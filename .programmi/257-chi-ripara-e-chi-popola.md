# 257 — Il registro di chi ripara e chi popola: quattro famiglie di lacune, quattro responsabili

> **item**: #257 · **priorità**: P2 · **stima**: ~1 sessione
> **stato**: CHIUSO
> **nasce-da**: `CHI_ripara_e_CHI_popola_20260909.md` (Cowork, fuori repo); domanda di Enzo del 2026-09-09: *«non ho capito chi si occupa di riparare questi problemi e chi si occupa di popolare i dati al momento assenti»*. **Adottato da Enzo il 2026-09-14** (S1101), nella forma piccola descritta sotto.

## Decisioni già prese (non si ri-chiedono)

- **Le quattro famiglie**: ① `DERIVABILE` (da dati già presenti → il codice) · ② `RICERCA` (da cercare fuori → la macchina della ricerca, `apps/api/src/modules/research`, con l'approvazione umana che già prevede) · ③ `CLIENTE` (persone, organigramma, retribuzioni, presenze → li porta l'azienda che compra) · ④ `DECISIONE` (Enzo).
- **Il registro è derivato, non scritto a mano.** Niente tabella `sys.*` popolata una volta: uno strumento (`docs/kb/tools/chi_ripara.py`) ri-deriva le lacune dai tre strumenti che già le misurano e assegna la famiglia con regole meccaniche. Un registro scritto a mano invecchia; qui vale il comando, non il numero (⭐ punto fisso).
- **Regole di assegnazione, meccaniche**: una tabella/colonna vuota che ha una FK o una mappatura da cui derivare (es. competenze ↔ occupazioni ESCO) → `DERIVABILE`; una tabella di **contenuto di settore** (unità, posizioni-modello, indicatori, processi, percorsi) vuota per un tenant → `RICERCA`; una tabella che contiene **dati della persona o dell'azienda** (utenti, incarichi, retribuzioni, presenze) → `CLIENTE`; ciò che nessuna regola classifica → `DECISIONE`, e l'elenco è finito e lo legge Enzo.
- **La famiglia ③ resta bloccata da M6** (la porta d'ingresso dei dati del cliente non esiste; l'import dal legacy è vietato da I12): il registro la **nomina**, non la risolve. La famiglia ② si aggancia a `#205`.
- Nessuna soglia: il numero per famiglia si stampa nella dashboard e chi legge giudica.

## Le fonti, misurate il 2026-09-09 (da ri-derivare, non da ricopiare)

| fonte | cosa misura | comando |
|---|---|---|
| `completezza_tenant.py` | quali tabelle di un tenant non sono popolate (13 mai popolate da nessuno) | `python docs/kb/tools/completezza_tenant.py` |
| `db_health.py` | le colonne dichiarate e mai riempite (279) | `python docs/kb/tools/db_health.py` |
| `sys.v_contenuto_fuori_settore` (mig `000388`) | i contenuti incoerenti col settore del tenant | `select * from sys.v_contenuto_fuori_settore` |

## Fasi

- [x] **F1 — La misura unificata** — `chi_ripara.py` legge le tre fonti e produce un elenco di lacune (tabella · colonna · tenant · quante righe/quanti vuoti), senza ancora classificare. **fatto =** l'elenco esce sul vivo, e il totale coincide con la somma delle tre fonti (post-condizione scritta). — FATTO 2026-09-28 · misurato dal vivo: 390 lacune (106+284+0), `--verifica-fonti` verde
- [x] **F2 — Le regole** — ogni lacuna riceve una famiglia con la regola che l'ha assegnata stampata accanto; ciò che non combacia esce `DECISIONE`. Regole in una tabella dichiarativa nello strumento (tabella → famiglia → ragione), non in `if` sparsi. **fatto =** `--selftest` a esiti opposti: una FK derivabile → `DERIVABILE`, una tabella di persone → `CLIENTE`, una sconosciuta → `DECISIONE`; sabotata una regola, il caso è rosso. — FATTO 2026-09-28 · `--selftest`: AUTOPROVA SUPERATA (4 casi + sabotaggio)
- [x] **F3 — La coda di lavoro** — `--per-famiglia` stampa i quattro elenchi con il responsabile; per `RICERCA` indica il dominio ricercabile di `#205` a cui appartiene (`chiaviDominio()`); per `CLIENTE` dichiara «bloccata da M6». **fatto =** l'elenco `DECISIONE` è finito ed è stato prodotto — **ancora da leggere da Enzo** (187 voci, riportate nel messaggio di chiusura sessione): finché non le legge, ogni voce resta senza esito. — FATTO 2026-09-28 · `--per-famiglia` verificato; DECISIONE 187 voci in attesa di lettura
- [x] **F4 — Nella dashboard** — una riga in `session_start.py`: `lacune: N — DERIVABILE a · RICERCA b · CLIENTE c · DECISIONE d`, muta se non c'è database (NON MISURABILE, non verde). **fatto =** la riga compare al boot; `check_istruzioni` verde. — FATTO 2026-09-28 · riga misurata al boot: `390 — DERIVABILE 139 · RICERCA 1 · CLIENTE 63 · DECISIONE 187`; salta pulita con `--no-db`; `check_istruzioni.py` verde

## Cronaca

- **S1116 (2026-09-28)**: costruito `docs/kb/tools/chi_ripara.py`. Riusa `completezza_tenant.py` (tabelle_di_tenant/misura/confronta, fonte A) e `check_domini_ricercabili.py` (R1/R3 e `DESTINAZIONE`, il gemello python di `chiaviDominio()` di `#205`, fonte RICERCA/CLIENTE) invece di reinventarli. Misura dal vivo (tunnel :5433): **390 lacune** = 106 tabelle (`completezza_tenant --contro HEURESYS`) + 284 colonne (stesso predicato di `db_health.py`, `pg_stats.null_frac=1`) + 0 righe (`sys.v_contenuto_fuori_settore`, oggi pulita). Post-condizione F1 (`--verifica-fonti`) verde: il totale torna ri-misurando le tre fonti in modo indipendente. Classificazione (F2): **DERIVABILE 139** (colonna è FK verso una tabella già popolata — include gli audit `created_by`/`updated_by`, derivabili dall'attore della richiesta) · **RICERCA 1** (`sys_skills`, vuota per HEURESYS, dominio `#205` `skills`) · **CLIENTE 63** (colonna soggetto diretta, o tabella "di persona" per R1∧¬R3 di `#205`, es. `sys_attendance`) · **DECISIONE 187** (44 tabelle intere mai popolate da HEURESYS che non sono né contenuto di settore né dati di persona — es. `sys_okrs`, `sys_surveys`, `sys_predictive_models`, `sys_visualization_graphs`, `sys_review_cycles` — più 143 colonne morte senza FK e senza soggetto, per lo più campi opzionali di testo/data mai valorizzati). `--selftest`: 4 casi reali a esito noto (uno per famiglia) + sabotaggio della regola `fk-a-tabella-popolata` (il caso derivabile cambia famiglia, gli altri tre restano invariati) — **AUTOPROVA SUPERATA**. F4: riga aggiunta a `session_start.py` dopo la sezione PAGINE, guardata da `if not args.no_db` come `db_health --sentinelle`. **L'elenco DECISIONE (187 voci) è finito ma NON ANCORA letto da Enzo**: la fase F3 lo produce correttamente, ma il "fatto =" del programma (chiuso-quando del backlog) pretende la lettura, non solo la produzione — riportato per intero nel messaggio di chiusura di questa sessione, non deciso qui.
