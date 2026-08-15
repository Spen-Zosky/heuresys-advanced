# 99 — Domini gerarchici e funzionali: applicare la definizione

> **item**: #99 · **priorità**: P1 · **stima register**: ~6-8 sessioni
> **stato**: IN CORSO
> **fonti**: `D:\heuresys-design-lab\2026-08-03--definizione-domini.md` + `2026-08-03--piano-definizione-domini.md` §7 · ADR-0036 · CLAUDE.md I16-I20, I22

## ⚠ Trappola di numerazione — leggerla prima di tutto

Il register parla di **«8 fasi» F1..F8**; il piano del lab parla di **«passi» 1..9**, dove il
passo 1 (la definizione) è chiuso in lab. **`F<n>` del register = passo `<n+1>` del piano.**
Le due numerazioni sono già state confuse una volta. In questo file comanda la colonna `Fn`.

## Decisioni vincolanti (non si ri-chiedono)

- L'accesso è l'**intersezione** di un perimetro gerarchico (*su quali persone*) e di una
  modalità funzionale (*quali dati e come*) — ADR-0036, che **supersede ADR-0027**.
- La fonte canonica del perimetro gerarchico è **l'albero delle unità**
  (`organization_unit_parent_id` + `organization_unit_manager_user_id`), **non** l'albero delle
  posizioni. Oggi il resolver gira ancora su quello sbagliato: è il bersaglio di F4.
- Un dominio gerarchico **non ha modalità**; nessuna lista di ruoli decide una vista.
- `mask` è il **quarto stato di autorizzazione**, accanto a edit/read/none.
- `PLATFORM_ADMIN` è un mandato **tecnico**, non HR: non apre `COMPENSATION` né `EVALUATION`.

## Fasi

