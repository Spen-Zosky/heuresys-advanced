# STATE — vista rapida

> Priorità e domande aperte. I numeri stanno in `docs/kb/SOT_STATE.md`, l'altra metà.

## Last session brief — l'ultima sessione, in breve

**S1079 — due consegne del lab eseguite, poi la scoperta che ha cambiato la sessione: il
sistema di controllo era cieco su un'intera classe di guasti.** Chiuse `#225` `#226` `#228`
`#229`; aperta `#227` (4.464 competenze isolate — lavoro che era orfano).

Il filo: **il cancello locale guarda il *diff*, e presume che le cose si guastino solo quando
le tocchi.** Ma una data che scade, un'altra voce che si chiude, una macchina che cambia e il
database che si muove non producono alcun diff. Sette difetti del registro erano invisibili
per costruzione, e sono emersi solo perché Enzo ha chiesto di cercarli.

Nascono da lì `#228` (il **cancello a tempo**: a ogni chiusura esegue i 10 strumenti che nessun
diff instrada, più cinque controlli di stato nuovi) e `#229` (**l'eredità fra sessioni**: il
numero di sessione era fermo da *quindici* sessioni e il boot **taceva**; una chiusura uccisa
era indistinguibile da una riuscita; il verdetto del cancello non veniva letto all'avvio).

**La lezione più cara**: l'aggancio del cancello è fallito **due volte restituendo `exit 0`**.
Verificarlo rileggendo il codice l'avrebbe dichiarato fatto, e sarebbe stato falso due volte.

## Top priorities — le priorità

1. **`#227` — le 4.464 competenze isolate nel grafo, il 31,8% del catalogo.** Era il residuo
   `F6-07` di `#222`, chiusa promettendo «un piano proprio» **mai creato**: lavoro orfano per
   tre giorni, invisibile a ogni elenco. Ha 5 fasi, e la prima è un **censimento per specie** —
   un elenco piatto di 4.464 righe non è un piano di lavoro.
   → `.programmi/227-competenze-isolate-nel-grafo.md` · ~2-3 sessioni
2. **`verifica_incrociata` è ROSSA, e nessuno sapeva da quando.** 10 verifiche con difetti, la
   più grossa da **667 casi** (requisito di competenza non coperto). Va **classificata** prima
   di diventare lavoro: alcune righe saranno difetti veri, altre la normalità di un'azienda
   vera mal classificata dallo strumento. Ora il cancello a tempo la esegue a ogni chiusura.
   → nessun piano ancora · da decomporre
3. **`#219` F5 — la corsa che chiude la voce.** Quattro fasi su cinque fatte e verificate live;
   resta la corsa integrale della suite (100 spec, build di produzione) con **zero falliti**.
   Non è correzione: è tempo di macchina, e va aperta con spazio davanti.
   → `.programmi/219-otto-guasti-suite-e2e.md` · ~20k, in gran parte attesa

## Open questions — le domande aperte

1. **Quattro voci aspettano un tuo input e non portano alcuna data**: `#85` `#8` `#16` `#52`.
   Non si sa da quanto aspettano, e potrebbero essere già risolte — è successo a `#86`, che
   chiedeva il login su due macchine e su una funzionava già. Le verifico io una per una?
2. **Il fornitore di proposte non è configurato in produzione** (`RESEARCH_GATEWAY_URL` /
   `_TOKEN` nel `.env`, che è tuo). Finché mancano, l'API dice «non c'è chi propone».
3. **Sulla VM resta una vecchia unit di servizio accanto a quella viva**
   (`heuresys-advanced-web.service.dev.bak`, in modalità sviluppo). È **inerte** — verificato —
   ma è configurazione di un servizio di produzione. Si sposta, si tiene, o si lascia?

## Verification — la verifica

```bash
python docs/kb/tools/session_start.py            # menu + salute, un giro solo
python docs/kb/tools/check_marciume.py           # cio' che marcisce senza produrre un diff
python docs/kb/tools/guardiano.py                # contesto e finestra 5h, misurati
bash scripts/close-log.sh report                 # corse interrotte ereditate
```
