# Handoff Rigor + HOLD Lane — Design Spec

> **Status**: ✅ **IMPLEMENTED** (S1000-S1001, 2026-06-20/21). The foundation (§3 closed-vocabulary + HOLD pull-lane), the gate (§4 `handoff_lint.py`, 10/10 checks, **blocking by default**), the skill (§5 v5.1 + §11.5/P5 rebase-safe push), the close-flow orchestrator (§12 `close-propagate.sh` + context-aware `vm-deploy.sh`) and the ecosystem idempotence verify (§13 marketplace-SHA + `project_memory`) are all shipped and verified. Deliberate deviations + the additive §11 enhancements still optional/Enzo-gated are recorded in **§14 Implementation status** at the bottom.
> **Goal**: rendere il sistema di handoff **rigoroso per enforcement, non per fiducia** — un gate deterministico (`handoff-lint`) che la skill `handoff` deve far passare prima del push — **e** introdurre un ciclo di vita degli stati a vocabolario chiuso con una corsia **HOLD** *pull-based*, così che le azioni esplicitamente rimandate a sessioni dedicate **non rientrino più nel menu dei pending** ma vivano in un registro separato, auditabile e attivabile solo su richiesta.
> **Scope**: estende la dottrina SoT v2 (`2026-06-05-sot-unification-design.md` §11-12). Non la sostituisce: i domini disgiunti + single-updater restano; qui si aggiunge **l'enforcement** che oggi manca, **la corsia di stato** che oggi non esiste, (§12) la **stabilizzazione del close-flow completo** (deploy + ecosystem-align + clone-DB del PROD twin) perché sia *sempre* eseguito in futuro, e (§13) la **garanzia di idempotenza dei 4 ecosistemi Claude** (Windows/mac/vm/linux-pc) misurata via `--verify`, non un'azione one-shot.

---

## 1. Problema

La dottrina SoT v2 promette *"drift strutturalmente impossibile"* via tre invarianti (domini disgiunti, single updater, counts ri-derivati). Il design è concettualmente solido, ma **tutta la rigidità vive come prosa rivolta all'LLM, zero enforcement meccanico**, e proprio al session-close — il momento di massimo esaurimento/compattazione del contesto. Conseguenze misurate in questa sessione (read-only, evidence-based):

### 1.1 Il drift "impossibile" è già nel file

`docs/kb/SOT_STATE.md` — un solo file, un solo updater, "ri-derivato ogni sessione" — dichiara lo stesso conteggio in due valori diversi:

| Punto del file | Migration dichiarate | Max file |
|---|---|---|
| §0 snapshot headline (riga 7) | **135** | `000136` |
| Delta S998 (righe 13-35) | **139** | `000141` |
| *Reale su disco (2026-06-20)* | *144* | *`000146`* |

Le 144/000146 reali sono in parte sessione in corso (legittimo, non ancora handoffato). Ma **135 vs 139 nello stesso file, entrambi scritti dal handoff** è drift puro: la sezione Delta viene ri-derivata, la headline §0 no. L'invariante "single updater + re-derive ⟹ no drift" è **falsificato dal file stesso**.

E la regola "STATE = zero numeri" (§11.5) è violata: `.handoff/STATE.md` righe 26-28 contengono `000141`, `139 file`, `12/12` (il blocco Verification embedda valori attesi = conteggi che duplicano SOT_STATE).

### 1.2 I 10 gap di rigidità (nessuno machine-checked)

| # | Gap | Evidenza |
|---|---|---|
| 1 | Nessun gate di verifica nel handoff prima del push | skill v4 Step 4 fa `git push` senza self-check; la spec §9 *one-time* aveva exit-criteria, la skill *ricorrente* no |
| 2 | Disgiunzione non verificata → già violata | STATE contiene counts |
| 3 | Counts ri-derivati solo a chiazze | §0 headline stale vs Delta |
| 4 | "Nessun pending solo in memoria" è auto-referenziale | regola §12.2: se il contesto compatta a metà, i pending pre-compaction sono persi *prima* del handoff |
| 5 | Nessuna atomicità del close | sequenza STATE→SOT→backlog→debt→index→commit→push→align→deploy senza transazione |
| 6 | Blast radius enorme su atto LLM-driven | Step 4+4b = push diretto main **+ auto-deploy PROD** al close |
| 7 | Counts stale senza fail-loud né TTL | §3b "se tunnel down → marca stale" ma nulla forza la ri-derivazione dopo |
| 8 | Loop "menu esaustivo" mai chiuso | nessuna riconciliazione next-start tra item chiusi e item marcati DONE |
| 9 | Marker delta silenziosamente fragile | `session-boot.ps1` riga 66 `try{}catch{}` vuoto |
| 10 | Skill/spec/CLAUDE.md tenuti in sync a mano | skill v4.0 ↔ spec v2 ↔ CLAUDE.md §12, nessun test |

### 1.3 Il dolore HOLD (causa-radice separata ma collegata)

