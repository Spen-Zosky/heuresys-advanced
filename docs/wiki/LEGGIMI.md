---
dominio: governo
natura: norma
stato: vivo
aggiornato_il: 2026-11-25
sintesi: Lo schema del wiki: come si scrivono, si aggiornano e si controllano le pagine
fonti: [docs/piani/PIANO_riordino-documentazione_20261125.md, docs/kb/tools/check_documenti.py, docs/kb/tools/build_wiki.py]
concetti: [wiki, ritiro]
---

# Il wiki di heuresys-advanced

Il wiki segue il modello llm-wiki: le **fonti grezze** (codice, migrazioni, ADR, registri di stato) non si copiano; le **pagine** le sintetizzano, con un rimando per ogni affermazione; questo file è lo **schema**, cioè le regole con cui le pagine si tengono. Il piano che lo ha creato è [PIANO_riordino-documentazione_20261125](../piani/PIANO_riordino-documentazione_20261125.md).

## Le pagine

- `domini/<dominio>.md`: una per ciascuno dei quindici domini, con le sezioni «Com'è oggi», «Decisioni in vigore», «Come si fa», «Stato e pendenze», «Storia», «Vedi anche». I domini sono gli stessi nel datastore.
- `concetti/<concetto>.md`: una per ogni oggetto del modello che compare in più domini (quando serve).
- [index.md](index.md) e [indice-analitico.md](indice-analitico.md) sono generati; [log.md](log.md) si scrive solo in aggiunta.

## I metadati

Ogni pagina comincia con un blocco `dominio`, `natura`, `stato`, `aggiornato_il`, `sintesi`, `fonti`, `concetti`. Valori ammessi e controlli in `docs/kb/tools/check_documenti.py`.

## Le tre operazioni

- **ingest**: quando cambia una fonte, si aggiorna la pagina che la cita, si rimette `aggiornato_il` e si aggiunge una riga a [log.md](log.md).
- **query**: si parte da [index.md](index.md) o dall'[indice analitico](indice-analitico.md), poi si scende alle fonti.
- **lint**: `python3 docs/kb/tools/check_documenti.py` (metadati, link, rimandi a ritirati, affermazioni vietate in [affermazioni_vietate.txt](affermazioni_vietate.txt)) e `python3 docs/kb/tools/build_wiki.py --check` (parti generate); entrambi girano nel workflow `state-lint.yml`.

## Le parti generate

I blocchi fra `<!-- generato:NOME -->` e `<!-- /generato -->` li riscrive `python3 docs/kb/tools/build_wiki.py`: le decisioni di ogni dominio (dagli ADR, con la mappa [adr_domini.tsv](adr_domini.tsv)) e la storia dei ritiri (dal registro dei ritiri). Non si editano a mano.

## Un documento che non serve più

Un piano o un esito chiuso passa a `stato: chiuso`; la conoscenza utile entra nella pagina di dominio; al giro di ritiro esce dal repo con `python3 docs/kb/tools/ritira_documenti.py`, e la pagina «Storia» del suo dominio lo conta.
