# Modello organizzativo e derivazione dei ruoli — blocco di lavoro

**Data**: 2026-07-26 · **Stato**: PROPOSTA — fasi F0-F5, alcune bloccate su input di Enzo
**Origine**: sessione S1032. Il cluster `Z-203` (peer occupation-fit) stava rattoppando a valle una
contraddizione che ha la sua radice qui. Regola enunciata da Enzo in sessione e recepita:

> La SoT è **l'organigramma** e tutto ciò che è desumibile da `sys_users` e dalle tabelle/viste
> collegate. I ruoli RBAC **si popolano da lì**, quindi non possono contraddirlo.

## 1. Perché questo blocco esiste — i fatti misurati

Tutti ri-derivabili con i comandi in §7; nessun numero qui è citato a memoria.

| Rilievo | Misura (2026-07-26) |
|---|---|
| Responsabili di unità organizzativa senza alcun ruolo manageriale | 11 su 17 |
| Persone con riporti diretti senza ruolo manageriale | 22 su 29 |
| Titolari del ruolo `MANAGER` che non dirigono nulla | 1 su 6 |
| `TEAM_LEADER`: lo è nei dati ma non ha il ruolo / ha il ruolo ma non lo è | 5 / 1 |
| Processi (registro) / legami processo-unità | 23 / 105 |
| Unità titolari per processo — **il modello per unità è SANO** | 23 legami `OWNER`, **0** processi con più di un'unità titolare |
| Processi **senza persona titolare** | **20 su 23** |
| Marcature persona-`OWNER` su legami dove l'unità **non** è titolare | **117 su 120** |
| Tipo unità `BRANCH` (= Filiale) usato da una banca | **0 unità** |
| Campo per l'inquadramento contrattuale (dirigente / QD / area prof.) | ~~non esiste~~ → **esiste ed è popolato**: `sys_user_contracts`, 160/162 utenti attivi (rettifica, §F1) |
| Dirigenti che sono vertici di unità / che portano un ruolo RBAC manageriale | **9 su 10** / **5 su 9** |

Il difetto comune: **ogni fatto organizzativo è dichiarato due volte** — una nella struttura, una nel
ruolo RBAC — e niente obbliga le due dichiarazioni ad accordarsi. Da lì nascono sia la divergenza di
`Z-203` sia le scale di ruoli scritte a mano nei singoli moduli.

## 2. Il modello di riferimento (verificato, non assunto)

Ricerca sul campo, fonti in §8. Una banca commerciale italiana si articola in: **Direzione Generale**
→ **Direzione / Divisione** → **Servizio** → **Ufficio** al centro; **Area territoriale / Distretto**
→ **Filiale** in periferia. «Headquarters» è un luogo, non un'unità; «Team» è un raggruppamento
funzionale, non organizzativo.

Chi guida cosa, e con quale **inquadramento** (CCNL credito — è questo il criterio che decide, non il
numero di riporti):

| Unità | Responsabile | Fascia |
|---|---|---|
| Direzione Generale | Direttore Generale, Vice DG | Dirigente |
| Direzione / Divisione | Direttore | Dirigente |
| Servizio | Responsabile di Servizio | QD3-QD4 |
| Ufficio | Responsabile di Ufficio | QD1-QD2 |
| Filiale | Direttore di Filiale | QD1-QD4 **secondo l'organico** |

Da cui la regola che il modello deve esprimere, e che oggi non è esprimibile:

> **Manager = vertice di un'unità di rango direzionale con inquadramento dirigenziale.**
> Guidare persone non basta: il responsabile della formazione dipende dal Direttore Risorse Umane,
> ha impiegati sotto di sé, ed è un quadro direttivo — non un manager.

## 3. Ruoli organizzativi e ruoli funzionali (tassonomia recepita)

Due tipi che **coesistono** e rispondono a criteri diversi; l'RBAC attinge da entrambi. È la
proiezione sui ruoli dei due assi già presenti in **ADR-0027**.

