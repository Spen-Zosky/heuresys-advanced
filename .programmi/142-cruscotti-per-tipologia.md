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
- [ ] **F2 — Modello dei cruscotti e dei permessi** ✅ **SBLOCCATA 2026-08-15 (S1062)**: #99 F7 è chiusa e il meccanismo esiste — `M1` (`lib/scope/matrix.ts`), la tabella `sys_ui_interface_data_classes` (mig. `000315`) e `almenoUnaCellaAperta`. Un cruscotto nuovo si dichiara con le **classi che espone**, e la sua platea si deriva; i permessi non si scrivono a mano ruolo per ruolo · budget ~180k
- [ ] **F3 — API per cruscotto** ✅ **SBLOCCATA 2026-08-15 (S1062)** — un endpoint per famiglia, granularità dichiarata per vista, integration test per il **divieto** oltre che per l'accesso · budget ~250k
- [ ] **F4 — Frontend + dimostrazione live per tipologia** — pagine, e un login reale **per ogni** tipologia (non una a campione) · budget ~250k

## Da dove si riprende

**F2 — Modello dei cruscotti e dei permessi.** Il blocco è caduto il 2026-08-15: #99 F7 ha
consegnato il meccanismo. Da sapere prima di aprirla, perché cambia il disegno di F2:

- La derivazione **restringe, non concede**. Dichiarare che un cruscotto espone `COMPENSATION`
  non lo apre a nessuno: toglie a chi ha `COMPENSATION = none` in M1 (capi-squadra,
  proprietari di processo, mentori, approvatori). Il *se* resta il permesso RBAC.
- **Il permesso proprio per cruscotto serve ancora.** F7 non lo sostituisce: sostituisce la
  parte «quali tipologie lo vedono», non «esiste il diritto di vederlo».
- Le otto famiglie dichiarate da Enzo vanno mappate sulle **sette classi** di M1: è lì che si
  vede se una famiglia è davvero distinta o se è la stessa vista con un altro nome.
