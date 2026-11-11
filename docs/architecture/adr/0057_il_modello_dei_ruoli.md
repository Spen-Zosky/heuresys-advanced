# ADR-0057 — Il modello dei ruoli: il comando si calcola, il funzionale si decide

- **Status**: ACCETTATO il 2026-11-10 da Enzo Spenuso, alle 15:16 UTC (16:16 ora di Roma), nel thread «Riordinare i ruoli degli utenti RTL», con il messaggio «approvo il modello dei ruoli», sulle decisioni D1-D5 consigliate. Il 2026-11-10 Enzo aveva scritto «c'è un gran casino: ruoli replicati. ruoli assegnati in unità organizzative non coerenti» e «va ricostruito daccapo».
- **Date**: 2026-11-10
- **Redatto da**: Claude Code, thread «Riordinare i ruoli degli utenti RTL»
- **Builds on**: ADR-0027 (due assi, gerarchico e funzionale), ADR-0035 (ritirare non è cancellare), ADR-0036 (mandati HR), ADR-0050 (il mandato come atto), ADR-0055 (la piattaforma concede con un motivo), regole di Enzo del 2026-10-31 (il ruolo segue il lavoro; USER è di tutti) e del 2026-11-05 (ogni ruolo delle utenze di prova va a una persona vera).
- **Non tocca**: I5, I16-I22 (il perimetro resta calcolato da `apps/api/src/lib/scope/resolver.ts` sull'organigramma), l'organigramma stesso.

> **In parole semplici.**
> 1. Chi comanda (CEO, Manager, Direttore di filiale, Team Leader) non si sceglie a mano: lo dice l'organigramma, e ognuno ha al massimo un ruolo di comando.
> 2. Il ruolo di lavoro (Tenant Admin, People Manager, DPO e gli altri) lo decide Enzo per nome, uno per persona, con il motivo legato alla posizione.
> 3. «Membro del team» non si concede più: non aggiungeva niente a «Utente».
> 4. Le migrazioni smettono di ridare i ruoli a ogni rilascio.

---

## §1 — Contesto

Misura del 2026-11-10 sul dump di produzione delle 03:42, ripristinato in una copia privata sulla VM (la produzione non è stata letta): 402 concessioni attive su 167 utenti di RTL Bank; 375 senza motivo né concedente; 0 atti di mandato in `sys.sys_mandate_acts`. I 10 direttori di filiale tenevano `BRANCH_MANAGER`, `TEAM_LEADER`, `TEAM_MEMBER` e `USER`; la Direttrice HR sei ruoli, fra cui `TENANT_ADMIN`, `HRMS_MANAGER` e `ORG_DIRECTOR`, mentre `TENANT_ADMIN` contiene già tutti i permessi di `ORG_DIRECTOR` e `HIRING_MANAGER` e tutti salvo 3 di `HRMS_MANAGER`. `TEAM_MEMBER` (13 permessi) è contenuto per intero in `USER`. La causa: dieci migrazioni concedono ruoli (000049, 000111, 000150, 000155, 000205, 000259, 000272, 000295, 000389, 000479), ciascuna con un criterio suo, e la catena si riapplica a ogni rilascio. Una concessione di ruolo non porta un'unità: il perimetro viene dalla posizione nell'organigramma, quindi «un ruolo nell'unità sbagliata» è un ruolo che non corrisponde alla posizione.

## §2 — Decisione

**R1.** Due assi separati (ADR-0027): il ruolo di comando viene dall'organigramma, il ruolo funzionale dal lavoro della persona.

**R2.** Il ruolo di comando si calcola e non si concede a mano (`sys.v_ruoli_di_comando_attesi`, migrazione 000485): titolare della sede o della Direzione Generale = `CEO`; di una filiale = `BRANCH_MANAGER`; di un'unità con figlie attive = `MANAGER`; di un'unità foglia = `TEAM_LEADER`. Guidare una squadra senza reggere un'unità non dà `TEAM_LEADER` (decisione di Enzo del 2026-10-31 su Marco Rinaldi). Vince il grado più alto. Al massimo uno per persona.

**R3.** `USER` è di tutti e non si tocca. `TEAM_MEMBER` non si concede più: l'appartenenza a una squadra è in `sys.sys_team_members`.

**R4.** Il ruolo funzionale lo decide Enzo per nome, con il motivo; al massimo uno per persona, un'eccezione si dichiara con il suo motivo. L'elenco vigente è in `db/scripts/modello-ruoli.sql`.

**R5.** Un ruolo che ne contiene un altro lo sostituisce. Perché sia vero, 000485 aggiunge a `BRANCH_MANAGER` e `CEO` i permessi di `TEAM_LEADER`, a `CEO` quelli di `BRANCH_MANAGER` (solo aggiunte, elencate in `staging.modello_ruoli_permessi_aggiunti`). `TENANT_ADMIN` non assorbe i 3 permessi di `HRMS_MANAGER` (`agent_capability:activate`, `consolidation:decide`, `consolidation:run`): lo vietano l'allowlist deny-by-default D-57 e 000481, verificate da `rbac-tenant-admin-allowlist.test.ts` e `agent-capabilities.integration.test.ts`.

**R6.** Ogni mandato regge su un atto approvato da un secondo titolare di mandato (ADR-0050 D4). Le concessioni dell'allineamento portano motivo e concedente (ADR-0055); gli atti di conferma si fanno dall'interfaccia, dopo l'allineamento.

**R7.** Le utenze di collaudo non tengono ruoli a riposo: `provision-collaudo-access` li concede all'inizio di un giro.

**R8.** Una fonte sola: `db/scripts/modello-ruoli.sql` porta il database allo stato dichiarato, con giornale `staging.modello_ruoli_undo` e inversa `db/scripts/modello-ruoli-inversa.sql`. Dopo la prima corsa applicata (`staging.modello_ruoli_corse`, funzione `sys.f_modello_ruoli_applicato()`), 000150, 000155, 000259 e 000272 smettono di concedere ruoli; su un database nuovo si comportano come prima. `sys.v_ruoli_fuori_modello` mostra ciò che si scosta dal modello, per esempio dopo un cambio dell'organigramma.

## §3 — Le decisioni di Enzo del 2026-11-10

- **D1.** Valentina Conti (HR Director) tiene `TENANT_ADMIN` e `HRMS_MANAGER`: il secondo porta le tre decisioni (agenti, consolidamento) che `TENANT_ADMIN` per D-57 non ha. Lascia `ORG_DIRECTOR` e `HIRING_MANAGER`.
- **D2.** `PEOPLE_MANAGER` passa da Paolo Barbieri a Maria Colombo; Barbieri prende `BLUEPRINT_MANAGER`.
- **D3.** Beatrice Russo tiene `RECRUITER` e `TAXONOMY_STEWARD` come eccezione dichiarata.
- **D4.** `TEAM_MEMBER` non si concede più.
- **D5.** Le utenze di collaudo perdono i ruoli a riposo.

Il resto dell'elenco: Marco Bruno `DATA_STEWARD`; Laura Santoro `DPO`; Andrea Martino `WHISTLEBLOWING_CUSTODIAN`; Alice Costa `SECURITY_ADMIN`; Luca Bianchi `PROCESS_OWNER`; Enzo Spenuso `PLATFORM_ADMIN` (che contiene `SALES`, `PLATFORM_OPERATOR`, `IMPLEMENTATION_CONSULTANT`, `BLUEPRINT_MANAGER`, `MANAGER` e `CEO`, misurato). Restano senza titolare in RTL, coperti da `TENANT_ADMIN`: `ORG_DIRECTOR`, `HIRING_MANAGER`, `READ_ONLY`.

## §4 — Conseguenze

- Il rilascio di 000485 non cambia le concessioni di nessuno: aggiunge permessi, viste e registro. L'allineamento delle persone in produzione è un passo a parte, con una frase scritta di Enzo, da fare dopo l'armonizzazione dell'organigramma con la corsa del datastore (decisione di Enzo del 2026-11-10: la corsa è la fonte di verità), così i ruoli di comando si calcolano una volta sola sull'organigramma definitivo.
- La regola di Enzo sui doppioni (2026-11-10): lo stesso ruolo in filiali diverse è una voce sola del catalogo con più titolari; due capi della stessa unità non possono esistere, e nel modello non possono perché il comando nasce dall'unico titolare dell'unità.
- Le prove e i testi che citano Federica Marchetti come Tenant Admin o Maria Colombo come HRMS Manager vanno allineati quando il modello si applica alla base delle prove.
