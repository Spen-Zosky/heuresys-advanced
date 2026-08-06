# S1047 — Ritrattazione delle consegne del lab, poi i secondi fattori di prova in produzione

**Sessione**: S1047 · 2026-08-06 · canonica
**Scelta di Enzo**: «prima L1+L2 (ingerire le due consegne e capire quali voci del menu poggiano su
premesse da riverificare), poi #146»

---

## Confine di sessione, dichiarato all'inizio

V1→V5 sono completabili in questa sessione. Il pezzo più lungo è V4 (triage di 27 voci eseguite):
se il contesto si esaurisce prima, si chiude V4 parzialmente **dichiarando quali voci non sono state
esaminate**, mai lasciando credere che il triage sia completo. V5 (#146) non dipende da V1-V4 e può
essere eseguita anche se il triage resta aperto.

Nessuna voce di questo piano richiede Enzo, **tranne** l'esito di V4 se il triage scopre uno stato
sbagliato in produzione, e la decisione di sicurezza già isolata su `#139` (tipizzare `SERVICE` un
account amministrativo attivo) — che **non** viene eseguita qui.

---

## V1 — Analisi avversariale delle due consegne in attesa · **FATTO**

Le due consegne chiedono, in coda a sé stesse, di essere verificate prima di essere eseguite.
La regola è stata applicata a sé stessa. **13 affermazioni portanti, ognuna con il comando che la
misura.**

| # | Affermazione della consegna | Come è stata misurata | Esito |
|---|---|---|---|
| A1 | L1: «applicata a **46 file** (2 in attesa + 44 in `ingerite/`)» | `ls inbox/*.md \| wc -l` = 2 · `ls inbox/ingerite/*.md \| wc -l` = **46** | ✗ **SMENTITA — sono 48**. L'istruzione è però presente in tutti e 48 (`grep -l` = 48): il numero è sbagliato, la copertura no |
| A2 | `user_type='SERVICE'` è il criterio di ammissibilità all'esenzione dal secondo fattore | letto `db/migrations/000118_mfa_exemption_service_only_audit.sql` §1: `RAISE EXCEPTION` se l'utente non è `SERVICE`; commento di testa *«a HUMAN PLATFORM_ADMIN must NOT be exemptable»* | ✓ **confermata** — il rilievo su `#139` è fondato |
| A3 | La colonna `blueprint_process_variant_id` è il bersaglio dell'`ON CONFLICT` di `000021` riga 166 | `sed -n '160,172p'` → riga 166: `ON CONFLICT (blueprint_process_variant_id, blueprint_process_code) DO NOTHING` | ✓ **confermata**, con precisazione: il bersaglio è la **coppia**, non la sola colonna. L'indice unico `sys_blueprint_process_registry_variant_code_uq` esiste (`000008` riga 63) |
| A4 | `tools/verifica_consegne.py` esce 31/31 | eseguito: `TOTALE 31 · superati 31 · FALLITI 0 · ciechi 0 · errori 0`, exit 0 | ✓ **confermata** |
| B1 | 46 voci del registro portano un `lab-id`: **19** non eseguite, **27** eseguite | ri-derivato con script sul campo autoritativo (riga `- lab-id: <id>`): 133 voci totali, **46** con il campo, **19** non eseguite (17 ACTIVE + 1 GATED + 1 INTERRUPTED), **27** DONE | ✓ **confermata** |
| B1b | «Due delle 46 sono artefatti di lettura — `#96` e `#129`» | entrambe portano il campo `- lab-id:` regolare (righe 28 e seguenti); artefatti misurati: **0** | ✗ **SMENTITA** — le 46 sono tutte vere. La cautela era infondata, il totale resta 46 |
| B2 | Modificare la `000210` è sicuro: la catena rigira intera, l'impronta è cancello solo per `@migrate: once`, il ledger aggiorna invece di allarmare | `db/scripts/migrate.sh` righe 76-83 (salto **solo** se marcato once **ED** già applicato) · righe 166-173 (`ON CONFLICT (file_name) DO UPDATE SET sha256 = EXCLUDED.sha256`) | ✓ **confermata** |
| B3 | Il difetto del menu **è già corretto**: `me/service.ts` valuta sempre la coppia dichiarata | letto `apps/api/src/modules/me/service.ts`: la coppia `requiredResource/requiredAction` è valutata **prima** di `if (!i.requiresAdmin) return true`; il commento nel codice documenta la stesura rotta precedente | ✓ **confermata** |
| B4 | `write-gate.ts` righe 111-116 nega per primo ciò che non è in elenco | letto `apps/agent-gateway/src/write-gate.ts`: `// 1. Allowlist (deny-by-default, before classification)` → `if (!allowlist.has(name))` → deny | ✓ **confermata** |
| B5 | `READ_TOOL_NAMES` ha un invariante scritto nel file | letto `apps/agent-gateway/src/mcp-tool-names.ts`: *«a new tool is added to the catalogue, add its name here too — otherwise it is denied»* | ✓ **confermata** + **precisazione aggiunta da chi esegue** (sotto) |
| B6 | Le 12 righe di `sys_seed_source_evidence` hanno impronte di 32 caratteri che non riproducono | `verifica_consegne.py` B6: `righe=12 con repo://=12 impronte a 32 caratteri=12` | ✓ **confermata** |
| B7 | Il piano diceva «28 file la referenziano»: sono **7** | `Grep blueprint_process_variant_id` = 11 hit, di cui 2 snapshot generati (`qa_artifacts/`) e 2 artefatti Codex (`.codex-review/work/`) → **7 file reali** (4 repository + 1 test + `000021` + `000008`) | ✓ **confermata** |
| B8 | Nel repo **una sola** migrazione è marcata `@migrate: once` | `grep -rl "@migrate: once" db/migrations/` = 1 → `000273_archive_requirements_on_retired_positions.sql` | ✓ **confermata** |

### Precisazione che le consegne non fanno, e che serve a chi eseguirà `#132`

`mcp-tool-names.ts` non espone i nomi grezzi: `DEFAULT_TOOL_ALLOWLIST` li costruisce passando ogni
lista per `withNamespace()`, che **duplica ogni nome aggiungendo il prefisso MCP**. `WebSearch` e
`WebFetch` non sono strumenti MCP e non portano quel prefisso: la lista separata che la stesura 3
prescrive va quindi unita all'allowlist **senza** passare per `withNamespace()`. Se ci passasse,
l'elenco conterrebbe un `mcp__…WebSearch` che non esiste e il cancello continuerebbe a negare.

### Verdetto su V1

Le due consegne sono **sostanzialmente fondate**: undici affermazioni portanti su tredici reggono
alla verifica, comprese tutte quelle che motivano le correzioni a `#131`, `#132` e `#139`. Le due
smentite sono di conteggio e non toccano nessuna conclusione. La regola che le consegne
introducono — analisi avversariale prima dell'esecuzione — si è dimostrata utile **applicata a sé
stessa**: ha trovato due errori in due file che dichiaravano di essere stati verificati.

---

## Piano

| id | cosa | chi | cosa significa fatto | stato |
|---|---|---|---|---|
| **V1** | Analisi avversariale delle due consegne in attesa | io | 13 affermazioni portanti misurate col comando accanto | ✅ **FATTO** |
| **V2** | Annotare nei due file di consegna ciò che è stato rifiutato e corretto | io | i due file in `inbox/` portano la sezione di ritrattazione con le 2 smentite e la precisazione | ✅ **FATTO** |
| **V3** | Ingerire le due consegne nel registro con i blocchi **corretti** | io | `lab_inbox.py --ingest` eseguito, `handoff_lint.py` verde, commit | ✅ **FATTO** — `#149` e `#150`, lint 0 fail, commit `70e28b8c`. Collisione di sottostringa (`#129`) **verificata assente** prima di ingerire, non assunta |
| **V4** | Parte B di L2 — triage delle 27 voci eseguite sui 4 criteri di rischio | io | lista breve: quali delle 27 rientrano nei casi 1-4 e se lo stato lasciato è corretto, **ognuna con la verifica accanto** | ✅ **FATTO** (§V4) |
| **V5** | `#146` — i 7 secondi fattori `e2e-fixture` attivi in produzione | io | i fattori di prova non sono più attivi in produzione, dimostrato live sul DB | ✅ **FATTO** (§V5-esito) — era già risolta, dimostrato |

**Fuori da questo ciclo** (registro separato, presentato una volta sola a fine sessione): la Parte A
di L2 non è un'esecuzione ma una **regola** — «rileggere il file di consegna quando si prende in
carico una delle 19». Si registra nel blocco della voce, non si esegue adesso per 19 voci.

---

## Simulazione — le cinque domande, per voce

### V2 — annotare i file di consegna

- **Precondizioni**: i due file esistono in `D:\heuresys-design-lab\inbox\` (verificato: 7.625 e
  10.595 byte). La sessione è **canonica**, non lab: la guardia che blocca le scritture non è attiva.
- **Meccanismo**: `Edit` sui due file. Non uno script: sono due file e le annotazioni sono diverse.
- **Propagazione**: il lab è **fuori dal repo** (`D:\heuresys-design-lab\`) e non è versionato da
  questo progetto. L'annotazione resta locale al Windows — è il comportamento voluto da Enzo, che
  legge il lab da lì. Ciò che deve arrivare nel repo è il **blocco del registro** (V3), non il file.
- **Chi**: io.
- **Guardia**: non distruttiva — si aggiunge una sezione in coda, non si riscrive il file.

### V3 — ingestione

- **Precondizioni**: `docs/kb/tools/lab_inbox.py` esiste ed è lo strumento dichiarato dal menu.
- **Meccanismo**: `python docs/kb/tools/lab_inbox.py --ingest`, poi `handoff_lint.py`. **Da leggere
  prima di lanciarlo**: `#129` dice che `lab_inbox.py:105/110` confronta gli id **per sottostringa** —
  un id prefisso di un altro è scambiato per già ingerito. I due id di oggi
  (`2026-08-06-istruzione-vincolante-su-ogni-consegna`,
  `2026-08-06-ritrattare-le-ingestioni-alla-luce-delle-correzioni`) non sono l'uno prefisso
  dell'altro, quindi il difetto non morde qui — **ma va verificato, non assunto**.
- **Propagazione**: il registro è in `docs/kb/`, versionato: commit locale su `main`. Push solo su
  richiesta esplicita di Enzo.
- **Chi**: io.
- **Guardia**: `handoff_lint.py` ha 10 controlli bloccanti; se fallisce, l'ingestione va corretta
  prima del commit.

### V4 — triage delle 27

- **Precondizioni**: il tunnel è su e il DB risponde (verificato al boot). Molte delle 27 sono
  migrazioni dell'organigramma (`000244`-`000251`): il triage va fatto **sul database**, non sui
  documenti.
- **Meccanismo**: i 4 criteri di L2. La classe a rischio più alto è la 1+3 insieme — voci che hanno
  cambiato dati di produzione **tramite migrazione**, dove un errore si ri-applica a ogni deploy.
- **Propagazione**: l'esito è una sezione di questo file + le note delle voci nel registro.
- **Chi**: io. Se il triage trova uno **stato sbagliato in produzione**, la correzione è una
  decisione che riporto a Enzo prima di eseguirla.
- **Guardia**: il triage è **read-only** sul database. Nessuna `UPDATE`/`DELETE` in questa voce.

## V4 — Triage delle 27 voci eseguite · **FATTO**

L2 chiede: «una lista breve — quali delle 27 rientrano nei casi 1-4, e per ciascuna se lo stato
lasciato è corretto. Se la risposta è "tutte a posto", va detta con la verifica accanto, non come
impressione.» Ecco la lista, con la misura accanto.

### Le 5 che NON richiedono riesame — non hanno toccato dati, schema o permessi

`#94` `#95` `#97` (driver e plancia `zp`: strumenti in `scripts/`) · `#96` (installazione di
`lab_inbox`: strumento) · `#145` (un vincolo di sequenza, nessuna esecuzione).
L2 le esclude esplicitamente: *«le voci che hanno prodotto solo documenti, strumenti del lab o
segnalazioni»*.

### Le 2 di classe «guardia» — criterio 3, verificate in esercizio oggi

| voce | verifica |
|---|---|
| `#130` Il cancello di verifica butta l'output delle suite | **verificato in esercizio in questa sessione**: il cancello ha imposto la riesecuzione all'apertura (`shell-tests`, exit=0, 36,8s) e ha **stampato** durata ed esito invece di buttarli. Stato corretto |
| `#138` Nessun lucchetto impedisce due suite sullo stesso database | non ri-provocato (servirebbero due suite in concorrenza). **Non verificato**, dichiarato tale |

### Le 20 di classe 1+3 — dati di produzione cambiati tramite migrazione

Sono le 8 fasi dell'organigramma (`#103`-`#110`, migrazioni `000244`-`000251`) più le voci di dati
che le circondano (`#100` `#102` `#111` `#112` `#113` `#114` `#116` `#118` `#119` `#120` `#122`,
e `#101` che è codice). **È la classe dove un errore torna a ogni deploy**, quindi è quella che ho
misurato per davvero.

**Catena**: tutte e 8 le migrazioni sono nel ledger, applicate il 2026-08-06, ognuna con il suo
sha256. Sul disco 271 file = 271 applicate.

| affermazione originale | misura di oggi | esito |
|---|---|---|
| `#114` l'albero delle posizioni è **spezzato in 15 tronconi** | radici per tenant: **RTL_BANK 1** (su 158 posizioni attive), **HEURESYS 1** (su 3) | ✅ **risolta** — un solo albero per tenant |
| `#113` **30 responsabili** di unità senza ruolo di comando | unità attive **senza responsabile: 0** su 43 (40 RTL + 3 Heuresys) | ✅ **risolta** |
| `#122` `HS-MGMT` esiste **due volte** | codici di unità duplicati per tenant: **0 righe** | ✅ **risolta** |
| `#112` i cataloghi dei requisiti hanno **perso l'aggancio** | righe orfane di posizione: skill **0**/1439, kpi **0**/168, learning **0**/1733 | ✅ **risolta** — 3.340 righe tutte agganciate |
| `#100` organigramma **incoerente al 66%** | violazioni di **nomenclatura: 0**, di **annidamento: 0** su 45 unità esaminate | ✅ **risolta** |
| `#101` la console segnalazioni è offerta a tutti e negata dall'API | letto `me/service.ts`: la coppia permesso è valutata **prima** di `requiresAdmin`; il commento nel codice documenta la stesura rotta | ✅ **risolta nel codice** (già confermato in V1/B3) |
| tenuta generale | `v_orphan_position_assignments` **0** · `v_positions_without_job_role` **0** · `v_active_primary_assignment_per_user` **0** · `v_deactivated_user_active_assignment` **0** · `v_tenant_boundary_violations` **0** · sentinelle `db_health` **11/11 a zero** | ✅ nessuna deriva |
| posizioni attive appese a un'unità **ritirata** dalla ricostruzione | **0** | ✅ disattivazione pulita |

**Non verificate, e lo dichiaro invece di darle per buone:**

- `#118` (dieci responsabili a `QD3`) e `#120` (dieci posizioni di comando a `MG-2`): i codici `MG`/`QD`
  **non stanno in `job_role_code`** — la query mirata torna 0 righe, quindi il livello contrattuale è
  modellato altrove e non l'ho ancora trovato. Nessuna conclusione tratta.
- `#111` (le 545 valutazioni ereditate dall'albero delle posizioni): non misurata.
- `#116` (28 persone su 45 su un cruscotto che il ruolo non vede) e `#119` (liste di ruoli scritte a
  mano): sono affermazioni sul **comportamento del codice**, non misurabili con una query. Restano da
  rileggere quando qualcuno le riapre.

### Reperto nuovo, emerso dal triage — un difetto della sentinella, non dei dati

`sys.v_organization_unit_integrity` segnala 5 flag residui. Due sono `senza_responsabile`, e a prima
lettura contraddicono la misura diretta (`manager_user_id IS NULL` → **0** su tutte le unità attive).
La contraddizione si scioglie così: **la vista non filtra `organization_unit_is_active`**. Le due
unità che segnala — *Divisione Risk & Compliance* e *Direzione Corporate Banking* — sono state
**ritirate il 2026-08-04** dalla ricostruzione stessa (`is_active = false`, `effective_to` valorizzato).
Una unità ritirata senza responsabile è lo stato normale, non una violazione.

Gli altri 3 flag (`responsabile_condiviso` su *Direzione Generale* e *RTL Bank S.p.A.*,
`responsabile_esterno` su *Direzione Generale*) descrivono una persona che guida sia la capogruppo sia
la direzione generale — plausibile per un vertice, e già coperto dalla domanda aperta registrata sui
«due responsabili di direzione senza posizione di comando».

**Conseguenza**: la sentinella produce falsi positivi permanenti su ogni unità che verrà ritirata in
futuro. Va aggiunto il filtro `is_active`. **Non l'ho fatto in questa sessione** — è fuori dallo scope
che Enzo ha approvato (L1+L2, poi `#146`) e tocca una vista strutturale. Va nel registro come voce
nuova.

### Verdetto V4

**Nessuna delle 27 ha lasciato uno stato sbagliato in produzione**, per quanto la misura arriva. Le
sei affermazioni portanti che erano verificabili sul database — l'albero spezzato, i 30 responsabili,
il codice doppio, i cataloghi sganciati, l'incoerenza al 66%, il menu che mente — sono **tutte e sei
risolte e ri-misurate oggi**. Quattro voci restano non verificate e sono elencate sopra col loro nome:
non sono «a posto», sono **non misurate**.

---

### V5 — `#146`, i secondi fattori di prova in produzione

- **Precondizioni**: da verificare per prima cosa che i 7 fattori siano **ancora** attivi — la voce
  è stata scritta il 2026-07-26 e nel frattempo il DB è cambiato. Il file
  `.secrets/backup-fattori-e2e-fixture-20260726.txt` esiste? È gitignorato?
- **Meccanismo**: da decidere **dopo** la misura, non prima. Le opzioni non sono equivalenti
  (disattivare ≠ cancellare ≠ ruotare) e la scelta dipende da cosa quei fattori servono oggi: se una
  suite E2E li usa, cancellarli rompe i test.
- **Propagazione**: se è una migrazione, arriva in produzione con la catena; se è uno script una
  tantum, va eseguito **anche** su VM e linux-pc.
- **Chi**: io, salvo che la misura riveli che disattivarli rompe qualcosa di cui Enzo deve decidere
  il destino.
- **Guardia**: prima di toccare qualunque riga di `sys_auth_mfa_*`, snapshot delle righe interessate.
  Un guard che passa su zero righe non è un guard: la verifica di chiusura deve contare **quante**
  righe sono cambiate e confrontarle con quante ne erano attese.

---

## V5 — `#146`, esito · **FATTO — era già risolta, e nessuno l'aveva ri-misurata**

**Non ho corretto niente. Ho dimostrato che entrambi i criteri di chiusura che la voce stessa
dichiara erano già soddisfatti.** La voce era stale: descriveva lo stato di S1032 (2026-07-26), e
S1046 l'ha riformattata per renderla visibile al menu **senza ri-misurarla**. È esattamente il modo
di sbagliare che la dottrina di oggi — verificare invece di credere — esiste per cogliere: la voce
era in cima al menu come P1 di sicurezza, e la sua premessa era falsa.

### La premessa falsa

La voce dice: *«i 7 fattori `e2e-fixture` sono ANCORA ATTIVI: non eliminabili finché
`mfa-enroll-confirm.integration.test.ts` resta rosso»*. Quel test **non è rosso**: rieseguito da
solo, passa **3/3 in 53s**. Il blocco che la voce descrive non esiste più.

### Criterio 1 — «zero fattori con label `e2e-fixture` in produzione»

| misura | risultato |
|---|---|
| fattori con `e2e` **o** `fixture` in qualunque punto del metadata | **0** |
| chiavi presenti nel metadata di tutta la tabella | **una sola: `label`** → la ricerca sopra è esaustiva, non parziale |
| inventario reale di `sys.sys_auth_mfa_factors` | 158 TOTP `derived-access` verificati (creati 2026-07-26) + **32 senza etichetta** |

**Come e quando sono spariti**: la sostituzione è avvenuta il 2026-07-26 con Z-262.
`apps/api/test/helpers/mfa-fixture-secrets.ts` — che **è tracciato da git, su un repository
pubblico** — non contiene più alcun valore letterale: li deriva da `.secrets/dev-access-master.key`,
gitignored (`.gitignore:53`). Il file dichiara esso stesso
`E2E_FIXTURE_LABEL = "derived-access"` come **sostituto** di `e2e-fixture`. La guardia
anti-reintroduzione (`mfa-fixture-parity.test.ts`) è verde.

### Criterio 2 — «suite auth verde»

**15 file, 96 test, tutti passati**: `auth`, `auth-mfa`, `auth-mfa-enforcement-switch`,
`auth-mfa-exemption`, `auth-mfa-mandatory`, `auth-refresh-cookie`, `mfa`, `mfa-email-otp-gating`,
`mfa-enroll-confirm`, `mfa-fixture-parity`, `mfa-policy`, `mfa-recovery-codes`, `mfa-secret-crypto`,
`mfa-sms`, `webauthn`.

### Rischio residuo, dichiarato e non azionabile qui

I 7 segreti restano **nella storia git** di un repository pubblico. Sono però **inerti**: i fattori
a cui corrispondevano non esistono più, e sostituirli era il rimedio corretto per un segreto esposto
(riscrivere la storia di un repo pubblico non lo sarebbe stato). Nessun segreto è stato letto,
stampato o messo nel contesto durante questa verifica: tutte le query hanno selezionato tipo,
etichetta, conteggi e date, **mai** `auth_mfa_factor_secret`. Il file di backup citato nel campo
`doc:` della voce **non esiste più sul disco**.

### Reperto nuovo — fuori scope, registrato come `#152`

I 32 fattori senza etichetta sono **26 TOTP non verificati** di `tommaso.fiore@rtl-bank.org` e
**6 WebAuthn verificati** di `admin@heuresys.com`, creati fra il 2026-07-22 e il 2026-08-01: non
sono i fattori di `#146`, sono **residui di enrollment che le suite lasciano in produzione**, uno
strato per corsa.

I 6 WebAuthn sono i più delicati — sono `verified = true` su un account amministrativo.

Un dato scagiona i test API: la corsa di oggi (2026-08-06) **non ha aggiunto righe** — il
`max(created_at)` resta 2026-08-01 — quindi l'isolamento transazionale (D-52) regge e la sorgente è
altrove, verosimilmente gli E2E Playwright, che non girano in transazione. **Non l'ho corretto**:
è fuori dallo scope approvato (L1+L2, poi `#146`), e ripulire 32 righe senza chiudere la falla a
monte sarebbe lavoro da rifare.

---

# Ciclo 2 — le due scoperte, ammesse da Enzo al giro successivo

**Mandato**: «sì, mettile entrambe nel prossimo ciclo» (2026-08-06).

| id | cosa | chi | cosa significa fatto | stato |
|---|---|---|---|---|
| **V6a** | `#152` — chiudere la sorgente dei 26 TOTP | io | «annulla» cancella il fattore sul server; asserzioni E2E ribaltate | ✅ **FATTO** — commit `c5255c65` |
| **V6b** | `#152` — chiudere la sorgente dei 6 WebAuthn | io | la pulizia gira anche quando il test fallisce | ✅ **FATTO** — commit `c5255c65` |
| **V6c** | `#152` — rimuovere l'arretrato di 32 righe | **Enzo decide** | migrazione applicata, zero fattori senza etichetta | ⏸ **scritta, non eseguita** — distruttiva su produzione |
| **V7** | `#151` — la sentinella ignora le unità ritirate | io | falsi positivi a zero, segnali veri intatti | ✅ **FATTO** — mig `000274`, provata live |

## V6 — cosa ho trovato aprendo `#152`

**Il difetto non era dei test: era di prodotto.** Il pulsante «annulla» dell'arruolamento faceva solo
`setPendingFactor(null)` e `form.reset()`. Nessuna chiamata al server. Quindi non erano solo gli E2E
a lasciare rifiuti — **qualunque persona reale** che avesse aperto l'arruolamento e premuto annulla si
sarebbe ritrovata in lista un fattore «in attesa di verifica» che credeva di non aver mai creato.

Il commento del test lo dichiarava *«by design»* e prometteva che la riga sarebbe scaduta da sé
(*«until either verify-setup succeeds or it ages out»*). **L'age-out non esiste**: `expires_at` e lo
sweep vivono su `sys_auth_mfa_otp_challenges`, cioè sulle *sfide* OTP, non sulle righe di
`sys_auth_mfa_factors`. Le righe restavano per sempre — ed è per questo che se ne contavano 26.

Il rimedio non ha richiesto codice nuovo: `DELETE /v1/auth/mfa/factors/:factorId` esisteva già, e la
pagina aveva già una mutazione `remove`. Ho aggiunto una mutazione dedicata e **silenziosa** perché
`remove` annuncia «fattore rimosso», che per chi sta annullando sarebbe fuori luogo; e che **non
blocca** la chiusura del riquadro se fallisce, perché chi ha chiesto di annullare ha diritto di
vederlo chiuso e un fattore non verificato non concede nulla.

**Le asserzioni del test codificavano il difetto** — pretendevano che dopo il cancel il fattore
*fosse ancora* in lista. Ribaltate. La nuova asserzione guarda **il `factorId` creato da quel test**,
non il totale dei TOTP non verificati dell'utente: un conteggio globale sarebbe rosso per colpa dei
residui altrui, o verde per caso il giorno in cui qualcuno li ripulisse a mano.

**I 6 WebAuthn hanno una causa diversa**, e la prima ipotesi era sbagliata: il cleanup *c'era già*.
Solo che è l'ultima riga del test, e `webauthn.spec.ts` gira con `retries: 1` — un tentativo fallito
non ci arriva mai e lascia il passkey. Il gancio nuovo gira **anche sul fallimento** e cancella
**solo** i `WEBAUTHN`: lo stesso utente possiede il TOTP `derived-access` da cui dipende ogni login
della suite, e una pulizia indiscriminata avrebbe spento tutti i test.

## V6c — perché mi fermo qui

Le 32 righe arretrate restano. `db/migrations/000275_purge_orphan_test_mfa_factors.sql` è scritta e
porta quattro guardie — `@migrate: once` (senza il marcatore la catena la rieseguirebbe a ogni deploy
e «ogni fattore senza etichetta muore» diventerebbe una regola permanente, che non è ciò che si
vuole), una soglia temporale, il vincolo sulle sole righe senza etichetta, e un `RAISE EXCEPTION` che
aborta l'intera operazione se anche **un solo** utente restasse senza fattore verificato.

Quella guardia è scritta per fallire davvero: interroga `NOT EXISTS` su un utente qualsiasi che
resterebbe scoperto, non un conteggio complessivo che passerebbe anche con una persona chiusa fuori.
Misurata prima di scriverla: entrambi gli utenti conservano un `derived-access` verificato.

**Non l'ho eseguita.** Cancella righe in produzione, ed è irreversibile — i segreti di quelle righe
non esistono altrove. Serve il via libera di Enzo.
