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
- [~] **F4 — Mascheratura + i tre qualificatori di cella** *(passo 5)* — **2 su 3 fatti** (2026-08-14). Stato misurato dei tre:
  - ✅ **stato di comunicazione** (valutazioni invisibili finché non consegnate) — implementato in **#92 F5** (`a8fad6f4`): filtro `shared_at OR acknowledged_at` su `/v1/me/performance`, dove una perdita reale è stata riprodotta e chiusa (una persona ne vedeva 4 su 2 comunicate)
  - ✅ **soglia di catena** (paga dei vertici) — `ba779c32`. `chainLevelOf` + `masksTopOfChainPay`; misurato: 5 livelli, 19 vertici, il direttore HR sta al livello 3 e smette di vedere la paga del CEO. **Innestato su 2 punti di `compensation`; i moduli che mascherano sono 18** → estenderlo è il residuo di F4
  - ⬜ **isolamento assoluto** (whistleblowing: solo la custodia, nemmeno il platform) — esiste il modulo dedicato, **non verificato** che l'isolamento regga contro il mandato tecnico: è la prossima mossa di F4
- [ ] **F5 — Completezza di `self`: colmare o motivare le tabelle scoperte** *(passo 6)* — I17: ogni tabella che referenzia una persona è raggiungibile self-scope **o la sua esclusione è dichiarata una per una, motivata**. Cancello meccanico = **#117**, che è la voce gemella: chiudere F5 chiude #117 · budget ~200k
- [ ] **F6 — I quattro domini nuovi: mentore, delega, approvatore, pari** *(passo 7)* — tabelle + endpoint + test · budget ~250k
- [ ] **F7 — Dashboard guidate dal DBMS (tabelle dashboard/blocchi derivate da M3)** *(passo 8)* — ⚠ **si sovrappone a #142** (cruscotti per tipologia di utilizzatore): prima di aprirla, decidere se F7 assorbe #142 o viceversa, altrimenti si costruisce due volte · budget ~250k
- [ ] **F8 — Frontend: sidebar e pagine derivate, i 22 orfani risolti, etichette tradotte** *(passo 9)* — E2E per tipologia · budget ~250k

## Ordine e vincoli

F3 **prima** di F4 e F5 (entrambe consumano il resolver). F7 dopo la decisione di sovrapposizione
con #142. F8 per ultima, perché legge tutto ciò che sta sotto.

## Da dove si riprende

**F4 — Mascheratura + i tre qualificatori di cella.** F3 è chiusa e su `main`; il branch
`wip/99-f3-resolver-unita` è stato mergiato (`ce3d649b`) e non serve più.

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
