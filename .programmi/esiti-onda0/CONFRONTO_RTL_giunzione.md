# Confronto fra il pacchetto della banca, il modello caricato e RTL Bank (W0-A1, 2026-10-11)

La prova è stata fatta su una copia usa-e-getta del gemello (`heuresys_advanced_w0a1_prova1`, copia di `heuresys_advanced` con la catena delle migrazioni applicata fino alla 000455). La produzione non è stata toccata. I file grezzi sono in `.programmi/esiti-onda0/prova-giunzione/`. Il pacchetto è `heuresys.prototipo.pacchetto/0.2` del prototipo `p20261010010521tjb` (banca commerciale regionale retail, 158 addetti), estratto in sola lettura dal database del datastore il 2026-10-11 con `estrai_pacchetto.sh`.

## 1. Il pacchetto entra nel modello: perdite di dati

**Nessuna.** Il caricatore ha scritto 5633 righe in 31 tabelle di contenuto, più 2844 traduzioni inglesi, 1247 legami con le prove e 174 «senza riscontro» (`carica.json`). La rilettura ricostruisce il pacchetto dalle sole righe del database e lo confronta con il file: 257 percorsi su 257, 0 percorsi con differenze, pacchetto ricostruito uguale all'originale, tutte le sezioni uguali (`rileggi.json`).

Per costruzione il confronto vede solo ciò che il caricatore sa scrivere: un campo che il pacchetto avesse e che il caricatore ignorasse comparirebbe come «percorso perso». Non ne è comparso nessuno.

## 2. Il modello si attiva: che cosa arriva al tenant

La versione caricata nasce DRAFT, senza chiave di costruzione (`attiva_prima.json`). Sulla copia, con un gesto esplicito dell'operatore (non una derivazione di advanced: vedi `RICHIESTA_datastore_attivazione.md`, M4), è stata pubblicata con chiave `BLUEPRINT_CONTENT`; il piano di costruzione è stato accettato e il modello è stato costruito in un tenant nuovo della copia (`attiva.json`):

| cosa | nel pacchetto | costruito nel tenant |
|---|---|---|
| unità organizzative | 31 | 31 |
| posizioni | 109 | 109 |
| competenze | 443 | 443 |
| indicatori | 327 | 327 |
| righe registrate nel registro dell'origine | | 910 |

Il tenant di prova è stato creato dentro la copia; non c'è nessun tenant nuovo nel database del gemello originale né in produzione.

**Ciò che il codice di advanced non legge oggi.** Dei 29 domini nuovi, nessuno è letto da un modulo API: sedi, organico previsto, obiettivi (247), CCNL con livelli e istituti (2 contratti, 10 livelli, 12 istituti, 29 condizioni), obblighi (20, con 770 legami alle posizioni), formazione (30), carriere (9), incentivi (5, 737 legami), commesse (4), prove (384), derivazioni. Non sono perse: stanno nel database e si rileggono. Semplicemente nessuna funzione le usa ancora per costruire. L'unica eccezione è il contratto collettivo, che da oggi legge il principio gerarchia-livelli (#265).

**Ciò che manca perché l'attivazione sia piena** (richiesta al datastore): ruoli di catalogo, cruscotti, porte di ricompensa, variante pubblicata, peso economico (109 posizioni su 109 a 0), identità del fascicolo. Vedi `RICHIESTA_datastore_attivazione.md`.

## 3. Il confronto con RTL Bank

Misurato sulla copia, solo lettura.

| | RTL Bank (tenant vero) | modello costruito dal pacchetto | in comune |
|---|---|---|---|
| unità organizzative | 42 | 31 | 3 nomi uguali |
| posizioni | 312 | 109 | 58 titoli uguali |
| competenze proprie del tenant | 28 | 443 | 0 codici uguali |
| indicatori propri del tenant | 0 | 327 | 0 |

Come leggerlo, senza forzare:
- Le posizioni di RTL Bank sono 312 per 158 dipendenti (una per persona, con la persona nel `metadata`); il pacchetto descrive 109 ruoli con organico previsto. Il confronto 312 contro 109 non è una perdita: sono due unità di conto diverse (posti contro ruoli), come già segnalato da Cowork il 4 ottobre.
- Le competenze: RTL Bank ne ha 28 proprie perché il resto è catalogo globale (14003 righe senza tenant); il modello porta 443 competenze con categoria, che la costruzione crea nel tenant. Nessun codice coincide: i due insiemi non sono confrontabili per codice.
- Gli indicatori: RTL Bank non ha definizioni proprie (233 sono globali); il modello ne porta 327, legate ai processi.
- I livelli contrattuali di RTL Bank (3A1L … QD4, Dirigente) sono tutti riconosciuti sull'ordine del contratto collettivo del pacchetto: 40 unità controllate, 0 avvisi del principio gerarchia-livelli, nessun livello fuori scala (`livelli_rtl.json`). L'ordine QD4 sopra QD3 sopra QD2 sopra QD1 viene dai minimi annui del contratto caricato, non da un'ipotesi.

**Perdite di dati verso RTL Bank: nessuna**, perché la giunzione non ha scritto niente nel tenant RTL Bank: ha costruito un tenant separato dentro la copia. Il confronto serve a vedere la distanza fra il modello e il tenant reale, non a sostituire l'uno con l'altro.

## 4. Effetto collaterale da sapere

Il caricatore scrive anche 327 definizioni di indicatore di piattaforma (righe senza tenant in `sys_kpi_definitions`) e 327 modelli per processo (`sys_process_kpi_templates`), perché la sentinella `v_processi_senza_kpi` pretende che ogni processo caricato sia misurato. Sono righe di piattaforma che il caricatore mette in advanced: rientrano nel censimento della separazione (`CENSIMENTO_separazione.md`, sezione 1) e vanno a casa nel datastore quando la separazione sarà fatta.