| Tipo | Derivazione | Ruoli | Cosa governa |
|---|---|---|---|
| **Organizzativo** | catene di dipendenza gerarchica (rango unità × inquadramento) | `MANAGER`, `CEO` | dati personali sensibili (I18, I20) |
| **Funzionale** | appartenenza a team e processi | `TEAM_LEADER`, `TEAM_MEMBER`, `PROCESS_OWNER` | attività (I16) — **mai** dati sensibili |
| **Conferito per nomina** | atto esplicito, nessun corrispettivo strutturale | `PLATFORM_ADMIN`, `TENANT_ADMIN`, `HRMS_MANAGER`, `WHISTLEBLOWING_CUSTODIAN`, `BLUEPRINT_MANAGER`, `READ_ONLY`, (`ORG_DIRECTOR` da classificare) | mandato |

**Eccezione da tenere scritta**: `TENANT_ADMIN` e `HRMS_MANAGER` sono conferiti *e* accedono ai dati
sensibili di tutto il tenant. Non passano dagli assi, li scavalcano per mandato — è l'invariante I20,
e resta l'unico caso in cui un ruolo non organizzativo tocca dati sensibili.

## 4. Il catalogo dei tipi di unità è multi-industry (requisito di Enzo)

Il catalogo non può essere una lista fissa: deve legarsi al **tipo di impresa del tenant**, con la
stessa logica dell'ontologia skill ESCO-NACE-ATECO. Alcuni tipi sono **caratteristici di un settore**
(Filiale → banca; Stabilimento, Magazzino → manifattura e logistica), altri sono **trasversali**
(Direzione, Divisione, Servizio, Ufficio). Come per le skill: quelle del Direttore Credito alle
Imprese non si applicano al software, ma quelle dell'Analista di Sistemi valgono in entrambi.

**Il pattern esiste già nel progetto e va riusato, non reinventato**: `sys_occupation_classifications`
(2121 voci, schema + gerarchia + livello) con la sua tabella di crosswalk e i 126.051 legami
occupazione→skill. Il tenant porta già l'asse industry: `sys_tenancies.tenant_industry_code`
(RTL Bank = `FIN_BANKING`; Heuresys System = **vuoto**, da valorizzare).

Il catalogo dei tipi di unità prende la stessa forma: **tipo + rango + applicabilità per settore**,
dove l'applicabilità «trasversale» è un valore esplicito e non l'assenza di vincolo.

## 5. Fasi

Ogni fase chiude con un comando, non con un'impressione. `⛔` = bloccata su input di Enzo.

### F0 — Catalogo dei tipi di unità, legato al settore
Rifare `sys_organization_unit_types` come catalogo con **rango gerarchico** e **applicabilità per
industry**; bilinguismo IT/EN sui nomi (`BRANCH` = Filiale: il termine c'è già, manca il legame).
Ritirare dall'applicabilità bancaria `PLANT`/`WAREHOUSE` senza cancellarli (valgono per tenant
manifatturieri); aggiungere i ranghi bancari mancanti.
- *chiuso quando*: `psql` — ogni unità dei due tenant ha un tipo applicabile al settore del proprio tenant, e la vista di validazione dei tipi non applicabili è vuota
- ⛔ **input Enzo**: l'elenco dei ranghi bancari reali e quali di essi hanno un manager al vertice

### F1 — Inquadramento contrattuale sulla persona — **RIDIMENSIONATA: il dato ESISTE GIÀ**

> **Rettifica 2026-07-26.** Questa fase nasceva dall'affermazione «l'inquadramento non esiste da
> nessuna parte». **Era falsa**: la ricerca aveva guardato `sys_users`, `sys_positions`,
> `sys_organization_units`, `sys_job_roles` — e non i **satelliti persona**. Il dato sta in
> `sys.sys_user_contracts` (`user_contract_ccnl_type`, `user_contract_ccnl_level`), **160 righe su
> 162 utenti attivi**, con le scale giuste e coerenti col settore del tenant:
>
> | Tenant | CCNL registrato | Livelli |
> |---|---|---|
> | RTL Bank (158) | `CCNL Credito 2024` | Dirigente 9 · QD4 5 · QD3 18 · 3A1L-3A4L 126 |
> | Heuresys System (2) | `CCNL Commercio` | Dirigente 1 · Quadro 1 |
>
> Coincide con quanto la ricerca web indicava come corretto. Senza contratto restano **2 utenti**,
> entrambi account di piattaforma di Heuresys System (`admin@`, `enzo.spenuso@`), non dipendenti.
>
> **E il dato è coerente con la struttura**: 9 Dirigenti su 10 sono vertici di unità organizzativa.
> A non seguire è di nuovo lo strato RBAC — di quei 9, solo **5** portano un ruolo manageriale.
> Quindi la derivazione di F2 è **già calcolabile oggi**: `Dirigente` + vertice di unità → `MANAGER`.

