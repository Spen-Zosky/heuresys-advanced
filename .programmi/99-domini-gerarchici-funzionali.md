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
- [ ] **F3 — Resolver unico dai domini, sull'albero delle UNITÀ** *(passo 4)* — è il cuore del programma: elimina le liste di ruoli sparse e sposta il resolver dall'albero delle posizioni a quello delle unità. Fatto = un solo resolver + test di deriva che **vieta la sesta lista** + contro-oracolo (dopo F3 resolver e org-actors girerebbero sullo stesso albero: serve un oracolo indipendente, o la prova è circolare). Liste note da assorbire: `positions/service.ts:33`, `teams/service.ts:29` · budget ~250k
- [ ] **F4 — Mascheratura + i tre qualificatori di cella** *(passo 5)* — parzialmente anticipata da #124 (S1053: dossier D1+D2 + superficie COMPENSATION D3). Restano i **3 qualificatori di cella** nel contratto dati: schemi Zod + test · budget ~150k
- [ ] **F5 — Completezza di `self`: colmare o motivare le tabelle scoperte** *(passo 6)* — I17: ogni tabella che referenzia una persona è raggiungibile self-scope **o la sua esclusione è dichiarata una per una, motivata**. Cancello meccanico = **#117**, che è la voce gemella: chiudere F5 chiude #117 · budget ~200k
- [ ] **F6 — I quattro domini nuovi: mentore, delega, approvatore, pari** *(passo 7)* — tabelle + endpoint + test · budget ~250k
- [ ] **F7 — Dashboard guidate dal DBMS (tabelle dashboard/blocchi derivate da M3)** *(passo 8)* — ⚠ **si sovrappone a #142** (cruscotti per tipologia di utilizzatore): prima di aprirla, decidere se F7 assorbe #142 o viceversa, altrimenti si costruisce due volte · budget ~250k
- [ ] **F8 — Frontend: sidebar e pagine derivate, i 22 orfani risolti, etichette tradotte** *(passo 9)* — E2E per tipologia · budget ~250k

## Ordine e vincoli

F3 **prima** di F4 e F5 (entrambe consumano il resolver). F7 dopo la decisione di sovrapposizione
con #142. F8 per ultima, perché legge tutto ciò che sta sotto.

## Da dove si riprende

**F3.** Prima mossa: misurare quali consumatori percorrono oggi l'albero delle posizioni
(`grep` sul resolver + i due `service.ts` noti), e **progettare il contro-oracolo prima del
codice** — senza, la prova di F3 è circolare per costruzione.
