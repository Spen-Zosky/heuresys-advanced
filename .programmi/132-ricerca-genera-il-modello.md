# 132 — La ricerca genera il modello, e l'archetipo scritto a mano sparisce

> **item**: #132 · **priorità**: P1 · **stima**: ~8 sessioni
> **stato**: NON AVVIATO
> **fonti**: decisione E29 di Enzo (2026-08-17) · epica P2a `D:\heuresys-design-lab\2026-08-05--epic-tenant-builder-p2a-ricerca.md` · piano approvato `~/.claude/plans/jaunty-percolating-storm.md`

## Decisioni vincolanti (non si ri-chiedono)

- **E29 (2026-08-17)** — *«Il fascicolo non può avere un archetipo aprioristico, altrimenti genera
  sempre una banca come RTL. I dati hardcoded del file di codice scritto a mano devono scomparire —
  non deve rimanere traccia — e l'archetipo deve essere generato dalla ricerca.»*
- **Profondità: TUTTO** — unità, posizioni, competenze, indicatori, processi. Non solo
  `business_processes` come prevedeva l'epica. È coerente con **E18** («coprire tutte le relazioni
  fra i dati»).
- **Prima prova su un'azienda NUOVA di settore diverso dal bancario**, poi su RTL Bank. Le due
  domande sono diverse: la prima chiede *«il meccanismo ha memoria del bancario?»*, la seconda
  *«quanto è buono il risultato?»*. Nessuna delle due risponde all'altra.
- **E10** — la capacità di ricerca è della piattaforma, non di un cliente: un dominio ricercabile si
  dichiara **in codice**, non nel database.
- **E27** (dove si sperimenta) ed **E28** (archivia oppure disfa) valgono qui come per `#198`.

## Le tre misure di partenza (2026-08-17 — si ri-misurano prima di usarle)

| Misura | Valore | Perché conta |
|---|---|---|
| righe create dall'archetipo in produzione | `0` unità · `0` posizioni · `0` competenze `RBR-%` · `0` utenti `SYN_%` | **il ritiro non richiede bonifica di dati** |
| chi nomina l'archetipo | **12 file** — 5 di codice, 7 di test | la superficie del ritiro |
| contenuto di un modello nel database | **non esiste** per posizioni/competenze/indicatori · `sys_organization_unit_templates` ha **225 righe orfane** (25 codici × 9 copie) | è il lavoro vero, e nessun piano lo nominava |

## ⚠ Da F3 a F6 nessuna azienda è costruibile

Dichiarato in anticipo. Non è un danno: oggi non se ne costruisce nessuna comunque, e ciò che si
toglie è una capacità **mai usata** che produceva il risultato sbagliato.

## I parametri che una ricerca mirata pretende (Enzo, 2026-08-17 — e la misura che lo corregge)

**La posizione di Enzo**: *«solo dopo aver stabilito il codice ATECO e definito il numero di addetti
sarà possibile fare le ricerche mirate»*. **Giusta nella sostanza, incompleta nel conto** — misurato
sul fascicolo reale e su `IDENTITA_OBBLIGATORIA` (`tenant-blueprints/service.ts:57-62`):

| Parametro | Oggi | Serve alla ricerca? |
|---|---|---|
| settore ATECO (`industryClassId`) | **obbligatorio** prima della firma | sì — è il primo |
| fascia dimensionale (`sizeBandId`) | **obbligatorio** | insufficiente da solo, vedi sotto |
| paese (`countryCode`) | **obbligatorio** · RTL = `IT` | **sì**: cambia organi di controllo, contratto, obblighi |
| intensità di vigilanza (`regulatoryIntensity`) | **obbligatorio** · RTL = `HIGH` | **sì**: decide se esiste una direzione Risk & Compliance |
| modello operativo (`operatingModelId`) | **opzionale** → **DA RENDERE OBBLIGATORIO** (Enzo, 2026-08-17) · catalogo di 6 (RETAIL, WHOLESALE, MIXED, B2B_SERVICES, MANUFACTURING, PUBLIC_SECTOR) | **sì, e pesa sulla FORMA più della dimensione**: RETAIL e WHOLESALE a parità di settore e addetti danno strutture opposte — con o senza filiali |
| numero di addetti (`employeeCount`) | **opzionale** → **DA RENDERE OBBLIGATORIO** · RTL = `158` | **sì**, ed è il punto che segue |

