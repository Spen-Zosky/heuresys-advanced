# Mandato O2-06 — l'attivazione v0.3 senza mani e la lettura della catena (cancello G2 su copia)

Modello: `claude-sonnet-5-5`. Tetto di spesa: 10 USD. Onda 2, sessione 6 di 10 (`.programmi/onda2/README.md`, regole comuni 1-11).

## Contesto

Il cancello G2, in forma strutturale (piano di esecuzione, PE-6): su RTL Bank si legge, per un processo scelto, la catena fin dove i dati esistono (processo, attività, ruoli, posizioni, persone, indicatori, decisioni), con priorità d'impresa e capability mostrate come «dichiarato vuoto»; il pacchetto convertito della banca si attiva senza interventi a mano. Che cosa copia la materializzazione è nella sezione 5 di `.programmi/onda2/DISEGNO_tabelle-onda2.md`.

## Leggi

`CLAUDE.md`, memoria, `.claude/rules/api-module-pattern.md`, `.claude/rules/frontend-live-data.md`; `DISEGNO_tabelle-onda2.md` sezioni 0 e 5; il modulo `apps/api/src/modules/tenant-materialization` per intero; gli esiti di O2-02, O2-03, O2-04, O2-05.

## Consegna

1. La materializzazione porta le sezioni v0.3 dal modello al tenant secondo la tabella della sezione 5: per codice, senza indovinare; ciò che non si risolve va in `staging.materializzazione_v03_dubbi` e la riga nasce disattivata o col campo nullo; una sezione dichiarata vuota produce zero righe.
2. Una rotta di lettura `GET /v1/tenant-processes/:id/chain` (modulo nuovo secondo il pattern in 7 passi, permesso esistente di lettura dei processi o uno nuovo con la sua migrazione RBAC, dichiarazioni del cancello `orgGate`/`tenantGate`) che restituisce la catena del processo: priorità d'impresa e capability collegate, attività con esecutori, ruoli, posizioni, persone che le occupano oggi, indicatori con target, decisioni con diritti. Ogni sezione senza dati dice `dichiaratoVuoto: true`, non un elenco vuoto muto.
3. Test di integrazione della rotta e della materializzazione.

## Prova di chiusura

- Su copia usa-e-getta del gemello migrata all'HEAD, con il pacchetto della banca caricato da O2-02: attivazione con la rotta già esistente, nessuna scrittura a mano; conteggi per tabella del tenant = conteggi attesi dalle sezioni del pacchetto meno i dubbi registrati.
- La rotta della catena, chiamata con l'API del gemello puntata alla copia e il login di una persona reale di RTL Bank con il profilo che la consente: risposta salvata in `.programmi/onda2/esiti/O2-06_catena.json` con comando, orario e persona (per ruolo, non per nome).
- Mutazione: un riferimento a un codice inesistente nel pacchetto finisce nei dubbi e non in una riga attiva.
- `pnpm test:api:vm` verde.

## Non fare

L'attivazione in produzione e il cancello G2 su produzione sono dell'Amministratore di Sistema (rilascio): in esito lo stato è `blocked-on-Amministratore di Sistema: rilascio di O2-01…O2-06`. Nessuna pagina web nuova in questa sessione.
