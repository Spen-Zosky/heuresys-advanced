# GOV — cosa resta da fare (scritto a mano, S1052, 2026-08-09)

> Questa e' la parte che una macchina non puo' dedurre: le decisioni prese, cosa e'
> rotto, e il prossimo comando. Il resto del rientro si rigenera da solo con
> `python docs/kb/tools/gov_rientro.py`.

## Regola d'ingaggio, decisa da Enzo e non negoziabile

1. **Il freno lo toglie solo Enzo**, e una corsa alla volta. Chi riprende NON lo tocca
   di propria iniziativa: chiede.
2. **Un lavoratore committa sul proprio ramo e basta.** Non trasferisce su main, non
   fa operazioni su GitHub. Il controllo finale e la chiusura sono di gov.
3. **Eseguire ≠ programmare.** Un lavoratore puo' e deve *scrivere* che gov dovra' fare
   un merge, un DROP, un deploy. Non deve poterli *eseguire*. I controlli non si
   allarmano per un verbo citato: si allarmano per un verbo eseguito.
4. **Ciclo verifica-correggi fino in fondo**: non ci si ferma sapendo che qualcosa non
   funziona.

## Dove siamo — fine S1052, 2026-08-10

**LA CORSA A DUE LAVORATORI E' AVVENUTA.** `--lane full-presidiata`, 22:40→23:09 del
2026-08-09: due lavoratori in parallelo su due cluster di classe A con perimetri
disgiunti, **1728 s contro i 3162 s che sarebbero serviti in fila = guadagno 1,83x**
(il piano stimava 1,4-1,6x). Costo 16,24 $.

**Come si e' sbloccata** (decisione di Enzo): il freno pretendeva `Z-250` chiuso, `Z-250`
pretende una corsa presidiata conclusa, la corsa la fa il driver, il driver era fermato dal
freno. Un cerchio che pretendeva l'effetto prima della causa. Il freno si chiama
`meta.autorizzato_non_presidiato` e ora governa esattamente quello: la corsia
`full-presidiata` non passa da quel cancello, **ogni altra si'** — provato nelle due
direzioni (`safe` -> exit 3, `full-presidiata` -> passa).

**Cosa ha prodotto: zero cluster chiusi, ed e' il verdetto giusto.**
`Z-112` ROSSO per **1 prova su 2** (ADR-0026) — lavoro completo, committato, perimetro
rispettato, typecheck e lint verdi, 1509 test passati. `Z-221` con un file non committato.
**Il processo ha giudicato invece di cedere.** E un lavoratore si e' rifiutato di
dichiarare chiuso un lavoro finito, perche' non aveva potuto far girare i tre revisori:
ha preferito fermarsi che millantare.

**Il rosso sui test era ambientale, verificato non assunto**: 1509 passati, zero falliti,
**un solo file caduto** (`seed-acquisition`, `connect timeout`); rieseguito da solo **5/5
verde**. E' `Z-251` (contesa sul DB condiviso), non un difetto del lavoro.

## I quattro test [a mano] di Z-250

| test | esito |
|---|---|
| bootstrap che non ri-censisce | **superato** — zero censimenti |
| freno tirato a meta' lavoro | **superato in entrambe le meta'** — STOP a lavoro avviato: hanno FINITO invece di essere uccisi; al rilancio il driver si e' fermato |
| troncamento da budget | **NON PROBANTE** — il tetto ha contenuto la spesa (10,96/12 · 5,28/12 · 0,95/1) ma il taglio a meta' lavoro non e' stato osservato |
| frontiere della description | **superato 8/8**, con 3 controlli negativi |

## Cinque difetti strutturali trovati CORRENDO (nessuna batteria li vedeva)

1. il driver si bloccava con il rapporto che scrive lui — `.zp/PROGRESS.md` e' tracciato e
   riscritto a ogni giro, quindi **due corse consecutive erano impossibili**;
2. il recinto **fermava il lavoro DENTRO il perimetro**: non seguiva i `cd`. 2 rifiuti su 4
   erano falsi;
3. il rientro contava **zero azioni** su lavoratori con 135 e 133;
4. la batteria della guardia era **rossa** (44/5) — ora 50/0, con un test nuovo che fallisce
   se il diario tornasse dentro l'albero;
5. l'istruttoria accusava di **«nessun diario»** chi ne aveva 135 righe, e il rilievo falso
   finiva nel verdetto accanto a quelli veri.
   In piu': i diari si **accumulavano** fra corse (ora si archiviano).

