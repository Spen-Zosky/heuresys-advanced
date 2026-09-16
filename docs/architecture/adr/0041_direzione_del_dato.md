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
interfaccia** scrive contratti, presenze, buste paga o documenti d'identità (`sys_user_contracts`,
`sys_user_pay_slips`, `sys_user_identity_documents`, `sys_position_compensation_profiles`) — zero
rotte di scrittura, verificato di nuovo qui con perimetro dichiarato: `rg --no-ignore --hidden`
su `apps/api/src` **e** `apps/web/src`, file gitignored inclusi. Le uniche cinque scritture
native su quell'area sono esattamente quelle che la regola, non ancora scritta, avrebbe già
preteso: (1) la richiesta di ferie nasce qui — `INSERT sys_time_off_requests`
(`time-off/repository.ts:408`); (2) il saldo si muove quando la richiesta è approvata —
`UPDATE sys_time_off_balances` (`time-off/repository.ts:441`); (3) il movimento resta come
traccia di quel gesto — `INSERT sys_leave_balance_transactions` (`time-off/repository.ts:467`);
(4) l'analisi retributiva interna — `INSERT sys_compensation_recommendations`
(`compensation/repository.ts:348`); (5) la consegna verso il gestionale esterno, cioè il confine
stesso — `INSERT sys_payroll_handoff_records` (`compensation/repository.ts:423`).

⚠ **Un'eccezione reale e già raggiungibile, non ipotetica**: `POST /v1/gdpr/users/:userId/erasure`
(`gdpr/routes.ts:69-71`, permesso `gdpr:erase`) esegue `DELETE FROM "<schema>"."<table>"`
(`gdpr/repository.ts:226`) su ogni tabella del registro `sys.sys_gdpr_data_map` con strategia
`DELETE` — e `sys_user_identity_documents` ce l'ha (`sys_user_contracts` e `sys_user_pay_slips`
hanno invece `RETAIN`). `gdpr:erase` è concesso oggi a `PLATFORM_ADMIN`, `TENANT_ADMIN` **e
`HRMS_MANAGER`** (misurato sul vivo): un ruolo di people management può, oggi, cancellare righe
di una tabella `importato`. Non è la stessa cosa di scrivere o modificare un dato — è una
cancellazione per diritto GDPR, orizzontale a tutte le tabelle mappate, indipendente da I23 — ma
la frase «zero rotte di scrittura» va letta per quello che è: zero rotte di creazione o modifica
**ordinaria**. La cancellazione GDPR resta fuori da questo invariante e non lo contraddice
(cancellare una riga importata non la rende nativa), ma questo ADR la nomina invece di lasciarla
implicita in un «mai» che non è letteralmente vero.

> *«Il People Management governa tutti i dati che nascono e si evolvono dentro questa
> piattaforma e che non sono importati da gestionali esterni. Buste paga e dati economici sono
> gestiti fuori ed entrano per altri obiettivi: analisi retributiva interna, configurazione di
> fisso e variabile, attribuzione di premi su obiettivi. La piattaforma non si occupa di paghe e
> contributi, presenze, assenze, ferie: usa quei dati per i propri scopi strategici e di
> metriche.»* — Enzo Spenuso, 2026-09-14

Un'abitudine non è una proprietà: **niente impedisce che domani qualcuno scriva una rotta che
modifichi una busta paga.** Il mandato K (`I-E`, indagine di classificazione) ha misurato che la
piattaforma oggi rispetta la regola pressoché ovunque, ma anche che nessuna riga sa dichiarare da
dove viene e che il registro di provenienza è spaccato in due convenzioni di nome che non si
parlano. La regola era vera per caso; questo ADR la rende vera per costruzione.

⚠ **Il numero «dodici tabelle amministrative» del dossier che precede questo mandato non è
verificabile**: la sola fonte che lo scrive (`docs/kb/COWORK_INBOX.md:878`) ne nomina
esplicitamente solo sette — `sys_user_contracts`, `sys_attendance`, `sys_user_pay_slips`,
`sys_user_identity_documents`, `sys_compensation_bands`, `sys_position_compensation_profiles`,
`sys_leave_accrual_rules` — e nessun file del mandato K enumera le altre cinque. Su queste sette,
ri-misurato: **solo `sys_attendance` ha colonne che dichiarano l'origine**
(`attendance_source`/`attendance_source_reference`); le altre sei no. Questo ADR non ripete
«undici su dodici»: dichiara le sette tabelle verificabili e il fatto misurato su quelle, non un
totale che nessun documento sa ricostruire.

## Decisione

**Ogni tabella `sys.sys_*` che rappresenta un dato del cliente sta in uno e un solo stato:**

