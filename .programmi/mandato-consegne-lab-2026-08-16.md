# Mandato — eseguire le 7 consegne del design-lab del 2026-08-16

**Aperto**: sessione canonica S1066, 2026-08-16 sera.
**Origine**: `D:\heuresys-design-lab\inbox\` (7 consegne) + i due documenti di orientamento
`2026-08-16--LEGGIMI-PRIMA-consegna-tenant-builder-p3.md` e
`2026-08-16--piano-coda-p3-e-tenant-builder-p4.md`.

**Regola che vale su tutto** (`#149`, ACTIVE continuativa): niente di ciò che il lab ha consegnato è
verificato. Per ogni affermazione portante: *«cosa la renderebbe falsa?»* → controllo **quella** cosa.
Ciò che non regge si corregge, e si **annota nel file di consegna** cosa è stato rifiutato.
I numeri delle consegne erano veri il 2026-08-16: si **ri-misurano** (⭐ PUNTO FISSO).

---

## Confine di sessione, dichiarato all'inizio (R24 §4)

Le Fasi **1-5** sono completabili in questa sessione. La Fase **6** (`#198`, 9 task) è dichiarata dal
lab stesso come **~2 sessioni**: **non si chiude qui**. La Fase **7** entra solo per il task **T5**,
che è indipendente. La Fase **8** è **lettura e verifica soltanto** — l'implementazione è bloccata da
`#132`, che non è fatta.

Chiusura anticipata obbligatoria: contesto ≥ 75% **oppure** finestra 5h ≥ 80% (`guardiano.py`).

---

## Tabella del piano

| id | Cosa | Chi | Cosa significa fatto | Stato |
|---|---|---|---|---|
| **F1** | Ingerire le 7 consegne nel register | io | `--ingest` + `handoff_lint.py` verde **+ register letto a occhio** (nessun doppione) + commit | ✅ FATTA `b7f04661` — 7 blocchi #202-#208, nessun doppione, lint verde |
| **F2.1** | `guardiano.py`: muore sulla riga del verdetto se stdout non è un terminale | io | `--sorveglia > out.txt` scrive il verdetto ed esce **0 o 3**, mai 1. Anche la copia `~/.claude/tools/` | ✅ FATTA `7911dde8` — difetto riprodotto (exit 1 su `✓`), poi verdetto scritto ed exit 0, selftest 32/32, 2 copie allineate |
| **F2.2** | `lab_inbox.py`: `str.replace` non dice se ha sostituito → doppioni silenziosi | io | patch (canale + encoding) applicata alle **due** copie; `collaudo_canale.py` 13/13 | ✅ FATTA `7911dde8` — patch applicata **con una correzione mia**: `classifica()` guardava il corpo, non l'intestazione → creava ancora doppioni. Collaudo 14/14 (e C5b, rotto da prima, riparato) |
| **F2.3** | `check_no_legacy_ingest.py` è **rosso** per `check_istruzioni.py` (falso positivo) | io | letto il file io stesso, allowlist col motivo; cancello **0** e `--selftest` **9/9** | ✅ FATTA `7911dde8` — falso positivo verificato leggendo il file, cancello 0, selftest 9/9 |
| **F3** | I 7 residui dentro `#196` e `#198` | io | i due blocchi riscritti sostituiti **per titolo**; lint verde; nessun `chiuso-quando` doppio | ✅ FATTA `82d80582` — #196 riscritta (14 campi, uno ciascuno), #198 riga corretta, + i due agganci di #208 |
| **F4** | `#199` — guardia mancante su `link-tenant` | io | test **che oggi passa** diventa rosso senza guardia e verde con; `BLUEPRINT_LINK_IS_PERMANENT` | ✅ FATTA `e9cbc332` — test rosso prima e verde dopo, dimostrazione LIVE sul fascicolo di RTL Bank |
| **F5** | `#196` — censire viste/conteggi/schermate che sommano le due specie di indicatori | io | elenco misurato sul DB e sul codice, non dedotto | ✅ FATTA `af44401a` — censimento su 3 livelli + **difetto trovato**: `z.coerce.boolean()` rendeva il filtro una bugia. E2E 101/101 |
| **F6** | `#198` — Tenant Builder P3, 9 task | io | **non completabile in questa sessione**: si avanza fin dove il guardiano consente, `resume-from` scritto | ⏸ **NON COMPLETABILE** in questa sessione (il lab stesso la dà a ~2 sessioni) — vedi sotto |
| **F7** | P4 task **T5** — vista `v_positions_with_critical_skill_gap` | io | numeri **ri-misurati** oggi; zero righe o 97 righe = vista ROTTA | ✅ FATTA `dcec8120` — solo T5, come previsto. Oracolo ri-misurato e riprodotto (97·299·70·60·2) + 64 cieche |
| **F8** | 2b/2c — leggere, verificare avversarialmente, lasciare `ACTIVE` con dipendenza `#132` dichiarata | io | annotazione nel file di consegna; nessuna riga di implementazione | ✅ FATTA `81b5fa19` — verificata, **un rilievo respinto**: il documento dice che P2a è costruita, ma `#132` è ACTIVE |

