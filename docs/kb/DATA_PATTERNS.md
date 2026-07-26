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

---

# Dal team di scoperta (2026-07-26)

Workflow `dbms-pattern-discovery`: sei lenti indipendenti + sintesi, 7 agenti, ~49 min. Le voci qui
sotto sono quelle **ri-verificate a mano** dopo la consegna; le altre restano nel referto del run
finché non passano la stessa verifica. Prova propria = ho eseguito io la query indicata.

## AP-03 · Anti-pattern — predicato di copertura ancorato al NOME invece che al grafo

**Forma da NON reggere**: un controllo di copertura deriva correttamente l'insieme dal catalogo di
sistema (`pg_constraint`) e poi lo **restringe con un `LIKE` sul nome della tabella**. La convenzione
di naming diventa un surrogato della semantica, e tutto ciò che sta fuori dal prefisso non viene mai
controllato — senza che nessuno se ne accorga, perché il test resta verde.

**Occorrenza (severità ALTA)**: `apps/api/test/gdpr.integration.test.ts`. Il commento dichiara
*«LIVE fk graph — the SoT is pg_constraint, never a hardcoded list»* e la query subito sotto aggiunge
`AND c.conrelid::regclass::text LIKE 'sys.sys_user\_%'`.
*Prova propria (2026-07-26)*: le FK verso `sys_users` sono **248 su 135 tabelle distinte**; dentro il
filtro del test ne cadono **74**. Il team ha misurato il seguito: 51 tabelle con FK-soggetto sono
assenti dal registro GDPR e contengono dati veri (`sys_survey_responses` 3.792, `sys_goals` 1.067,
`sys_performance_reviews` 161, `sys_time_off_requests` 69…). Il gate resta verde perché nessuna di
quelle tabelle inizia per `sys_user_`. In più l'asserzione è `toBeGreaterThan(20)`: soglia che passa
comunque.

**Perché in questo schema è particolarmente insidioso**: vale il pattern P-04 qui sotto — il naming
NON può fare da indice semantico, perché ogni colonna porta il prefisso della propria entità. Quindi
qualunque regola trasversale ancorata al nome è strutturalmente incompleta.

**Due varianti scoperte tentando di chiuderlo** (Z-257, S1032 — tentativo *interrotto*, rollback
eseguito; verdetti in `.zp/prove/Z-257-verdetti-adversarial.json`). Sono la ragione per cui il
rimedio a un AP-03 non è «togliere il filtro» e basta:

- **AP-03a · il gate che si ri-arma da solo.** Se la copertura mancante viene colmata da una
  migrazione che *ri-deriva* l'insieme (`INSERT … SELECT` su `pg_constraint` con `ON CONFLICT DO
  NOTHING`), e il runner ri-applica tutti i file a ogni esecuzione (`db/scripts/migrate.sh` fa
  esattamente questo), allora un elemento nuovo viene **auto-classificato al primo deploy** e il
  test non diventa mai rosso. Il gate sembra chiuso e non gatea: è l'AP-03 originale in forma nuova.
  Un popolamento che alimenta un gate dev'essere uno **snapshot scritto**, non una query viva.
- **AP-03b · allargare il perimetro senza guardare chi lo consuma.** `sys_gdpr_data_map` non pilota
  solo il controllo di copertura: pilota anche export DSR, cancellazione e retention. Portarlo da 54
  a 249 righe per far gateare il test ha fatto sì che `exportSubjectData` — che cammina ogni riga con
  `SELECT *` — restituisse a un utente righe intere di **fatti altrui** (verificato live). Prima di
  estendere un registro, va deciso come **ogni** suo consumatore tratta le righe nuove: l'ordine
  inverso trasforma un buco di copertura in una fuga di dati.

**Come si chiude**: il predicato di appartenenza a una classe si calcola come **raggiungibilità nel
grafo FK** verso l'entità radice della classe (`sys_users` per il dato personale, `sys_tenancies` per
l'ambito tenant), mai come pattern sul nome. → cluster `Z-257`.

---

## P-04 · Prefisso d'entità universale: il naming non è un indice semantico

**Forma**: ogni colonna porta il prefisso della propria entità — 205 chiavi primarie su 205 sono
`<entità>_id`, **zero** sono `id` nudo; la FK verso `sys_tenancies` viaggia sotto **137 nomi di
colonna diversi** su 142 tabelle.

**Conseguenza operativa, che è il vero contenuto del pattern**: nessuna logica trasversale può essere
scritta per nome di colonna. Filtro tenant, dato personale, campi traducibili, colonne di audit —
tutto va derivato dal grafo. È la giustificazione formale di AP-03 e di P-05.

---

## P-05 · Ambito tenant in TRE classi, non due

**Forma**: le tabelle non si dividono in «tenant-scoped» e «globali», ma in tre: **diretta** (FK a
`sys_tenancies`), **transitiva** (ambito ereditato dall'aggregato padre, nessuna colonna tenant
propria), **globale** (nessun percorso). Ogni classe richiede una forma di filtro diversa.

**Misura (chiusura transitiva sul grafo, max 6 hop)**: 142 dirette · **34 transitive** (30 a 1 hop,
4 a 2 hop) · 29 globali, su 206 tabelle `sys`.

**Dove NON è applicato**: il tier transitivo non ha alcun riscontro nel codice — il filtro tenant su
quelle tabelle esiste solo se il singolo repository si ricorda di fare la join. Esempio verificato dal
team: `sys_team_members` (173 righe, zero colonne tenant) e `teams/repository.ts:270` che cancella
per `team_id + user_id` senza filtro tenant, affidandosi alla guardia sull'aggregato a monte.

**Riusabile per**: un test dell'invariante I5 che calcoli il tier dalla topologia e pretenda la forma
di filtro corrispondente; e per decidere quali tabelle un export o una cancellazione per-tenant deve
toccare. → cluster `Z-258`.

---

## P-06 · La politica `ON DELETE` codifica il ruolo semantico dell'arco

**Forma**: su tutte le FK verso `sys_users`, `ON DELETE` distingue **senza eccezioni** l'arco
«attore che ha scritto il record» dall'arco «soggetto di cui il record parla». Si può classificare la
semantica di un arco leggendo `confdeltype`, senza guardare il nome della colonna.

**Misura**: 118 archi attore (`created_by`/`updated_by`/`deleted_by`) → **118 su 118 `SET NULL`**,
zero eccezioni. Archi soggetto: 58 `CASCADE`, 44 `SET NULL`, 7 `RESTRICT`, 1 `NO ACTION`.
`ON UPDATE` è `NO ACTION` su tutti i 596 vincoli dello schema.

**Riusabile per**: derivare automaticamente la distinzione attore/soggetto che oggi è una **regex
duplicata** nel test GDPR e nella dottrina della migration 000186 — cioè un'occorrenza di AP-01. E
per validare in CI che ogni nuova colonna `created_by`/`updated_by` nasca `SET NULL`.

---

## Restano da verificare

Nel referto del run, non ancora promossi qui: registro dei bersagli polimorfici con funzione dinamica
anti-orfano (1 sede su 9 lo implementa) · politica di cancellazione del tenant con intenzioni
contraddittorie sullo stesso hub · tre forme incompatibili di storicizzazione · slot di attestazione
sui satelliti (15 sedi, 1 popolata) · **zero vincoli `EXCLUDE` in tutto lo schema** a fronte di
satelliti con finestre temporali sovrapponibili · stato dichiarato e finestra temporale che dicono la
stessa cosa senza accordarsi · tenant ripetuto sul satellite senza vincolo composito con l'hub.

Le ultime due sono specializzazioni di **AP-01** su forme diverse: la conferma che quell'anti-pattern
è la forma dominante di questo schema, non un incidente.
