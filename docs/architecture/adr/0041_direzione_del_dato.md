# ADR-0041 — La direzione del dato: invariante I23

**Status**: PROPOSTO
**Date**: 2026-09-16
**Decided by**: Enzo Spenuso (regola) · Claude Code CLI (stesura, mandato K)
**Adds**: invariante **I23** del `CLAUDE.md`

---

## Contesto

Heuresys Advanced non è un gestionale di amministrazione del personale: buste paga, contratti,
presenze e documenti d'identità **entrano da fuori** (Zucchetti, SAP, o l'equivalente del
cliente), e la piattaforma li **usa** per i propri scopi — analisi retributiva interna,
configurazione di fisso/variabile, attribuzione premi, metriche. Non li **produce**.

Questa distinzione non era mai stata scritta come regola. Esisteva **per abitudine**: misurato
sulle dodici tabelle amministrative del dossier che ha preceduto questo mandato, **nessuna
interfaccia** scrive contratti, presenze, buste paga o documenti d'identità — zero rotte di
scrittura trovate. Le uniche cinque scritture native su quell'area sono esattamente quelle che la
regola, non ancora scritta, avrebbe già preteso: la richiesta di ferie (gesto della persona), il
movimento del saldo che ne consegue, la raccomandazione retributiva interna, la consegna verso il
gestionale esterno.

> *«Il People Management governa tutti i dati che nascono e si evolvono dentro questa
> piattaforma e che non sono importati da gestionali esterni. Buste paga e dati economici sono
> gestiti fuori ed entrano per altri obiettivi: analisi retributiva interna, configurazione di
> fisso e variabile, attribuzione di premi su obiettivi. La piattaforma non si occupa di paghe e
> contributi, presenze, assenze, ferie: usa quei dati per i propri scopi strategici e di
> metriche.»* — Enzo Spenuso, 2026-09-14

Un'abitudine non è una proprietà: **niente impedisce che domani qualcuno scriva una rotta che
modifichi una busta paga.** Il mandato K (`I-E`, indagine di classificazione) ha misurato che la
piattaforma oggi rispetta la regola pressoché ovunque, ma anche che nessuna riga sa dichiarare da
dove viene, che il registro di provenienza è spaccato in due convenzioni di nome che non si
parlano, e che undici tabelle amministrative non hanno alcuna colonna di origine. La regola era
vera per caso; questo ADR la rende vera per costruzione.

## Decisione

**Ogni tabella `sys.sys_*` che rappresenta un dato del cliente sta in uno e un solo stato:**

| stato | definizione operativa | chi scrive |
|---|---|---|
| **nativo** | scritta da rotte API sotto il permesso di un ruolo di people management | l'interfaccia, dall'azione di una persona |
| **importato** | scritta **solo** da corse di importazione, materializzazione o seed; **nessuna rotta di scrittura esiste**; la colonna di origine è obbligatoria | l'importazione, mai un'interfaccia |
| **ibrido** | il gesto nasce qui (una rotta API scrive), il saldo o il valore che quel gesto muove viene anche da un'importazione | entrambi, su parti dichiarate; la regola del conflitto è **X-4** (mandato K, Fase 5) |

Una quarta etichetta, **infrastruttura**, esiste nella classificazione (`I-E`) ma **è fuori da
questo invariante**: registri tecnici, code, sessioni, cataloghi RBAC non sono dati del cliente —
non hanno una «direzione» da dichiarare.

Il confine dell'**importato** non è un permesso che nega la scrittura: è l'**assenza della
porta**. È la forma robusta del divieto — un permesso si dimentica di negare, una rotta che non
esiste non si scrive per errore.

### Le quattro tabelle dichiarate «importate, porta non ancora costruita» (D6)

Contratti (`sys_user_contracts`), buste paga (`sys_user_pay_slips`), documenti d'identità
(`sys_user_identity_documents`) e profili retributivi di posizione
(`sys_position_compensation_profiles`) sono state popolate dal collaudo e **non hanno nessuna
porta d'ingresso vera** da un gestionale esterno. Per decisione di Enzo (D6=A, mandato K):
restano **importate**, nessuna interfaccia le scrive, e la porta d'ingresso vera si costruisce
quando ci sarà un tracciato reale da un primo cliente — costruirla ora significherebbe indovinare
un formato e rifarlo dopo. Non è un mandato aperto: è una classificazione dichiarata.

### La classificazione di oggi (allegato)

