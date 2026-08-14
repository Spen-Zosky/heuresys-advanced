# Ciclo S1060-B — `#99` F4 (il residuo) + le lacune formative senza nome

**Scelta di Enzo**: «pusha tutto poi 99 e le lacune formative».
**Confine di sessione, dichiarato adesso**: entrambi i cantieri stanno in questa sessione. `#99` **F5**
(completezza di `self`, budget ~200k, voce gemella di `#117`) **non** ci sta insieme a questi due e
**non** è promessa qui.

## Misure di apertura (fatte sul vivo, prima di pianificare)

### Cantiere A — `#99` F4, l'estensione della soglia di catena

| Cosa | Misura | Comando |
|---|---|---|
| Moduli che importano da `lib/scope/mask` | **18** | `grep -rln "scope/mask\|masksTopOfChainPay\|chainLevelOf" apps/api/src/modules` |
| Dove la soglia di catena è **già** innestata | **solo `compensation/service.ts`**, righe 113-117 | `grep -rn "masksTopOfChainPay\|chainLevelOf" apps/api/src/modules` |
| Dei 18, quanti nominano `COMPENSATION` | **4** — `compensation` (11 occorrenze), `users` (2), `analytics` (1), `insights` (1) | ciclo `grep -c COMPENSATION` sui 18 service |
| Schemi condivisi che espongono importi | `compensation`, `compensation-read`, `me`, `predictions`, `time-off` | `grep -rln "salary\|gross\|bonus\|amount" packages/shared/src/schemas/` |

**Il difetto è già dimostrabile, e non è teorico.** Lo stesso dato — la retribuzione di un vertice —
si comporta in **due modi diversi** a seconda della porta da cui entri:

- `apps/api/src/modules/compensation/service.ts:113-117` — applica **entrambi** i qualificatori: il
  mandato tecnico *e* la soglia di catena. Il direttore HR (livello 3) **non** vede la paga del CEO.
- `apps/api/src/modules/users/service.ts:204-206` — il **dossier della persona** maschera
  `EMPLOYMENT_PAY_FIELDS` **solo** sotto mandato piattaforma. La soglia di catena non c'è: lo stesso
  direttore HR, aprendo il dossier del CEO, **la paga la vede**.
- `apps/api/src/modules/analytics/service.ts:117-124` — stesso schema, e con un'aggravante già
  misurata e scritta lì dentro: **280 posizioni su 299 hanno un solo titolare**, quindi ogni punto
  dello scatter *è* la retribuzione di una persona. Mascherato sotto mandato piattaforma, scoperto
  rispetto alla soglia di catena.

`me` è **fuori** per I17 (la propria retribuzione si vede sempre). `time-off.amount` è il rateo di
maturazione delle ferie, **non** una retribuzione — escluso con la ragione, non per omissione.

### Cantiere B — le lacune formative che non sanno dire di che competenza parlano

| Cosa | Misura | Comando |
|---|---|---|
| Righe in `sys.sys_learning_gaps` | **270** | `SELECT count(*)` |
| Con `learning_gap_skill_id` valorizzato | **0** | `count(learning_gap_skill_id)` |
| Con `learning_gap_position_id` valorizzato | **0** | `count(learning_gap_position_id)` |
| Con la persona | **270** | `count(learning_gap_user_id)` |
| Con i **nomi delle competenze nel metadata** | **270 su 270** | `jsonb_array_length(metadata->'legacy'->'skill_gaps') > 0` |

`repository.ts:109-110` fa due sotto-query su quelle due colonne vuote: `position_title` e
`skill_name` tornano **NULL su tutte e 270 le righe**. Intanto il dato c'è: ogni riga porta
`skill_gaps: [{skill: "Leadership", gap: 2}, …]` più `coverage_score` e `proficiency_score`.
Quattro tipi di analisi: `individual_role` 72 · `team_benchmark` 68 · `individual` 66 ·
`succession_readiness` 64.

> ⚠ **Non è un import dal brownfield** (I12, il rubinetto chiuso). Il metadata è **già dentro
> `sys.*`**: si *deriva da ciò che il database contiene*, che è esattamente ciò che I12 prescrive di
> fare al posto dell'import. Nessuna riga viene dal DB legacy → `check_no_legacy_ingest.py` non deve
> accendersi, e va **eseguito** per dimostrarlo, non dato per scontato.

## Simulazione a 5 domande

