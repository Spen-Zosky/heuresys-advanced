# 218 — I residui del legacy senza referente locale: analizzarli tutti, e risolverli uno per uno

> **item**: #218
> **stato**: IN CORSO

## Decisione vincolante (non si ri-chiede)

**Enzo, 2026-08-19** — *«tutti i dati provenienti dal db legacy che non hanno mai avuto un
referente locale devono essere analizzati e trattati correttamente: per ognuno si deve decidere
se eliminarli o se è opportuno/necessario creare il referente locale. È comunque da privilegiare
la cancellazione/bonifica per l'igiene del DBMS attuale, che ormai ha superato il legacy ed è
completamente autonomo.»*

E la previsione operativa, da verificare: *«un'attenta e approfondita analisi del DBMS sarà in
grado di restituire le informazioni necessarie e di permettere una pulizia profonda del DBMS che
ne assicura l'indipendenza e l'autonomia»*.

**Ordine di preferenza, dichiarato**: eliminare › creare il referente › lasciare com'è **solo**
con una ragione scritta.

## Il caso che l'ha prodotta

Le **225** righe di `sys_organization_unit_templates` portano
`organization_unit_template_blueprint_id`, che punta a **9** identificativi inesistenti in tutte
e quattro le tabelle di blueprint. Avevo concluso «225 righe orfane»; il file che le crea diceva
altro — mig. `000064`: `-- legacy template_id group (the 9)`. Sono il `template_id` del sistema
di provenienza, conservato come raggruppamento, **senza FK perché non c'è nulla a cui agganciarlo**.

Non è un guasto e non è a posto: è un **residuo mai risolto**, e questa voce esiste per non
lasciarne altri.

## Perché conta

Un riferimento ereditato che non punta a nulla di locale **mente sul proprio nome**, e a occhio è
indistinguibile da un difetto — come ha dimostrato la mia lettura sbagliata. Finché ce ne sono, il
database non è autonomo dal legacy nemmeno nella propria descrizione di sé.

## Non è in conflitto con I12

«Il rubinetto è chiuso» vieta di **importare** nuove righe dal legacy. Questa voce chiede di
**risolvere** ciò che è già dentro `sys.*`: materia diversa, direzione opposta.

## Vincoli

Le quattro cose di `db-migrations.md` — misura prima · guardia al momento dell'esecuzione ·
post-condizione che protegge ciò che **non** doveva cambiare · rollback dichiarato — e **ADR-0035**:
si emenda il file che crea l'oggetto, non si cancella solo a valle, o al deploy dopo torna.

## Fasi

