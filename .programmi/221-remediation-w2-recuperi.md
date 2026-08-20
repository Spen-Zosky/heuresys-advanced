# 221 — Remediation forense W2 · Recuperi

> **item**: #221 · **priorità**: P1 · **stima**: ~80-120k token
> **stato**: CHIUSO
> **capofila**: `.programmi/220-remediation-dossier-forense.md` — lì stanno fonte, verifiche
> S1075, decisioni di Enzo e il **metodo vincolante** per ogni voce. Non si ricopia qui.

## ⚠ Il piano è cambiato il 2026-08-20, e questa sezione dice perché

La stesura precedente diceva: *«NACE e il crosswalk sono spariti per un effetto collaterale
(`CASCADE`), non per una decisione»*. **È falso, e la misura lo ha mostrato.**

Li ha rimossi `db/migrations/000211_deprecate_legacy_activity_schemes.sql`, del 2026-07-23,
una deprecazione **deliberata** — archivio in `audit.*`, `DELETE` esplicite in ordine, e una
post-condizione fail-loud che pretende zero righe legacy. La sua intestazione porta l'evidenza,
da Eurostat KS-GQ-24-007 / EUR-Lex NACE Rev 2.1 / ISTAT ATECO 2025:

- **ATECO_2025 è conforme a NACE Rev 2.1 e identico fino al 4° digit PER COSTRUZIONE** ⇒
  *«il crosswalk non aggiunge informazione»*;
- lo scheme `NACE` legacy era un **ibrido incoerente**: divisione 45 abolita in 2.1, 18 gruppi
  Rev-2 inesistenti in 2.1, sezione extraterritoriale duplicata su U e V;
- lo scheme `ATECO` legacy era un import parziale L5-L6, **interamente duplicato** da ATECO_2025;
- **referenze business: zero**.

Il dossier forense ha misurato la sparizione (vera) e ne ha dedotto una perdita (falsa). La
decisione di Enzo del 2026-08-20 — *«si ripristinano»* — nasceva da quella lettura.

## Decisione di Enzo, 2026-08-20 (dopo aver visto l'evidenza di 000211)

> **Il crosswalk si DERIVA da ATECO_2025, non si importa dai CSV.**

Cioè: nessuna riga rientra dal materiale di recupero, e l'ibrido `NACE` legacy **non torna**.
Ciò che serve si **costruisce dai dati che `sys.*` già contiene** — che è esattamente quel che
I12 impone, e che qui è anche la strada tecnicamente migliore.

**Come è possibile senza toccare 000211**: la deprecazione cancella gli scheme `'NACE'` e
`'ATECO'`, e la sua post-condizione conta quelli. Lo scheme derivato si chiama **`NACE_REV_2_1`**
— nome già ammesso dal `CHECK` della tabella, e diverso dai due. `000211` non lo vede, non lo
cancella, non fallisce. Nessun file da emendare, nessuna oscillazione a ogni deploy.

## Le misure che reggono il piano (2026-08-20, sul vivo)

| cosa | misura |
|---|---|
| `sys_activity_classifications` | **3.257** righe, **un solo** scheme: `ATECO_2025` |
| per livello | L1 22 · L2 87 · L3 287 · L4 651 · L5 920 · L6 1290 |
| struttura NACE 2.1 (L1-L4) | **1.047** righe derivabili |
| estensioni nazionali (L5-L6) | **2.210** righe, che in NACE non esistono |
| forma dei codici | `01.1` → `01.11` → `01.11.0` → `01.11.00`: il 4° digit si ottiene troncando |
| mapping | entrambe le tabelle a **0** righe; le 4 FK ora `RESTRICT` (#220 F1) |

**Dove il crosswalk aggiunge informazione davvero**: sulle 2.210 righe nazionali L5/L6, che non
hanno un corrispondente NACE proprio e vanno ricondotte alla loro classe. Sui livelli 1-4 la
corrispondenza è identitaria — e va scritta lo stesso, perché un consumatore che chiede «qual è
il NACE di questo codice» deve avere risposta per qualunque codice, non solo per metà.

## Fasi

- [x] **F1 Lo scheme NACE 2.1, derivato e non importato** — FATTO 2026-08-20 · mig 000341 · 1.047 righe in prod · divisione 45 abolita: **0 trovate** · scheme legacy: 0 · budget ~35k · rilievo `F7-04`
      1.047 righe (L1-L4 di ATECO_2025), con id `uuid_generate_v5` deterministico e gerarchia
      ricostruita dai `parent_code`. Non è una copia: è la **proiezione europea** del catalogo
      italiano, che per costruzione coincide con esso fino al 4° digit.
      **fatto =** 1.047 righe misurate · 0 nodi orfani (ogni `parent_code` esiste) · nessuna
      delle 18 voci abolite in 2.1, perché non esistono in ATECO_2025 e quindi non possono
      entrare.
- [x] **F2 Il crosswalk, per troncamento** — FATTO 2026-08-20 · mig 000341 · 3.257 corrispondenze (1.047 EXACT + 2.210 BROADER) · 0 orfani nei due versi · casi noti verificati: `A→A`, `01.11→01.11`, `01.13.11→01.13` · budget ~30k · rilievo `F7-01`
      3.257 corrispondenze `ATECO_2025 → NACE_REV_2_1`: identitarie fino al 4° digit, al padre
      di livello 4 per le 2.210 nazionali.
      **fatto =** 3.257 righe · **0 orfani in entrambi i versi** · ogni riga ATECO ha esattamente
      una NACE · l'impronta si ri-deriva dai dati, non da un file esterno (è la prova che nulla
      è stato importato).
