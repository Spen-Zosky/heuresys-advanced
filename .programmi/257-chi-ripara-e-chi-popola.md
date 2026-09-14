# 257 — Il registro di chi ripara e chi popola: quattro famiglie di lacune, quattro responsabili

> **item**: #257 · **priorità**: P2 · **stima**: ~1 sessione
> **stato**: NON AVVIATO
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

- [ ] **F1 — La misura unificata** — `chi_ripara.py` legge le tre fonti e produce un elenco di lacune (tabella · colonna · tenant · quante righe/quanti vuoti), senza ancora classificare. **fatto =** l'elenco esce sul vivo, e il totale coincide con la somma delle tre fonti (post-condizione scritta).
- [ ] **F2 — Le regole** — ogni lacuna riceve una famiglia con la regola che l'ha assegnata stampata accanto; ciò che non combacia esce `DECISIONE`. Regole in una tabella dichiarativa nello strumento (tabella → famiglia → ragione), non in `if` sparsi. **fatto =** `--selftest` a esiti opposti: una FK derivabile → `DERIVABILE`, una tabella di persone → `CLIENTE`, una sconosciuta → `DECISIONE`; sabotata una regola, il caso è rosso.
- [ ] **F3 — La coda di lavoro** — `--per-famiglia` stampa i quattro elenchi con il responsabile; per `RICERCA` indica il dominio ricercabile di `#205` a cui appartiene (`chiaviDominio()`); per `CLIENTE` dichiara «bloccata da M6». **fatto =** l'elenco `DECISIONE` è finito, letto da Enzo, e ogni voce ha un esito scritto (regola nuova, o decisione).
- [ ] **F4 — Nella dashboard** — una riga in `session_start.py`: `lacune: N — DERIVABILE a · RICERCA b · CLIENTE c · DECISIONE d`, muta se non c'è database (NON MISURABILE, non verde). **fatto =** la riga compare al boot; `check_istruzioni` verde.

## Cronaca
