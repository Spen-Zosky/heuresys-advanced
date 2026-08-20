# 221 — Remediation forense W2 · Recuperi

> **item**: #221 · **priorità**: P1 · **stima**: ~80-120k token
> **stato**: NON AVVIATO
> **capofila**: `.programmi/220-remediation-dossier-forense.md` — lì stanno fonte, verifiche
> S1075, decisioni di Enzo (2026-08-20) e il **metodo vincolante** per ogni voce. Non si ricopia qui.

## Perché esiste, e perché non viola I12

Il rubinetto del brownfield è chiuso (I12): non si importa più nulla dal legacy. **Questo non è
un import dal legacy.** NACE e il crosswalk ATECO↔NACE sono una **tassonomia europea** — cioè
esattamente la materia che I21 tiene aperta a ogni industry — e sono spariti per un effetto
collaterale (`CASCADE`), non per una decisione. La fonte è il materiale di recupero in
`D:\heuresys-datastore\_recupero_20260716\`, non il DB legacy.

**Decisione di Enzo 2026-08-20**: NACE + crosswalk **si ripristinano**.

## ⛔ Ordine vincolante

**F1 e F2 partono solo DOPO F1 di `#220`** (W1.1, le FK da `CASCADE` a `RESTRICT`). Ripristinare
prima significherebbe rifare lo stesso lavoro al primo ritiro di catalogo che passa.

## Fasi

- [ ] **F1 NACE rientra** — budget ~30k · rilievo `F7-04` · ⛔ dopo `#220` F1
      1.066 righe. **Strada preferita**: `reference_sync`, se ha ancora la sorgente — è la casa
      della sincronizzazione ISTAT/ATECO/ESCO e non richiede un file esterno. **Ripiego**: il CSV
      `D:\heuresys-datastore\_recupero_20260716\nace_rev2.csv`, con `-- @migrate: once` e giornale
      di annullamento. La scelta fra le due si fa **misurando** cosa `reference_sync` contiene, non
      per preferenza.
      **fatto =** 1.066 righe misurate **e** gerarchia integra (nessun nodo orfano, nessun ciclo).
- [ ] **F2 Il crosswalk rientra** — budget ~30k · rilievo `F7-01` · ⛔ dopo F1
      5.730 corrispondenze: 3.890 dirette + 1.840 da rimappare su ATECO 2025 per codice. Sorgente
      `crosswalk_ateco_nace.csv` nello stesso materiale di recupero.
      **fatto =** conteggio esatto + **0 orfani** su entrambi i lati + impronta del contenuto
      uguale a quella del CSV (la terza è quella che smaschera un ripristino parziale).
- [ ] **F3 La datazione onesta dei vettori ricalcolati** — budget ~15k · rilievo `F7-02`
      Gli embedding portano `min = max = 2026-06-06` mentre il testo da cui derivano è cambiato
      dopo: la data dice quando è girato il calcolo, non a cosa si riferisce. O si registra la
      provenienza reale, o si dichiara per iscritto che quel timestamp non è tracciabilità.
      **fatto =** tracciabilità misurabile — data una riga, si sa da quale testo viene.
- [ ] **F4 Le due misure che possono smentire il dossier** — budget ~25k · rilievi `F7-03`, `F7-06`
      Nessuna delle due è una correzione: sono **misure** il cui esito decide se c'è lavoro.
      · **F7-03** — chiusura documentale delle purghe deliberate (mig `000197`, `000200`, `000235`,
        `000241`, già misurate S1075). In più: **i 59 corsi food con 199 assegnazioni esistono
        ancora?** Se sì, è una domanda per Enzo (I21: contenuto senza un'industry che lo ospiti),
        non una cancellazione da fare di slancio.
      · **F7-06** — famiglie e ruoli rimaneggiati (referto 27 del vault): **confermato o smentito
        con una misura**, e va bene entrambe le cose.
      **fatto =** registro datastore aggiornato con l'evidenza, in un verso o nell'altro.
- [ ] **F5 Il clone di CI riallineato, dopo i recuperi e non prima** — budget ~10k · rilievi `F8-11`, `F8-12`
      `bash db/scripts/clone-vm-db.sh`. Va **per ultimo**: rinfrescare prima significherebbe
      copiare il database senza NACE e senza crosswalk, e ritrovarsi la CI che misura il passato.
      **fatto =** i conteggi di `heuresys_ci` combaciano con la produzione.

## Le prove che devono poter fallire

- **F1/F2** — il conteggio da solo non prova niente: 1.066 righe sbagliate contano 1.066. Serve
  l'**impronta** del contenuto confrontata con la sorgente, ed è la ragione per cui è nel «fatto =».
- **F2** — «0 orfani» va misurato **nei due versi**: un crosswalk può puntare a un ATECO che non
  esiste, o lasciare scoperto un NACE che dovrebbe essere coperto.
- **F5** — un clone rinfrescato che porta i conteggi giusti può comunque essere inutilizzabile:
  la prova vera è `bash db/scripts/ci-rehearsal.sh` verde **dopo** il refresh (→ memoria
  `ci_clone_lacks_script_imported_data`: le tabelle popolate da script arrivano vuote).

## Chiuso quando

NACE e crosswalk sono in produzione con impronta verificata, `heuresys_ci` è allineato, e i
rilievi `F7-01`, `F7-02`, `F7-03`, `F7-04`, `F7-06`, `F8-11`, `F8-12` sono aggiornati nel
registro datastore.
