# 227 — Le competenze isolate nel grafo: un terzo del catalogo senza un solo arco

> **item**: #227
> **stato**: IN CORSO
> **nota**: F1 fatta (S1081, 2026-08-25); l'effort è da **ri-stimare al ribasso** — il censimento
> mostra 4.332 derivabili a macchina e **30 righe** di curatela vera, non 4.464
> **nasce-da**: `#222` F6-07, che dichiarava «da fare, con un piano proprio» — e quel piano
> **non è mai stato creato**. La voce `#222` è stata chiusa `DONE` e il residuo è rimasto orfano
> per tre giorni, invisibile a ogni elenco. Trovato in S1079 censendo i residui dichiarati
> dentro voci chiuse.

## La misura, ri-derivata il 2026-08-24 (non ricopiata da `#222`)

```sql
select (select count(*) from sys.sys_skills)                                  -- 14.033
     , (select count(*) from sys.sys_skill_taxonomy_edges)                    -- 18.420
     , (select count(*) from sys.sys_skills s where not exists (
          select 1 from sys.sys_skill_taxonomy_edges e
           where e.skill_taxonomy_edge_parent_id = s.skill_id
              or e.skill_taxonomy_edge_child_id  = s.skill_id));              -- 4.464
```

**4.464 competenze su 14.033 — il 31,8% — non hanno alcun arco tassonomico**, né in su né in giù.
`#222` diceva 4.467 su 14.036: la differenza sono le 3 competenze fuse in S1077 (mig `000351`).
Il numero regge, ed è **due ordini di grandezza** sopra le 84 che il dossier forense stimava.

## Perché conta, e perché non è una fase dentro un'altra voce

Il grafo delle competenze è il substrato di ciò che la piattaforma promette: somiglianza,
scostamento fra requisito e persona, percorsi formativi, successione. Una competenza senza archi
**esiste ma non partecipa**: non è simile a nulla, non colma nessuna lacuna, non appare in nessun
percorso. Un terzo del catalogo in questa condizione non è un difetto di integrità — è una
**capacità dichiarata che su un terzo dei casi non funziona**, e nessuna misura di integrità la
segnala, perché nulla è rotto.

È curatela, non riparazione: va decomposta prima di poter essere eseguita.

## Fasi

