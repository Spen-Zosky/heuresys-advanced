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
- [x] **F2 Le derivabili: l'arco si prende dalla fonte, non si inventa** — **FATTO 2026-08-28
  (S1083), e l'esito è che NON SONO DERIVABILI — perché non sono isolate.** È il secondo
  ribaltamento di questo piano, dopo quello di F1, e come quello nasce da una misura.

  **Le quattro strade, provate una per una e tutte chiuse:**

  | strada | misura | esito |
  |---|---|---|
  | il **padre delle sorelle** dello stesso gruppo | **265 gruppi su 358 frammentati** (nessun padre arriva al 50%), 10,9 padri medi per gruppo, fino a **72** in uno solo. Padre unico: 34 gruppi. Dominante ≥80%: 2 | ⛔ sarebbe una scelta arbitraria fra decine di candidati, non una derivazione |
  | l'**albero dei gruppi** (`skill_group_parent_id`) | dei 6.456 archi `IS_A` esistenti, **ZERO** collegano una competenza al gruppo-padre della propria. 1.705 stanno nello stesso gruppo, 286 senza gruppo, i restanti 4.465 attraversano gruppi senza relazione | ⛔ nessuna regola strutturale da imitare: gli archi vengono dalla fonte ESCO, non dalla struttura |
  | l'**URI ESCO** | `http://data.europa.eu/esco/skill/<uuid>` — identificatori **opachi**, nessuna gerarchia nel path | ⛔ niente da leggere |
  | la **fonte ESCO a monte** | già misurato in F1: in `reference_sync` non c'è tassonomia di competenze (solo occupazioni) | ⛔ non c'è |

  **⭐ E QUI LA MISURA RIBALTA LA DOMANDA.** Delle 4.464 «isolate», **4.383 (98,2%) hanno un
  `skill_group_id`, e TUTTE E 4.383 stanno in un gruppo che ha un padre nell'albero ESCO**
  (`sys_skill_groups`: 640 gruppi, 636 con padre — l'albero europeo è già nel database, intero).

  Quindi **non sono isolate nella tassonomia: sono isolate nel solo grafo competenza→competenza.**
  La loro collocazione tassonomica esiste già, ed è quella che ESCO usa davvero — l'appartenenza
  al gruppo. Il titolo di questa voce — «4.464 su 14.033 senza un solo arco tassonomico» — è vero
  alla lettera e **fuorviante nella sostanza**: descrive un vuoto in una struttura, non un vuoto
  di conoscenza.

  **Conseguenza per le fasi che seguono, dichiarata qui e non scoperta dopo**: scrivere 4.332
  archi inventati avrebbe **peggiorato** il grafo, riempiendolo di legami che nessuna fonte
  sostiene e che nessuno potrebbe più distinguere dai 6.456 veri (che portano
  `source=ESCO_v1.2.0` nel loro metadata — gli 11.964 `RELATED`, invece, non dichiarano fonte, ed
  è già oggi un difetto di tracciabilità). **F5 cambia bersaglio**: la sentinella non deve contare
  «le competenze senza archi», che è una misura che spaventa senza informare, ma **le competenze
  senza collocazione tassonomica** — né arco né gruppo. Misurate oggi: **81**, cioè lo 0,58% del
  catalogo, e sono esattamente le specie S3 (51 ESCO senza gruppo) + S4/S5 (30 non-ESCO) che F3 e
  F4 hanno già in carico. Il problema non è mai stato un terzo del catalogo. — per le ESCO l'albero esiste a monte e va **letto**, non ricostruito a intuito. ⚠ Vincolo `I12`: il rubinetto del brownfield è chiuso, ma ESCO **non è brownfield** — è la tassonomia europea, e `reference_sync` è la sua casa dichiarata. **fatto =** archi scritti, il conteggio delle isolate scende del numero previsto da F1, e una post-condizione protegge ciò che NON doveva cambiare
- [ ] **F3 Le non derivabili e non usate: si ritirano o si dichiarano** — una competenza che nessuno usa e che nessuna tassonomia conosce è residuo, non catalogo. ⚠ `ADR-0035`: ritirare non è cancellare — si emenda il file che la crea. **fatto =** ogni riga o ritirata o tenuta **con la ragione scritta**, mai un jolly
- [ ] **F4 Le usate ma non derivabili: curatela vera** — sono quelle che qualcuno usa davvero e che nessuna fonte sa collocare. Qui l'arco è una **decisione**, e va presa con un criterio dichiarato, non a intuito. **fatto =** criterio scritto, applicato, e una sentinella che tiene il conto delle isolate perché non risalga in silenzio
- [ ] **F5 La sentinella** — oggi nessuna misura conta le competenze isolate: il numero è potuto crescere fino a un terzo del catalogo senza che niente lo dicesse. ⚠ Una vista `sys.v_*` nuova diventa **automaticamente** una sentinella che pretende zero righe (memoria `new_sys_view_becomes_sentinel`): qui zero non è l'atteso, quindi va dichiarata **informativa** con la sua soglia, o renderà rossa la prova generale. **fatto =** la misura esiste, ha una soglia motivata, ed è stata vista scattare

## Chiuso quando

Le quattro specie di F1 hanno tutte una destinazione eseguita, il conteggio delle isolate è sceso
al valore che F1 dichiara raggiungibile (**non a zero** — alcune resteranno, con la ragione
scritta), e una sentinella lo sorveglia perché non risalga senza che nessuno se ne accorga.


## S1085 (2026-08-30) — F3 e F5 chiuse, e **il criterio di F4 e' gia' misurato**

**F3** — le due non-ESCO mai usate ritirate (`CUSTOM::BANCASSUR`, `CUSTOM::FRAUD-DET`), mig
`000368`. La risposta non era ovvia: sono competenze *bancarie*, e I21 tiene il catalogo
coerente con l'industry, quindi sembravano catalogo legittimo. A decidere e' stata la
**provenienza**: vengono dall'estrazione legacy, le 23 sorelle dello stesso file qualcuno le
usa, queste no. Due guardie ri-verificate all'esecuzione, tre post-condizioni, e un rollback
vero (`staging.skill_ritirate_undo` + `staging.ripristina_skill_ritirata()`). La misura prima
del `DELETE` ha trovato **2 embedding** che le referenziavano: passano anch'essi dal giornale.

**F5** — sentinella `sys.v_skill_isolate_residue`, bloccante. La soglia **non** e' «zero
isolate»: 4.434 su 4.464 sono ESCO con URI, la tassonomia europea che I21 tiene aperta —
pretendere zero li' equivarrebbe a potarla. Zero e' l'atteso solo per il **residuo**.

### F4 — il criterio, misurato invece che immaginato

Le 28 in uso hanno **tutte** un embedding (28 su 28, misurato), e le ESCO collocate nella
tassonomia ne hanno 14.003: **l'arco si puo' DERIVARE invece di inventarlo**, cercando la
competenza ESCO piu' vicina che gia' abbia un padre.

Prime dodici proposte, per somiglianza coseno decrescente:

| isolata | ESCO piu' vicina | somiglianza |
|---|---|---|
| Collaborazione | collaborare con i colleghi | 0,890 |
| Consulenza per la gestione patrimoniale | offrire consulenza in materia di investimenti | 0,866 |
| Gestione del rischio operativo | Gestione del rischio | 0,851 |
| Gestione del rischio di mercato | Gestione del rischio | 0,840 |
| Innovazione | cercare innovazioni per le pratiche in uso | 0,826 |
| **Gestione della liquidita' aziendale** | **gestire il trasporto di contanti** | **0,823** |
| Erogazione prestiti | gestire le domande di prestito | 0,800 |
| Stress testing e analisi di scenario | Gestione del rischio | 0,799 |
| Orientamento ai risultati | attuare obiettivi a breve termine | 0,796 |
| **Finanza sostenibile ed ESG** | **green bond** | **0,792** |
| Gestione degli NPL | tecniche di riscossione debiti | 0,789 |
| Orientamento al cliente | soddisfare i clienti | 0,781 |

⚠⚠ **E la misura dice anche che applicarlo alla cieca sarebbe sbagliato**: «Gestione della
liquidita' aziendale» → «gestire il trasporto di contanti» e' **semanticamente falsa** pur
stando a 0,823, sopra a proposte corrette come «Erogazione prestiti» → «gestire le domande di
prestito» (0,800). **La somiglianza non ordina la correttezza**: una soglia da sola non separa
le buone dalle cattive, e questo e' il reperto che F4 deve portarsi dietro.

**Cosa resta da decidere in F4**, e va deciso guardando le 28 una per una:
- la **direzione** dell'arco: `IS_A` verso la vicina (es. «Gestione del rischio operativo»
  *IS_A* «Gestione del rischio»), non verso il *padre* della vicina — la vicina e' gia' il
  concetto sovraordinato nei casi buoni;
- la **soglia**, che serve come filtro grossolano ma **non basta**: sotto la soglia si dichiara
  «non collocabile a macchina», sopra si **rilegge** prima di scrivere;
- il **giornale di rollback**, perche' 28 archi scritti a macchina vanno potuti disfare.