| | Cantiere A (soglia di catena) | Cantiere B (lacune) |
|---|---|---|
| **Precondizioni** | tunnel su · `chainLevelOf` e `masksTopOfChainPay` esistono e sono provati (`ba779c32`) | tunnel su · il metadata è popolato su 270/270 (misurato) |
| **Meccanismo** | riuso delle due funzioni già scritte, **non** una seconda implementazione: la regola vive in un posto solo | lettura del JSONB già presente nella riga, nessuna nuova FK, nessuna scrittura |
| **Propagazione** | codice API → CI → deploy watcher | idem; nessuna migrazione |
| **Chi** | io | io |
| **Guardia** | nessuna scrittura di massa. La prova deve **fallire prima**: riprodurre la perdita (HR che vede la paga del vertice dal dossier) e poi chiuderla | nessuna scrittura. La prova mostra il nome della competenza dove oggi c'è `null` |

## Voci

| id | cosa | chi | cosa significa fatto | stato |
|---|---|---|---|---|
| A1 | Vaglio meccanico dei 18 moduli: quali espongono davvero un importo per persona | io | lista chiusa, con la ragione di esclusione scritta per ognuno degli esclusi | **FATTO** — dentro 3 (`compensation` già, `users`, `analytics`), fuori tutti gli altri **con ragione**; `evidence`/`okrs`/`talent-review` erano falsi positivi (`_payload` contiene «pay») |
| A2 | Riprodurre la perdita sul dossier (`users`) con una prova rossa | io | un test che fallisce mostrando la paga di un vertice a un attore di livello inferiore | **FATTO** — `AssertionError: busta "2026-07": l'importo lordo di un vertice è uscito: expected 3741.23 to be undefined` |
| A3 | Innestare la soglia di catena sulle superfici trovate in A1 | io | prova A2 verde, e nessuna regressione sulle superfici già coperte | **FATTO** — `0877cdbf` (dossier, 3/3 + 36/36 vicini) e `ae9cbde3` (analytics, 2/2 + 34/34). La prova di analytics è nata verde → **sabotata e vista rossa** sul numero giusto (`expected 220000 to be less than 220000`), poi ripristinata |
| A4 | Aggiornare `.programmi/99-*.md` — F4 chiusa o residuo ri-dichiarato | io | il file dice lo stato reale, non quello sperato | **FATTO** — F4 **chiusa**, si riprende da F5 |
| B1 | La superficie delle lacune mostra la competenza dal metadata | io | la competenza non è più vuota sulle 270 righe, misurato dall'API viva | **FATTO** — `e247ad72` (API) + `d3f497da` (le due schermate, area personale compresa). 955 voci su 955 con un nome, 10 competenze distinte, 270 righe su 270 |
| B2 | Prova live + `check_no_legacy_ingest.py` verde | io | output reale allegato, cancello a 0 | **FATTO** — `OK — nessun artefatto nuovo prende righe dal legacy`, exit 0. Due chiamate HTTP con login di persone reali (lista amministrativa + area personale), 6/6 |

## Rettifica di due misure mie (non scoperte altrui: errori miei, corretti misurando di nuovo)

1. La misura di apertura di B diceva «**270 su 270** portano i nomi delle competenze»: contava
   gli **array non vuoti**, non le voci con un nome. Conclusione giusta, ragione sbagliata.
2. La verifica successiva diceva «**2 nomi distinti** su 955 voci, 823 senza nome»: cercava
   solo la chiave `skill` e non vedeva l'**intero secondo dialetto** (`skill_name`, con anche
   `current_level`/`target_level`). Il numero vero è **10 nomi distinti, 955 voci su 955 con
   un nome**. Se mi fossi fermato lì avrei costruito su un dato dimezzato — o rinunciato.

## Registro delle scoperte (fuori da questo ciclo — R24 §5)

| cosa | quando presentarlo |
|---|---|
| La prova generale del database (`ci-rehearsal.sh`) non esegue la suite Vitest: una guardia che vive in un test le sfugge per costruzione. È ciò che ha lasciato passare la `000312` in S1059 e ha tenuto la CI rossa per un giorno. | una volta sola, a fine ciclo |
| `positionTitle` resta vuoto sulle 270 lacune: `learning_gap_position_id` è NULL su tutte. A differenza della competenza, **il metadata non porta un titolo di posizione**, quindi non c'è niente da mostrare — si potrebbe derivare dalla posizione corrente della persona, ma sarebbe un'inferenza, non il dato. Non l'ho fatto. | una volta sola, a fine ciclo |

## Chiusura

**CICLO CHIUSO — 6/6 voci fatte, non resta niente.**

`#99` **F4 è chiusa** (era il residuo dichiarato) e le lacune formative dicono di quale
competenza parlano su entrambe le schermate. Quattro commit: `0877cdbf` · `ae9cbde3` ·
`e247ad72` · `d3f497da`. Confine rispettato: **F5 non è stata aperta** e non era promessa.
