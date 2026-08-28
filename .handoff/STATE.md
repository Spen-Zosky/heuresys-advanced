# STATE — vista rapida

> Priorità e domande aperte. I numeri stanno in `docs/kb/SOT_STATE.md`, l'altra metà.

## Last session brief — l'ultima sessione, in breve

**S1083 — la sessione in cui la misura ha smentito il piano scritto sei volte, e una di quelle
volte ha spiegato perché una voce non si chiudeva da mesi.** Mandato di Enzo: risolvere i quattro
rossi del cruscotto e i cinque programmi aperti, poi *iniziare le corse* di ogni voce P1/P2/P3,
decidendo tutto da me e fermandomi solo sulla capienza. Tutti e tre i blocchi chiusi.

**I quattro rossi non erano quattro problemi.** Due erano sintomi di guasti più grandi: il registro
delle migrazioni nominava un file introvabile su tutte e tre le macchine e in tutta la storia git —
ed era la **traccia di un ritiro fatto a metà** in S1082, dove il file fu tolto e la sua riga di
registro no. E il «gap di traduzione» erano **tre entità di collaudo**
dimenticate da una corsa E2E morta a metà, che **bloccavano l'intera catena in produzione** perché
una migrazione a monte pretende copertura EN a zero.

**Il filo che lega la giornata**: in sei voci diverse la misura ha corretto il piano. Le 4.464
competenze «isolate nel grafo» non sono isolate affatto — il 98,2% ha un gruppo ESCO con un padre,
e quelle davvero scollegate sono **81**. Il primo perimetro della coda dell'agente **non si apre**:
862 risposte di clima su 862 portano il nome di chi ha risposto. `#159` F2 avrebbe prodotto ciò che
un divieto permanente vieta. E `#169` F3 non era eseguibile com'era scritta.

**La scoperta che vale oltre la sessione**: i rossi delle corse E2E lanciate da Windows sono
**rumore**. L'API non regge il tunnel — non è caduta sotto carico, **non è riuscita ad avviarsi**,
perché il caricamento della cache dei permessi va in timeout. È la stessa dottrina già scritta per
il database («si esegue dove il database vive»), mai estesa alla suite.

## Top priorities — le priorità

1. **`#219` F5e — la corsa integrale, ma SUL GEMELLO.** È il primo atto della prossima sessione, e
   **non va rifatta da Windows**: la corsa di ieri ha dato `fase 1: 1 fallito + 4 flaky + 83
   passati` e `fase 2: 4 falliti + 89 NON ESEGUITI`, e i quattro falliti erano **tutti i setup di
   autenticazione**, uccisi da un'API che il tunnel non tiene in vita. Verificato: il gemello ha
   Playwright, Node 22 di default, il database **in casa** e il web vivo.
   `ssh linux-pc 'cd ~/heuresys-advanced/apps/web && pnpm test:e2e:prod'` — dopo un `git pull` là.
   → `.programmi/219-otto-guasti-suite-e2e.md`
2. **Tre voci aspettano lo stesso tuo input, e nessuna lo diceva.** `#198` T9b, `#132` F7 e `#205` sono tutte `blocked-on-Enzo` sull'**indirizzo e la credenziale del
   fornitore di ricerca** (`RESEARCH_GATEWAY_URL` / `_TOKEN`): verificato leggendo il `.env`, sono
   assenti in locale e la dashboard li dà mancanti anche in produzione. Un solo input le sblocca
   tutte e tre. → `.programmi/132-ricerca-genera-il-modello.md`
3. **`#143` F3 e `#54` F3 — i due modelli dati nuovi aspettano la loro superficie.** Le tabelle sono
   in produzione; servono l'asse funzionale vivo per il primo (`isInFunctionalScope` è ancora codice
   morto) e le rotte per il secondo. → `.programmi/143-squadra-come-progetto.md` · `54-recruiting-ats.md`

## Open questions — le domande aperte

1. **Chi ha pushato il 26 agosto alle 18:47?** Invariata da S1082: due commit di prodotto arrivati
   su `origin/main` senza un push mio, con CI partita e sito ripubblicato. Non è un'attività
   pianificata né una sessione CLI parallela, e il diario non registra nulla.
2. **`#86`** — `claude login` sul solo `linux-pc`, cinque minuti tuoi. Invariata da S1080.
   ⚠ **E una risposta che vale la pena sapere subito** (`#236`): oggi **solo il deploy** sopravvive
   alla chiusura della sessione — è un timer systemd sulla VM, e si legge con
   `bash scripts/verifica-deploy.sh`. Le **clonazioni no**: girano sotto un `ssh` in primo piano, e
   quella del database contiene un `DROP … CASCADE` in place. Chiudere la CLI nella finestra
   sbagliata lascia il gemello **rotto**, non indietro.
3. **Le risposte ai sondaggi di clima sono oggi leggibili fuori dalla catena organizzativa.**
   Misurato: chiunque abbia `surveys:read` le vede, anche di persone che non gli riportano.
   Classificarle come sensibili è la cura, ma comporta annotare **21 rotte** con l'org-gate e
   cambia chi vede cosa in produzione: pretende una prova live, quindi è una voce di lavoro e non
   un ritocco. La riga in `data-classes.ts` resta, ma da oggi porta accanto la misura che la
   smentisce.

## Verification — come si controlla

```bash
python docs/kb/tools/session_start.py            # menu + salute, un giro solo
python docs/kb/tools/verifica_incrociata.py      # atteso: 0 verifiche con difetti
python docs/kb/tools/check_marciume.py           # atteso: «niente e' marcito»
bash scripts/verifica-deploy.sh                  # com'e' finito il deploy armato
```

> I numeri (migrazioni, moduli, conteggi DB, CI) stanno in `docs/kb/SOT_STATE.md`.
