# Mandato O2-02 — il caricatore porta il pacchetto v0.3 nelle tabelle del modello

Modello: `claude-sonnet-5-5`. Tetto di spesa: 8 USD. Onda 2, sessione 2 di 10 (`.programmi/onda2/README.md`, regole comuni 1-11).

## Contesto

`db/scripts/pacchetto/definizione-pacchetto.mjs` dice dove va ogni dato del pacchetto v0.2 e come si rilegge dalle righe: la rilettura è la prova che niente si perde. O2-01 ha creato le case delle sezioni v0.3. Questa sessione estende il caricatore alla v0.3, compreso il perimetro (ADR-0046 §1: `perimeter_status` `DICHIARATO` solo se la sezione `perimetro` ha voci).

## Precondizione

Il pacchetto v0.3 del caso banca (convertito dalla v0.2 con le sezioni nuove dichiarate vuote, PE-5) è depositato dal datastore. Se non c'è: stato `WAIT-INPUT: pacchetto v0.3 del caso banca non depositato`, e la sessione si limita a estendere il caricatore e a provarlo su un pacchetto v0.3 costruito nel test a partire dallo schema (`prototipo-pacchetto.schema.json`), dichiarato come tale.

## Leggi

`CLAUDE.md`, memoria; `definizione-pacchetto.mjs`, `db/scripts/pacchetto/prova-000456.sh`; `DISEGNO_tabelle-onda2.md` sezione 1; nel datastore (sola lettura) `src/contratto/v0.3/mappatura-advanced.json`, lo schema e i vocabolari; l'esito di O2-01.

## Consegna

1. Il caricatore scrive ogni sezione e campo v0.3 nelle tabelle M1, per codice, e li rilegge in un pacchetto equivalente; una sezione dichiarata vuota produce zero righe e nessun errore.
2. Il caricatore rifiuta un pacchetto che non passa lo schema v0.3, e accetta ancora un pacchetto v0.2 (nessuna sezione v0.2 cambia significato).
3. La lettura di ritorno conta le regole che marcano senza rifiutare (al massimo cinque priorità, un solo DECIDE per decisione, ore per posizione) e le riporta, senza fermarsi.

## Prova di chiusura

- Su copia usa-e-getta: caricamento del pacchetto della banca (o del pacchetto di prova, se manca), rilettura, confronto con il JSON di partenza normalizzato: uguali; conteggio righe per sezione uguale al conteggio nel JSON.
- Mutazione: togliere dal caricatore una colonna (per esempio `work_nature`) fa diventare rosso il confronto.
- Un pacchetto v0.2 già usato in `prova-000456.sh` si carica e si rilegge come prima.

## Non fare

Nessun caricamento sul database di produzione; nessuna corsa del modello nel datastore (decisione del 17/10); nessuna scrittura nel repository del datastore.
