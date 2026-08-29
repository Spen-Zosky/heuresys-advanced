# STATE — vista rapida

> Priorità e domande aperte. I numeri stanno in `docs/kb/SOT_STATE.md`, l'altra metà.

## Last session brief — l'ultima sessione, in breve

**S1084 — la sessione in cui una premessa scritta nel piano si è rivelata falsa, e la cosa da
costruire esisteva già.** Mandato di Enzo: risolvere i tre rossi del boot, poi `#237` e `#236`; a
metà, l'estensione a tutte le fasi restanti delle due voci. **Entrambe chiuse**, più i tre rossi.

**`#237` diceva che una chiusura costa il 25% della finestra. Misurato: il 2,8%.** Il 25% veniva da
un numero scritto nel piano stesso, che sommava alla chiusura tutto il lavoro fatto dopo
l'invocazione della skill. Isolata — Claude Code marca ogni turno con la skill che lo ha prodotto —
la chiusura pura costa **28.352 token in media su 14 chiusure**. E la voce più cara non è scrivere
lo stato: è **leggerlo** (25,2% contro 23,0%).

**`#236` voleva un timer nuovo sul gemello. C'era già** — `heuresys-advanced-clonedb.service`, con
`OnFailure` e `Persistent=true`, viva da mesi. Mancava solo un innesco su richiesta: una riga,
`systemctl start --no-block`. Provato uccidendo **ogni ssh** mentre il clone girava: è finito lo
stesso, `Result=success`, clone intatto.

**Il filo della giornata**: ogni prova che poteva fallire ha fallito almeno una volta, e ogni
fallimento ha corretto il lavoro — la misura del costo, la post-condizione della compattazione, la
CI. Un apostrofo dentro un `${VAR:-…}` ha reso verde un caso negativo: trappola **già documentata**
in un file accanto, e riprodotta lo stesso. Un commento altrove non è un presidio.

## Top priorities — le priorità

1. **La cura di `#237` F2 va CONFERMATA su questa chiusura, ed è il primo atto naturale della
   prossima sessione.** Il register è passato da **911.609 a 321.121 byte (−65%)** archiviando 193
   voci chiuse, ma il piano prescrive che il guadagno si misuri *sulla chiusura successiva*, non sul
   peso. Il comando è `python docs/kb/tools/costo_chiusura.py -n 14`: se la chiusura di S1084 non
   scende sotto la media di 28.352 token, la cura non ha funzionato e si passa alla **seconda** voce
   della tabella — `SOT_STATE.md`, ancora **432.938 byte** e senza cura. → `.programmi/237-*.md`
2. **`#219` F5e — la corsa E2E integrale, SUL GEMELLO e non da Windows.** Invariata da S1083 e
   ancora la voce P2 più matura: i falliti erano tutti setup di autenticazione, uccisi da un'API
   che il tunnel non tiene viva.
   `ssh linux-pc 'cd ~/heuresys-advanced/apps/web && pnpm test:e2e:prod'` — dopo un `git pull` là.
3. **Tre voci aspettano lo stesso tuo input, e un solo dato le sblocca tutte.** `#198` T9b, `#132`
   F7 e `#205` sono `blocked-on-Enzo` sull'indirizzo e la credenziale del fornitore di ricerca
   (`RESEARCH_GATEWAY_URL` / `_TOKEN`): assenti nel `.env` locale e mancanti anche in produzione.
4. **`#143` F3 e `#54` F3 — i due modelli dati nuovi aspettano la loro superficie.** Le tabelle sono
   in produzione; servono l'asse funzionale vivo per il primo (`isInFunctionalScope` è ancora codice
   morto) e le rotte per il secondo.

## Open questions — le domande aperte

1. **Chi ha pushato il 26 agosto alle 18:47?** Invariata da S1082: due commit di prodotto arrivati
   su `origin/main` senza un push mio, con CI partita e sito ripubblicato. Non è un'attività
   pianificata né una sessione CLI parallela, e il diario non registra nulla.
2. **`#86`** — `claude login` sul solo `linux-pc`, cinque minuti tuoi. Invariata da S1080.
3. **Le risposte ai sondaggi di clima sono leggibili fuori dalla catena organizzativa** (`#235`,
   invariata): chiunque abbia `surveys:read` le vede, anche di persone che non gli riportano.
   Classificarle come sensibili comporta annotare **21 rotte** e cambia chi vede cosa in produzione.

## Verification — come si controlla

```bash
python docs/kb/tools/session_start.py            # menu + salute, un giro solo
python docs/kb/tools/verifica_incrociata.py      # atteso: 0 verifiche con difetti
python docs/kb/tools/check_marciume.py           # atteso: «niente e' marcito»
bash scripts/verifica-cloni.sh                   # I TRE LAVORI ARMATI: deploy - clone - ecosistema
bash scripts/verifica-deploy.sh                  # il solo deploy (verifica-cloni ci si appoggia)
python docs/kb/tools/costo_chiusura.py -n 14     # quanto e' costata la chiusura (#237)
```

> **«Posso chiudere la sessione mentre quelle attivita' procedono?»** — la risposta e'
> `bash scripts/verifica-cloni.sh`, non una memoria (`#236` F3). Tre verdetti a vocabolario
> chiuso: deploy `DEPLOYATO/IN-VOLO/CI-ROSSA/DISALLINEATO/NON-VERIFICATO` - clone
> `FRESCO/IN-CORSO/INDIETRO/FALLITO/NON-VERIFICATO` - ecosistema
> `ALLINEATO/INDIETRO/INTERROTTO/NON-VERIFICATO`. **`NON-VERIFICATO` non vuol dire «a
> posto»: vuol dire «non ho potuto guardare».** Esce 0 se niente e' in guasto, 1 su un
> guasto vero, 2 se non ha potuto misurare.

> I numeri (migrazioni, moduli, conteggi DB, CI) stanno in `docs/kb/SOT_STATE.md`.
