# D-86 e D-87 — i due cancelli che rompono la chiusura

> **voci**: D-87 (deploy-watch) · D-86 (clone-vm-db) · **poi** #224
> **stato**: piano scritto S1078, simulazione fatta prima di eseguire (R24 §3)
> **confine di sessione**: A e B sono completabili in questa sessione. #224 dipende da
> quanto resta dopo; se non ci sta, si dichiara e non si finge di avvicinarsi alla fine.

## Perché stanno insieme

Nessuno dei due si manifesta a comando: si manifestano **alla chiusura di sessione**, che è
il momento in cui non si ha voglia di aprire un cantiere. D-86 la blocca ogni volta che si
ritira una tabella; D-87 la blocca per sempre se un commit è stato rotto e poi corretto.
Entrambi sono stati aggirati a mano una volta e la causa è rimasta.

---

## Tabella dei deliverable

| id | cosa | chi | fatto = | stato |
|---|---|---|---|---|
| **A1** | D-87 — la prova che riproduce il caso reale, **vista fallire** col codice di oggi | io | il caso nuovo in `run-shell-tests.sh` è ROSSO prima della cura | ✅ `1 fail su 208` |
| **A2** | D-87 — `ci-gate.sh --esiti <sha>`: i nomi dei workflow per esito, sulla stessa seam fixture | io | `--esiti` stampa `STATO nome` per riga; offline, senza rete | ✅ provato con re-run + pending + cancelled |
| **A3** | D-87 — `deploy-watch.sh`: il cancello guarda **l'ultimo esito per workflow**, non ogni commit | io | A1 diventa verde; i due casi #212 restano bloccanti | ✅ |
| **A4** | D-87 — post-condizione: ciò che NON doveva cambiare | io | la sezione #165/#212 intera verde, e la batteria shell completa verde | ✅ **210 ok / 0 failed** |
| **B1** | D-86 — misura sul gemello: la tabella fantasma **sopravvive davvero** | io | tabella creata sul clone, `clone-vm-db.sh` lanciato, tabella ancora lì + FATAL | ✅ `fantasma=1 righe=1`, exit 1 |
| **B2** | D-86 — drop esplicito degli schemi **misurati**, prima del ripristino | io | elenco stampato, `DROP SCHEMA` nome per nome, nessun jolly | ✅ + **B2b non previsto** (sotto) |
| **B3** | D-86 — prova live sul gemello: la fantasma sparisce, il censimento combacia | io | rilancio: tabella assente, censimento OK, exit 0 | ✅ `fantasma_residua=0`, `13 voci identiche`, exit 0 |
| **B4** | D-86 — la guardia regge il caso peggiore (VM muta a dump iniziato) | io | il ramo `dump_rc` dichiara il clone incompleto anche col drop preventivo | ✅ esce **prima** di toccare il DB |
| **C** | #224 — il check che cambia verdetto col fuso | io | secondo il flusso concordato **più** le due correzioni (prova rossa prima; candidati oltre `verify-storia36.sql`) | ✅ **4 fusi verdi sul gemello, 3 in produzione** |

### B2b — il difetto che la misura ha trovato, e che il piano non prevedeva

Il censimento contava le tabelle da `information_schema.tables`, che mostra **solo ciò su
cui chi interroga ha privilegi**. I due lati non interrogano con lo stesso ruolo (VM come
`postgres`, clone come `heuresys`): il confronto non era fra due misure omogenee. Con
l'esca viva e di proprietà di `postgres`, il censimento leggeva `sys.tab=264` su **entrambi**
i lati — cieco — e l'allarme scattò solo perché l'esca aveva un indice (`sys.idx` 788≠787).

**Una tabella ritirata senza indici sarebbe passata verde.** Il guardiano dei ritiri non si
accorgeva dei ritiri. Ora si conta da `pg_class`. Non è una voce nuova del ciclo: è la
regola ⑤ — *le prove devono poter fallire* — applicata alla prova di B1, che senza questo
sarebbe stata un falso verde in attesa.

---

## A — D-87 · Il cancello del deploy

### Cosa fa oggi, letto nel codice (non a memoria)

