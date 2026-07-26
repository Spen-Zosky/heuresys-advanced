# DATA_PATTERNS — registro dei pattern di dati riusabili

> **Scopo** (istruzione di Enzo, 2026-07-26): tenere censite e aggiornate le **logiche di dati già
> adottate** nel DBMS — le forme che si ripetono e che si possono **riproporre** ad altri scenari.
> Nasce da un caso concreto: la logica del catalogo skill/occupazioni (schema + gerarchia + crosswalk
> + applicabilità settoriale) è stata riconosciuta come forma generale e riusata per il catalogo dei
> **tipi di unità organizzativa**. Questo file esiste perché quel riconoscimento non resti un episodio.

**Cosa NON è**: non è uno stato del progetto (→ `SOT_STATE.md`), non è un backlog (→ `SOT_BACKLOG.md`),
non è un registro di difetti (→ `DEBT_REGISTER.md`). Qui stanno **forme**, non fatti né lavori.

## Regola di manutenzione

1. Ogni sessione che **introduce** una forma nuova, o che **scopre** che una forma esistente si
   ripete, aggiunge o aggiorna una voce qui. Una forma usata due volte è un pattern; usata una volta
   è un'implementazione.
2. Ogni voce porta la **prova**: la query o il comando che la mostra sul dato reale, con i numeri e
   la data. Una voce senza prova è una proposta, e va marcata come tale.
3. Ogni voce dichiara **dove NON è applicata pur potendo**: è lì che sta il valore del registro.
4. Gli anti-pattern si registrano insieme ai pattern, con lo stesso rigore: sapere quale forma **non**
   reggere vale quanto sapere quale adottare.
5. Il registro è alimentato anche dal **team di scoperta** sul DBMS (workflow `dbms-pattern-discovery`):
   i suoi rilievi confluiscono qui dopo verifica, non come lista separata.

---

## P-01 · Catalogo di riferimento gerarchico con crosswalk e applicabilità settoriale

**Forma**: una classificazione esterna si modella come catalogo con `scheme` + `code` + `parent_code`
+ `level`, una tabella di **crosswalk** fra schemi diversi, e — quando i valori non sono universali —
un asse di **applicabilità per settore**. I nomi passano dall'overlay bilingue, non sono duplicati.

**Dove è implementato**: `sys_occupation_classifications` (2121 voci, schemi ISCO/ESCO/CP) +
`sys_occupation_classification_mappings` (crosswalk) + `sys_occupation_skill_requirements`
(126.051 legami occupazione→skill).
*Prova (2026-07-26)*: `SELECT count(*) FROM sys.sys_occupation_classifications` → 2121;
`SELECT count(*) FROM sys.sys_occupation_skill_requirements` → 126051.

**Perché l'asse settoriale**: alcune voci sono caratteristiche di un settore, altre trasversali. Le
skill di un Direttore Credito alle Imprese non si applicano al software; quelle di un Analista di
Sistemi valgono in entrambi. L'applicabilità **trasversale è un valore esplicito**, non l'assenza di
vincolo — altrimenti non si distingue «vale ovunque» da «nessuno l'ha ancora ristretta».

**Dove NON è applicato pur potendo**:
- `sys_organization_unit_types` — 8 tipi generici (`PLANT`, `WAREHOUSE` in una banca; `HEADQUARTERS`
  e `TEAM` che non sono unità organizzative) senza rango né applicabilità settoriale → F0 del piano
  `2026-07-26-organizational-model-and-role-derivation-design.md`.
- **Inquadramenti contrattuali** — non esistono affatto; l'unico campo affine,
  `sys_job_roles.job_role_seniority_level`, porta una scala generica (`MID`/`JUNIOR`/`EXECUTIVE`/…,
  62 vuoti su 137) che non può rappresentare né `QD3` (CCNL credito) né `1° livello` (CCNL terziario).
  Due tenant, due scale incompatibili: è il caso d'uso canonico dell'asse settoriale → F1.

---

## P-02 · RACI sui legami entità ↔ processo

**Forma**: la relazione fra un'entità e un processo non è booleana ma **tipizzata per responsabilità**
— titolare, contributore, consultato, informato — e la titolarità è **unica per processo**.