---

## Simulazione a 5 domande — le voci che la richiedono

### F1 — ingestione

- **Precondizioni**: 7 consegne in `inbox/`, tutte col segnaposto `#NN` (**da ri-misurare**: se una
  porta un numero vero, l'ingestione crea un doppione — è il difetto di F2.2, ancora non corretto al
  momento di F1).
- **Meccanismo**: `lab_inbox.py --ingest` appende blocchi in coda all'Action register di
  `SOT_BACKLOG.md`. **Ho letto il codice?** → da fare prima di lanciarlo.
- **Propagazione**: il register è versionato; commit + push.
- **Chi**: io.
- **Guardia**: `handoff_lint.py` (10 controlli, `S4` intercetta gli id duplicati) **più** rilettura del
  register: gli errori della fusione passano tutti il lint.

### F2.2 — patch al canale

- **Precondizioni**: `lab_inbox.py` in **due** copie (`docs/kb/tools/`, `D:\heuresys-design-lab\tools\`),
  dichiarate identiche il 2026-08-12 — **da ri-misurare con un hash**.
- **Meccanismo**: sostituzione integrale col file di `artefatti/patch-canale-fusione/`. Non è la copia
  di `patch-encoding-stdout/` (contiene una sola delle due correzioni).
- **Propagazione**: la copia del lab è **fuori dal repo** → non la porta né git né `align-clones`.
- **Chi**: io.
- **Guardia**: `collaudo_canale.py` ha il controllo `C1` apposta per le due copie divergenti; se resta
  verde con una sola copia aggiornata, è `C1` a essere rotto.

### F4 — la guardia su `link-tenant`

- **Precondizioni**: `repository.ts:229-242` fa ancora l'`UPDATE` senza condizione — **da rileggere**.
- **Meccanismo**: l'idioma del modulo (`approvals/effects/tenant-activation.ts:25-33`), non
  un'invenzione.
- **Propagazione**: codice API → build → deploy. **Nessuna migrazione**: non tocca `db/**`.
- **Chi**: io.
- **Guardia**: il test si scrive sul caso che **oggi passa**. Se al primo colpo è verde senza la
  guardia, è il test a essere sbagliato.

### F6/F7 — tutto ciò che tocca `db/**`

- **Precondizioni**: ⚠ `verify_gate` **applica** le migrazioni alla produzione (`migrate-idempotent`
  non è read-only). Una migrazione committata e non deployata entra in prod **senza il suo codice**.
- **Meccanismo**: `ssh linux-pc 'cd ~/heuresys-advanced && bash db/scripts/ci-rehearsal.sh'` (~26 s)
  **prima** del push.
- **Propagazione**: la catena si ri-applica per intero a ogni deploy → **ritirare non è cancellare**
  (ADR-0035): si emenda il file che crea l'oggetto.
- **Chi**: io.
- **Guardia**: post-condizione che protegge ciò che **non** doveva cambiare, non solo ciò che doveva.

---

## Registro delle scoperte fuori ciclo (R24 §5 — si presentano una volta sola)

| Scoperta | Misura | Presentata |
|---|---|---|
| **`z.coerce.boolean()` rende ogni filtro booleano di querystring una bugia**: `Boolean("false")` è `true`, quindi `?isGlobal=false` filtrava i globali — l'esatto contrario. **21 occorrenze in 19 file** di `packages/shared/src/schemas/`. Corretta **solo** `kpi-definitions` (serviva a `#196`); le altre 20 no | provata in isolamento: `"false"→true`, `"0"→true`, `""→false` · trovata dalla prova live di `#196`, che si sentiva rispondere «199 indicatori dell'azienda» su 199 tutte di piattaforma | **da presentare a Enzo** |
| **Le due specie convivono GIÀ, e non negli indicatori**: `learning_modules` ha 92 righe = 77 di piattaforma + **15 dell'azienda**, e `learning/page.tsx` mostra un conteggio unico esattamente come faceva `/kpis`. `career_paths` (7) e `learning_paths` (72) sono **tutte** di azienda. La premessa di `#196` («dalla prima costruzione saranno due specie») è vera per gli indicatori e **già superata** altrove | misurata sul database, 2026-08-16 sera | **da presentare a Enzo** |