- [x] **F1 Il censimento: quante sono, e dove** — **FATTO 2026-08-19 (S1072)** · strumento
      `docs/kb/tools/censimento_riferimenti_orfani.py` (`--elenco` · `--da-risolvere` ·
      `--con-righe` · `--selftest` **15/15**). Il criterio è meccanico come la fase chiedeva:
      interroga `pg_constraint` e `information_schema`, e **il numero non è scritto qui** — si
      ri-deriva a ogni esecuzione (⭐ PUNTO FISSO: un conteggio in un documento è vero il giorno
      in cui lo scrivi).

      **⚠ IL CRITERIO GREZZO DÀ UN NUMERO INSERVIBILE, e la misura lo dimostra**: applicato senza
      distinzioni trova **317** colonne. Un elenco così non è una decisione, è un mucchio — e
      «privilegiare la bonifica» sarebbe rimasta un'intenzione, che è esattamente ciò che questa
      fase esiste per evitare. Quattro cause di falso positivo, ognuna con una ragione
      **strutturale** e non discrezionale:

      · le **VISTE** non hanno vincoli per costruzione — una `v_*` che espone `user_id` non ha
        perso niente, sta proiettando una colonna che altrove è agganciata (34 nel solo `sys`);
      · gli **ARCHIVI** (`audit.*_archive`) conservano righe **già cancellate**: una FK verso
        l'origine le renderebbe incancellabili, cioè romperebbe la ragione per cui esistono;
      · i riferimenti **POLIMORFI** (`approval_request_resource_id`, `notification_resource_id`)
        puntano a tabelle diverse secondo il tipo: la FK è **impossibile**, non mancante;
      · le tabelle di **LAVORAZIONE** (`staging.*`) portano le chiavi della provenienza per
        definizione — sono il bersaglio di **`#69`**, non di questa voce.

      **La misura del 2026-08-19** (datata, quindi evidenza e non affermazione sul presente):
      **108** colonne su tabelle vere, così ripartite — `da-risolvere` **11** · polimorfo 10 ·
      esterno 7 · modello-ia 5 · archivio 29 · lavorazione 46. Cioè **le voci che F2 deve
      decidere una per una sono undici**, non centinaia: la bonifica è alla portata di una
      sessione, e senza questa fase non si poteva saperlo.

      **Le undici, con righe e migrazione d'origine** (ri-derivabili con `--da-risolvere --con-righe`):
      `sys_source_lineage_records` ne porta **tre** (l'ex-lineage del brownfield: 70.959 righe, con
      44.744 / 57.053 / 1.490 valorizzate) · `sys_reference_translations.entity_id` **32.485
      valorizzate su 32.485** ed è la più grossa · `sys_organization_unit_templates.…_blueprint_id`
      **225**, il caso che ha aperto la voce (mig. `000064` lo dichiara «legacy template_id group»)
      · `sys_capability_score_lineage` due colonne × 339 · `sys_user_timeline_events…_source_id`
      2.682 · `sys_advisor_suggestions…_rule_id` 14 · `sys_engagement_action_plans…_source_id` 8 ·
      `sys_generated_record_origins…_superseded_by_run_id` **0 righe** — mai usata, ed è la più
      facile da decidere.

      ✅ **LA PROVA SA FALLIRE, ed è il classificatore a doverlo dimostrare**: `--selftest` ha
      **15 casi**, di cui **11 negativi** — cioè cose che NON devono finire in `da-risolvere`.
      Senza quelli, un classificatore che rispondesse sempre «da risolvere» passerebbe metà della
      batteria e il censimento tornerebbe a essere il mucchio da 317. C'è anche il caso
      dell'**ordine delle regole** (una colonna polimorfa dentro un archivio dev'essere
      *archivio*): l'ordine è una scelta, quindi va dimostrato invece che promesso.