**Dove è implementato**: `sys_organization_unit_processes.org_unit_process_role`.
*Prova (2026-07-26)*: 23 `OWNER` · 30 `CONTRIBUTOR` · 29 `CONSULTED` · 23 `INFORMED`; e
**zero processi con più di un'unità titolare** — il livello unità rispetta già la regola.

**Dove NON regge**: al livello **persona** (`sys_process_participants`) la stessa disciplina non è
imposta: solo 3 delle 120 marcature `OWNER` stanno sul legame la cui unità è davvero titolare, e 20
processi su 23 non hanno una persona titolare. Il ruolo è un `varchar` con default `OWNER` e nessun
indice unico → F3.

**Riusabile per**: qualunque legame molti-a-molti che esprime responsabilità (unità↔KPI,
persona↔progetto, team↔servizio).

---

## P-03 · Segnale esplicito, mai inferenza dal grafo

**Forma**: un'autorizzazione non si deduce dalla topologia («ha qualcuno sotto di sé»), ma da un
**segnale dichiarato** — un ruolo assegnato oppure una designazione strutturale. Il grafo dice com'è
fatta l'organizzazione, non chi è autorizzato.

**Dove è implementato**: `lib/scope/resolver.ts` — `isManagerial` = ruolo manageriale **oppure**
`isOrgUnitManager`, mai «ha riporti». È il vincolo F1 di ADR-0027.
*Prova (2026-07-26)*: 29 persone hanno riporti diretti nella catena posizioni, 17 sono designate
responsabili di unità, 6 hanno il ruolo `MANAGER`: tre insiemi diversi, e solo i primi due sono
segnali. Inferire dal terzo darebbe il sotto-albero a 29 persone.

**Riusabile per**: ogni volta che una capacità sembra deducibile da una relazione. La domanda giusta
è «chi l'ha dichiarato?», non «chi ce l'ha di fatto?».

---

## AP-01 · Anti-pattern — lo stesso fatto dichiarato due volte senza vincolo

**Forma da NON reggere**: due tabelle (o una tabella e una lista nel codice) dichiarano lo stesso
fatto, e niente le obbliga ad accordarsi. La divergenza non produce errori: produce **due verità**, e
chi legge sceglie quella che ha sottomano.

**Occorrenze misurate (2026-07-26)**:
- struttura organizzativa ↔ ruoli RBAC: **11 responsabili di unità su 17** senza ruolo manageriale,
  e 1 titolare di `MANAGER` che non dirige nulla;
- titolarità di processo a livello unità ↔ a livello persona: **117 marcature su 120** stanno dove
  l'unità non è titolare;
- gate di autorizzazione: `semantic-matching` teneva una lista di ruoli locale che duplicava
  `canReadOrgTarget` e lo contraddiceva su attori reali (cluster `Z-203`).

**Come si chiude**: una delle due dichiarazioni diventa **derivata** dall'altra (vista, funzione,
proiezione), oppure un vincolo del database impone l'accordo. Mai «ricordarsi di aggiornarle
entrambe»: è la forma che genera il difetto, non la disattenzione di chi la usa.

**Test di riconoscimento**: se per rispondere a una domanda esistono due query che possono dare
risultati diversi, questo anti-pattern è presente.

---

## AP-02 · Anti-pattern — invariante di dominio tenuta dalla prosa

**Forma da NON reggere**: una regola vera del dominio («un processo ha un solo titolare», «un
responsabile di unità è un manager») vive nei documenti e non nello schema. Il dato degenera senza
che nulla protesti, e la degenerazione si scopre per caso.

**Occorrenza canonica**: `sys_process_participants.process_participant_role`, `varchar(16)` con
default `'OWNER'` e nessun indice unico → 17 legami con più titolari-persona, uno con 7.

**Come si chiude**: indice unico parziale, `CHECK`, o vista di validazione eseguita da `db:validate`.
Il progetto ha già la sede giusta (7 viste di validazione): il pattern è **aggiungere la vista**, non
correggere il dato una volta.

---

## In attesa di verifica — dal team di scoperta

Il workflow `dbms-pattern-discovery` (2026-07-26) analizza il DBMS su sei lenti: grafo delle chiavi
esterne, famiglie di satelliti, cataloghi e crosswalk, storicizzazione, dati dormienti, invarianti
non imposte. I pattern che ne emergono entrano qui **dopo verifica**, con la loro prova — non come
elenco separato, altrimenti il registro si biforca e ricade in AP-01.