## Cosa e' successo dopo la chiusura di Z-250 (10 agosto, mattina)

**`#177` corretto**: i verdetti dei tre revisori adversarial vivevano in un workflow che
moriva con la sessione — due corse su due si erano fermate li'. Ora c'e' `zp_review.py`:
i verdetti si registrano una lente alla volta e sopravvivono; il passo 3 comincia da
`stato`, non dal lancio. 13 prove in `scripts/test/zp-review-tests.sh`.
**NON e' ancora provato sul campo**: serve una corsa in cui un lavoratore arrivi davvero
al passo dei revisori.

**`#179`**: gli alberi si fossilizzavano dopo il primo merge. `git pull --rebase` riscrive
i commit, e la guardia li contava per HASH: vedeva «lavoro da perdere» su cio' che era
gia' in main e non allineava piu' l'albero. Il lavoratore della corsa dopo ha letto una
skill vecchia di un giorno. Ora si conta per CONTENUTO (`git cherry`).

**`#180`**: **66 prove erano fuori dal cancello** — `run-shell-tests.sh` raccoglieva i
file di `scripts/test/` solo per `bash -n`. E' la ragione per cui la batteria della
guardia e' rimasta rossa senza che nessuno lo sapesse. Ora girano dentro: 156 ok, 0 fail.

**`#178` chiuso**: il troncamento da budget e' stato **osservato** (12,14$ su un tetto di
12, esito `troncato`). Era l'unico test di Z-250 dichiarato non probante.

## ~~La prossima azione — una sola~~ — FATTA (S1052, 10 agosto)

~~Chiudere `Z-112`~~. **E' chiuso**: seconda prova registrata dal lavoratore, verdetto
**VERDE zero rilievi** (`.zp/verdetti/w1-Z-112-20260810-090053.json`), merge **`b6824e7e`**,
riga 447 del piano spuntata. **`Z-250` e' chiuso con lui.** Piano: **46 chiusi su 262**.

Resta valida la regola: le prove NON le registra gov, gov giudica. Se le scrivesse lui,
giudicherebbe se' stesso.

## Dove siamo davvero — S1053, 10 agosto pomeriggio (misurato, non ricordato)

**Tre cose scritte sopra non erano piu' vere all'apertura di questa sessione**, e le ho
misurate una per una:

1. **Z-112 chiuso**, non «da chiudere» (vedi sopra). Anche `.zp/interrupted.json` lo porta
   ancora come interrotto: e' **residuo, non un difetto attivo** — verificato, non assunto:
   `zp_state.py prossimo` propone `Z-032`, perche' i cluster chiusi sono esclusi da
   `ammesso()` prima che la priorita' agli interrotti si applichi. Quel residuo conserva
   pero' i **7 rilievi adversarial**, che sono l'unica copia leggibile: non cancellarlo
   senza averli portati altrove.
2. **Il cancello di verifica non aveva mai chiuso.** Il verdetto su disco era delle
   **12:37** — quello vecchio e rosso — mentre la corsa lanciata alle 12:38 e' morta con la
   sessione. Il `.zp/suite.lock` e' stato trovato **orfano** (PID 23580 inesistente): e' la
   prova sul campo del rilievo adversarial n.1. Non blocca nulla — `suite-lock.ts` ignora e
   sovrascrive un lock stantio — ma il residuo su disco e' reale.
3. **Ci sono correzioni non committate nel working tree di main**:
   `apps/api/test/drift-check.integration.test.ts`, `apps/api/test/helpers/drift-check.ts`,
   `apps/api/vitest.config.ts` e il nuovo `scripts/test/drift-check-rilascia-il-lucchetto.sh`.
   Sono le correzioni ai 7 rilievi, iniziate e mai chiuse. **Toccano `apps/api`: perimetro di
   un lavoratore, non di gov.** Vanno assegnate o buttate — non lasciate li'.

**La prossima azione, adesso**: `#181` — i 7 rilievi di drift-check — a **un solo**
lavoratore. Terreno `apps/api/test/**` + `apps/api/vitest.config.ts`, che e' lo stesso
perimetro di `Z-112`, classe A. La corsa mette anche alla prova `#177` sul campo, che
nessun lavoratore ha ancora usato.

