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
- [~] **F3 — Resolver unico dai domini, sull'albero delle UNITÀ** *(passo 4)* — **METÀ FATTA, PARCHEGGIATA su una decisione di Enzo** (2026-08-14). Vedi §F3 in fondo. Restano le liste di ruoli da assorbire: `positions/service.ts:33`, `teams/service.ts:29` · budget residuo ~150k
- [ ] **F4 — Mascheratura + i tre qualificatori di cella** *(passo 5)* — parzialmente anticipata da #124 (S1053: dossier D1+D2 + superficie COMPENSATION D3). Restano i **3 qualificatori di cella** nel contratto dati: schemi Zod + test · budget ~150k
- [ ] **F5 — Completezza di `self`: colmare o motivare le tabelle scoperte** *(passo 6)* — I17: ogni tabella che referenzia una persona è raggiungibile self-scope **o la sua esclusione è dichiarata una per una, motivata**. Cancello meccanico = **#117**, che è la voce gemella: chiudere F5 chiude #117 · budget ~200k
- [ ] **F6 — I quattro domini nuovi: mentore, delega, approvatore, pari** *(passo 7)* — tabelle + endpoint + test · budget ~250k
- [ ] **F7 — Dashboard guidate dal DBMS (tabelle dashboard/blocchi derivate da M3)** *(passo 8)* — ⚠ **si sovrappone a #142** (cruscotti per tipologia di utilizzatore): prima di aprirla, decidere se F7 assorbe #142 o viceversa, altrimenti si costruisce due volte · budget ~250k
- [ ] **F8 — Frontend: sidebar e pagine derivate, i 22 orfani risolti, etichette tradotte** *(passo 9)* — E2E per tipologia · budget ~250k

## Ordine e vincoli

F3 **prima** di F4 e F5 (entrambe consumano il resolver). F7 dopo la decisione di sovrapposizione
con #142. F8 per ultima, perché legge tutto ciò che sta sotto.

## Da dove si riprende

**F3, dal punto in cui è stata parcheggiata** — leggere la sezione qui sotto, poi la domanda
per Enzo. Il codice non è su `main`: è sul branch **`wip/99-f3-resolver-unita`**, commit
`f640644f`, con le sue prove verdi. `main` non è mai stato lasciato rosso.

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

### 3. ⛔ LA DECISIONE CHE FERMA F3 — è di Enzo, non tecnica

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
