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
esiste per eliminare — e F7 dovrebbe poi smontarli. Perciò **F2 e F3 sono GATED su #99 F7**,
mentre F1 e F4 restano autonome.

## Fasi

- [x] **F1 — INDAGINE: perimetro, sovrapposizione con #99 F7, catalogo delle tipologie** — FATTO 2026-08-14 (S1058). **(a)** sovrapposizione sciolta: vedi sopra — F2/F3 gated su #99 F7. **(b)** catalogo delle tipologie = quello dichiarato da Enzo (Azienda · Processi · Organizzazione · Filiale · HR Management · Platform Management · Tenant Management · Self-Service). **(c)** misura del cruscotto unico, live sul DB di produzione: **una sola voce attiva** — `dashboard` / `/dashboard` / permesso `dashboard:view` / gruppo sidebar `overview` — e **sette ruoli su quattordici** la detengono (`BLUEPRINT_MANAGER, BRANCH_MANAGER, HRMS_MANAGER, MANAGER, PLATFORM_ADMIN, PROCESS_OWNER, TENANT_ADMIN`): sette tipologie diverse guardano la stessa pagina, che è il problema posto da Enzo, misurato. **(d) reperto**: il difetto **D2** del piano domini («4 ruoli su 13 atterrano su `/dashboard` senza poterla vedere») **è già risolto** — `apps/web/src/lib/landing.ts` delega a `landingForPermissions` di `@heuresys/shared` e dichiara in testa che nessuna lista di nomi di ruolo vi sopravvive (voce **#116**): l'atterraggio si deriva dai grant. Una affermazione in meno da inseguire in F2.
- [x] **F2 — Modello dei cruscotti e dei permessi** — FATTO 2026-08-16 (S1064). **Consegna**: mig. `000316` — 3 tabelle (`sys_dashboards`, `sys_dashboard_blocks`, `sys_dashboard_block_data_classes`), **8 famiglie · 27 viste · 21 classi · 7 permessi · 16 concessioni**, più la sentinella `v_dashboard_class_drift` (le sentinelle passano da 17 a **18**). La granularità vive **nel blocco** e la pagina eredita l'unione: una sola verità, e la sentinella sorveglia il giorno in cui divergessero. **Nessuna famiglia è attiva**: le pagine non esistono ancora (le fa F4) e un `CHECK` impedisce di attivarne una senza pagina — un menu che offre pagine inesistenti è la stessa bugia che F7 ha appena tolto. **Reperto della mappatura**: *Organizzazione* e *Filiale* espongono le **stesse classi** — non le separa il *cosa* ma il *perimetro*; le classi di M1 non possono distinguerle, ed è la conferma che ADR-0036 ha due assi. **I due residui chiusi**: la lista di ruoli a mano (`highestRoleLabel`) sostituita da una derivazione, e l'albero delle **posizioni** sostituito da quello delle **unità** in `posizioniNelPerimetroOrganizzativo` — corretta alla sorgente, quindi `dashboard`+`analytics`+`insights` insieme. **Misura sul vivo**: fra i 25 che possono aprire quelle pagine, **19 vedevano il vuoto e ora vedono i propri dati, 0 perdono qualcosa**. Prove: `dashboards-f2.integration.test.ts` **12/12**, suite toccate **63/63**, `ci-rehearsal` VERDE due passate, prova live con **4 login reali** (`apps/api/scripts/prova-live-142-f2.mts`) · budget ~180k
- [ ] **F3 — API per cruscotto** ✅ **SBLOCCATA 2026-08-15 (S1062)** — un endpoint per famiglia, granularità dichiarata per vista, integration test per il **divieto** oltre che per l'accesso · budget ~250k
- [ ] **F4 — Frontend + dimostrazione live per tipologia** — pagine, e un login reale **per ogni** tipologia (non una a campione) · budget ~250k

## Da dove si riprende

**F3 — API per cruscotto.** F2 ha consegnato il modello il 2026-08-16. Da sapere prima di
aprire F3, perché ne cambia il disegno:

- **Il catalogo è già interrogabile**: `sys_dashboards` → `sys_dashboard_blocks` →
  `sys_dashboard_block_data_classes`. Un endpoint per famiglia legge di lì quali viste
  comporre, e la granularità per vista **c'è già** — non va inventata in F3, va onorata.
- **La platea non si scrive**: il permesso è in `dashboard_permission_code`, e la restrizione
  è M1 sulle classi del blocco. Un blocco che l'attore non può vedere si **omette**, e
  l'endpoint deve dire *che* è stato omesso (`masked`, quarto stato — I20), non tacere.
- **`self` non ha permesso** ed è deliberato (I17): l'endpoint self-service non va gated.
- ⚠ **`dashboard_is_active` è `false` per tutte e otto**, e un `CHECK` impedisce di attivarne
  una senza pagina agganciata. È F4 a costruire le pagine e ad attivarle: F3 può servire le
  API senza attivare nulla.
- ⚠ **Un permesso nuovo arriva a `PLATFORM_ADMIN` da solo** — `000005` riga 405 è un grant a
  tappeto che rigira a ogni deploy. Non è un difetto: ADR-0032 protegge i dati HR
  **mascherando**, non negando il permesso. Chi scrive post-condizioni che contano le
  concessioni lo deve sapere, o le scrive rosse (successo qui, due volte).