| stato | definizione operativa | chi scrive |
|---|---|---|
| **nativo** | scritta da rotte API sotto il permesso di un ruolo di people management | l'interfaccia, dall'azione di una persona |
| **importato** | scritta **solo** da corse di importazione, materializzazione o seed; **nessuna rotta di creazione o modifica ordinaria esiste** (la cancellazione GDPR è l'eccezione nominata sopra); la colonna di origine è obbligatoria | l'importazione, mai un'interfaccia |
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

`I-E` (mandato K, 2026-09-15 03:31) ha classificato **245 tabelle su 245 attese in quel
momento**, con scrittori file:riga per ciascuna — l'esito completo è in
`.programmi/K-ruoli-direzione/esiti/I-E.md`. In una riga: **nativo 28 · importato 88 · ibrido 97 ·
infrastruttura 32**. 103 tabelle sono «dubbie» secondo la regola meccanica del mandato (hanno sia
scrittori API sia scrittori di importazione, o righe senza alcuno scrittore trovato, o sono una
delle quattro di D6): le ratifica Enzo riga per riga in **X-1** (Fase 5), fuori da questa sessione.

⚠ **Il vivo, ri-misurato il 2026-09-16, ha 246 tabelle `sys.sys_*`, non 245**
(`select table_type, count(*) from information_schema.tables where table_schema='sys' and
table_name like 'sys\_%' group by table_type` → `BASE TABLE 246`). La differenza è
`sys_permessi_plenipotenziari_ammessi`, creata dalla stessa sessione K (migrazione `000418`,
applicata il 2026-09-15 alle 19:13 — dopo il lancio di `I-E`, ore 03:31): non è un errore di
misura, è una tabella nata **dopo** che la classificazione era già chiusa. `I-E` non è più
completa rispetto al vivo, e questo ADR lo dichiara invece di ripetere un numero superato: la
tabella mancante è `infrastruttura` per natura (allowlist di una sentinella RBAC, non un dato di
cliente), e **X-1** la classifica esplicitamente prima di depositare
`sys.sys_classificazione_direzione_dato` come dato di sistema. Fino a quel momento la
classificazione di `I-E` vale come riferimento di lavoro **con questa lacuna dichiarata**, non
come inventario chiuso.

### Il caso ibrido più delicato: le ferie

`time-off` è l'unico modulo dove le due direzioni si toccano su dati vivi. Le regole di
maturazione arrivano tutte da fuori (contrattuali, CCNL); la richiesta di ferie nasce qui; il
saldo è ibrido — la giacenza iniziale importata, i movimenti dalle approvazioni fatte qui si
sommano. Enzo ha già risposto alla domanda «chi vince in caso di conflitto» (D5, 2026-09-15,
opzione **C**): *l'importazione non tocca mai un saldo che ha un gesto nativo aperto; il
conflitto va in un registro e lo chiude il `DATA_STEWARD`.*

`I-D` (mandato K) ha misurato, sulle quattro tabelle ibride, **682 righe** che soddisfano la
definizione meccanica del conflitto (importate **e** modificate dopo l'importazione — ri-misurato
qui il 2026-09-16 sulla sola `sys_time_off_balances`: 422/422, invariato). Non è zero, ed è
importante dirlo con la stessa precisione con cui `I-D` lo ha scritto: delle 682, **nessuna è
riconoscibile come il gesto di una persona nella piattaforma** — 681 sono state modificate a
blocchi da due lavori automatici (le bonifiche di fine luglio, l'avanzamento notturno della
storia di RTL), una sola ha un istante proprio ma dello stesso giorno dei blocchi. **Zero gesti
individuali sono in conflitto**, pur essendoci 682 righe che la definizione meccanica marca come
tali. La regola nasce verde nel senso che conta: nessuna persona ha mai visto la propria richiesta
sovrascritta da un'importazione. Il caso vero nascerà con il primo cliente che importa saldi e usa
la piattaforma insieme, non prima. La sentinella e la migrazione che rendono la regola vera sul
database sono **X-4** e **X-5** (Fase 5), non questo ADR.

## Conseguenze

1. **`X-1`** deposita la classificazione come dato interrogabile (non un commento in un file),
   con le righe dubbie ratificate da Enzo.
2. **`X-2`** aggiunge la colonna di origine (`origine_dato`) a ogni tabella importata/ibrida che
   ne è priva — l'elenco esatto lo misura `X-2` sul vivo (le 88 importate e le 97 ibride di
   `I-E`), non un conteggio del dossier: sulle sette amministrative nominabili, sei ne sono
   prive oggi (sopra).
3. **`X-5`** è la sentinella che tiene vera la regola: nessuna tabella `importato` riceve righe
   `origine_dato='NATIVO'`, nessuna `nativo` riceve `'IMPORT'`, nessun conflitto ibrido resta
   aperto oltre 30 giorni.
4. **I ruoli di people management di Fase 4** ereditano questo confine: `PEOPLE_MANAGER` (R-6)
   riceve scrittura sulle tabelle `nativo`, lettura sulle `importato`, mai una rotta di scrittura
   su queste ultime — perché quella rotta non esiste, non perché un permesso gliela neghi.
   ⚠ Questo vale per i ruoli sotto il mandato HR (`HR_MANDATED_ROLES`), **non** per i tre ruoli
   che il mandato mette in `haMandatoPiattaformaAssegnato` — `R-5` `BLUEPRINT_MANAGER`, `R-8`
   `IMPLEMENTATION_CONSULTANT`, `R-9` `PLATFORM_OPERATOR`/`SALES` (misurato sul testo del
   mandato, non a memoria: l'insieme contiene esattamente questi quattro codici, non altri).
   Quelli vedono e scrivono per **assegnazione-cliente** (asse ortogonale I16, la tabella di
   `R-0`), con lettura mascherata per ADR-0032/I20 — un asse diverso, deciso a parte, che questo
   ADR non estende e non vincola. `R-0` non è un ruolo, è la tabella dell'asse; `SECURITY_ADMIN`
   (`R-7`) **non** è in questo insieme: è un ruolo di **cliente** (non esce dal tenant, non usa
   l'asse di `R-0`, entra invece in `puoConcedereRuoli`) — il mandato lo dichiara esplicitamente
   (sezione 2, conseguenza c). Se e come I23 si applica ai tre ruoli di piattaforma è una domanda
   che questo ADR lascia aperta, non decisa per estensione implicita.
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