Il backlog oggi distingue solo *escluso* (DONE/WON'T-DO) vs *incluso* (tutto il resto). Manca la distinzione tra **chi deve ricomparire** (bloccato da una dipendenza che può sciogliersi) e **chi deve sparire dal flusso normale finché non lo si richiama** (rimandato per scelta a una sessione dedicata).

Censimento reale (`grep` su `SOT_BACKLOG.md`, 2026-06-20): **11 `DEFER`**, più `sospeso` (2), `differito` (1), `schedulato` (1), "→ sessione dedicata", "DEFER S970", "Leva successione DEFERITA (decisione Enzo)" — **tutti prosa, nessuno uno stato machine-distinguibile**. Il protocollo `## Session start` di CLAUDE.md dice testualmente *"KEEP gated items… (visible but clearly not ready)"* → tutto ciò che è parcheggiato di proposito **rientra nel menu** ogni sessione. Da qui il fastidio: le azioni differite ricompaiono tra i pending invece di stare a gestione separata.

---

## 2. Locked decisions

1. **L'enforcement è uno script deterministico** (`handoff-lint`), non altra prosa. La skill `handoff` lo esegue e **non pusha con lint rosso** (come per CI rossa, R3).
2. **Vocabolario di stati chiuso a 6 valori**, ognuno con una *corsia* (push / pull) e metadati obbligatori. Nessuno stato raw fuori vocabolario (`DEFER`/`sospeso`/`differito` → migrati a `HOLD`).
3. **Nuova corsia HOLD, pull-based**: esclusa dal corpo del menu di session-start, mostrata solo come conteggio-sommario; entra in menu **solo** su richiesta esplicita o quando scatta il suo *reactivation-trigger*.
4. **Il registro HOLD vive come SEZIONE TAGGATA dentro `SOT_BACKLOG.md`** — opzione (a), raccomandata. Niente nuovo file di stato (rispetta la regola anti-proliferazione "never spawn a new state file"). La separazione di corsia la garantisce il lint + il render del menu, non la separazione fisica.
5. **Nessun item può essere HOLD senza metadati completi** (hold-reason, decided-by, hold-since, reactivation-trigger): il lint lo rifiuta → impossibile parcheggiare in silenzio.

---

## 3. Parte 1 — Lifecycle degli stati (vocabolario chiuso)

### 3.1 I 6 stati, corsie e metadati

| Stato | Corsia | Nel menu? | Semantica | Metadati obbligatori |
|---|---|---|---|---|
| **ACTIVE** | push | sì (P1/P2/P3) | lavorabile ora | priority, effort, doc-ref |
| **GATED** | push | sì, `⛔` con blocco | bloccato da una **dipendenza tecnica** che può sciogliersi da sé | blocker, *unblock-trigger* |
| **WAIT-INPUT** | push (vassoio "aspetta te") | sì, sezione dedicata | bloccato su un **input che solo Enzo fornisce** (credenziale, sandbox, decisione *cosa*) | input-richiesto, perché-solo-tuo |
| **HOLD** ⏸ | **pull** | **NO** (solo conteggio) | **rimandato per scelta** a sessione apposita *quando lo chiederà Enzo* | hold-reason, **decided-by**, **hold-since (SXXX)**, **reactivation-trigger** |
| **DONE** / **FATTO** | — | no (terminale) | chiuso | commit-ref |
| **WON'T-DO** | — | no (terminale) | non si farà | rationale |

### 3.2 La distinzione chiave: WAIT-INPUT vs HOLD

- **WAIT-INPUT** = *"appena mi dai X parte"*. Aspetta una **cosa**. Resta visibile in un vassoio "aspetta te" perché il giorno che arriva X diventa subito lavorabile. Es. `#8 EMAIL` (app-password Outlook), `#16 SuccessFactors` (sandbox).
- **HOLD** = *"non ora, sessione dedicata, chiedimelo tu"*. Non aspetta una cosa: aspetta la **decisione di iniziare**. Pull-based → **fuori dal menu di default**. Es. il "programma-faro schedulato" (`#3/#4/#5-RACI/#13/#17`), l'audit `#9/#10/#11` "sessione dedicata", i `DEFER` B-50 sbloccabili solo da decisione PM.

Regola di disambiguazione per il lint e per chi scrive il handoff: *se l'item riparte appena arriva un input esterno specifico → **WAIT-INPUT**; se riparte solo quando Enzo decide di dedicargli una sessione → **HOLD***.

### 3.3 Schema canonico di una voce (machine-parseable)

Ogni item nel backlog porta una riga-intestazione con `· status: <STATO>` e, per gli stati non-terminali, i metadati come sotto-bullet `key: value`. Esempio HOLD (è il campo `reactivation-trigger` che oggi non esiste ed è ciò che serve a Enzo):

```markdown
- **#3 Gap#1 programma-faro** · status: HOLD ⏸
  - hold-reason: scope/autorità *cosa* = Enzo; build solo su go esplicito
  - decided-by: Enzo · hold-since: S998 (2026-06-19)
  - reactivation-trigger: Enzo dice "parti con Gap#1" + scioglie le decisioni §8 dello spec
  - effort-at-reactivation: ~7.5-9 pw · doc: docs/product/WORKITEM_GAP1_DESIGN_SPEC.md
```

Esempio WAIT-INPUT:

```markdown
- **#8 EMAIL dormiente** · status: WAIT-INPUT
  - input-richiesto: app-password Outlook (enzo.spenuso@outlook.com)
  - perché-solo-tuo: credenziale personale → attiva EMAIL_OTP + digest live in 1 mossa
```

### 3.4 Render nel menu (il pezzo che toglie il fastidio)

Il session-start **non lista** gli HOLD tra i pending. Mostra una riga di sommario, p.es.:

```
⏸ 14 azioni in HOLD (gestione separata) — scrivi "mostra hold" per l'elenco.
```

Quando Enzo dice "mostra hold" / "riprendi #3", quell'item passa `HOLD → ACTIVE` **per quella sessione** (transizione che il handoff finale persiste se il lavoro è iniziato). Gli HOLD restano quindi tracciati, auditabili (chi/quando/perché/cosa-li-risveglia), **ma fuori dall'elenco azioni**.

### 3.5 Transizioni ammesse

```
ACTIVE  → DONE | WON'T-DO | GATED | WAIT-INPUT | HOLD
GATED   → ACTIVE (unblock-trigger scatta) | WON'T-DO | HOLD
WAIT-INPUT → ACTIVE (input arriva) | WON'T-DO | HOLD
HOLD    → ACTIVE (reactivation-trigger / richiesta esplicita) | WON'T-DO
DONE / WON'T-DO = terminali (nessuna uscita)
```

---

## 4. Parte 2 — `handoff-lint`: il gate deterministico

### 4.1 Collocazione e contratto

- File: `docs/kb/tools/handoff_lint.py` (stesso posto di `build_index.py`; Python già usato lì).
- Invocazione: `python docs/kb/tools/handoff_lint.py [--no-db]` da repo root.
- Contratto: **exit 0** = tutti i check pass; **exit 1** = almeno un check fail (stampa lista puntuale `FAIL <id>: <dettaglio>`); **exit 2** = errore interno (file mancante, parse error).
- `--no-db`: salta i check che richiedono il tunnel psql (D3 parziale) e li marca `SKIPPED (no-db)` invece che FAIL — usato quando il tunnel è giù; in quel caso i counts DB vanno marcati `(non ri-derivato — tunnel down)` nel SOT, e D3 verifica *quella marcatura* invece del valore.

### 4.2 I check (4 gruppi)

| # | Check | Regola | Come si calcola | Fail se |
|---|---|---|---|---|
| **D1** | Disgiunzione STATE | STATE = zero conteggi | regex conteggi su `.handoff/STATE.md` esclusa la sezione `## Verification` (i comandi sì, i commenti-con-numeri no) | numeri-conteggio fuori dai comandi shell |
| **D2** | Coerenza interna SOT | headline §0 == ultimo Delta | estrae `N file / 000NNN / M moduli` da §0 e dall'ultimo `## Delta SXXX` | i due set non combaciano |
| **D3** | Freschezza counts | dichiarato == reale | confronta i counts SOT con `ls db/migrations/*.sql \| wc -l`, max-migration, `package.json` versions, `git tag`, e (tunnel up) le query psql del SOT | scostamento ≠ 0 e non marcato stale |
| **D4** | Drift vs HEAD | SOT cita l'HEAD giusto | `git rev-parse HEAD` == sha nel Delta corrente (post-commit del handoff) | sha stale |
| **S1** | Struttura STATE | sezioni + ≤60 righe + 1-3 priorità | parse markdown sezioni | manca sezione / >60 righe / priorità ∉ [1,3] |
| **S2** | Vocabolario stati | ogni item ha **uno** stato del vocabolario chiuso | per ogni voce `- **#…**` cerca `· status: <STATO∈{6}>` | item senza stato o con `DEFER`/`sospeso`/`differito` raw |
| **H1** | Integrità HOLD | nessun HOLD senza metadati | per ogni `status: HOLD` verifica hold-reason + decided-by + hold-since + reactivation-trigger | manca un campo |
| **H2** | Nessun rinvio orfano | niente "rinvio" in prosa fuori da un blocco HOLD | grep parole-spia (`differit`, `sospes`, `→ sessione dedicata`, `rimandat`) non dentro una voce HOLD/WAIT-INPUT | trova un rinvio non formalizzato |
| **A1** | Atomicità | o tutto coerente o si aborta | i 4 file target staged + cross-reference validi (es. `#` citato nel brief esiste nel backlog) | handoff parziale |
| **A2** | Loop chiuso | item "chiusi" sono marcati DONE | i `#` citati come chiusi nel brief STATE hanno `status: DONE` nel backlog | un item chiuso nel brief non è DONE |

I nuovi rispetto allo stato attuale sono **S2/H1/H2** (sono quelli che impediscono il ritorno del problema HOLD); D1-D4 e A1-A2 colpiscono i 10 gap §1.2.

### 4.3 Struttura dello script (implementabile)

```python
# docs/kb/tools/handoff_lint.py — deterministico, no side-effects, sola lettura repo.
# Exit: 0 pass · 1 fail (lista FAIL) · 2 errore interno.

VALID_STATES = {"ACTIVE","GATED","WAIT-INPUT","HOLD","DONE","FATTO","WON'T-DO"}
HOLD_REQUIRED = {"hold-reason","decided-by","hold-since","reactivation-trigger"}
DEFER_WORDS   = ("differit","sospes","rimandat","→ sessione dedicata","DEFER ")
STATE_MD   = ".handoff/STATE.md"
SOT_MD     = "docs/kb/SOT_STATE.md"
BACKLOG_MD = "docs/kb/SOT_BACKLOG.md"

def check_D1_state_no_counts(text) -> list[str]: ...   # regex conteggi fuori da ```...```
def check_D2_sot_internal(text) -> list[str]: ...      # §0 vs ultimo Delta
def check_D3_freshness(sot, repo, use_db) -> list[str]:...# ls/git/package.json/psql
def check_D4_head(sot) -> list[str]: ...                # git rev-parse vs Delta sha
def check_S1_state_struct(text) -> list[str]: ...       # sezioni, <=60 righe, 1-3 prio
def check_S2_vocab(backlog) -> list[str]: ...           # ogni item ha status valido
def check_H1_hold_meta(backlog) -> list[str]: ...       # HOLD => 4 campi
def check_H2_no_orphan_defer(backlog) -> list[str]: ... # DEFER_WORDS fuori da HOLD
def check_A1_atomicity(repo) -> list[str]: ...          # staged + cross-ref
def check_A2_loop_closed(state, backlog) -> list[str]:..# brief chiusi => DONE

def main():
    fails = []
    for chk in (D1,D2,D3,D4,S1,S2,H1,H2,A1,A2): fails += chk(...)
    if fails:
        for f in fails: print(f"FAIL {f}")
        sys.exit(1)
    print("handoff-lint OK")
```

Nessun check muta file: il lint è **read-only sul repo**, opera su working tree (post-scrittura, pre-commit). Idempotente, ri-eseguibile.

---

## 5. Parte 3 — Modifiche alla skill `handoff` (v5)

Delta minimo rispetto a v4 (`~/.claude/skills/handoff/SKILL.md`):

- **Step 3c esteso**: i rinvii decisi in sessione si registrano come voci **`HOLD`** (o **`WAIT-INPUT`**) con il blocco strutturato §3.3 — **mai** come prosa `DEFER`/`sospeso`. La regola cardinale "nessun pending solo in memoria" si rafforza in: *"nessun pending senza uno stato del vocabolario; nessun rinvio senza reactivation-trigger"*.
- **Nuovo Step 3.5 — lint gate** (prima del commit):
  ```bash
  python docs/kb/tools/handoff_lint.py || { echo "handoff-lint rosso: correggi prima di pushare"; }
  ```
  Se rosso: correggere i FAIL e ri-lanciare. **Mai pushare con lint rosso** (R3 cross-project: la CI rossa è un errore da correggere, non da scaricare — stesso principio). Se la skill gira in un progetto senza `handoff_lint.py`, lo step è no-op silenzioso (come Step 3d per `build_index.py`).
- **Step 4 invariato** (commit + push diretto main) ma ora *gated* dallo Step 3.5.
- Bump nota skill: `v5.0 — handoff-lint gate + closed-vocabulary states + HOLD pull-lane (S999, 2026-06-20)`. v4/v3/v2 preservati dove i file extra / il lint sono assenti.

---

## 6. Parte 4 — Modifiche a `CLAUDE.md` (`## Session start` + `## Source of Truth`)

### 6.1 `## Session start` — regola di inclusione del menu

Cambia il punto 2-3 del protocollo:

- Il menu aggrega **ACTIVE** (in P1/P2/P3), **GATED** (`⛔` con blocco), **WAIT-INPUT** (vassoio dedicato "aspetta un tuo input").
- **HOLD è ESCLUSO dal corpo del menu**: compare solo come **riga-sommario di conteggio** ("⏸ N azioni in HOLD — scrivi *mostra hold*"). Entra in menu **solo** su richiesta esplicita di Enzo o quando il suo `reactivation-trigger` è soddisfatto.
- Terminali (DONE/FATTO/WON'T-DO) esclusi come oggi.

### 6.2 `## Source of Truth` — nota sul vocabolario

Aggiungere una riga: *"Gli item di backlog/debt portano uno `status` del vocabolario chiuso {ACTIVE, GATED, WAIT-INPUT, HOLD, DONE, WON'T-DO}. HOLD = corsia pull (gestione separata, fuori dal menu). Lo stato è verificato da `docs/kb/tools/handoff_lint.py` a ogni handoff."*

---

## 7. Migrazione dei rinvii esistenti (one-time, prima che il lint diventi bloccante)

Il lint H2/S2 fallirebbe sul backlog attuale (11 `DEFER` + prosa). Prima dell'attivazione-bloccante, una passata di migrazione classifica ogni rinvio esistente:

| Item attuale | Stato target | Note |
|---|---|---|
| `#3/#4/#5-RACI/#13/#17` programma-faro schedulato | **HOLD** | reactivation-trigger = go esplicito Enzo |
| audit `#9/#10/#11` "sessione dedicata" | **HOLD** | reactivation-trigger = richiesta sessione audit |
| `#8 EMAIL`, `#16 SuccessFactors` | **WAIT-INPUT** | aspettano input/credenziale esterni |
| B-50 `DEFER` (branches/pools/candidates già chiusi S982) | **DONE** o **HOLD** | quelli chiusi → DONE; quelli ancora aperti su decisione PM → HOLD con trigger "decisione bridge/Wave-2" |
| `#12/#5c/#14/#18/#19` terminali | **WON'T-DO** / **DONE** | già disposti S998 |

Strategia consigliata: la migrazione è **CLASS-A operativa** (riclassificazione meccanica evidence-based) ma con un punto **CLASS-B**: alcuni `DEFER` storici potrebbero essere WAIT-INPUT *o* HOLD a seconda dell'intento → in dubbio, default a **HOLD** (più conservativo: esce dal menu, Enzo lo richiama) e si annota per conferma.

---

## 8. Verification / exit criteria

- `python docs/kb/tools/handoff_lint.py` ritorna **0** sul repo allineato post-handoff.
- Iniettando un drift artificiale (es. cambiare a mano un count in §0 del SOT) il lint ritorna **1** con `FAIL D2/D3`.
- Una voce HOLD priva di `reactivation-trigger` → `FAIL H1`.
- Un `DEFER` raw lasciato in prosa → `FAIL H2/S2`.
- Un session-start su backlog migrato mostra gli HOLD **solo** come conteggio-sommario, non nei tier P1/P2/P3.
- Push del handoff bloccato finché il lint è rosso (verificato simulando un fail).
- Nessun impatto build/test (tooling docs + script standalone) — ma il push triggera CI: deve restare verde.

---

## 9. Risks & non-goals

| Rischio | Mitigazione |
|---|---|
| Il lint diventa fragile sul parsing markdown (falsi FAIL) | regex ancorate + test del lint su un fixture di STATE/SOT/backlog noti; `--no-db` per ambienti senza tunnel; iniziare in modalità **warn-only** (stampa FAIL ma exit 0) per 1-2 sessioni, poi promuovere a bloccante |
| Migrazione mis-classifica un rinvio | default conservativo a HOLD; annotare per conferma Enzo (CLASS-B) |
| HOLD nascosto = item dimenticato | il sommario-conteggio è sempre visibile al session-start; ogni HOLD ha un reactivation-trigger esplicito → è "parcheggiato", non "perso" |
| La skill è globale e gira su altri progetti | lint + vocabolario sono **opt-in per presenza file**: progetti senza `handoff_lint.py` e senza `status:` nel backlog non sono toccati (no-op) |

**Non-goals**: (1) rendere atomico l'intero close con una vera transazione filesystem — A1 si limita a un check di coerenza pre-commit, non a un rollback automatico (eventuale task infra separato, cfr. gap #5); (2) cambiare l'auto-deploy PROD al close (gap #6 — decisione di blast-radius, autorità Enzo, fuori scope qui); (3) toccare il boot hook (resta infra-only); (4) il fix del marker `try{}catch{}` (gap #9) — micro-fix separato.

---

## 10. Rollout (ordinato, idempotente)

1. Scrivere `docs/kb/tools/handoff_lint.py` + un fixture-test minimo.
2. Definire il vocabolario nel `## Source of Truth` di CLAUDE.md + cambiare `## Session start` (render HOLD = sommario).
3. Migrare i rinvii esistenti del backlog ai 6 stati (§7), default conservativo HOLD.
4. Aggiornare la skill `handoff` → v5 (Step 3c esteso + Step 3.5 lint gate).
5. Far girare il lint in **warn-only** per 1-2 handoff; correggere i FAIL reali emersi.
6. Promuovere il lint a **bloccante** (push gated). Aggiornare questo spec → Status IMPLEMENTED.

---

## 11. Potenziamenti (P1-P9)

Le §1-§10 rendono il sistema **rigoroso** (rileva il drift, formalizza gli stati). Questa sezione raccoglie i potenziamenti che lo rendono **più potente**: da *rilevare* il drift a renderlo *impossibile*, da *passivo* a *proattivo*, e blindato per l'uso **multi-sessione**. Sono additivi sulla fondazione §1-§10. Evidenze raccolte in sessione (2026-06-20, read-only):

- la skill `handoff` Step 4 fa **`git push` diretto su main senza `pull`/`rebase`/`fetch`** → race su STATE/SOT con sessioni concorrenti;
- il pattern *sorgente-strutturata → vista-generata* è **già nel repo**: `docs/kb/tools/build_index.py` produce `INDEX_PATHS.md` **+ `index_paths.yaml`** (510 KB machine-readable);
- CI = **8 workflow su self-hosted runner** (`lint.yml`, `shell-tests.yml`, …) → un gate di stato si innesta senza nuova infra;
- **59 item** in stati non-terminali oggi senza alcun age-tracking → accumulo silenzioso.

### 11.0 Sintesi

| # | Proposta | Leva | Impatto | Costo | Dipende da | Autorità |
|---|---|---|---|---|---|---|
| P1 | Item come dati canonici (status+metadati strutturati; narrativa prosa) | rende-impossibile | alto | medio | — | **Enzo (architetturale)** |
| P2 | Menu di session-start generato da script | rende-impossibile | alto | medio | P1 | **Enzo (architetturale)** |
| P3 | Trigger machine-checkable (HOLD/GATED si auto-segnalano) | proattivo | alto | medio | P1 | Claude (how) |
| P4 | Session-journal incrementale append-only | proattivo | alto | basso | — | Claude (how) |
| P5 | Concorrenza: `pull --rebase` + ri-lint pre-push | robustezza | alto | basso | — | Claude (how) |
| P6 | Lint anche in CI (`state-lint.yml`) | robustezza | medio | basso | lint §4 | Claude (how) |
| P7 | Reality-check al boot (lint in lettura) | robustezza | medio | basso | lint §4 | Claude (how) |
| P8 | Stato INTERRUPTED ≠ HOLD (`resume-from`) | precisione | alto | basso | vocab §3 | Claude (how) |
| P9 | Age/health tracking + TTL counts stale | precisione | medio | basso | P1 | Claude (how) |

### 11.1 P1 — Item come dati canonici *(decisione architetturale = Enzo)*

**Cosa**: gli item di `SOT_BACKLOG.md` (e debt) portano il loro `status` + metadati (§3.3) come **blocco dati machine-parseable** (YAML inline o front-matter per voce); la **narrativa resta prosa** intorno. Il drift §1.1 nasce dalla ridondanza dello stesso fatto in più punti di prosa: strutturare l'item lo rende **impossibile da introdurre**, non solo rilevabile.

**Come**: ogni voce diventa un blocco con header dati + corpo narrativo, p.es.

````markdown
```item
id: "3"
title: Gap#1 programma-faro
status: HOLD
hold-reason: "scope/autorità cosa = Enzo; build solo su go esplicito"
decided-by: Enzo
hold-since: S998
reactivation-trigger: { kind: manual, desc: "Enzo dice parti con Gap#1 + scioglie §8" }
effort: "~7.5-9 pw"
doc: docs/product/WORKITEM_GAP1_DESIGN_SPEC.md
```
Narrativa libera sotto: razionale, storia, link [[...]] — non parsata.
````

Il lint §4 passa da regex-fragili-su-markdown a **parse di blocchi `item`** (robusto, niente falsi FAIL §9). Abilita P2/P3/P9.

**Onestà / contraddizione**: tocca in parte la locked-decision di `2026-06-05-sot-unification-design.md` §2 ("*not canonical+generated-views*") — ma **solo sugli item**, non sulla narrativa, e il repo già genera `index_paths.yaml`. Resta una scelta di Enzo: dove vive lo stato (prosa pura vs prosa+dati-item).

### 11.2 P2 — Menu di session-start generato *(decisione architetturale = Enzo)*

**Cosa**: con gli item strutturati (P1), il menu `## Session start` si **genera** da uno script (`docs/kb/tools/build_menu.py`) invece di essere ricostruito a mano dall'LLM: tier P1/P2/P3 da `status:ACTIVE` + priority, sezione GATED, vassoio WAIT-INPUT, conteggio-sommario HOLD. L'LLM lo **presenta** e aggiunge solo il giudizio dove serve (impatto/aggregabilità).

**Perché**: chiude il **gap #8** (loop esaustivo): il menu diventa una **funzione pura dello stato** → esaustivo per costruzione, non per diligenza. Precedente in casa: `build_index.py`.

**Dipende da P1.** Senza dati strutturati, la generazione resta fragile (la ragione storica per cui §12.1 scelse LLM-driven). P1 rimuove quella ragione.

### 11.3 P3 — Trigger machine-checkable

**Cosa**: il `reactivation-trigger` (HOLD) e l'`unblock-trigger` (GATED) ammettono una forma **valutabile**, non solo testo: `{ kind: query, sql: "...", expect: ">0" }` o `{ kind: file-exists, path: "..." }`. Al boot, un check li valuta e, se soddisfatti, **segnala proattivamente**: *"il parcheggio #X è diventato sbloccabile — riattivare?"*.

**Esempio reale**: i `DEFER` B-50 ("sbloccabile quando Wave-2 popola `position_id`") → `{ kind: query, sql: "SELECT count(*) FROM sys.sys_... WHERE position_id IS NOT NULL", expect: ">0" }`. HOLD/GATED smettono di essere liste morte: il sistema viene incontro a Enzo. `kind: manual` resta per i trigger che dipendono solo dalla sua decisione.

**Dipende da P1** (il trigger è un campo strutturato).

### 11.4 P4 — Session-journal incrementale

**Cosa**: un file append-only `.handoff/session-journal.ndjson`, **azzerato/ruotato dal boot** (`session-boot.ps1`) e **consolidato dal close** (skill Step 3). Ogni decisione/rinvio/pending vi viene appeso *quando emerge* durante la sessione.

**Perché**: risolve il **gap #4 alla radice**. La regola "nessun pending solo in memoria" oggi è verificata al close — ma se il contesto **compatta a metà** il pending è già perso *prima* del check. Col journal il close diventa "**consolida dal journal**", non "ricostruisci dalla memoria": il pending sopravvive alla compattazione.

**Come**: una riga = `{"ts","kind":"pending|decision|defer|interrupted","ref","note"}`. Il boot, se trova un journal **non vuoto** all'avvio (sessione precedente morta senza close), lo segnala come recovery invece di azzararlo. Il marker §9 (`.session-align.marker`) e il journal condividono il ciclo create-at-boot / consume-at-close.

### 11.5 P5 — Concorrenza multi-sessione *(urgente)*

**Cosa**: prima del push, la skill `handoff` fa `git pull --rebase origin main`, **ri-lancia `handoff-lint` dopo il rebase** (lo stato remoto può essere cambiato), poi pusha. Su conflitto di STATE/SOT/backlog: risolverlo è parte del close (mai `-X ours/theirs` cieco; mai `--no-verify`).

**Perché**: oggi il close pusha diretto senza rebase (verificato: skill Step 4). Con sessioni concorrenti — **scenario in atto** — due close = conflitto o lost-update. Costo bassissimo, **indipendente da tutto il resto**, protegge da subito.

**Delta skill (Step 4)**:
```bash
git pull --rebase origin main
python docs/kb/tools/handoff_lint.py   # ri-verifica post-rebase; rosso ⇒ stop
git push origin main
```

### 11.6 P6 — Lint in CI

**Cosa**: nuovo workflow `.github/workflows/state-lint.yml` che esegue `handoff_lint.py --no-db` su ogni push che tocca `.handoff/**` o `docs/kb/SOT_*.md` o `DEBT_REGISTER.md`.

**Perché**: il lint al close protegge il *proprio* close; in CI protegge anche le **edit a mano fuori dal handoff** (un'altra sessione che tocca il backlog senza chiudere). Doppio gate. Si innesta sui 8 workflow esistenti, runner self-hosted (no `--no-db`? il runner VM **ha** il DB locale → può girare full).

### 11.7 P7 — Reality-check al boot

**Cosa**: al session-start, dopo gli hook infra, girare `handoff_lint.py` **in lettura** e includerne l'esito nel banner: *"stato coerente"* oppure *"⚠ stato già driftato: FAIL D3 (migration 139 dichiarate vs 144 reali)"*.

**Perché**: col multi-sessione lo stato committato può essere già incoerente *prima* che tu inizi (un'altra sessione l'ha lasciato così). Saperlo all'avvio evita di costruire il menu su dati marci. Costo: una invocazione read-only.

### 11.8 P8 — Stato INTERRUPTED ≠ HOLD

**Cosa**: aggiungere al vocabolario §3.1 lo stato **INTERRUPTED** (corsia push, **in cima** al menu): lavoro **iniziato e fermato involontariamente** (fine budget/contesto), da riprendere. Metadati: `resume-from: <punto esatto>` (file:line, branch, prossimo step), `interrupted-since: SXXX`.

**Perché**: un flusso interrotto **non è** parcheggiato per scelta (≠ HOLD) né lavorabile-da-zero (≠ ACTIVE generico): è in volo. È il caso peggiore di perdita-contesto (riprendere a metà) e oggi finirebbe confuso. Va distinto e prioritizzato. Il journal P4 (`kind:interrupted`) lo alimenta automaticamente.

**Transizioni**: `ACTIVE → INTERRUPTED` (budget/contesto finito) ; `INTERRUPTED → ACTIVE` (ripreso) `| DONE | HOLD` (se Enzo decide di parcheggiarlo).

### 11.9 P9 — Age/health tracking

**Cosa**: derivare da `hold-since`/`interrupted-since`/`wait-since` l'**età in sessioni** di ogni item non-terminale; un mini-report al boot: *"14 HOLD (3 fermi >20 sessioni → candidati WON'T-DO), 5 WAIT-INPUT (2 aspettano da >10), 1 INTERRUPTED"*. Più **TTL sui counts stale** (sistematizza il gap #7): un count marcato `(non ri-derivato — tunnel down)` da >N sessioni → FAIL del lint (non resta stale per sempre).

**Perché**: anti-accumulo. Oggi 59 item non-terminali crescono senza poda. L'età rende visibile il "parcheggio diventato cimitero".

**Dipende da P1** (le date sono campi strutturati interrogabili).

### 11.10 Sequenza raccomandata (additiva su §10)

1. **P5** — concorrenza: subito, indipendente, protegge oggi.
2. **P8 + P4** — interrupted-state + journal: chiudono la perdita-contesto, costo basso.
3. **P1 + P2** — stato come dati + menu generato: il salto strutturale (**decisione Enzo**).
4. **P3 + P6 + P7** — proattività + gate CI + reality-check: innesto naturale post-P1.
5. **P9** — health: igiene continua.

P5/P8/P4/P6/P7 **non** richiedono P1 e possono procedere sulla fondazione §1-§10. P2/P3/P9 attendono la decisione su P1.

---

## 12. Stabilizzazione del close-flow completo (deploy + ecosystem-align + clone-DB)

L'implementazione del nuovo sistema non si chiude con un'esecuzione one-shot. Il **close-flow di OGNI sessione futura** deve includere stabilmente la propagazione completa ai cloni — repo+deploy, ecosistema Claude (skill incluse) e refresh del DB bare-metal del PROD twin linux-pc — altrimenti i cloni driftano dal PC source-of-truth (la skill `v5` resterebbe solo su Windows, il DB di linux-pc resterebbe fermo). Questa sezione definisce **cosa rendere permanente** e **come correggere skill/script** perché lo sia.

### 12.1 Stato attuale del close-flow (gap verificati, 2026-06-20)

| Passo | Oggi | Gap |
|---|---|---|
| handoff-lint gate | non esiste | aggiunto da §4-5 di questo design |
| commit + push main | ✅ skill Step 4 | — |
| `align-clones all --delta --resilient --auto-deploy` | ✅ skill Step 4b | propaga repo+payload+memorie; deploy solo se i commit toccano deploy-paths |
| `align-claude-ecosystem` | ❌ manuale/standalone (`deploy/README §Claude ecosystem`) | **la skill `v5` non raggiunge i cloni al close** |
| `clone-vm-db.sh` su linux-pc | ❌ on-demand (B-52) | **il DB del PROD twin non si rinfresca al close** |
| orchestratore unico | ❌ inesistente | il close è una checklist in prosa nella skill → dimenticabile |

`align-clones.sh` **non** invoca né `align-claude-ecosystem` né `clone-vm-db` (solo una NOTE nel commento del leg linuxpc). I due canali (§ del corpo: repo+payload via `align-clones`; ecosistema via `align-claude-ecosystem`) sono **disgiunti e oggi solo il primo è automatico al close**.

### 12.2 Intervento: orchestratore unico `close-propagate.sh`

Per rendere il flusso *non-dimenticabile* — "sempre eseguito" = **un entrypoint canonico**, non una lista che qualcuno può saltare — si introduce `scripts/close-propagate.sh`, idempotente + resiliente, che incapsula la **propagazione post-push**:

```
close-propagate.sh [--full|--delta] [--no-deploy] [--no-clone-db]
  1. align-clones.sh all  <mode> --resilient (--auto-deploy|--deploy)   # repo+payload+deploy PROD vm+linuxpc
  2. align-claude-ecosystem.sh all --resilient [--delta]                # ecosistema Claude (skill v5) sui cloni
  3. clone-db su linux-pc  (per policy §12.3, resiliente: host off → skip)
  4. verify: ecosystem --verify CLEAN + /readyz+/login vm&linuxpc + lint sui cloni
```

La skill `handoff` **Step 4b** smette di chiamare direttamente `align-clones` e chiama `close-propagate.sh` (un solo punto di verità del "close completo"). Ogni host irraggiungibile è **skip+warn**, mai un fail del close (resilienza già nativa nei due align-script).

### 12.3 Policy del clone-DB al close (decisione = Enzo)

`clone-vm-db.sh` è `pg_dump(VM) | pg_restore(local) --clean --if-exists` su ~1.1 GB: **DROP+recreate** del DB locale di linux-pc (alcuni minuti). linux-pc è un **PROD twin per testing reale** → un clone cieco a ogni close **cancellerebbe eventuali dati di test in corso** e costa banda/tempo anche quando nulla è cambiato. Il *trigger* è quindi una scelta di costo+blast-radius, da decidere:

| Opzione | Quando clona | Pro | Contro |
|---|---|---|---|
| A. ogni close | sempre | twin sempre 1:1 con VM | costoso; distrugge dati di test locali a sorpresa |
| B. **condizionale** (racc.) | solo se la sessione ha toccato i dati VM (seed/import/migration) o se passato `--clone-db` | economico; clona solo quando serve | serve un segnale "dati VM cambiati" (deriva dal marker/commit-paths) |
| C. TTL | se l'ultimo clone è più vecchio di N | cadenza prevedibile | può clonare anche senza cambiamenti |
| D. on-demand (status quo) | mai automatico | zero sorprese | il twin drifta dai dati VM finché non lo si rinfresca a mano |

**Raccomandazione: B (condizionale) + sempre resiliente + override esplicito** (`--clone-db` forza, `--no-clone-db` salta). In tutti i casi `--clean --if-exists` rende il refresh idempotente, e linux-pc off → skip+warn. La scelta finale (incluso "sempre" se preferisci la garanzia 1:1 sopra il costo) è tua: impatta direttamente come usi linux-pc per il testing.

### 12.4 `vm-deploy.sh` context-aware (gap linux-pc — BLOCCANTE per il close-flow automatico)

**Finding verificato (2026-06-20)**: `vm-deploy.sh` è VM-centrico; usato come entrypoint deploy di linux-pc (ciò che il close-flow stabilizzato farebbe via `align-clones linuxpc --deploy`) produce un **twin rotto**. La logica corretta esiste già — ma **duplicata e divergente** — in `provision-linux-pc.sh`. Gap concreti:

| Aspetto | `vm-deploy` su linux-pc (rotto) | `provision-linux-pc.sh` (corretto) |
|---|---|---|
| Web build URL | `PUBLIC_HOST` default = `80.225.82.207` (VM) → `NEXT_PUBLIC_API_BASE_URL` inlinea la **VM pubblica**, non `192.168.1.11` → il twin serve un bundle che chiama la VM, non il proprio API/DB locale | builda con `NEXT_PUBLIC_API_BASE_URL=http://192.168.1.11:8013/v1` |
| systemd `User/Group` | installa scheduler units (`scraping/insights/backup/reindex`) con `User=ubuntu` letterale (sed solo su `@@REPO_DIR@@`/`@@NODE_BIN@@`) → **timer falliscono** su linux-pc (user `enzo`) | `sed 's#User=ubuntu#User=enzo#g'` + Group |
| placeholder `@@PUBLIC_HOST@@/@@*_PORT@@` | non sostituiti negli scheduler units | sostituiti |
| sudo | **OK** (non un gap): sudoers `enzo ALL=(postgres) NOPASSWD: ALL` + `(root) NOPASSWD: systemctl,install,apt-get,apt,loginctl` copre `pg_dump`/`install`/`systemctl` | (prerequisito one-time) |

Finché linux-pc è stato deployato **solo** via `provision-linux-pc.sh`, il gap non è mai stato colpito; il close-flow automatico lo colpirebbe alla **prima** esecuzione.

**Fix**: rendere `vm-deploy.sh` **context-aware** assorbendo la logica di provision — accettare `SERVICE_USER`/`SERVICE_GROUP` (default `ubuntu`) e applicare il `sed User=/Group=` a **tutte** le unit installate; sostituire i placeholder `@@PUBLIC_HOST@@/@@API_PORT@@/@@WEB_PORT@@` negli scheduler units (oggi solo `@@REPO_DIR@@`/`@@NODE_BIN@@`); `PUBLIC_HOST` è già parametrizzato. `align-clones` passa per il leg linuxpc `PUBLIC_HOST=192.168.1.11 SERVICE_USER=enzo` (oltre a `REPO_DIR`). Esito: `vm-deploy.sh` diventa l'entrypoint **unico** VM+linux-pc, e `provision-linux-pc.sh` si riduce a (setup-PG locale + clone-db + primo deploy) delegando build/systemd a `vm-deploy` → **elimina la duplicazione divergente** (essa stessa fonte di drift futuro). Da registrare anche in `DEBT_REGISTER.md` come debito risolto in questo intervento.

### 12.5 Correzioni a skill/script previste (al go)

- **`vm-deploy.sh` context-aware** (§12.4) — prerequisito perché il deploy automatico di linux-pc sia corretto.
- **nuovo** `scripts/close-propagate.sh` (orchestratore §12.2) + un suo test in `scripts/test/run-shell-tests.sh` (almeno: parsing flag, resilienza host-off simulato, idempotenza).
- **skill `handoff` → v5**: Step 3.5 lint gate (§5) + Step 4b che invoca `close-propagate.sh` invece di `align-clones` diretto.
- **`align-clones.sh`**: leg linuxpc passa `PUBLIC_HOST/SERVICE_USER` a `vm-deploy` (§12.4); opzionale gancio del clone-DB nel leg linuxpc se si preferisce tenerlo lì invece che nell'orchestratore — da decidere in implementazione (default: nell'orchestratore, così `align-clones` resta a singola responsabilità).
- **guardie trasversali**: ogni passo idempotente, resiliente (skip host off), e non bloccante per il close (un deploy/clone fallito segnala ma non impedisce il commit di stato già pushato).

### 12.6 Documentazione da aggiornare (al go)

- `deploy/README.md` → §"close-flow completo": il close = lint → commit → push → `close-propagate.sh` (con la policy clone-DB scelta). Oggi documenta i tre script separati ma non il flusso unico automatico.
- `CLAUDE.md` → §"Full alignment & deploy doctrine": aggiungere che il close propaga **anche** ecosistema + clone-DB del twin, non solo `align-clones`.
- memoria `feedback_full_alignment_doctrine.md` → addendum: close-flow esteso a ecosistema + clone-DB (oggi l'addendum 2026-06-12 cita solo che l'ecosistema *esiste* come script, non che è parte del close automatico).

### 12.7 Verifica / exit criteria

- Un close di prova (sessione successiva all'implementazione) propaga la skill `v5` su tutti i cloni raggiungibili; `align-claude-ecosystem all --verify` → drift report **CLEAN**.
- Se la policy clone-DB scatta, `clone-vm-db.sh` su linux-pc chiude con row-count **local == VM** sulle tabelle sentinella.
- `/readyz` + `/login` OK su vm e linux-pc dopo il deploy.
- `handoff_lint.py` verde sul repo dei cloni (lo stato propagato è coerente).
- Host off durante il close → skip+warn, il close **non fallisce**.

### 12.8 Rollout (additivo a §10)

7. Scrivere `close-propagate.sh` + test; cablare la skill `v5` Step 4b su di esso.
8. Sciogliere la policy clone-DB (§12.3) con Enzo; parametrizzare l'orchestratore di conseguenza.
9. Aggiornare la documentazione §12.5.
10. Un close di prova end-to-end con verify CLEAN (exit criteria §12.6) → il close-flow completo è stabile e permanente.

---

## 13. Garanzia di idempotenza degli ecosistemi Claude (4 macchine)

Requisito (Enzo): dopo il go, i **4 ecosistemi Claude** — Windows (source-of-truth), mac, vm, linux-pc — devono essere **cloni idempotenti**, identici **salvo path / OS / arch / stato-per-macchina**. Questa sezione fissa il **perimetro** della garanzia, **chiude i buchi** verificati e rende l'idempotenza **misurata, non promessa**.

> **Idempotente** qui = *clone effettivo verso Windows modulo le sole differenze OS/arch/path + lo stato legittimamente per-macchina*. NON byte-identità assoluta (impossibile e non voluta: auth, DB claude-mem, memorie di altri progetti sono per-macchina by-design).

### 13.1 Perimetro (cosa è garantito, cosa diverge per-design)

| Componente | Garanzia | Canale | Note |
|---|---|---|---|
| `CLAUDE.md` globale, `skills/` (incl. `handoff v5`), `commands/`, `statusline-command.sh` | **idempotente** (verbatim, CRLF-stripped) | `align-claude-ecosystem` | — |
| `settings.json` | **idempotente modulo OS** | id. | transform jq deterministico per-host |
| claude-mem settings | **idempotente modulo path** | id. | DB MAI copiato (per-macchina) |
| SDK npm/pip | **idempotente** (pin alla versione Windows al run) | id. | `resolve_sdk_specs` |
| **plugin** | **divergenza VISIBILE** (Opzione C) — non pin automatico | id. + verify-SHA | versioni allineate **manualmente da Enzo** per-macchina (§13.2) |
| **memorie progetto** (`heuresys-advanced/memory`) | **idempotente** | **`align-clones`/`sync-memory-tree`** (canale 2, §13.3) | non viaggia su `align-claude-ecosystem` |
| `agents/hooks/output-styles` user-level | divergente **per-design** | — | wipati sui remoti (clone "puro"); i hook funzionali stanno in `settings.json` |
| auth (`.credentials.json`), `~/.claude.json`, memorie altri progetti, `plans/tasks/history/todos` | divergente **per-design** | — | per-macchina; mai clonati |

### 13.2 Plugin — Opzione C (decisione Enzo: semplicità; update manuale per-macchina)

**Vincolo di piattaforma verificato (2026-06-20)**: il CLI non offre pin di versione (`install`/`update`/`marketplace add` senza flag versione/ref); `installed_plugins.json` registra `version:"unknown"`; il marketplace principale `claude-plugins-official` (13/16 plugin) **non è un checkout git** (gli altri 5-6 sì, con SHA). Il pin stretto automatico è quindi **non disponibile** senza un meccanismo custom costoso (Opzione A, scartata).

**Opzione C adottata**: il sistema **non auto-pinna e non auto-aggiorna** i plugin — rende la divergenza **visibile** e lascia l'update a Enzo, su ciascuna delle 4 macchine, quando il verify la segnala.

- **`verify_host` esteso**: oltre alla presenza (`plugin_ok=$base`, oggi unico check), confronta lo **SHA HEAD dei marketplace git** del remoto vs Windows (`git -C ~/.claude/plugins/marketplaces/<name> rev-parse HEAD`) → riga `marketplace_sha <name>: win=<sha> remote=<sha> OK|DRIFT` nel drift report.
- `claude-plugins-official` (non-git): marcato esplicitamente `official=non-git (versione non verificabile via SHA — update manuale)` — **non** un fail, ma una nota visibile, così il limite è dichiarato e non silenzioso (no silent cap).
- Un `marketplace_sha … DRIFT` **non blocca** il close (è gestione di Enzo), ma compare nel report e nel sommario del close → Enzo decide se/quando `claude plugin marketplace update` + restart sulla macchina che diverge.

### 13.3 Due canali al close — non-bypassabili (decisione Enzo)

L'idempotenza completa richiede **entrambi** i canali, e il secondo (memorie progetto) **non può essere saltato** — altrimenti "ecosistema idempotente" resta parziale:

1. **`align-clones.sh all`** → repo + payload gitignored lean + `.env` key-merge + **memorie progetto** (`sync-memory-tree`) + deploy.
2. **`align-claude-ecosystem.sh all`** → catalogo portabile + SDK + plugin (verify-SHA).

`close-propagate.sh` (§12.2) esegue **tutti e due**, in quest'ordine, su **tutte** le macchine in scope. Enforcement:
- host **raggiungibile** con un canale **fallito** → `close-propagate.sh` esce **fail-loud** (il close segnala l'errore; non è un best-effort silenzioso). Mai saltare un canale su un host vivo.
- host **irraggiungibile** → skip+warn (resilienza), il close non fallisce; catch-up manuale alla prossima raggiungibilità.
- **verify memorie progetto**: il verify confronta il manifest del tree `.../memory` remoto vs Windows (conteggio + presenza file) → riga `project_memory: win=<n> remote=<n> OK|DRIFT` nel report.

### 13.4 Mac dentro lo scope (decisione Enzo)

La garanzia + il `--verify` si applicano a **tutte e 4** le macchine. `align-clones all` e `align-claude-ecosystem all` includono già `mac-local` (oltre a vm + linuxpc). Resilienza: il Mac (datato, LAN, può essere off) → skip+warn se irraggiungibile, ma **in scope pieno** per il verify quando raggiungibile. Nessuna macchina è esclusa dalla definizione di "ecosistema idempotente".

### 13.5 Idempotenza misurata, non promessa

L'idempotenza **non si assume**: si verifica. **Exit-criterion bloccante** del close-flow stabilizzato:

```
align-claude-ecosystem.sh all --verify   # drift report per-macchina sotto deploy/reports/claude-align/
```

→ verdetto **CLEAN** su ogni macchina raggiungibile, con la sola eccezione **dichiarata** dei `marketplace_sha DRIFT` plugin (gestione manuale Enzo, §13.2) che è informativo, non bloccante. Un DRIFT su catalogo/settings/SDK/memorie-progetto **è** bloccante.

### 13.6 Correzioni a script previste (al go)

- **`align-claude-ecosystem.sh` `verify_host`**: aggiungere il confronto `marketplace_sha` (git HEAD remoto vs Windows) + la nota `official=non-git` + il check `project_memory` (manifest tree). Oggi il verify è cieco sulla versione plugin e non guarda le memorie progetto.
- **`close-propagate.sh`** (§12.2): orchestrare i **due** canali con fail-loud su host raggiungibile; raccogliere i drift report; esporre nel sommario del close i `marketplace_sha DRIFT` come avvisi-per-Enzo.
- **documentazione**: `deploy/README.md` §"idempotenza ecosistemi" (perimetro §13.1 + procedura update plugin manuale §13.2) + addendum memoria `reference_claude_ecosystem_alignment.md`.

### 13.7 Verifica / exit criteria

- `align-claude-ecosystem all --verify` → **CLEAN** su mac + vm + linux-pc (escluso solo l'avviso `marketplace_sha DRIFT` plugin).
- Catalogo (CLAUDE.md global, skills incl. `handoff v5`, commands, settings, statusline) + SDK: **identici** modulo OS/path su tutte e 4.
- `project_memory` remoto == Windows su tutte le macchine raggiungibili.
- Un canale fallito su host vivo → il close **fallisce** (fail-loud provato simulando un errore).
- I `marketplace_sha DRIFT` eventuali sono **elencati** nel sommario del close (visibili, mai silenziosi) per l'update manuale di Enzo.

---

## 14. Implementation status (S1000-S1001, 2026-06-20/21)

| Area | Stato | Note |
|---|---|---|
| §3 vocabolario + HOLD lane | ✅ DONE | CLAUDE.md (Source of Truth + Session start render) + HOLD register (5 HOLD / 2 WAIT-INPUT, metadati completi) |
| §4 handoff-lint | ✅ DONE | **10/10 check** (D1-D4 · S1-S2 · H1-H2 · A1-A2), **blocking by default** (exit 1 su FAIL), `--warn-only` soft, `--no-db` skip. H2 esteso al backlog (section/block/terminal-aware, basso falso-positivo) |
| §5 skill v5.1 | ✅ DONE | Step 3e gate bloccante + Step 4 rebase-safe (P5) + Step 4b `close-propagate.sh` |
| §7 migrazione rinvii | ✅ DONE | rinvii attivi → HOLD register; 0 orfani attivi (archivio storico escluso per scope) |
| §11 P1-P9 | ✅ **DONE (tutti)** | P1 register canonico (store strutturato item) · P2 `build_menu.py` (menu generato) · P3 trigger valutabili `{kind: query\|file-exists\|manual}` · P4 `session-journal.ndjson` (boot-rotate / close-consolidate / `journal-append.sh`) · P5 rebase-safe push · P6 `state-lint.yml` CI · P7 boot reality-check · P8 INTERRUPTED · P9 age-in-sessions + stale-count TTL |
| §12 close-propagate + vm-deploy | ✅ DONE | orchestratore dual-channel + clone-db Opzione B + fail-loud + `--dry-run`; `vm-deploy.sh` rende **TUTTE** le unit (api/web + scheduler) con `SERVICE_USER` → entrypoint unico VM+linux-pc; test §12.5 in `run-shell-tests.sh` |
| §13 ecosystem verify | ✅ DONE | marketplace-SHA (Opzione C, informativo) + `project_memory` parity (**bloccante**) + mac/vm/linuxpc in scope |
| docs/rollout | ✅ DONE | questo status-flip + CLAUDE.md doctrine + memoria addendum + D-39 RISOLTO |

**Deviazioni deliberate (non difetti)**:
- **D4 = WARN non FAIL**: lo sha citato dal SOT diverge legittimamente da HEAD finché il handoff non committa (il lint gira pre-commit) → un FAIL darebbe falso positivo a ogni run.
- **H2/S2 scope**: il "no orphan defer" enforce le **sezioni attive** del backlog (P0-P4, Candidati, Integrazione) + le priorità di STATE; i ~130KB di archivio (`✅`/`🟢 Aggiornamento SXXX`/`🔭`/`Verifica stato`) sono esclusi by-design (record di sessione, non rinvii vivi). S2 valida il vocabolario sul register taggato.
- **--no-db**: non ci sono check psql pesanti (i count DB restano ri-derivati dal handoff Step 3b); `--no-db` salta i check repo-derivati tunnel-dipendenti e li marca `SKIPPED`.

**Verifica live (S1001)**: lint 10/10 + i 5 exit-criteria §8 (D3/H1/H2/A1/A2 inject→FAIL→restore, git pulito); shell-suite **53/53**; `bash -n` su tutti gli script. **Resta da dimostrare al PRIMO close reale** (§12.7/§13.7): `align-claude-ecosystem all --verify` → CLEAN sui remoti raggiungibili — è il close-flow E2E live, eseguibile solo a fine di una sessione con propagazione.

---

*Design prodotto in sessione di sola analisi (read-only) S999, 2026-06-20; **implementato S1000-S1001 (2026-06-20/21) — vedi §14**. Estende `2026-06-05-sot-unification-design.md` (SoT v2 §11-12). §11 (potenziamenti P1-P9) + §12 (stabilizzazione del close-flow completo) + §13 (idempotenza ecosistemi Claude, 4 macchine — Opzione C plugin) aggiunte su richiesta Enzo.*
