# 216 — Il passaggio di consegne fra sessioni: il menu spiega, e l'avanzamento si deriva

> **item**: #216
> **stato**: CHIUSO

Nasce da Enzo, 2026-08-18: *«il tuo handoff è gestito molto male e in modo incompleto e non
chirurgico. Il menu di azioni all'apertura è criptico, non spiega bene le azioni, non delinea
chiaramente priorità e cronologie ottimali, non dà istruzioni chiare su cosa è stato interrotto
nella sessione precedente»*.

La causa non è il menu: è che **l'avanzamento di una voce vive ricopiato in cinque posti**
(titolo, effort, corpo, STATE, piano) invece che derivato da uno. È il ⭐ PUNTO FISSO applicato
al register — un dato che varia non si scrive come fatto, si scrive il modo di produrlo.

## Decisioni vincolanti (prese, non si ri-chiedono)

1. **L'ordine non è negoziabile: F1 → F2 → F3.** Un menu che spiega leggendo da fonti che non
   esistono racconterebbe meglio la stessa cosa vecchia. E un menu che spiega senza **vedere**
   tutte le voci le spiegherebbe bene tacendone due.
2. **Il piano è la fonte dell'avanzamento, il register è la fonte dell'identità.** `.programmi/`
   dice *dove siamo*; `SOT_BACKLOG.md` dice *cos'è, quanto vale, cosa la blocca*. Nessun numero
   di avanzamento si scrive nel register — T1 lo vieta già.
3. **Anche una voce mono-sessione ha un piano.** Non perché serva a spezzarla, ma perché è il
   posto dove «cosa è fatto / cosa manca / da dove si riprende» esiste in forma leggibile da uno
   strumento. Senza, il menu può solo elencare.
