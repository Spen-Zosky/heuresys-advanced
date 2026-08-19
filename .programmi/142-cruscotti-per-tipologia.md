# 142 — Cruscotti focalizzati per tipologia di utilizzatore

> **item**: #142 · **priorità**: P1 · **stima register**: ~3-4 sessioni
> **stato**: IN CORSO
> **fonti**: direzione di Enzo 2026-08-05 (registrata nel register) · mig `000271`, `000272`

## Decisioni vincolanti (non si ri-chiedono)

- **Direzione di Enzo**: «la parola *cruscotto* da sola non sarà sufficiente per collegare un
  utente ad un cruscotto». Famiglia indicata: **Azienda · Processi · Organizzazione · Filiale ·
  HR Management · Platform Management · Tenant Management · Self-Service**, e altri.
- Ciascun cruscotto ha **requisiti d'accesso propri**, incluso il **divieto** e la
  **granularità delle viste**.
- **Chiusura dichiarata**: ogni cruscotto ha un permesso proprio; nessuna pagina è raggiungibile
  da chi non può vederne il contenuto; la granularità è dichiarata per vista e verificata con
  **un login reale per tipologia**.
- Stato di partenza già misurato (S1045): esiste **un solo** cruscotto, governato dal permesso
  generico `dashboard:view`, e la sua voce di menu ora lo dichiara (mig `000271`).
- Il ruolo `BRANCH_MANAGER` (mig `000272`) è **già l'aggancio previsto** per «Dashboard
  Filiale»: quando la famiglia arriva si sostituisce il grant generico con quello specifico,
  **senza toccare chi detiene il ruolo**.

## ⚠ Sovrapposizione — SCIOLTA in F1 (2026-08-14)

**Non è «chi assorbe chi»: è che uno è la fondazione dell'altro, e l'ordine conta.**

`M3` del piano domini (`2026-08-03--definizione-domini.md` §11) dichiara la cascata
`tipologia → domini attivi → celle M1 non-none → dashboard e blocchi → voci di sidebar →
pagine`, con la regola: *una tipologia vede una voce **se e solo se** esiste almeno una cella
non-`none` fra i suoi domini e le classi di dato che quella pagina espone.* Lo scopo dichiarato
è rendere **derivabile** ciò che oggi è dichiarato a mano.

Quindi: **#99 F7 dà il MECCANISMO** (come si deriva un cruscotto), **#142 dà il CATALOGO**
(quali cruscotti esistono, per chi, con che contenuto — che è decisione di prodotto e F7 non
la fornisce).

**Conseguenza operativa, ed è il risultato di F1**: costruire F2/F3 di #142 *prima* di #99 F7
significa **dichiarare a mano** gli otto permessi e le loro visibilità — esattamente ciò che M3
esiste per eliminare — e F7 dovrebbe poi smontarli. ~~Perciò **F2 e F3 sono GATED su #99 F7**~~
— ⚠ **FRASE SUPERATA, tenuta per storia** (riconciliata S1071): il gate è caduto il 2026-08-15
(`#99` è DONE, epica chiusa 10/10 in S1064) e F2 e F3 sono **state fatte**, come dice l'elenco
delle fasi qui sotto. Un piano che conserva un blocco già caduto fa credere fermo ciò che si è
mosso, ed è il difetto che `#216` ha curato. Testo originale:
mentre F1 e F4 restano autonome.

## Fasi

