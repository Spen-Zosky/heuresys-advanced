# `.programmi/` — le voci che non stanno in una sessione

Una voce del backlog che vale 2-8 sessioni non si chiude mai, perché ogni sessione che la
apre spende metà del suo contesto a ri-capire dove era arrivata la precedente. Qui ogni voce
di quel tipo ha **un file**, e quel file è l'unica cosa che una sessione nuova deve leggere
per ripartire.

Non è una convenzione nuova: è la forma di `.storia36/PROGRESS.md` — che ha portato a
termine un programma da 13 cluster — generalizzata a qualunque voce.

## Il patto, in quattro punti

1. **Le decisioni già prese non si ri-chiedono.** Stanno in testa al file. Una sessione nuova
   le legge, non le rinegozia. È ciò che impedisce a Enzo di rispondere due volte alla stessa
   domanda.
2. **Una fase sta in UNA sessione.** Se non ci sta, va spezzata. Il budget dichiarato accanto
   alla fase è una promessa verificabile contro `guardiano.py`, non un augurio.
3. **Una spunta senza evidenza non è una spunta.** `[x]` esige data + prova sulla stessa riga.
   `programmi.py --verifica` esce 1 se manca — è il controllo che impedisce a un programma di
   dichiararsi avanti mentre sta fermo.
4. **Interrompersi è previsto, dimenticarsene no.** Una fase lasciata a metà si marca
   `INTERROTTO al punto <X>` con l'evidenza; la sessione dopo riprende da lì, e lo strumento
   **vieta** di spuntare fasi successive scavalcandola.

## Comandi

```bash
python docs/kb/tools/programmi.py             # cosa è aperto e da dove si riprende
python docs/kb/tools/programmi.py --verifica  # integrità (exit 1 su difetto)
python docs/kb/tools/programmi.py --selftest  # 16 prove, provate capaci di fallire
python docs/kb/tools/programmi.py --id 99     # un programma per esteso
```

Il boot (`session_start.py`) stampa da sé i programmi aperti con la fase successiva: nessuna
sessione deve ricordarsi di guardare qui.

## Come si apre un programma nuovo

File `.programmi/<id>-<slug>.md`, con l'intestazione (`> **item**: #N` e `> **stato**: …`),
il blocco delle decisioni vincolanti e il blocco `## Fasi`. Lo stato dichiarato deve
coincidere con le spunte, o `--verifica` lo dice.

Vocabolario di stato: `NON AVVIATO` · `IN CORSO` · `CHIUSO` · `SOSPESO`.

## Le quattro regole di forma (S1069 — ognuna nasce da un difetto vero)

1. **Ogni voce ACTIVE ha il suo piano, anche quella mono-sessione.** Non serve a spezzarla:
   serve perché «cosa è fatto / cosa manca / da dove si riprende» esista in una forma che uno
   strumento sa leggere. `handoff_lint.py` lo pretende con `T2`, **bloccante**.
2. **L'evidenza di una spunta sta sulla STESSA riga della fase.** Il parser lavora riga per riga:
   una data messa nella riga di continuazione non esiste, e `--verifica` chiama la spunta nuda.
3. **La sigla fra `**…**` non può contenere `*`.** In `#69` la sigla «I 18 residui
   `staging.wave1_*`» faceva sparire la fase, e il menu diceva «0/1 fatte» su un piano che di
   fasi ne mostra due. Adesso una riga che sembra una fase e non lo diventa è un difetto.
4. **Un id non numerico si aggancia lo stesso**: `Z-251` vive in `Z251-<slug>.md` e dichiara
   `> **item**: Z-251`. La normalizzazione sta in `programmi.normalizza_id()`, una volta sola,
   e la importano `handoff_lint.py` e `build_menu.py`.

## Da qui il menu di avvio SPIEGA

`build_menu.py` deriva da questi file la riga che accompagna ogni voce ACTIVE — «N/M fatte ·
riprendi da **F<n>** <titolo>», col blocco `⛔` se la fase lo dichiara. Nessun avanzamento va
ricopiato nel register: `T1` lo vieta nel titolo **e** nell'effort.

Una fase lasciata a metà si marca `INTERROTTO al punto <X>` qui, e la voce diventa `INTERRUPTED`
nel register con `resume-from` — che il menu porta in **cima**. Un `INTERRUPTED` senza
`resume-from` è un FAIL (`S6`): sarebbe un'interruzione dichiarata e persa lo stesso.