4. **Una voce continuativa (#79, #149, #214) ha per fasi i prossimi passi concreti**, non un
   ciclo infinito. Quando la coda si svuota si aggiungono i successivi: è la forma che soddisfa
   la sostanza, non solo il controllo di integrità.
5. **Un id non numerico si aggancia lo stesso** (`Z-251`). La normalizzazione dell'id vive in
   **una** funzione condivisa, importata dagli strumenti che ne hanno bisogno: tre copie della
   stessa regola sono il difetto che questa voce racconta.

## Misura di partenza (2026-08-18, S1069 — comandi, non memoria)

```bash
python docs/kb/tools/handoff_lint.py          # register: quante ACTIVE il menu VEDE
python docs/kb/tools/programmi.py --verifica  # quanti piani, e se sono integri
ls .programmi/*.md                            # per quali voci esiste un piano
```

- **16 ACTIVE viste dal menu, 18 nel file**: `#50` e `#69` hanno una parentetica in corsivo fra
  il titolo e `· status:`, e `parse_register_items` non le riconosce → **invisibili al menu**.
  `#50` ha perfino un programma aperto `[1/3]` che il boot stampa in una sezione diversa.
- **11 delle 16 ACTIVE non hanno piano**: `#211 #216 #215 #205 #197 #198 #181 Z-251 #149 #214 #79`.
  Ce l'hanno: `#132 #142 #143 #159 #54`. Due piani sono di voci ormai `DONE` (`#92`, `#99`).
- **T2 ne vede solo 3** (`#149 #198 #214`): filtra sull'effort e le mono-sessione non lo passano.
- **`INTERRUPTED` usato 0 volte su 200 voci**, pur avendo la cima del menu riservata.

## Fasi

- [x] **F0 La misura e il piano** — FATTO 2026-08-18 · 16 ACTIVE incrociate coi piani, 2 voci invisibili al parser trovate, budget verificato (`guardiano.py --budget 200000` → «si continua») · evidenza: questo file
- [x] **F1 Il menu deve VEDERE tutte le voci ACTIVE** — FATTO 2026-08-18 · register 16→18 ACTIVE, `#50` e `#69` ora nel menu col titolo pulito · cancello `S5` provato capace di fallire: col parser storico nomina esattamente le 2 righe perse, con quello di oggi 0
      Il parser tollera testo fra il titolo e lo stato; il titolo resta il nome. Il cancello che
      impedisce la ricaduta non guarda la causa: confronta ciò che un umano legge come voce con
      ciò che il parser produce, e pretende che i due numeri coincidano.
- [x] **F2 Ogni voce ACTIVE ha il suo piano** — FATTO 2026-08-18 · 20 programmi, `programmi.py --verifica` verde e selftest 16/16 · `T2` **18/18 ACTIVE coperte**, provato capace di fallire nascondendo il piano di `#215`
      Dodici file nuovi (undici misurati + `#69`, che T2 ha trovato solo dopo F1), contenuto
      **spostato** dai corpi delle voci, non inventato. `normalizza_id()` vive in `programmi.py`
      e la importano `handoff_lint.py` e `build_menu.py`: `Z-251` si aggancia come `#216`.
- [x] **F3 Il menu spiega invece di elencare** — FATTO 2026-08-18 · ogni voce ACTIVE porta «N/M fatte · riprendi da <fase>», derivato da `.programmi/`; il blocco di una fase compare come ⛔; menu 59 righe (guardia ~90). Ripuliti i 5 effort che ricopiavano l'avanzamento
      Per ogni voce: cosa è fatto · cosa manca · da dove si riprende · cosa la blocca. Derivato
      dal piano e dal register, mai ricopiato.
- [x] **F4 T2 diventa bloccante, e l'interruzione si dichiara** — FATTO 2026-08-18 · `T2` è FAIL e verde su 18/18 · `T1` esteso agli effort e `S6` (INTERRUPTED senza `resume-from`) nuovi, entrambi provati capaci di fallire · prova INTERRUPTED eseguita su `#215` e **ritirata**
      La prova ha mostrato più di quanto chiedeva: il register diceva «resume-from: F2, F1 fatta»
      e il piano «0/4 fatte, riprendi da F1» — la discordanza fra le due fonti è visibile a occhio
      nel menu, ed è il motivo per cui la riga derivata sta anche nella corsia INTERRUPTED.

## Simulazione (le cinque domande, per fase — R24 §3)

**F1** · *precondizioni*: `handoff_lint.py` e `build_menu.py` condividono già il parser, quindi
c'è un solo posto da toccare. · *meccanismo*: `parse_register_items` — la regex pretende lo stato
subito dopo il titolo in grassetto. · *propagazione*: nessun artefatto nuovo, il file è
versionato e arriva ai cloni col repo. · *chi*: io. · *guardia*: il cancello nuovo deve uscire
**rosso adesso** (2 righe perse) e verde dopo; se nascesse verde misurerebbe altro.

**F2** · *precondizioni*: F1 fatta, o due dei piani sarebbero per voci che il menu non mostra. ·
*meccanismo*: `programmi.py` legge l'intestazione dell'item e il blocco delle fasi; `--verifica`
esce 1 sui difetti. · *propagazione*: `.programmi/` è versionato, come i piani esistenti. ·
*chi*: io — il contenuto sta nei corpi delle voci. · *guardia*: `--verifica` dopo ogni file, non
alla fine: uno stato dichiarato che contraddice le spunte va visto subito.

**F3** · *precondizioni*: F2 fatta per tutte e 11, o il menu spiegherebbe a macchia di leopardo. ·
*meccanismo*: `build_menu.py` importa `programmi.carica()` e incrocia per id. · *propagazione*:
`session_start.py` chiama `build_menu.py`, quindi il boot cambia da sé. · *chi*: io. · *guardia*:
il menu non deve allungarsi al punto di essere illeggibile — una sola riga di avanzamento per
voce, e la prova è che il boot resti sotto le ~90 righe.

**F4** · *precondizioni*: F2 fatta (T2 a zero), o il cancello nasce rosso e insegna a non
guardarlo (#194). · *meccanismo*: `check_titoli_derivati` — l'avviso diventa un errore
bloccante. · *propagazione*: il cancello gira a ogni boot e a ogni chiusura. · *chi*: io. ·
*guardia*: la prova `INTERRUPTED` si esegue **e si ritira** nella stessa sessione: una voce
lasciata `INTERRUPTED` per finta sarebbe una bugia nel register.

## Confine di sessione

Le quattro fasi stanno in **questa** sessione: budget ~195k contro un residuo misurato di 625k
(`guardiano.py --budget 200000` → «si continua»). Se il guardiano dovesse superare le soglie, si
interrompe alla fase in corso, la si marca `INTERROTTO al punto <X>` qui sopra, e la voce diventa
`INTERRUPTED` nel register — che è per l'appunto ciò che questa voce costruisce.
