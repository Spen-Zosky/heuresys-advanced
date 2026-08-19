# 218 — I residui del legacy senza referente locale: analizzarli tutti, e risolverli uno per uno

> **item**: #218
> **stato**: CHIUSO

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

      ⚠⚠ **DUE DECISIONI SU SEI ERANO SBAGLIATE, e le ha corrette il file che crea l'oggetto.**
      Avevo deciso di *aggiungere* la FK su `import_run_id` (il referente esiste, zero orfani) e
      di *eliminare* `table_mapping_id`. Poi ho letto la mig. **`000281`**, che quelle due FK le
      ha **sciolte di proposito** — «sono metadati di ESECUZIONE (quale corsa d'import, quale
      mappatura), parziali per costruzione: non sono la provenienza, e scioglierli non toglie
      nulla alla risposta». Rimetterne una contraddirebbe una decisione presa e motivata; togliere
      l'altra butterebbe il metadato che quella decisione aveva scelto di conservare.
      **È la stessa lezione di `#132` F1**, ed è la seconda volta in due voci: *«0 su 9» misurava
      una cosa vera e ne suggeriva una falsa — bastava leggere il file che crea l'oggetto prima di
      dire cosa sia.* Qui la misura («44.744 puntano a righe che esistono») era vera, e la
      conclusione che ne traevo falsa.

      | # | colonna | misura | decisione |
      |---|---|---|---|
      | ① | `sys_source_lineage_records.source_lineage_import_run_id` | **44.744** valorizzate, e tutte puntano a righe che ESISTONO in `reference_sync.import_runs` — la tabella è tornata a esistere altrove (`#164` F4 l'ha traslocata da `brownfield`) | **LASCIARE — la ragione è già stata scritta**, nella `000281`: metadato di esecuzione, sciolto apposta. ⚠ Ma vive **solo nel file di migrazione**, e il database non la porta: va nel commento della colonna, o ricompare a ogni censimento |
      | ② | `sys_source_lineage_records.source_lineage_table_mapping_id` | **57.053** valorizzate · la tabella `table_mappings` **non esiste più** · nessun codice la legge | **LASCIARE, stessa ragione della `000281`** — non «eliminare», come avevo deciso prima di leggerla. È un metadato di esecuzione conservato per scelta: il bersaglio non c'è più, il fatto che quella mappatura sia stata usata sì |
      | ③ | `sys_source_lineage_records.source_lineage_sdbi_mapping_card_id` | **1.490** valorizzate · `mapping_cards` non esiste · ⚠ il modulo `provenance` la ESPONE nell'API · **è l'unica delle sei che un commento ce l'ha già** | **LASCIARE**: identificativo di una scheda del sistema SDBI, cioè un riferimento **esterno**. Il commento c'è (ADR-0014 §3.4) — ed è la prova che la cura funziona: basta che il censimento lo legga |
      | ④ | `sys_organization_unit_templates.organization_unit_template_blueprint_id` | **225** valorizzate, **9** valori distinti · la mig. `000064` lo dichiara: «legacy template_id group (the 9)» | **LASCIARE, con la ragione scritta** — ed è già indagato in `#132` F1: quei nove **non sono blueprint di questo sistema**, sono il raggruppamento del database di provenienza. Non sono orfani: non hanno **mai** avuto un referente locale. ⚠ Ma il **nome mente sul contenuto** (`..._blueprint_id` per una cosa che non è un blueprint): F3 lo rinomina, ed è quello il lavoro |
      | ⑤ | `sys_generated_record_origins.generated_record_origin_superseded_by_run_id` | **0 righe** · la mig. `000319` la dichiara: «la corsa di importazione che l'ha sostituita (P4); nullo finché non accade» | **LASCIARE, con la ragione scritta**: il referente non manca, **non esiste ancora** — la corsa di P4 (`#206`) non è stata costruita. Agganciarla oggi vorrebbe dire inventare la tabella bersaglio; eliminarla, buttare una decisione di progetto già presa |
      | ⑥ | `sys_advisor_suggestions.advisor_suggestion_rule_id` | **14** valorizzate · `varchar(48)` con un `CHECK`, non un uuid | **LASCIARE, con la ragione scritta**: è il **codice di una regola scritta in codice**, non una riga di una tabella. Il `CHECK` è già il suo vincolo, e una FK richiederebbe di mettere in tabella un catalogo che vive nel codice per scelta |

      **IL CONTO DI F3 CAMBIA, E IN MEGLIO.** Dopo la correzione non serve né aggiungere una FK
      né eliminare una colonna: **cinque voci su sei hanno una ragione**, e il difetto vero è che
      la ragione **non sta nel database**. Misurato: delle sei, **una sola** porta un commento di
      colonna; le altre cinque no, e la loro ragione vive in un file di migrazione che chi
      interroga il database non ha davanti.

      Quindi F3 è: **scrivere la ragione accanto alla colonna** (`COMMENT ON COLUMN`, cinque
      volte) più la **rinomina** di ④, il cui nome mente sul contenuto. E F4 diventa la sua metà
      naturale: **il censimento legge i commenti**, e una colonna con una ragione dichiarata esce
      da `da-risolvere`. Così lo strumento smette di essere una fotografia e diventa la cura che
      la fase chiede — chi aggiunge domani una colonna che promette un referente senza mantenerlo
      la vede comparire da sola, perché non avrà nessuna ragione scritta.
- [x] **F3 La bonifica, con le quattro cose** — **FATTA 2026-08-19 (S1072)** · mig. **`000331`**.
      Dopo la correzione di F2 la bonifica **non è né una FK aggiunta né una colonna eliminata**:
      è **scrivere la ragione dove chi interroga il database la trova**. Sei `COMMENT ON COLUMN`,
      ognuno con tre cose — che cosa contiene la colonna, perché non ha un vincolo, e **dove sta
      la decisione** (il rimando a `#218`, che è anche il segnale che F4 legge).
      *Le quattro cose del metodo*: (a) la misura prima, dal censimento; (b) la guardia
      ri-verifica **adesso** che tutte e sei le colonne esistano ancora, e nomina quelle assenti
      invece di far fallire un `COMMENT ON` su una colonna sparita; (c) la post-condizione
      protegge **ciò che non doveva cambiare** — le 225 righe ereditate, il contenuto di
      `sys_source_lineage_records`, e **che nessuna FK sia rinata per distrazione**; (d) il
      rollback **non serve e la ragione è scritta**: `COMMENT ON` non tocca né dati né struttura.

      🔬 **DUE VOLTE ROSSA SULLA PROVA GENERALE, e il difetto era ogni volta nel controllo.**
      Prima: «`sys_source_lineage_records` ha 1 chiave esterna» — vero, ma era quella su
      `tenant_id`, legittima e senza alcun rapporto con quelle sciolte dalla `000281`. Il mio
      controllo guardava **tutte** le FK della tabella invece delle **due colonne** che riguarda.
      Poi, prima di correggerlo: l'errore diceva *quante* e non *quali*, e per scoprire il nome
      serviva una seconda indagine su una macchina remota — ora lo stampa.
      ⚠ **E ha rivelato una cosa vera, fuori da questa voce**: il clone di CI porta quella FK su
      `tenant_id` e **la produzione no**. Registrato sotto, non toccato qui.
- [x] **F4 La guardia che impedisce il prossimo** — **FATTA 2026-08-19 (S1072)**.
      Il censimento **legge i commenti dal database**: una colonna la cui ragione rimanda a
      `#218` esce da `da-risolvere` ed entra in `ragione-scritta`. È ciò che trasforma lo
      strumento da fotografia a cura — chi domani aggiunge una colonna che promette un referente
      senza mantenerlo la vede comparire da sola, perché non avrà nessuna ragione scritta.
      ⚠ **Il segnale è il rimando, non un commento qualunque**: altrimenti qualsiasi descrizione
      diventerebbe un lasciapassare, e sarebbe la guardia a insegnare come aggirarla.

      ✅ **LA BATTERIA, e la correzione che è servita a farla valere.** `--selftest` ha ora **23**
      casi in **una sola lista**, di cui **13 negativi** — cose che NON devono uscire dall'elenco.
      ⚠⚠ La stesura precedente teneva tre gruppi con tre cicli separati e sommava le lunghezze a
      mano: eseguiva **22** casi e ne dichiarava **14**. Peggio, due dei tre cicli giravano
      **prima che il contatore dei rossi esistesse** — un caso fallito li avrebbe fatti morire
      con un `NameError` invece di dire ROSSO. **Uno strumento che misura male sé stesso è il
      difetto più pericoloso che possa avere**, perché il suo verde non significa niente. Ora
      il numero dei casi eseguiti e quello dichiarato sono lo stesso numero, e si vede.

## Fuori da questa voce — trovato misurando, una volta sola

**Il clone di CI e la produzione non hanno le stesse chiavi esterne.** Trovato dalla
post-condizione della `000331`: su `sys.sys_source_lineage_records` il clone porta
`..._tenant_id_fkey` e la produzione **no**. Una delle due ha ragione e l'altra è alla deriva,
e non si sa quale senza guardare: un vincolo in più sul clone rende la CI **più severa** del
posto che deve proteggere (verde in produzione, rosso in CI), uno in meno la rende **cieca**.
Non è materia di `#218` — qui si censiscono i riferimenti senza referente, non la deriva fra
ambienti — ma è la prima volta che quella deriva viene *misurata* invece che sospettata.

## Chiuso quando

Ogni residuo censito in F1 ha una decisione eseguita, e un cancello impedisce che ne nascano di
nuovi senza che qualcuno se ne accorga.