### I due modi di dire la dimensione hanno DUE RUOLI, non uno (Enzo, 2026-08-17)

Non è ridondanza da eliminare: è una distinzione da rispettare.

- **La fascia** (`XS 1-9 · S 10-49 · M 50-249 · L 250-999 · XL 1000+`) serve al **pricing della
  piattaforma** e **canalizza la ricerca**: si cerca «una banca di fascia M», non «una banca di 158
  dipendenti». Cinque fasce sono cinque corsie, ed è ciò che rende una ricerca ripetibile e
  confrontabile fra clienti diversi.
- **Il numero** descrive l'**azienda vera**, ed è *«quello su cui lavorano le tabelle gestionali»*.
  Riscontro misurato: il fascicolo di RTL dichiara **158** addetti e RTL ha **158 posizioni attive**
  — il numero non è un'etichetta, è il dato che il sistema usa davvero.

**⚠ IL BUCO, trovato misurando questa distinzione**: `sys_tenant_blueprint_version_employee_count_check`
verifica **soltanto** che il numero sia `>= 0`. **Nessun vincolo lega la fascia al numero.** Oggi si
può dichiarare fascia `XS` (1-9) e `5000` dipendenti, e nulla protesta — la ricerca cercherebbe
un'azienda minuscola mentre le tabelle gestionali ne descrivono una grande. Con la ricerca questo
smette di essere teorico. Il vincolo va aggiunto in **F0**: il numero deve cadere dentro la fascia
dichiarata (`min <= n <= max`, con `max` nullo per `XL`).

**L'incoerenza da sciogliere, ed è nel codice non nei documenti.** La dimensione è dichiarata **due
volte**: la fascia (obbligatoria) e il numero (opzionale). Il commento sopra `IDENTITA_OBBLIGATORIA`
dichiara che i ricavi e il numero di dipendenti *«descrivono l'azienda ma non entrano in nessuna
derivazione, e pretenderli bloccherebbe la firma per un dato che non cambia il risultato»*.

**Con la ricerca quel dato inizia a cambiare il risultato**, e quella frase diventa falsa. Le fasce
misurate: `XS 1-9 · S 10-49 · M 50-249 · L 250-999 · XL 1000+`. La fascia `M` è larga **cinque
volte**: con 50 addetti si fa un'organizzazione piatta, con 249 tre livelli e delle filiali. RTL è
`158`, non «M».

**Conseguenza per il piano**: prima di **avviare una ricerca** (non prima della firma — sono due
momenti diversi) servono **cinque** parametri: ATECO · **numero** di addetti · paese · intensità di
vigilanza · modello operativo. La fascia resta come **derivata** dal numero, non come suo sostituto.
Il commento nel codice va aggiornato insieme, o resterà a dire il contrario di ciò che facciamo.

## Fasi

- [ ] **F0 i parametri della ricerca** — tre cose insieme: *(a)* rendere obbligatori prima di
  **avviare una ricerca** (non prima della firma) i **sei** parametri della tabella qui sopra —
  ATECO · fascia · **numero di addetti** · paese · vigilanza · **modello operativo**; *(b)*
  aggiungere il **vincolo di coerenza fascia↔numero** che oggi non esiste; *(c)* correggere il
  commento di `IDENTITA_OBBLIGATORIA` (`tenant-blueprints/service.ts:52-56`), che dichiara il
  contrario sul numero di addetti e diventerà falso. Piccola, ma va **prima** di F4: una ricerca
  avviata senza questi parametri non è mirata, e non ce ne accorgeremmo guardando l'esito — ne
  uscirebbe un'azienda plausibile e generica.
  **La prova che deve poter fallire**: un fascicolo con fascia `XS` e `5000` addetti dev'essere
  **respinto**. Oggi passa