- [x] **F3 La datazione onesta dei vettori ricalcolati** — FATTO 2026-08-20 · **rilievo SMENTITO**: 14.036/14.036 impronte combaciano, 0 stantii · la tracciabilità non è mai stata `created_at`, è `source_text_hash` · mig 000342 installa la sentinella `sys.v_embedding_impronta_non_combacia` (24/24 a zero) · prova: 0→1→0 cambiando un testo senza ricalcolare · budget ~15k · rilievo `F7-02`
      Gli embedding portano `min = max = 2026-06-06` mentre il testo da cui derivano è cambiato
      dopo: la data dice quando è girato il calcolo, non a cosa si riferisce. O si registra la
      provenienza reale, o si dichiara per iscritto che quel timestamp non è tracciabilità.
      **fatto =** tracciabilità misurabile — data una riga, si sa da quale testo viene.
- [x] **F4 Le due misure che possono smentire il dossier** — FATTO 2026-08-20 · **nessun lavoro conseguente, per misura** · F7-03: 92 moduli, **0 food/energy** (i 59 corsi non esistono più); 0 assegnazioni prive di riferimento — le 1.990 «orfane» puntano a un *percorso*, la FK è `SET NULL` · F7-06: 16 famiglie professionali + 176 ruoli = i numeri del referto 27, nomi in italiano e coerenti con FIN_BANKING (I21) · budget ~25k · rilievi `F7-03`, `F7-06`
      Nessuna delle due è una correzione: sono **misure** il cui esito decide se c'è lavoro.
      · **F7-03** — chiusura documentale delle purghe deliberate (mig `000197`, `000200`, `000235`,
        `000241`). In più: **i 59 corsi food con 199 assegnazioni esistono ancora?** Se sì, è una
        domanda per Enzo (I21: contenuto senza un'industry che lo ospiti), non una cancellazione.
      · **F7-06** — famiglie e ruoli rimaneggiati (referto 27 del vault): **confermato o smentito
        con una misura**, e va bene entrambe le cose.
- [x] **F5 Il clone di CI riallineato, dopo i recuperi e non prima** — FATTO 2026-08-20 · `scripts/clone-vm-db.sh` (non `db/scripts/`: il piano sbagliava il path) · locale=VM su 161 utenti / 315 posizioni / 118.360 presenze, 13 voci di censimento identiche · `ci-rehearsal.sh` VERDE **dopo** il refresh · budget ~10k · rilievi `F8-11`, `F8-12`
      `bash db/scripts/clone-vm-db.sh`. Va **per ultimo**: rinfrescare prima copierebbe un
      database senza il crosswalk, e la CI misurerebbe il passato.
      **fatto =** conteggi di `heuresys_ci` allineati alla produzione, e `ci-rehearsal.sh` verde
      **dopo** il refresh (→ memoria `ci_clone_lacks_script_imported_data`).

## Le prove che devono poter fallire

- **F1/F2** — il conteggio da solo non prova niente: 1.047 righe sbagliate contano 1.047. La
  prova è che ogni riga NACE derivata **coincida** con la sua ATECO di pari codice, verificata
  per confronto e non per fiducia nella `INSERT ... SELECT`.
- **F2** — «0 orfani» va misurato **nei due versi**: una corrispondenza può puntare a una NACE
  inesistente, oppure lasciare scoperta una riga ATECO che dovrebbe averne una.
- **F2** — la prova che il troncamento è giusto **non** è che produca 3.257 righe: è che una
  riga di livello 6 finisca sotto la classe **giusta**. Si verifica su casi noti
  (`01.13.11 → 01.13`), non sul totale.
- **F5** — un clone con i conteggi giusti può essere inutilizzabile: la prova è `ci-rehearsal.sh`
  verde dopo il refresh, perché le tabelle popolate da script arrivano vuote.

## Chiuso quando

`NACE_REV_2_1` e il crosswalk sono in produzione **derivati** (nessuna riga importata da fuori),
`heuresys_ci` è allineato, e i rilievi `F7-01`, `F7-02`, `F7-03`, `F7-04`, `F7-06`, `F8-11`,
`F8-12` sono aggiornati nel registro datastore — con `F7-01`/`F7-04` chiusi **nella forma
derivata**, e la ragione scritta per cui l'ibrido legacy non è tornato.