Resta di questa fase, molto ridotto: **promuovere il dato a catalogo di riferimento settoriale** —
oggi `ccnl_type`/`ccnl_level` sono testo libero sul satellite, senza catalogo né vincolo, quindi
niente impedisce a un `QD3` di comparire su un tenant che applica il CCNL Commercio.
- *chiuso quando*: `psql` — i due campi puntano a un catalogo, esiste il vincolo che lega la scala al settore del tenant, e zero righe violano
- residuo: `tenant_industry_code` di Heuresys System è **vuoto**, va valorizzato

**Scale di riferimento (dalla ricerca, per il catalogo):**

| Tenant | Settore | CCNL | Scala |
|---|---|---|---|
| RTL Bank | credito | CCNL ABI | Dirigente · **QD1-QD4** · Aree Professionali |
| Heuresys System | consulenza direzionale | **CCNL Terziario Distribuzione e Servizi** (Confcommercio) | Dirigente *(CCNL separato)* · **Quadro** · 1°-7° livello |

Un `QD3` non significa nulla per Heuresys, un `1° livello` non significa nulla per RTL Bank: è la
stessa logica del catalogo unità e delle skill. Nel CCNL Terziario il 1° livello comprende capi
servizio, analisti sistemisti, responsabili marketing, product manager; i dirigenti stanno fuori.
- *chiuso quando*: `psql` — ogni utente ACTIVE dei due tenant ha un inquadramento valido per il CCNL del proprio settore; zero righe senza
- residuo: `tenant_industry_code` di Heuresys System è **vuoto**, va valorizzato

### F2 — Derivazione dei ruoli organizzativi *(dipende da F0, F1)*
`MANAGER`/`CEO` calcolati da (rango unità × inquadramento del responsabile). La derivazione è una
funzione, non un'assegnazione a mano. Il ramo `isOrgUnitManager` del resolver smette di essere una
scorciatoia compensativa e diventa **asserzione di coerenza**: se diverge, è un errore che esplode.
- *chiuso quando*: `vitest` — un test deriva i ruoli attesi dalla struttura e verifica che coincidano con `sys_user_auth_roles`, zero differenze in entrambe le direzioni

### F3 — Ruoli funzionali derivati + titolare unico di processo ✅ *input ricevuto*
`TEAM_LEADER`/`TEAM_MEMBER` da `sys_team_members`, `PROCESS_OWNER` da `sys_process_participants`.

**Regola (Enzo, 2026-07-26): un titolare PER PROCESSO. Le altre istanze sono partecipazioni.**
Il modello *per unità* la rispetta già: 23 processi, 23 unità titolari, zero doppioni, e i restanti
82 legami sono `CONTRIBUTOR`/`CONSULTED`/`INFORMED` — un RACI corretto. Il difetto è tutto al livello
**persona**: solo 3 delle 120 marcature `OWNER` stanno sul legame la cui unità è davvero titolare;
le altre 117 stanno su legami di sola partecipazione, e 20 processi su 23 restano senza titolare.

Quindi la riparazione **non richiede di indovinare nomi**: il titolare di un processo è il
responsabile dell'unità che lo possiede — le 18 unità che ospitano processi hanno tutte un
responsabile. Cinque titolarità sono però **imposte dalla vigilanza** (Circolare 285 Banca d'Italia,
funzioni aziendali di controllo) e vanno verificate contro la funzione, non solo dedotte:
`02` KYC/AML → Antiriciclaggio · `10` → Risk Management · `11` → Compliance · `12` → Internal Audit
(terzo livello) · `16` → ICT e sicurezza.