- [ ] **F1 dove vive il contenuto di un modello** — migrazioni per unità/posizioni/competenze/
  indicatori di una versione di variante, con chiave naturale per dominio. Riuso di
  `sys_organization_unit_templates` **se la forma regge**, e bonifica delle 225 orfane (o la ragione
  scritta per cui restano). ⚠ `ci-rehearsal.sh` sul linux-pc prima del push
- [ ] **F2 `BlueprintBuildSource`** — la seconda implementazione di `BuildSource`: il `BuildPlan` si
  legge dal database. La `justification` diventa **la proposta approvata che ha generato la riga**,
  e il registro dell'origine diventa una catena completa fino alla fonte web
- [ ] **F3 il ritiro, senza lasciare traccia** — via `blueprints.ts` (287 righe), `getArchetype`,
  `archetypeUsers`, `synProficiency`, `synKpiValue`. I test costruiscono da un modello **seminato nel
  test**, non da uno globale: è la differenza fra una fixture e un archetipo mascherato
- [ ] **F4 il motore di ricerca** — corse, proposte, fonti (indirizzo + data + impronta), decisione
  motivata. Riuso quasi totale delle 5 tabelle di acquisizione. Due modifiche già misurate
  dall'epica: `tenant_id` nullabili con `CHECK` sulla coppia, e il legame alla versione di fascicolo.
  Più `BLUEPRINT_FIELD_LOCKED` (`D-81`), che l'epica vuole **insieme**. ⚠ La difesa di §4.4 non è
  opzionale: **una pagina web può contenere istruzioni**, e la ricerca le legge
- [ ] **F5 i cinque domini ricercabili** — `organization_units` · `positions` · `skills` · `kpis` ·
  `business_processes`. Il primo costa la forma, gli altri quattro la riusano
- [ ] **F6 il ponte: le proposte approvate diventano il modello** — famiglia (se non esiste),
  variante, versione 1 col contenuto. Riqualifica da scrivere: `sys_blueprint_families` e `_variants`
  **non sono un catalogo anticipato**, sono un **sottoprodotto dei clienti**
- [ ] **F7 le due prove** — prima l'azienda nuova di settore diverso (se ne esce una banca,
  l'archetipo è sparito solo di nome), poi RTL Bank come metro di qualità. Sul gemello, poi in
  produzione

## Le prove che devono poter fallire

- **F2** — un fascicolo **senza** modello non deve costruire «zero righe con successo»: deve
  **rifiutarsi**. Uno zero silenzioso qui è il difetto peggiore, perché somiglia a un successo.
- **F3** — `grep -rn "RETAIL_BANK_REFERENCE\|getArchetype" apps/ packages/` deve tornare **vuota**.
  Se resta un riferimento, il ritiro non è avvenuto: è stato rinominato.
- **F5** — una proposta con una fonte **non ammessa** va respinta col motivo, non accettata con un
  avviso.
- **F7.1** — l'azienda del settore diverso **non deve** avere unità che somigliano a filiali
  bancarie. È il modo più utile in cui questo piano può fallire: direbbe che la ricerca non ricerca.

## Ordine e intreccio con `#198`

F1 → F2 → F3 → F4 → F5 → F6 → F7. Il **T7** di `#198` (le due pagine) si può intercalare in qualunque
momento: non dipende da *dove* nasce il modello. Il **T9** (la prova che chiude P3) ha senso **dopo**
F6, altrimenti misurerebbe una costruzione fatta dall'archetipo che stiamo togliendo.
