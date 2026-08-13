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