**Vincolo di indipendenza**: il titolare dell'audit interno non può coincidere con quello di rischio
o conformità, né possedere processi che poi audita. È l'unico caso in cui la deduzione dall'unità va
bloccata se produce sovrapposizione.
- *chiuso quando*: `psql` — indice unico parziale attivo (un solo `OWNER`-persona per processo); `INSERT` di un secondo titolare fallisce; zero processi senza titolare; zero marcature `OWNER` su legami di sola partecipazione; il controllo di indipendenza dell'audit è vuoto

### F4 — Guardie di non-regressione *(dopo ogni fase)*
Viste di validazione accanto alle sette esistenti, eseguite da `db:validate`: responsabile senza ruolo
derivato · ruolo organizzativo senza unità da dirigere · processo senza o con più titolari · unità di
tipo non applicabile al settore del tenant. Più la **vista di contesto organizzativo per utente** —
posizione, unità, capo, sotto-albero, team, processi, flag manageriale — che è il modo corretto di
«rispecchiare l'organigramma nei record Users» senza creare una seconda verità che deriva.
- *chiuso quando*: `pnpm db:validate` verde con le nuove viste incluse, e ognuna provata su un caso negativo iniettato

### F5 — Riparazione dei dati sui due tenant *(dipende da F2, F3)*
Ricalcolo della proiezione su RTL Bank e Heuresys System; quest'ultimo ha 2 utenti su 5 senza alcuna
posizione. Idempotente e ri-eseguibile.
- *chiuso quando*: `psql` — tutte le viste di F4 vuote su entrambi i tenant, due esecuzioni consecutive con diff vuoto

## 6. Conseguenze sul lavoro in corso

- **`Z-203` resta aperto e non committato.** I tre revisori hanno confermato che la modifica al
  service regge ma l'evidenza no (test tautologico, fixture non deterministico, due metodi su tre
  scoperti, narrativa di rischio invertita nell'ADR). Va corretto, ma con la consapevolezza che F2 ne
  elimina la premessa: la lista di ruoli locale rattoppava una derivazione mancante.
- **Rilievo separato da registrare**: in `similarPeople` il gate organizzativo filtra il bersaglio ma
  **non le righe restituite** (`knnSimilarUsers` filtra per tenant, non per sotto-albero). Perdita
  preesistente, non introdotta da `Z-203`.
- **La regola generale non è imposta da nulla**: altri moduli (es. `insights`) tengono ancora scale di
  ruoli scritte a mano. Dopo F2 diventa un controllo meccanico.

## 7. Comandi che ri-derivano i numeri di §1

```bash
# divergenza struttura ↔ ruoli
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -f docs/kb/tools/sql/org_role_divergence.sql
# titolarità dei processi
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT count(*) FROM sys.sys_organization_unit_processes"
# tipi di unità in uso vs catalogo
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT t.organization_unit_type_code, count(ou.*) FROM sys.sys_organization_unit_types t LEFT JOIN sys.sys_organization_units ou ON ou.organization_unit_type_id=t.organization_unit_type_id GROUP BY 1 ORDER BY 2 DESC"
```

## 8. Fonti del modello di riferimento

- [Banca Popolare Pugliese — assetto organizzativo](https://www.bpp.it/chi-siamo/assetto-organizzativo)
- [Banca d'Italia — organizzazione](https://www.bancaditalia.it/chi-siamo/organizzazione/)
- [CCNL ABI, Capitolo XIII — Quadri direttivi (First Cisl)](https://www.firstcisl.it/ccnl-abi/capitolo-xiii-quadri-direttivi/)
- [Contratto bancario: livelli e mansioni](https://it.indeed.com/guida-alla-carriera/trovare-lavoro/contratto-bancario-livelli-e-mansioni)
- [FISAC CGIL — passaggio da Aree Professionali a Quadri Direttivi](https://www.fisac-cgil.it/wp-content/uploads/2013/02/PassaggioAreeProfessionaliQuadrDirettivi.pdf)