- [x] **F1 — ADR che sostituisce ADR-0027 e riscrive I16-I20** *(passo 2)* — ADR-0036 Accepted, ADR-0027 Superseded, CLAUDE.md con I16-I20 + I22, ADR_INDEX rigenerato — FATTO 2026-08-10 (S1053) · commit `4b8b3871`
- [x] **F2 — Modello dati dei domini + bonifica delle «18 relazioni implausibili»** *(passo 3)* — ASSORBITA: le 18 relazioni oggi sono **0** (query su posizioni attive con riporti: 0 righe su universo 39, assorbite da 000244→000263 + #113/#114) e la sentinella permanente **esiste già** come X10c di `verifica_incrociata.py`, falsificabilità provata per iniezione in transazione — VERIFICATO 2026-08-10 (S1053) · nessuna migrazione da scrivere
- [x] **F3 — Resolver unico dai domini, sull'albero delle UNITÀ** *(passo 4)* — **FATTA 2026-08-14** (commit `63c0c7e8` + merge `ce3d649b` + `383f1eae`). Perimetro sull'albero delle unità · vincolo F1 riscritto su decisione di Enzo (il capo è chi dirige un'unità) · 4 liste di ruoli misurate, 2 assorbite e 2 escluse con motivo · cancello di deriva `test/unit/role-lists-drift.unit.test.ts` con falsificabilità provata. Dettaglio in §F3
- [x] **F4 — Mascheratura + i tre qualificatori di cella** *(passo 5)* — **CHIUSA 2026-08-14 (S1060)**. I tre qualificatori erano coperti; l'estensione della soglia di catena — che era il residuo dichiarato — è fatta, e il vaglio dei 18 moduli è **meccanico e chiuso**: dentro `compensation` (già), `users`/dossier (`0877cdbf`), `analytics` (`ae9cbde3`); fuori `me` (I17), `insights` (la banda è input interno, non esce), `predictions` (percentile dentro `details`, già mascherato), `time-off` (rateo ferie), `evidence`/`okrs`/`talent-review` (falsi positivi: `_payload` contiene «pay»), gli altri 9 senza campi retributivi. Le due perdite trovate erano **reali e misurate**, non teoriche: un mandato HR di livello 3 leggeva dal dossier la busta di luglio di un vertice (3.741,23 €), e dallo scatter di analytics il punto unico a 220.000 € — che è anche il massimo assoluto, quindi `overallMaxMidEur` ripeteva la stessa cifra. Stato dei tre qualificatori:
  - ✅ **stato di comunicazione** (valutazioni invisibili finché non consegnate) — implementato in **#92 F5** (`a8fad6f4`): filtro `shared_at OR acknowledged_at` su `/v1/me/performance`, dove una perdita reale è stata riprodotta e chiusa (una persona ne vedeva 4 su 2 comunicate)
  - ✅ **soglia di catena** (paga dei vertici) — `ba779c32`. `chainLevelOf` + `masksTopOfChainPay`; misurato: 5 livelli, 19 vertici, il direttore HR sta al livello 3 e smette di vedere la paga del CEO. **Innestato su 2 punti di `compensation`; i moduli che mascherano sono 18** → estenderlo è il residuo di F4
  - ✅ **isolamento assoluto** (whistleblowing) — `6c4c92a4`. **Reggeva già**, ma senza prova: ora è presidiato su tre livelli — la platea dei permessi derivata dal DB (solo la custodia), il mandato tecnico che fa login e prende **403** dal vivo, e un cancello di deriva che si accende se un file fuori dal modulo nomina quelle tabelle (rilevatore provato in entrambi i versi: distingue una lettura da un commento)
- [x] **F5 — Completezza di `self`: colmare o motivare le tabelle scoperte** *(passo 6)* — **FATTA 2026-08-15 (S1061)**. Esito letto dal cancello, non dichiarato: **109 tabelle = 78 raggiungibili + 3 tramite il padre + 28 escluse con motivo, SCOPERTE 0** (erano 22). Diciotto escluse una per una; **quattro costruite nella stessa sessione** — `/v1/me/mentorships`, `/v1/me/processes`, `/v1/me/skill-gap-scores` e il campo `assignedTarget` di `/v1/me/kpis`. Zero migrazioni: i permessi riusati sono quelli che il ruolo base `USER` già detiene. Dettaglio in §F5
  - ⚠ **la contraddizione col register era apparente**: `#117` risultava `DONE` mentre questo file lo dava come «gemello da chiudere con F5». Sciolta misurando — **#117 ha costruito il CANCELLO**, F5 è la **classificazione** che quel cancello elencava come scoperta. Due lavori diversi, e nessuno dei due era sbagliato.
- [x] **F6a — Tre dei quattro domini: mentore, approvatore, pari** *(passo 7, prima metà)* — **FATTA 2026-08-15 (S1061)** · commit `aa06344e`. `Domain` passa da 5 a 8 e `activeDomainsOf` li deriva dalle tabelle che li **definiscono** (`sys_mentorships` 17 · `sys_approval_steps` 29 · membro-non-capo di squadra 159), non da liste di ruoli. Prove: `domains-f6.integration.test.ts` 4/4 + 22/22 con `scope-org` e `me`; uguaglianza verificata nei **due versi** contro un contro-oracolo scritto in SQL.
  - ⚠ **il rischio non era aggiungerli, era `hasAnyDomain`**: era `size > 0`, e decide se il menu mostra le voci amministrative. Con `team_peer` sarebbe diventato vero per quasi tutti — **misurato sabotando: 109 persone in più** avrebbero visto il menu di governo. Da qui `DOMINI_CHE_APRONO_UNA_SUPERFICIE`, che è I18 reso codice: mentore/approvatore/pari dicono **cosa fai**, non **su chi puoi guardare**.
- [x] **F6b — Il quarto dominio: la DELEGA** *(passo 7, seconda metà)* — **FATTA 2026-08-15 (S1061)**. L'istituto **non esisteva**: nessuna colonna di delega nel database, e nel codice «delegate» era solo il verbo inglese. Ora c'è, col suo dato: mig **`000314`** (`sys_user_delegations` — delegante · delegato · ambito · decorrenza · scadenza · stato · 2 CHECK di dominio), **2 permessi** (`delegation:read`/`manage`, a `PLATFORM_ADMIN`/`TENANT_ADMIN`/`HRMS_MANAGER`), modulo API **4 rotte** + `GET /v1/me/delegations` (I17, dai due lati). `Domain` è a **9**.
  - **tre scelte dichiarate, non implicite**: l'ambito non è un assegno in bianco (`FULL` esiste nel vincolo ma nessun endpoint lo concede) · la finestra ha decorrenza e scadenza, perché senza il perimetro non sa dire «chi c'era quando» · lo **stato è un atto registrato**, non dedotto dalle date: «revocata» ≠ «scaduta», e `isInForce` si **calcola**, non si memorizza.
  - **niente PATCH e niente DELETE**: una delega non si modifica e non si cancella — si revoca, così la storia resta leggibile.
  - ⚠ **la prova generale è stata ROSSA due volte, ed è servita**: la tabella nuova mancava dal registro di riconciliazione (`000062`) e le sue due FK di soggetto dalla mappa GDPR (`000226`). Entrambi difetti che si vedono **solo alla seconda passata** e che sarebbero stati CI rossa 25 minuti dopo il push; entrambi corretti **emendando il file di numero minore**, che è la regola.
  - **prove**: `delegations.integration.test.ts` 7/7 + `domains-f6` 4/4 + `me` = **21/21**. ⚠ **Il primo sabotaggio NON fu colto**: il caso della revoca era scritto sul soggetto condiviso e si auto-saltava con un `if`, perché i casi precedenti gli lasciavano una delega in vigore. Riscritto con un **soggetto dedicato**, il sabotaggio (rimosso il controllo dello stato) è ora rosso con «il dominio resta acceso dopo la revoca».
- [ ] **F7 — Dashboard guidate dal DBMS (tabelle dashboard/blocchi derivate da M3)** *(passo 8)* — ⚠ **si sovrappone a #142** (cruscotti per tipologia di utilizzatore): prima di aprirla, decidere se F7 assorbe #142 o viceversa, altrimenti si costruisce due volte · budget ~250k
- [ ] **F8 — Frontend: sidebar e pagine derivate, i 22 orfani risolti, etichette tradotte** *(passo 9)* — E2E per tipologia · budget ~250k

## Ordine e vincoli

F3 **prima** di F4 e F5 (entrambe consumano il resolver). F7 dopo la decisione di sovrapposizione
con #142. F8 per ultima, perché legge tutto ciò che sta sotto.

## Da dove si riprende

**F7 — Dashboard guidate dal DBMS** *(passo 8)*, budget ~250k. F4 (S1060), F5, F6a e F6b
(S1061) sono chiuse e non vanno riaperte. Restano **F7** e **F8**: il programma è a **7/8**.

⚠ **Prima di aprire F7 va sciolta la sovrapposizione con `#142`**, ed è già istruita: `#142` F1
(S1058) ha stabilito che **F7 dà il MECCANISMO** (come si deriva un cruscotto dalla matrice M3)
e **`#142` dà il CATALOGO** (quali cruscotti esistono, per chi — decisione di prodotto). Per
questo `#142` F2/F3 sono `GATED` proprio su questa fase: aprirle prima significherebbe
dichiarare a mano gli otto permessi che M3 esiste per derivare.

Tre cose che F6 lascia a chi prosegue:
- **`Domain` è a 9 su 11.** Mancano `self` e `custody`, che ADR-0036 elenca ma che non sono
  domini «da accendere»: `self` è il pavimento universale (I17, sempre vero per tutti) e
  `custody` è il mandato di custodia delle segnalazioni, già presidiato a parte da F4.
  Aggiungerli richiede una decisione, non del codice.
- **`DOMINI_CHE_APRONO_UNA_SUPERFICIE` è il punto delicato di ogni dominio nuovo.** Ogni volta
  che se ne aggiunge uno va deciso **esplicitamente** se entra in quell'insieme, e il test di
  non-regressione dice subito quante persone cambierebbero vista (misurato: sbagliando, **109**).
- **misurato: nessuno è mentore e allievo insieme**, e nessuno è capo e pari della stessa
  squadra. Un test scritto su un soggetto solo copre quindi un lato solo — è successo **due
  volte** in questa sessione, e in entrambi i casi il sabotaggio non fu colto finché non è
  stato aggiunto un secondo soggetto.

Una cosa da sapere prima di F5, imparata in S1060 e valida per ogni fase che segue: la regola
implementata in `lib/scope/*` **non è la regola applicata**. F4 aveva la funzione giusta, provata
da 7 test verdi, e due superfici su tre non la chiamavano. Il vaglio delle superfici va fatto
**meccanicamente** (grep sui campi, non sui nomi dei moduli) e la prova va scritta **contro la
porta HTTP**, non contro la funzione: `evidence`, `okrs` e `talent-review` sembravano toccare
dati di paga solo perché `_payload` contiene «pay».

*(storia: F3 è chiusa e su `main`; il branch
`wip/99-f3-resolver-unita` è stato mergiato (`ce3d649b`) e non serve più.)*

Prima mossa di F4: #124 ha già portato dossier + superficie `COMPENSATION`, quindi si parte
misurando **cosa resta scoperto** dei tre qualificatori di cella nel contratto dati (schemi
Zod), invece di ripartire dal piano.

---

## §F3 — istruttoria del 2026-08-14 (fatta, non da rifare)

### 1. Il cambio d'albero è misurato, e non muove l'accesso di nessuno

Contro-oracolo eseguito sul database vivo (161 attori, 43 unità attive, 161 posizioni):

| | albero POSIZIONI (oggi) | albero UNITÀ (ADR-0036) |
|---|---|---|
| accessi totali | 649 | **649** |
| attori con perimetro diverso | — | **0 su 161** |
| accessi guadagnati / persi | — | **0 / 0** |

I due alberi **coincidono** sui dati reali. Il passaggio non allarga e non restringe: allinea
la fonte alla definizione. *(Trappola in cui sono caduto e che vale la pena non ripetere: la
prima misura diceva «il CEO perde 133 persone». Era un errore mio nella CTE ricorsiva —
`c.anc` invece di `c.des`, quindi la chiusura scendeva di un livello solo. I dati erano sani.)*

### 2. La prova NON può essere comportamentale

Poiché i due alberi coincidono, **nessun dato reale distingue l'uno dall'altro**: un test sui
dati di oggi sarebbe verde in entrambi i casi. Peggio: `scope-org` derivava i suoi attori
dall'albero delle unità *proprio perché* il resolver girava sulle posizioni — dopo F3 le due
fonti sono la stessa e quelle sei asserzioni diventano **circolari**.

La prova costruita (verde, sul branch) **fabbrica la divergenza** dentro la transazione del
file: spostare il riporto della POSIZIONE non muove il perimetro; spostare l'UNITÀ della
persona lo muove. Rollbackata da tx-isolation.

### 3. ✅ LA DECISIONE — presa da Enzo il 2026-08-14: **dirigere un'unità = essere capo**

Il ruolo RBAC manageriale resta come **aggiunta** (copre chi ha il ruolo sulla carta senza
dirigere un'unità), non come condizione alternativa di pari rango. I quattro test sono stati
riscritti su ciò che resta significativo, ed è una regola **più stretta** di prima: nemmeno un
riporto nell'albero delle posizioni apre un perimetro. Il testo qui sotto resta come cronaca
di come la domanda è nata.

### 3-bis. Com'era posta la domanda (cronaca)

Quattro test di `scope-resolver` e `users` diventano rossi con **universo vuoto**
(`expected 0 to be greater than 0`). Verificano il **vincolo F1 di Enzo**:

> «un utente NON manageriale che HA riporti vede solo se stesso»

Nel modello nuovo **quel caso non è più costruibile**: avere riporti significa dirigere
un'unità, e dirigere un'unità è già il segnale manageriale (`isOrgUnitManager`). Il segnale
e la fonte del perimetro diventano la stessa cosa, quindi **metà del vincolo F1 resta senza
casi possibili**. Resta significativo solo il ramo RBAC: chi ha ruolo `MANAGER`/`CEO` ma non
dirige alcuna unità → perimetro vuoto → self.

**Le tre uscite possibili** (nessuna è un dettaglio di implementazione):
1. **F1 si riscrive**: il segnale manageriale diventa *dirigere un'unità*, e il ramo RBAC
   diventa un'aggiunta, non una condizione. I 4 test si riscrivono su ciò che resta.
2. **F1 si conserva** com'è: allora l'albero delle posizioni deve sopravvivere come seconda
   fonte accanto a quello delle unità — cioè F3 non elimina un albero, ne tiene due.
3. **F1 si ritira**: il vincolo nacque quando il perimetro veniva dalle posizioni; se quella
   fonte sparisce, potrebbe non servire più.
