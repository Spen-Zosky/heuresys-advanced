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
| **V2** | Annotare nei due file di consegna ciò che è stato rifiutato e corretto | io | i due file in `inbox/` portano la sezione di ritrattazione con le 2 smentite e la precisazione | ⬜ |
| **V3** | Ingerire le due consegne nel registro con i blocchi **corretti** | io | `lab_inbox.py --ingest` eseguito, `handoff_lint.py` verde, commit | ⬜ |
| **V4** | Parte B di L2 — triage delle 27 voci eseguite sui 4 criteri di rischio | io | lista breve: quali delle 27 rientrano nei casi 1-4 e se lo stato lasciato è corretto, **ognuna con la verifica accanto** | ✅ **FATTO** (§V4) |
| **V5** | `#146` — i 7 secondi fattori `e2e-fixture` attivi in produzione | io | i fattori di prova non sono più attivi in produzione, dimostrato live sul DB | ⬜ |

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
