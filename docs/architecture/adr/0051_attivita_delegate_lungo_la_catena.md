# ADR-0051 — Le attività delegate lungo la catena

- **Status**: ACCETTATO il 2026-10-31 da Enzo Spenuso (in chat alle 18:12 ora di Roma: «sì, ADR-0051»); proposto lo stesso giorno alle 17:30
- **Date**: 2026-10-31
- **Redatto da**: Claude Code, thread «Portare nel progetto le attività delegate»
- **Richiesta**: Enzo Spenuso, 2026-10-31 17:23 ora di Roma: «c'è un altro principio fondamentale che non è ancora stato implementato e iniettato nel progetto: attività delegate. Questo disciplina il principio in base al quale un capo (genericamente parlando) può delegare attività proprie anche ad un suo collaboratore dipendente all'interno della catena organizzativa di cui il capo è il vertice (quindi si applica a chi non è il responsabile di una Unità Organizzativa ma che comunque è referente/responsabile di altri user presenti nella medesima catena».
- **Relates to**: ADR-0036 (domini, `delegation` fra gli 11 funzionali; I16-I20), ADR-0049 (le attività appartengono a un processo), ADR-0050 proposto (identificazione legata al mandato), ADR-0011 (ESS in modulo dedicato), regola di Enzo del 2026-10-31 «il ruolo segue il lavoro», regola trasversale «piattaforma agentica, AI driven».

> **In parole semplici.**
> 1. Chi è a capo di altre persone (perché guida un'unità, oppure perché altre posizioni riportano alla sua) può affidare a una di loro una **sua** attività: per esempio approvare le ferie della squadra mentre è via.
> 2. Può delegare solo a chi sta **sotto di lui** nella catena, e solo ciò che **lui stesso** può fare: la delega non dà mai più di quanto abbia chi delega.
> 3. La delega ha un inizio, una fine, un autore e si può revocare. Ogni azione del delegato resta firmata «Mario Rossi per conto di Anna Bianchi».
> 4. Non serve un ruolo da amministratore per delegare: il diritto nasce dall'essere capo. Gli amministratori HR intervengono solo per eccezione (per esempio quando il capo è assente all'improvviso).
> 5. Gli agenti della piattaforma propongono e ricordano le deleghe (assenze in arrivo, pratiche ferme), ma la decide sempre una persona.

---

## Contesto

Letto su `main` (commit `84eb51d`) e misurato in sola lettura in produzione il 2026-10-31 alle 17:25 ora di Roma dal thread dell'analisi delle interfacce:

- la tabella `sys.sys_user_delegations` esiste dalla migrazione 000314, con gli ambiti `APPROVALS`, `FULL` e `CONSOLIDATION` (000465), decorrenza, scadenza, stato `ACTIVE|REVOKED` e motivo. In produzione è vuota;
- l'API `/v1/delegations` (`apps/api/src/modules/delegations`) crea e revoca deleghe **per conto di altri**, e lo può fare solo chi ha `delegation:manage` (TENANT_ADMIN, HRMS_MANAGER, SECURITY_ADMIN, PLATFORM_ADMIN). Un capo non può delegare da solo;
- **nessun vincolo di catena**: oggi si può registrare una delega fra due persone qualsiasi del tenant;
- l'ambito `APPROVALS` **non ha effetto**: il modulo `approvals` non legge le deleghe. L'unico consumatore reale è `tenant-consolidation` (ambito `CONSOLIDATION`, ADR-0036 non coinvolto);
- nella matrice M1 (`apps/api/src/lib/scope/matrix.ts`) il dominio `delegation` vale `ACTIVITY = read` e niente altro, per scelta dichiarata;
- dal 2026-08-14 (#99 F3) la catena si calcola solo dall'albero delle **unità** (`apps/api/src/lib/scope/org.ts`, `orgSubtreeUserIds`). Il riporto fra **posizioni** (`position_reports_to_position_id`) esiste ancora nei dati: in RTL Bank 157 posizioni riportano a 38 referenti, e oggi tutti e 38 guidano anche un'unità. Il caso del referente senza unità quindi è previsto dal principio ma in RTL oggi non c'è; nascerà con il primo tenant che ha capi-squadra o coordinatori senza unità propria.

## Decisione

### 1. Chi è capo: due fonti della catena, una sola regola

La **catena di delega** di una persona è l'unione di:

- (a) il sottoalbero delle unità che dirige (la fonte di oggi, `orgSubtreeUserIds`);
- (b) il sottoalbero transitivo delle posizioni che riportano alla sua posizione attiva (`position_reports_to_position_id`), cioè i titolari attivi di quelle posizioni.

La fonte (b) vale **solo per la delega**: non allarga il perimetro dei dati sensibili di ADR-0036 (I18-I20), che resta sull'albero delle unità. Un referente senza unità diventa capo **per le attività**, non per vedere stipendi e valutazioni dei suoi.

Le squadre (`team_lead`) non sono catena: sono un dominio funzionale, e una squadra può attraversare più unità.

### 2. Il vincolo di catena

Una delega di catena è valida se e solo se:

- il delegato sta nella catena di delega del delegante (escluso il delegante stesso);
- entrambi appartengono al tenant;
- la finestra è coerente (già nel CHECK).

Il vincolo si controlla **alla creazione** e **a ogni uso**: se l'organigramma cambia e il delegato esce dalla catena, la delega non viene revocata ma **non ha effetto** finché la condizione non torna vera, e la pagina lo mostra («sospesa: Mario Rossi non è più nella tua catena»). Revocare resta un atto di una persona, come da 000314.

### 3. Che cosa si delega: attività proprie, per tipo

La delega porta un **ambito** e, dove serve, un **oggetto**:

| ambito | oggetto | effetto |
|---|---|---|
| `APPROVALS` | facoltativo: un tipo di richiesta (ferie e permessi, formazione…) | il delegato vede e decide i passi di approvazione assegnati al delegante |
| `PROCESS_STEP` (nuovo) | obbligatorio: un'attività di processo (`sys_tenant_process_steps`, ADR-0049) | il delegato esegue quell'attività al posto del delegante |
| `CONSOLIDATION` | i gruppi di dati (000465) | resta com'è: delega di mandato del Direttore HR |
| `FULL` | — | resta non concedibile (000314) |

Regola cardine: **la delega non dà mai più di quanto abbia chi delega**. Il diritto del delegato su un oggetto è l'intersezione fra ciò che la delega nomina e ciò che il delegante può fare oggi su quell'oggetto. Se il delegante perde il diritto, lo perde anche il delegato.

**Dati sensibili esclusi per regola.** Una delega di catena non trasmette le classi COMPENSATION, EVALUATION e SPECIAL_CATEGORY: un'approvazione retributiva o una valutazione non si delega lungo la catena. Se in futuro servisse, si apre con un nuovo ADR, non con un valore del vincolo.

**Niente sub-delega.** Il delegato non può delegare a sua volta ciò che ha ricevuto.

**Niente decisioni su di sé.** Il delegato non vede e non decide per conto del delegante una richiesta che lo riguarda: una che ha presentato lui o di cui è il soggetto (per esempio le sue ferie). Errore `DELEGATION_OWN_REQUEST`. Aggiunta il 2026-11-01 dopo la segnalazione della revisione di sicurezza del rilascio.

### 4. Chi può creare una delega

- **Il capo, da sé**, per le proprie attività: `POST /v1/me/delegations` (delegante = chi chiama, sempre). Non serve un permesso di ruolo: il diritto nasce dall'essere capo (il ruolo segue il lavoro). Vive nel modulo ESS (ADR-0011).
- **Gli amministratori HR, per eccezione**: l'attuale `/v1/delegations` con `delegation:manage` resta per i casi in cui il capo non può farlo (assenza improvvisa). Anche loro devono rispettare il vincolo di catena: l'eccezione riguarda **chi** crea la delega, non **a chi** va.

Il delegante, il delegato e chi ha `delegation:read` vedono la delega. Il delegante e gli amministratori la revocano.

### 5. La firma «per conto di»

Ogni azione compiuta in forza di una delega registra il delegato come autore e la delega come titolo (`acting_delegation_id` nel registro di audit e, dove esiste, sulla decisione: per esempio sul passo di approvazione). L'interfaccia scrive «Mario Rossi per conto di Anna Bianchi». Il delegante riceve una notifica per ogni azione fatta a suo nome.

### 6. Gli agenti

La piattaforma è agentica. Per la delega gli agenti hanno tre compiti, nessuno dei quali decide al posto di una persona:

- **proporre**: quando il capo ha un'assenza approvata in arrivo e pratiche assegnate, l'agente propone una delega (a chi, per cosa, da quando a quando) che il capo conferma con un gesto;
- **ricordare**: deleghe in scadenza, deleghe sospese perché la catena è cambiata, pratiche ferme presso un delegato;
- **spiegare**: perché una persona può o non può ricevere una delega (fuori catena, attività non del delegante, classe esclusa).

Un agente **non riceve deleghe** finché gli agenti non hanno un'identità propria (tema di ADR-0050). Quando l'avranno, potrà riceverle con le stesse regole delle persone e con la firma «agente X per conto di Y».

### 7. Cosa non cambia

- Il perimetro dei dati di ADR-0036: la delega non apre dati sensibili.
- Il CHECK su `FULL` e la delega `CONSOLIDATION` del Direttore HR.
- Le deleghe esistenti: in produzione la tabella è vuota (misurato il 2026-10-31).

## Implementazione

Fatta il 2026-10-31 sul ramo del thread, con queste precisazioni rispetto alla bozza:

1. Migrazione `000468`: ambito `PROCESS_STEP` nel CHECK (emendato alla fonte in `000314`; `000465` ora cerca il CHECK per nome), colonne `user_delegation_request_type` e `user_delegation_tenant_process_step_id` con il CHECK di coerenza, `approval_step_acting_delegation_id` sui passi di approvazione, la voce di menu `/me/delegations` con l'etichetta inglese. **Il tipo di delega non è una colonna**: si legge dall'ambito (APPROVALS e PROCESS_STEP sono di catena, CONSOLIDATION e FULL di mandato), perché una colonna in più sarebbe una seconda verità.
2. `apps/api/src/lib/scope/org.ts`: `delegationChainUserIds` (unità più riporti fra posizioni) e `ownUnitIds` (le unità di cui un'attività è «propria»).
3. Servizio deleghe: vincolo di catena alla creazione, dalle due vie; validità rimisurata a ogni uso e mostrata come `inChain`; rotte `/v1/me/delegations` (conferire, revocare le proprie, candidati, casella, decisione, proposte). Il pavimento delle rotte è `approval:read:self`, del ruolo base: il diritto di delegare lo misura la catena, non un ruolo.
4. Approvazioni: il delegato decide i passi del delegante dalla propria casella; ogni condizione si ri-verifica dentro la transazione della decisione; il passo resta del delegante, `decided_by` è il delegato e la delega è il titolo. Il delegante riceve un avviso per ogni decisione presa a suo nome. **I tipi delegabili sono un elenco chiuso per inclusione** (ferie e permessi, iniziative formative): un tipo nuovo non diventa delegabile da sé, e le richieste senza tipo restano fuori.
5. Una delega `PROCESS_STEP` ha effetto sulle richieste che appartengono a quell'attività (ADR-0049): oggi l'attività di processo non ha altro lavoro registrato su cui agire.
6. Pagina «Deleghe» nell'area personale (`apps/web/src/app/(authenticated)/me/delegations/page.tsx`).
7. Proposta dell'agente: oggi è una **regola**, non un modello linguistico. Un'assenza approvata che comincia entro 30 giorni, con passi di approvazione aperti e senza una delega che la copra, produce una proposta con la spiegazione; suggerisce l'ultima persona a cui si è delegato, se è ancora nella catena. La persona conferma con un gesto.

## Prove

- Una delega fuori catena è rifiutata (`DELEGATION_OUT_OF_CHAIN`), vista rossa prima della guardia.
- Un referente senza unità ma con posizioni che gli riportano può delegare ai titolari di quelle posizioni, e non vede per questo i loro dati sensibili.
- Un delegato che esce dalla catena perde l'effetto della delega senza che la riga cambi.
- Un'approvazione decisa dal delegato porta la firma «per conto di».
- Il delegato non decide per conto del capo una richiesta che lo riguarda (`DELEGATION_OWN_REQUEST`).