- [x] **F1 — INDAGINE: perimetro, sovrapposizione con #99 F7, catalogo delle tipologie** — FATTO 2026-08-14 (S1058). **(a)** sovrapposizione sciolta: vedi sopra — F2/F3 gated su #99 F7. **(b)** catalogo delle tipologie = quello dichiarato da Enzo (Azienda · Processi · Organizzazione · Filiale · HR Management · Platform Management · Tenant Management · Self-Service). **(c)** misura del cruscotto unico, live sul DB di produzione: **una sola voce attiva** — `dashboard` / `/dashboard` / permesso `dashboard:view` / gruppo sidebar `overview` — e **sette ruoli su quattordici** la detengono (`BLUEPRINT_MANAGER, BRANCH_MANAGER, HRMS_MANAGER, MANAGER, PLATFORM_ADMIN, PROCESS_OWNER, TENANT_ADMIN`): sette tipologie diverse guardano la stessa pagina, che è il problema posto da Enzo, misurato. **(d) reperto**: il difetto **D2** del piano domini («4 ruoli su 13 atterrano su `/dashboard` senza poterla vedere») **è già risolto** — `apps/web/src/lib/landing.ts` delega a `landingForPermissions` di `@heuresys/shared` e dichiara in testa che nessuna lista di nomi di ruolo vi sopravvive (voce **#116**): l'atterraggio si deriva dai grant. Una affermazione in meno da inseguire in F2.
- [x] **F2 — Modello dei cruscotti e dei permessi** — FATTO 2026-08-16 (S1064). **Consegna**: mig. `000316` — 3 tabelle (`sys_dashboards`, `sys_dashboard_blocks`, `sys_dashboard_block_data_classes`), **8 famiglie · 27 viste · 21 classi · 7 permessi · 16 concessioni**, più la sentinella `v_dashboard_class_drift` (le sentinelle passano da 17 a **18**). La granularità vive **nel blocco** e la pagina eredita l'unione: una sola verità, e la sentinella sorveglia il giorno in cui divergessero. **Nessuna famiglia è attiva**: le pagine non esistono ancora (le fa F4) e un `CHECK` impedisce di attivarne una senza pagina — un menu che offre pagine inesistenti è la stessa bugia che F7 ha appena tolto. **Reperto della mappatura**: *Organizzazione* e *Filiale* espongono le **stesse classi** — non le separa il *cosa* ma il *perimetro*; le classi di M1 non possono distinguerle, ed è la conferma che ADR-0036 ha due assi. **I due residui chiusi**: la lista di ruoli a mano (`highestRoleLabel`) sostituita da una derivazione, e l'albero delle **posizioni** sostituito da quello delle **unità** in `posizioniNelPerimetroOrganizzativo` — corretta alla sorgente, quindi `dashboard`+`analytics`+`insights` insieme. **Misura sul vivo**: fra i 25 che possono aprire quelle pagine, **19 vedevano il vuoto e ora vedono i propri dati, 0 perdono qualcosa**. Prove: `dashboards-f2.integration.test.ts` **12/12**, suite toccate **63/63**, `ci-rehearsal` VERDE due passate, prova live con **4 login reali** (`apps/api/scripts/prova-live-142-f2.mts`) · budget ~180k
- [x] **F3a — Il catalogo in lettura** — FATTO 2026-08-16 (S1064). Due rotte sul modulo esistente (`GET /v1/dashboard/catalog` e `/catalog/:code`), schemi condivisi, una sola query per l'intero catalogo (non N+1). **Nessun `requirePermission` sulla lista**, e non è una dimenticanza: non esiste UN permesso per «vedere il catalogo» — ogni famiglia porta il suo e il Self-Service non ne ha (I17), quindi il filtro è per-riga e ciò che esce è già solo dell'attore. Il dettaglio nega col **codice che userebbe `requirePermission`**, perché la condizione è la stessa. **10/10 test**, metà sul **divieto**. ⚠ **La prova live ha trovato un difetto mio, e serio**: avevo modellato la mascheratura come **booleano** derivato da `almenoUnaCellaAperta`, che risponde «questa superficie ti riguarda sì/no» e tratta `mask` come *aperto* — così un `PLATFORM_ADMIN` riceveva la vista delle retribuzioni **in chiaro**, contro ADR-0032. E il test non se n'era accorto perché era **tautologico** (filtrava per `COMPENSATION` e asseriva `COMPENSATION`). Ora sono **tre stati** — `open`/`masked`/`denied`, `modalitaDellaVista` in `matrix.ts`, che prende la modalità *migliore* fra i domini per ogni classe e la *peggiore* fra le classi: fallisce chiuso. Evidenza live: mandato tecnico → `masked`, mandato HR → `open`, nessun dominio → `403` · ~110k
- [x] **F3b — I dati dentro le viste** — FATTO 2026-08-19 · **27 fornitori, uno per ogni vista dichiarata**, in `apps/api/src/modules/dashboard/blocchi.ts`; rotta `GET /v1/dashboard/catalog/:code/data`; contenuto in tre forme discriminate (`counters`/`series`/`list`) perché il frontend di F4 possa disegnare una vista senza sapere quale sia. **Il fornitore NON gira sulle viste mascherate**: girare e scartare sarebbe una promessa, non girare è una garanzia. Test **11/11**, metà negativi, e il caso decisivo confronta DUE attori sulla STESSA vista invece di asserire ciò che ha appena filtrato (è il difetto tautologico che F3a aveva pagato). **Sabotato**: fatto riempire il contenuto anche alle mascherate → i 2 casi negativi diventano rossi. Prova live `prova-live-142-f3b.mts` **3/3 verdi** con tre login reali: `enzo.spenuso` (mandato tecnico) 23 viste con dati e la vista economica **masked, zero valori** · `valentina.conti` (mandato HR) 17 viste e la stessa vista **open con 12 valori** · `antonio.parisi` (nessun dominio) **3 viste, solo Self-Service**, 403 sul resto.
      🔬 **Tre difetti trovati dalla prova live, tutti invisibili al typecheck** perché vivono nello schema del database o nelle regole di scope: (1) `import_run_wave` è `smallint` e il `coalesce` con un testo non compila; (2) `user_skill_proficiency` è **varchar** (RD-08: categorico = varchar+CHECK) e non se ne fa la media — «function avg(character varying) does not exist»; (3) ⚠ **il più serio**: chiedevo il tier di scope PRIMA di servire qualunque cruscotto, e `scopeTierAndRole` **lancia** per chi non ha domini (#119). Risultato: **500 sul Self-Service**, cioè sull'unico cruscotto che I17 garantisce a chiunque. Ora `self` non dipende dal tier, e un test lo presidia · budget ~140k
- [ ] **F4 — Frontend + dimostrazione live per tipologia** — pagine, e un login reale **per ogni** tipologia (non una a campione) · budget ~250k

## Da dove si riprende

**F4 — Frontend + dimostrazione live per tipologia.** F3b ha chiuso il 2026-08-19: le 27 viste
hanno il loro contenuto reale, la mascheratura è provata sul vivo, e la rotta `catalog/:code/data`
è la sola sorgente che le pagine dovranno consumare.

- ⚠ **`dashboard_is_active` è ancora `false` per tutte e otto**, e un `CHECK` impedisce di
  attivarne una senza pagina agganciata (`sys_ui_interfaces`). È F4 a costruire le pagine, ad
  agganciarle e ad attivarle — in questo ordine, o il `CHECK` respinge.
- **Le tre forme del contenuto sono un contratto**: `counters` / `series` / `list`. Un componente
  per forma, non uno per vista, o il catalogo torna a essere dichiarato a mano.
- **Il login reale va fatto per OGNI tipologia**, non a campione: è la chiusura dichiarata di
  questa voce.
- ⚠ **La vista `masked` ha un contenuto da mostrare**: `withheldReason`. Non è uno stato vuoto —
  ADR-0032 vuole che riga, soggetto e periodo restino visibili mentre i valori non lo sono.

### Storia di F3b (chiusa)

F3a aveva consegnato il catalogo il 2026-08-16: le rotte esistono, il permesso per famiglia è
applicato, e ogni vista esce già con la propria **modalità** (`open`/`masked`/`denied`). Restava
il contenuto.

- **La modalità è già decisa, non ricalcolarla**: `modalitaDellaVista` (in `matrix.ts`) è
  l'unica fonte. F3b la legge e riempie solo le viste `open`; le `masked` restituiscono la
  dichiarazione senza valori, le `denied` non arrivano nemmeno alla query.
- ⚠ **Non ripetere il mio errore di F3a**: `almenoUnaCellaAperta` risponde a una domanda
  DIVERSA («questa superficie ti riguarda?») e tratta `mask` come aperto. Usarla per decidere
  un contenuto rimette in chiaro ciò che ADR-0032 maschera.
- **`self` non ha permesso** ed è deliberato (I17): l'endpoint self-service non va gated.
- ⚠ **`dashboard_is_active` è `false` per tutte e otto**, e un `CHECK` impedisce di attivarne
  una senza pagina agganciata. È F4 a costruire le pagine e ad attivarle: F3 può servire le
  API senza attivare nulla.
- ⚠ **Un permesso nuovo arriva a `PLATFORM_ADMIN` da solo** — `000005` riga 405 è un grant a
  tappeto che rigira a ogni deploy. Non è un difetto: ADR-0032 protegge i dati HR
  **mascherando**, non negando il permesso. Chi scrive post-condizioni che contano le
  concessioni lo deve sapere, o le scrive rosse (successo qui, due volte).