- [x] **F2 La decisione, una per una** — **FATTA 2026-08-19 (S1072)**, e ha **corretto F1
      mentre la eseguiva**: le voci non erano undici, sono **sei**.

      🔬 **IL CRITERIO DI F1 AVEVA UN SEGNALE DEBOLE, e F2 l'ha trovato provando a decidere.**
      Cinque delle undici erano **polimorfe** e non si chiamavano come le altre polimorfe:
      `capability_score_lineage_child_id` · `..._parent_id` · `action_plan_source_id` ·
      `reference_translations.entity_id` · `user_timeline_event_source_id`. Il classificatore le
      riconosceva **dal nome**, e quei cinque nomi non erano nell'elenco. Ciò che le accomuna non
      è come si chiamano: è che **accanto hanno una colonna gemella che ne dichiara il bersaglio**
      (`..._type`, `..._table`) — una proprietà dello **schema**, che si interroga, non una
      convenzione da tenere aggiornata a mano. Regola aggiunta al classificatore; ✅ **sabotata**:
      spenta, le sei tornano **undici** e la batteria cade **11/14**.

      **Le sei decisioni** — il criterio di Enzo è «eliminare (preferito), creare il referente,
      oppure lasciare con la ragione scritta»:

      | # | colonna | misura | decisione |
      |---|---|---|---|
      | ① | `sys_source_lineage_records.source_lineage_import_run_id` | **44.744** valorizzate, e **tutte e 44.744** puntano a righe che ESISTONO in `reference_sync.import_runs` — misurato con una join, non dedotto | **CREARE IL REFERENTE**: la FK si può aggiungere **senza bonifica**, perché non c'è un solo orfano. È il caso più netto dei sei: il referente c'era già, mancava solo di dirlo |
      | ② | `sys_source_lineage_records.source_lineage_table_mapping_id` | **57.053** valorizzate · la tabella `table_mappings` **non esiste più** (era in `brownfield`, ritirato da `#164` F4) · **nessun codice la legge** (assente dai campi del modulo `provenance`) | **ELIMINARE** — è la preferita di Enzo e qui non costa niente: punta nel vuoto e nessuno la guarda |
      | ③ | `sys_source_lineage_records.source_lineage_sdbi_mapping_card_id` | **1.490** valorizzate · `mapping_cards` non esiste · ⚠ **il modulo `provenance` la ESPONE nell'API** (`sdbiMappingCardId`) | **LASCIARE, con la ragione scritta**: è l'identificativo di una scheda del sistema SDBI, cioè un riferimento **esterno** — non un referente locale mancante. Eliminarla sarebbe un cambio di contratto pubblico per un guadagno nullo. La ragione va scritta **accanto alla colonna**, o al prossimo censimento ricompare |
      | ④ | `sys_organization_unit_templates.organization_unit_template_blueprint_id` | **225** valorizzate, **9** valori distinti · la mig. `000064` lo dichiara: «legacy template_id group (the 9)» | **LASCIARE, con la ragione scritta** — ed è già indagato in `#132` F1: quei nove **non sono blueprint di questo sistema**, sono il raggruppamento del database di provenienza. Non sono orfani: non hanno **mai** avuto un referente locale. ⚠ Ma il **nome mente sul contenuto** (`..._blueprint_id` per una cosa che non è un blueprint): F3 lo rinomina, ed è quello il lavoro |
      | ⑤ | `sys_generated_record_origins.generated_record_origin_superseded_by_run_id` | **0 righe** · la mig. `000319` la dichiara: «la corsa di importazione che l'ha sostituita (P4); nullo finché non accade» | **LASCIARE, con la ragione scritta**: il referente non manca, **non esiste ancora** — la corsa di P4 (`#206`) non è stata costruita. Agganciarla oggi vorrebbe dire inventare la tabella bersaglio; eliminarla, buttare una decisione di progetto già presa |
      | ⑥ | `sys_advisor_suggestions.advisor_suggestion_rule_id` | **14** valorizzate · `varchar(48)` con un `CHECK`, non un uuid | **LASCIARE, con la ragione scritta**: è il **codice di una regola scritta in codice**, non una riga di una tabella. Il `CHECK` è già il suo vincolo, e una FK richiederebbe di mettere in tabella un catalogo che vive nel codice per scelta |

      **Il conto di F3**: una migrazione che *aggiunge una FK* (①), una che *elimina una colonna*
      (②) — entrambe con le quattro cose del metodo di bonifica — più *tre commenti di colonna*
      (③⑤⑥) e *una rinomina* (④). ⚠ Le tre «ragioni scritte» non sono un ripiego: **finché non
      sono scritte nel database**, al prossimo censimento quelle colonne ricompaiono identiche e
      qualcuno rifarà questa stessa indagine.
- [ ] **F3 La bonifica, con le quattro cose** — budget dipende da F1
      Migrazioni che emendano i file che creano gli oggetti, più la rimozione degli esemplari
      esistenti. Prova generale sul gemello prima del push, sempre.
- [ ] **F4 La guardia che impedisce il prossimo** — budget ~30k
      Un cancello che rende rosso un riferimento nuovo che nomina un oggetto e non lo aggancia.
      Senza, il censimento di F1 è una fotografia e non una cura.

## Chiuso quando

Ogni residuo censito in F1 ha una decisione eseguita, e un cancello impedisce che ne nascano di
nuovi senza che qualcuno se ne accorga.