- [x] **F1 Censire le 4.464, per specie** — **FATTO 2026-08-25 (S1081)**, misura ri-derivata sul
  vivo (4.464 / 14.033 = **31,8%**, il numero regge). ⚠⚠ **Il censimento RIBALTA l'impostazione
  di questo piano: la curatela umana non è su un terzo del catalogo, è su 30 righe.**

  | specie | n | usata? | strategia | fase |
  |---|---:|---|---|---|
  | **S1** ESCO, in un gruppo che ha **già sorelle collegate** | **4.332** | mai, da nessuno | l'arco si **deriva dalla struttura già presente** | F2 |
  | **S2** ESCO, gruppo senza sorelle collegate | 51 | mai | serve la fonte ESCO a monte | F2 |
  | **S3** ESCO **senza `skill_group_id`** | 51 | mai | nessun aggancio: ritiro o dichiarazione | F3 |
  | **S4** non-ESCO **USATE davvero** (23 `CUSTOM::` bancarie + 5 `COMP::` comportamentali) | **28** | sì | **curatela vera**, elenco esplicito nel referto | F4 |
  | **S5** non-ESCO mai usate: `CUSTOM::BANCASSUR`, `CUSTOM::FRAUD-DET` | 2 | mai | ritiro o dichiarazione, nominate una per una | F3 |

  **I cinque numeri che spiegano il ribaltamento**, tutti misurati:
  - **4.434 su 4.464 (99,3%) sono ESCO con URI**, tutte globali, **nessuna con tenant** — e
    **nessuna delle 4.434 è usata da nessuno**: né su una persona né su una posizione
  - **4.332** di esse stanno in un gruppo (`skill_group_id`) dove **altre competenze sorelle
    hanno già archi**: 366 gruppi su 386 sono in comune con i 397 gruppi delle collegate.
    L'arco **non va inventato**, va derivato — che è precisamente ciò che F2 chiedeva
  - le **9.569 collegate hanno TUTTE un URI ESCO** (zero senza): il grafo è interamente ESCO
  - **zero gemelli**: nessuna isolata ha un omonimo già collegato. La strada «copia l'arco
    dal gemello» che F1 ipotizzava **non esiste** — misurata, non supposta
  - archi per specie: `RELATED` 11.762 · `IS_A` 6.456 · `PREREQUISITE_OF` 198 · `PART_OF` 4.
    Solo **6.456 portano `source=ESCO_v1.2.0`** (esattamente gli `IS_A`); gli 11.964 `RELATED`
    non dichiarano fonte. ⚠ E **solo 1.705 `IS_A` su 6.456 hanno il padre nello stesso gruppo**:
    il legame gruppo→padre **non è 1:1**, quindi F2 non può fare «padre = il gruppo» — deve
    derivare dal padre delle sorelle, o dalla fonte, e dichiarare quale
  - ⚠ **la fonte ESCO a monte NON è più consultabile come tassonomia di competenze**: in
    `reference_sync` non c'è nessuna tabella di skill/taxonomy (solo due giornali `staging.*_undo`
    e le tabelle `sys_esco_*`, che sono **occupazioni**, non competenze). F2 lavora su ciò che
    il database già contiene — coerente con `I12`, ma va saputo **prima** di aprirla

  **Le 28 di S4, che sono il lavoro vero**: `AML-OPS` · `BASEL-REG` · `CASH-MGMT` ·
  `CORE-BANKING` · `CREDIT-SCORE` · `CYBER-FIN` · `DIGITAL-PAY` · `FX-TRADING` · `IFRS9` ·
  `INT-AUDIT` · `KYC-DUE` · `LOAN-ORIG` · `MARKET-RISK` · `MIFID-COMP` · `NPL-MGMT` · `OP-RISK` ·
  `PRIV-BANKING` · `PSD2-OPEN` · `REL-BANKING` · `STRESS-TEST` · `SUSTAIN-FIN` · `TRADE-FIN` ·
  `WEALTH-MGMT` + le comportamentali `Leadership` · `Orientamento ai risultati` ·
  `Collaborazione` · `Orientamento al cliente` · `Innovazione`. **Sono il catalogo bancario di
  RTL Bank**, tutte del suo tenant e tutte in uso: non sono residuo da bonificare, sono il cuore
  del dominio — e sono isolate perché nessuno le ha mai collocate nella tassonomia. Le 5
  `COMP::` sono le **gemelle vive** di cui `#215` cancellò le copie globali morte (S1069)
- [ ] **F2 Le derivabili: l'arco si prende dalla fonte, non si inventa** — per le ESCO l'albero esiste a monte e va **letto**, non ricostruito a intuito. ⚠ Vincolo `I12`: il rubinetto del brownfield è chiuso, ma ESCO **non è brownfield** — è la tassonomia europea, e `reference_sync` è la sua casa dichiarata. **fatto =** archi scritti, il conteggio delle isolate scende del numero previsto da F1, e una post-condizione protegge ciò che NON doveva cambiare
- [ ] **F3 Le non derivabili e non usate: si ritirano o si dichiarano** — una competenza che nessuno usa e che nessuna tassonomia conosce è residuo, non catalogo. ⚠ `ADR-0035`: ritirare non è cancellare — si emenda il file che la crea. **fatto =** ogni riga o ritirata o tenuta **con la ragione scritta**, mai un jolly
- [ ] **F4 Le usate ma non derivabili: curatela vera** — sono quelle che qualcuno usa davvero e che nessuna fonte sa collocare. Qui l'arco è una **decisione**, e va presa con un criterio dichiarato, non a intuito. **fatto =** criterio scritto, applicato, e una sentinella che tiene il conto delle isolate perché non risalga in silenzio
- [ ] **F5 La sentinella** — oggi nessuna misura conta le competenze isolate: il numero è potuto crescere fino a un terzo del catalogo senza che niente lo dicesse. ⚠ Una vista `sys.v_*` nuova diventa **automaticamente** una sentinella che pretende zero righe (memoria `new_sys_view_becomes_sentinel`): qui zero non è l'atteso, quindi va dichiarata **informativa** con la sua soglia, o renderà rossa la prova generale. **fatto =** la misura esiste, ha una soglia motivata, ed è stata vista scattare

## Chiuso quando

Le quattro specie di F1 hanno tutte una destinazione eseguita, il conteggio delle isolate è sceso
al valore che F1 dichiara raggiungibile (**non a zero** — alcune resteranno, con la ragione
scritta), e una sentinella lo sorveglia perché non risalga senza che nessuno se ne accorga.