La classificazione completa delle 245 tabelle `sys.sys_*` — misurata, con scrittori file:riga per
ciascuna — è in `.programmi/K-ruoli-direzione/esiti/I-E.md`. In una riga: **nativo 28 · importato
88 · ibrido 97 · infrastruttura 32**. 103 tabelle sono «dubbie» secondo la regola meccanica del
mandato (hanno sia scrittori API sia scrittori di importazione, o righe senza alcuno scrittore
trovato, o sono una delle quattro di D6): le ratifica Enzo riga per riga in **X-1** (Fase 5),
fuori da questa sessione. Fino alla ratifica, la classificazione **proposta** da `I-E` vale come
riferimento di lavoro, non come dato di sistema — `X-1` la deposita come tale
(`sys.sys_classificazione_direzione_dato`).

### Il caso ibrido più delicato: le ferie

`time-off` è l'unico modulo dove le due direzioni si toccano su dati vivi. Le regole di
maturazione arrivano tutte da fuori (contrattuali, CCNL); la richiesta di ferie nasce qui; il
saldo è ibrido — la giacenza iniziale importata, i movimenti dalle approvazioni fatte qui si
sommano. Enzo ha già risposto alla domanda «chi vince in caso di conflitto» (D5, 2026-09-15,
opzione **C**): *l'importazione non tocca mai un saldo che ha un gesto nativo aperto; il
conflitto va in un registro e lo chiude il `DATA_STEWARD`.* La misura di `I-D` (mandato K) dice
che oggi quei conflitti sono **zero**: la regola nasce verde. La sentinella e la migrazione che la
rendono vera sul database sono **X-4** e **X-5** (Fase 5), non questo ADR.

## Conseguenze

1. **`X-1`** deposita la classificazione come dato interrogabile (non un commento in un file),
   con le righe dubbie ratificate da Enzo.
2. **`X-2`** aggiunge la colonna di origine (`origine_dato`) alle tabelle importate/ibride che ne
   sono prive — undici su dodici amministrative, secondo il dossier che precede questo ADR.
3. **`X-5`** è la sentinella che tiene vera la regola: nessuna tabella `importato` riceve righe
   `origine_dato='NATIVO'`, nessuna `nativo` riceve `'IMPORT'`, nessun conflitto ibrido resta
   aperto oltre 30 giorni.
4. **Ogni ruolo nuovo di Fase 4** che scrive dati del cliente eredita questo confine: un ruolo di
   people management (`PEOPLE_MANAGER`, R-6) riceve scrittura sulle tabelle `nativo`, lettura
   sulle `importato`, mai una rotta di scrittura su queste ultime — perché quella rotta non
   esiste, non perché un permesso gliela neghi.
5. **`DATA_STEWARD`** (R-6) nasce come il titolare naturale di ciò che questo ADR chiama
   `importato` e `ibrido`: le corse di importazione, il registro di provenienza, i conflitti
   sugli ibridi.

## Cosa NON cambia

- I dati già importati **restano dove sono**: questo ADR guarda avanti, non riscrive la
  provenienza di ciò che è già in `sys.*` (coerente con ADR-0038).
- `reference_sync` (ISTAT/ATECO/ESCO) non è toccato: è una classificazione esterna ufficiale, non
  un dato di cliente nel senso di questo invariante — è `infrastruttura`/tassonomia aperta per
  I21, non `importato` nel senso HR.
- Nessun connettore verso Zucchetti/SAP nasce da questo ADR (D6): la porta si costruisce quando
  esiste un tracciato reale.

## Come si fa rispettare

Un invariante scritto solo in un documento si aggira per distrazione. La catena di controllo,
costruita dal mandato K:

- `sys.sys_classificazione_direzione_dato` (X-1) — la classificazione come dato, non come prosa.
- La colonna `origine_dato` su ogni tabella importata/ibrida (X-2).
- `sys.v_direzione_del_dato_violata` (X-5) — rossa se una tabella `importato` riceve una riga
  `NATIVO`, se una `nativo` riceve `IMPORT`, o se un conflitto ibrido resta aperto oltre 30
  giorni. Raccolta da `docs/kb/tools/db_health.py`.
- `sys.sys_conflitti_ibridi` (X-4) — il registro dei conflitti sugli ibridi, con `DATA_STEWARD`
  come risolutore.

Finché queste quattro voci (Fase 5 del mandato K) non sono chiuse, l'invariante è **dichiarato**
ma non ancora **sorvegliato**: questo ADR lo dice esplicitamente, perché un ADR che promette una
guardia non ancora costruita e non lo dice è peggio di uno che aspetta.

## Ratifica

Questo ADR nasce `PROPOSTO`. Passa da tre confutatori in sola lettura (workflow `W3` del mandato
K) prima di andare a Enzo; la ratifica si registra in
`.programmi/K-ruoli-direzione/esiti/RISPOSTE_ENZO.md` e porta lo stato ad `ACCETTATO`.