`scripts/deploy-watch.sh` §3b, dal 2026-08-16 (#212): per **ogni** commit intermedio fra
`LAST_GOOD` e `ARMED` che tocca `DEPLOY_PATHS_RE`, pretende una CI verde. Un commit rosso
nella finestra blocca il rollout, e **la storia non si riscrive**: quel rosso resta per sempre.

Misurato il 2026-08-21 (D-87): `61ea8b90` rotto e **già corretto dal commit successivo**
teneva ferma la produzione a ogni tick.

### La simulazione, cinque domande

- **Precondizioni** — `ci-gate.sh` sa già nominare i workflow rossi (`RED:<nomi>`, riga
  `classify()`); la seam `CI_GATE_FIXTURE` accetta già una **directory** `<sha>.json`, quindi
  il caso «esiti diversi per sha diversi» è esprimibile offline. Verificato: c'è già una
  sezione `#165 — ci-gate non bloccante (75) + deploy-watch armato` con 12 casi.
- **Meccanismo** — la correzione **non** è quella che il registro proponeva. Il registro
  offriva due strade: gate sul solo sha armato (troppo debole — è il buco di #212) oppure
  gate sulla finestra con esenzione per i «rossi superati» (una toppa). La misura dei
  workflow ne mostra una terza, più semplice e più forte di entrambe:

  > **La CI verifica l'ALBERO, non il diff.** Un verde del workflow *W* su un commit *C*
  > certifica l'albero a *C* per intero, antenati inclusi. Quindi serve, per ogni workflow
  > *W* visto nella finestra, **il verde di W sul commit più recente che ha eseguito W**.
  > Un rosso di *W* su un antenato è irrilevante: quell'albero non va in produzione.

  Questa regola **contiene** #212 senza clausole: se `ARMED` è di soli documenti non ha corse
  di codice, quindi il commit più recente che ha eseguito `test-integration` è quello di codice
  sotto — in volo o rosso — e il cancello blocca, esattamente come oggi.
  E **scioglie** D-87: il workflow rotto e poi corretto ha il suo esito più recente verde.
- **Propagazione** — `deploy-watch.sh` e `ci-gate.sh` stanno sotto `scripts/`, che è dentro
  `DEPLOY_PATHS_RE` e dentro i trigger di `shell-tests.yml`: viaggiano con `align-clones` e
  vengono provati dalla CI. Nessun artefatto fuori dal repo.
- **Chi** — io, per intero. Nessun input di Enzo.
- **Guardia** — il rischio della cura è il suo opposto: **trasformare un rosso in un verde**.
  Perciò i due casi #212 valgono più del caso nuovo, e la prova A1 va vista rossa prima.

### ⚠ Un test esistente cambia esito, e va detto

Il caso `#212 gemello: sha armato verde ma codice ROSSO nella finestra => esce 1` usa lo
**stesso** nome di workflow (`"a"`) per il commit armato e per l'intermedio. Letto alla
lettera, descrive: *«il workflow a è stato rosso su un albero vecchio e verde su quello
finale»* — cioè **il caso di D-87**, non quello di #212. Con la regola nuova quel caso
deploya, ed è la risposta giusta.

Non si tocca un test per farci passare il proprio codice: si **aggiunge** accanto il caso
#212 fedele alla realtà — `ARMED` verde su `state-lint`, intermedio rosso su
`test-integration`, nomi distinti come in produzione — e si pretende che quello resti
bloccante. Il valore di #212 non si perde: si misura su una fixture che descrive davvero
ciò che è successo il 2026-08-16.

---

## B — D-86 · Il clone che non riflette i ritiri

### Cosa fa oggi, letto nel codice

`pg_restore --clean --if-exists` droppa **solo gli oggetti presenti nel dump**. Una tabella
ritirata dalla produzione non è più nel dump, quindi nel clone **sopravvive**: il clone
diventa un sovrainsieme della sorgente. Il censimento finale — che è giusto — vede
`sys.tab` e `sys.idx` diversi e dichiara `FATAL`, e `close-propagate.sh` non arma.

Lo script **droppa già `staging` a mano**, per un difetto gemello scoperto in S1050
(una funzione di troppo, firma vecchia): il precedente c'è, ed è la direzione giusta.

### La simulazione, cinque domande

- **Precondizioni** — il gemello è su (`enzo-S550CM`, up 23h). Il DB locale del gemello
  esiste. Il tunnel verso PROD è su.
- **Meccanismo** — si estende alla radice ciò che `staging` ha già: droppare gli schemi
  **prima** del ripristino, così il clone è una copia e non una sovrapposizione. Gli schemi
  **si misurano**, non si scrivono a mano: misurati adesso in produzione sono
  `audit · public · reference_sync · staging · sys`, ma un elenco cristallizzato qui
  invecchierebbe al primo schema nuovo (⭐ IL PUNTO FISSO). L'elenco si deriva dai due lati,
  **si stampa**, e si droppa **nome per nome** — nessun jolly.
- **Propagazione** — `clone-vm-db.sh` sta in `scripts/`: viaggia con `align-clones`, ed è
  provato da `shell-tests.yml`. Il gemello lo esegue via unit systemd.
- **Chi** — io. Serve solo che il gemello resti acceso.
- **Guardia** — il caso limite è **la VM muta a dump iniziato**: col drop preventivo il clone
  è già distrutto. Ma è esattamente la condizione che `--clean` produce già oggi (lo script
  lo dichiara: *«Il DB locale è stato droppato da --clean e ora è INCOMPLETO»*), e il ramo
  `dump_rc` esce non-zero dicendolo. Il drop preventivo **non introduce** un rischio nuovo:
  allarga di pochi secondi una finestra che esiste già, su un oggetto **riproducibile per
  definizione** — è un clone, si rifà. Un guard che va **verificato**, non ereditato: B4.
- **Rollback** — non serve un giornale `*_undo`: l'oggetto è un clone, e il rimedio è
  rilanciare lo script. La ragione è dichiarata qui, come vuole il metodo (④d).

---

## C — #224, dopo A e B

Flusso confermato con Enzo, ordine obbligato **1 misura → 2 sana dati + generatore →
3 fissa il fuso**. Due correzioni concordate:

1. la prova a doppio `TimeZone` si costruisce **prima** e la si vede **rossa** su C2g;
2. il censimento dei candidati non si ferma a `verify-storia36.sql` (63 cast `::date`
   misurati; `verify-storia36-dossier.sql` ne ha 0): vanno guardate anche le viste
   sentinella `sys.v_*`, di cui una è rossa stasera.

---

## Fuori da questo ciclo (registro separato — R24 §5)

- La sentinella `v_incarico_attivo_senza_contratto` (1 riga) — **presentata una volta**: se
  risultasse fuso-dipendente rientra in C, altrimenti è una voce nuova da proporre.
- I derivati superati (2/3) — un comando, si esegue in chiusura.