> ⚠️ **CORREZIONE, misurata dopo aver proposto il contrario tre volte.** `Z-251` **NON e'
> assegnabile a nessun lavoratore**: in `zp.config.yaml` e' **classe D**, e le corsie
> ammettono solo A/B (`safe`) o A/B/C (`full`, `full-presidiata`). Il file lo dice a chiare
> lettere — «D ed E non appaiono in nessuna corsia: non e' una dimenticanza. D richiede
> autorizzazione per lotto» e «il presidio e' una garanzia sul COME si corre, non un
> permesso in piu' sul COSA si tocca». La ragione sta nel suo criterio di chiusura: **due
> corse consecutive della suite mentre gira un `pg_dump` sulla VM di produzione**, cioe'
> ~90 minuti di test piu' un dump su produzione viva. Serve un'autorizzazione di Enzo per
> lotto. Non e' un dettaglio procedurale: e' la differenza fra un lavoro di test e
> un'azione sulla produzione.

**Le tre decisioni aperte, tutte di Enzo** (registrate perche' non si perdano):

1. **`#182`** — i due rami «recuperati» portano **473 righe mai entrate in main**, e uno e'
   il versante **E2E** di `Z-112` (317 righe, zero file in comune col commit che ha chiuso
   il cluster, scritto dieci ore prima). Istruire e portare in main, o archiviare dicendolo.
2. **`Z-251`** — l'autorizzazione per lotto di cui sopra.
3. **`#175`** — riformulata da `#182`: non e' solo «il verde fu dato col cancello cieco», e'
   che **il lavoro di `Z-230` non e' in main**.

## Il freno, adesso

**INSERITO per il non presidiato**, e resta li'. La corsa sorvegliata non ne ha piu'
bisogno. Se il loop debba girare anche NON presidiato e' una decisione di Enzo, e non ha
scadenza.

## Cosa NON e' rotto (verificato, non si ricontrolla)

- recinto sui comandi, divieti assoluti, criterio eseguire/programmare — **49 prove**
- identita' di database in sola lettura (`gov_worker`): `UPDATE`/`DELETE`/`DROP` falliscono
  nel DBMS, provato dall'albero del lavoratore
- consuntivo del perimetro: elenca i file fuori recinto, provato sul caso vero
- diario: 229 azioni registrate nella corsa di collaudo
- guardia sul riallineamento degli alberi: non tocca ne' file non salvati ne' commit propri

## Il lavoro dei lavoratori, dove sta

`gov/w1` e' entrato in main in **due tempi**: il merge `551dd8d0` lo porto' solo fino a
`f5aa771c`, e il commit di `Z-112` (`7eb39abf`) resto' sul ramo; e' arrivato dopo, col
merge **`b6824e7e`**. Gli altri restano sui loro rami: `gov/w2` (0 commit),
`gov/w1-recuperato` e `gov/w2-recuperato` (un commit ciascuno, **mai istruiti** — salvati
dal reflog dopo che un riallineamento aveva cancellato un commit da 5 file e 317 righe).
Quei due rami sono una **voce aperta**: o si istruiscono, o si archiviano dicendolo.

## La plancia — FATTA, 7 voci su 7 (S1052)

L'istruzione di Enzo (sessione `e3112922` riga 1898) e' stata eseguita per intero.
Piano ed esiti misurati: `docs/superpowers/plans/2026-08-09-plancia-gov.md`.
Commit: `3b185b05`, `51ac3eb7`, `3e034f2f`.

- **due ritmi**: `/api/volo` 0,008 s contro `/api/stato` 1,18 s. Prima erano tre
  processi Windows ogni 5 secondi solo per guardare;
- **cinque viste** (Volo · Lavoratori · Piano · Config · Storico) al posto della pagina
  unica, con la scelta che persiste;
- **i lavoratori**: albero, ramo, cluster, azioni, commit, verdetti, rami in attesa;
- **i diari in diretta**, aggiornati nel battito, coi rifiuti del recinto in rosso;
- **la composizione dei cluster** e i perimetri reali;
- **la fascia «in volo adesso»**: quanto tempo dall'ultima azione — il lock dice che un
  driver esiste, non che stia facendo qualcosa;
- **la configurazione**: 10 campi, 4 dichiarati intoccabili, una riga per volta, con
  verifica del piano E coerenza fra campi, e rollback provato su un caso vero.

Il freno NON e' stato duplicato nel cockpit: due posti da cui togliere lo stesso freno
sarebbero due posti da cui sbagliare.
