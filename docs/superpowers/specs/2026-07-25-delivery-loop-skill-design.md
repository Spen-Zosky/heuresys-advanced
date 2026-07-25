# Design — skill `delivery-loop` (ciclo di vita del work-item: build · ship · triage)

> ⚠️ **SUPERSEDED 2026-07-25** da `2026-07-25-zero-pending-loop-design.md`. Questa bozza descriveva solo il *motore* (una iterazione), senza il loop, il driver esterno e la condizione di terminazione. Conservata per la matrice di copertura §1 e la gate matrix §3, riusate nel design successivo. **Non implementare da questo documento.**

**Data**: 2026-07-25 · **Stato**: SUPERSEDED — non approvato
**Provenienza**: sessione Cowork 2026-07-25. Inventario reale: 36 script in `scripts/`, 13 tool in `docs/kb/tools/`, 18 skill installate (14 user-level + 4 project-level). Letti integralmente: `~/.claude/CLAUDE.md` (regole 1-23, il global iniettato in Cowork era la snapshot v3 R1-R17), `CLAUDE.md` di progetto, `~/.claude/skills/handoff/SKILL.md`, `specs/2026-07-06-project-atlas-skill-design.md`, e il «Protocollo di chiusura di un cluster» in `specs/2026-07-25-zero-pending-plan.md`.

## 0. Decisioni prese in autonomia (CLASSE A, tutte reversibili)

| # | Decisione | Evidenza che la rende univoca | Come si annulla |
|---|---|---|---|
| D1 | **Delego** release e session-lifecycle invece di riassorbirli | `handoff` è dichiarato unico writer di `SOT_STATE`/`SOT_BACKLOG`/`DEBT_REGISTER`; `CLAUDE.md` §Source of Truth impone «single per domain — do not duplicate». Assorbirli creerebbe due writer sullo stesso file | §2: i modi `ship`/`status` chiamano gli script esistenti. Riassorbire = riscrivere quei due riferimenti, e ritirare `handoff` Step 4b |
| D2 | Nome **`delivery-loop`** | Nessuna collisione con i trigger delle 18 skill installate; resta valido oltre il piano zero-pendenze (a differenza di `cluster-close`); non intercetta frasi generiche (a differenza di `ship-it`) | Rinomina cartella + campo `name` + `eval/triggers.yaml` |
| D3 | **Nessun commit** da questa sessione Cowork | Verificato: 5 file staged non committati su `main` @ `3596be42` (`.handoff/STATE.md`, `docs/kb/SOT_STATE.md`, `INDEX_PATHS.md`, `index_paths.yaml`, `zero-pending-plan.md`) → sessione CLI in volo. Un commit da qui li inghiottirebbe. Inoltre le preferences Cowork impongono READ-ONLY sulla SoT di stato | Enzo autorizza il commit dopo aver chiuso la sessione CLI |

## 1. Scopo e perimetro

Skill richiamabile che possiede il **ciclo di vita di un work-item**, dal register al PROD verificato. Codifica in procedura eseguibile e misurabile ciò che oggi vive come prosa in due documenti diversi: il **pattern 7-step** di `CLAUDE.md` e il **«Protocollo di chiusura di un cluster»** del piano zero-pendenze (248 cluster, ~1.370h, ondate W0-W6).

**Il gap è verificato, non presunto**: `specs/2026-07-06-project-atlas-skill-design.md` §1 dichiara letteralmente fuori perimetro «il BUILD degli item (resta governato da CLAUDE.md pattern 7-step + DoD ADR-0026); la chiusura sessione (dominio esclusivo della skill `handoff`)». Nessuna skill copre oggi il BUILD. Nessuna skill copre il triage di incidente/regressione. La release multi-host esiste solo come Step 4b di `handoff`, cioè **solo a chiusura sessione**.

**Fuori perimetro** (frontiere negative, §7): chiusura sessione e riscrittura SoT (`handoff`) · costruzione conoscenza/atlas (`project-atlas`) · audit forense e QA E2E (`web-qa-audit`, `forensic-100x-kickoff`) · due diligence investor (`saas-investor-due-diligence`) · topologia grafo (`graphify`) · consolidamento pagina nel grafo RBP (`consolida-pagina`).

## 2. Architettura (skill unica a dispatcher — coerente con `project-atlas`)

Collocazione: **`.claude/skills/delivery-loop/`** nel repo (viaggia con git + `align-clones`; promozione a plugin `heuresys-plugins` solo se servirà multi-progetto).

```
.claude/skills/delivery-loop/
├── SKILL.md                    # dispatcher + contratto (<150 righe, progressive disclosure)
├── references/
│   ├── delivery.config.yaml    # MANIFEST: path SoT, gate matrix per area, host target,
│   │                           #   soglie, sezione `adaptive:` (override auto-appresi, azzerabile)
│   ├── track-build.md          # i 5 step del protocollo cluster + pattern 7-step + ondate W0-W6
│   ├── track-ship.md           # pre-flight → deploy → verifica live → decisione rollback
│   ├── track-triage.md         # riproduci → isola → diagnosi → fix → 2 verifiche → postmortem
│   ├── gates.md                # catalogo gate + regola di derivazione dallo scope (§3)
│   ├── dod-contract.md         # ADR-0026: template evidenza LIVE (comando+output+path+timestamp)
│   ├── adversarial.md          # prompt dei verificatori istruiti a demolire (§4)
│   ├── model-map.md            # matrice modello×effort per tipo agente (§5)
│   ├── goal-recipes.md         # condizioni /goal misurabili per i modi lunghi (§6)
│   └── LEARNINGS.md            # auto-aggiornato: Lezioni (prosa) + run-record YAML (§6)
└── eval/
    ├── triggers.yaml           # 14 frasi positive + 8 esche negative (§8.5)
    ├── scenarios.md            # 4 scenari E2E con criterio osservabile
    └── run_eval.py             # esegue triggers + riporta precision/recall
```

Tool deterministici in **`docs/kb/tools/`** (convenzione repo, non dentro la skill): `delivery_preflight.py`, `delivery_gate.py`, `delivery_evidence.py`.
Tool riusati: `session_start.py`, `status_dashboard.py`, `handoff_lint.py`, `build_menu.py`, `journal-append.sh`.
Script riusati: `ci-gate.sh`, `close-propagate.sh`, `align-clones.sh`, `vm-deploy.sh`, `vm-rollback.sh`, `pull-prod-backups.sh`.

### Modi del dispatcher (routing deterministico)

| Modo | Trigger | Comportamento | Costo |
|---|---|---|---|
| **status** (default a invocazione nuda) | `/delivery-loop` | pre-flight reale (tunnel, DB, branch/dirty/unpushed, CI, PROD) + quale item/cluster è in volo + ondata corrente + gate mancanti. Non ricostruisce il menu: rimanda a `session_start.py` | ~zero |
| **build** | «lavora Z-NNN», «chiudi il cluster», «prossima ondata», «implementa il modulo X» | i 5 step del protocollo, con le **2 verifiche di natura diversa** come contratto rifiutabile e la review adversarial obbligatoria. Chiude con commit atomico proposto + blocco evidenza DoD | proporzionale all'item |
| **ship** | «porta in prod», «allinea i cloni», «deploy», «rollback» | pre-flight → `close-propagate.sh`/`align-clones.sh --deploy` → verifica live (`/api/readyz` + `/login` + smoke DB) → **decisione rollback quantificata** (non «forse conviene») | medio |
| **triage** | «CI rosso», «regressione», «PROD giù», «questo si è rotto» | loop diagnostico con anti-bias R14 (evidenza contraria obbligatoria dopo la prima ipotesi) e stop-condition a 2 tentativi falliti nella stessa direzione. Postmortem **proposto** come blocco DEBT, non scritto | basso-medio |
| — | «chiudi sessione», «handoff» | **non gestito** — frontiera negativa letterale | — |

## 3. Gate matrix derivata a runtime (anti-drift — correttivo obbligatorio)

I gate **non sono hardcoded nella skill**. A ogni run si derivano dallo scope reale toccato (`git diff --name-only` + `git status --short`):

| Area toccata | Gate obbligatori |
|---|---|
| `apps/api/**` | `pnpm typecheck` · `pnpm lint` · vitest sui file toccati **e** sui moduli dipendenti · integration su DB reale via tunnel :5433 |
| `apps/web/**` | `typecheck` · `lint` · `pnpm i18n:check` · Playwright sulle spec pertinenti (`test:e2e:prod:node22` se Node ≥23 — D-36) |
| `packages/shared/**` | `typecheck` a monte + rebuild dei consumer (`api`, `web`, `showcase`) |
| `db/migrations/**` | `db:migrate` idempotente **due volte** con diff `pg_dump` vuoto + `db:validate` (7 viste) |
| `scripts/**`, `deploy/**` | lint shell + dry-run del percorso modificato |
| `docs/kb/**` | `handoff_lint.py` (10 check bloccanti) |

**Check fail-loud**: se il diff tocca un'area **senza** gate mappato in `delivery.config.yaml` → errore bloccante con richiesta di mappatura. Mai skip silenzioso. Mai «lancia tutta la suite» come scorciatoia: costa e nasconde quali gate contano davvero.

## 4. Orchestrazione: agenti, tool, skill collegate

- **Review adversarial** solo via **Workflow tool** (pipeline/parallel, cap concorrenza, structured output) — mai `Agent` sciolti. Tre verificatori su **lenti distinte** (correttezza · sicurezza/multi-tenant · riproducibilità), come nel censimento S1029: il rilievo cade se ≥2 lo refutano. Prompt istruito a **demolire**, non a confermare.
- **Le due verifiche di natura diversa sono un contratto meccanico**: `delivery_gate.py` rifiuta due esecuzioni dello stesso tipo (es. vitest+vitest) e pretende una coppia eterogenea — test automatico **+** prova live con evidenza, oppure integration su DB reale **+** unit sul ramo che l'integrazione non raggiunge.
- **Evidenza DoD (ADR-0026)**: nessuno step si chiude su mock/placeholder/green-test. `delivery_evidence.py` produce il blocco canonico (comando + output + path assoluto + timestamp, R5). Se manca un input che solo Enzo può dare → stato `blocked-on-Enzo: <cosa, perché>`, mai «done».
- **DB/SSH**: psql via tunnel :5433; SSH remoto con `MSYS_NO_PATHCONV=1` + nvm (riferimento a `memory/reference_remote_ssh_deploy_ops`, **non ricopiato**).
- **Skill collegate**: rispetta `handoff` come unico writer di stato — i modi `build`/`triage` **preparano e lint-validano** blocchi Action register/DEBT, non li committano. Durante la sessione appendono fatti con `bash scripts/journal-append.sh` (il journal è consumato dal close). Nessun nuovo file di stato (regola `CLAUDE.md` «never spawn a new state file»).
- **Da NON usare**: Windows-MCP/chrome-tools per file ops in CLI (i tool nativi bastano); `--no-verify`; `git push` senza autorizzazione di sessione.

## 5. Model-map (token-optimization con qualità garantita)

| Attività | Modello | Effort | Razionale |
|---|---|---|---|
| Pre-flight, inventari, probe, letture liste | haiku | low | estrazione senza giudizio |
| Implementazione su pattern ripetuto (modulo 7-step) | sonnet | medium | il pattern è noto, il rischio è basso |
| Verifica/diagnosi su DB reale, SQL, SSH | sonnet | medium | precisione, zero allucinazioni |
| Review adversarial + decisione rollback + sintesi triage | modello di sessione (opus/fable) | high | il giudizio non si delega in giù |
| Modo `status` | main loop, zero subagenti | — | è un pre-flight, non un'indagine |

Fallback dichiarato: in dubbio → eredita il modello di sessione. **Mai downgrade silenzioso su task di giudizio.**

## 6. Self-learning, `/goal`, degradazione

- Fine invocazione `build`/`ship`/`triage` → append a `LEARNINGS.md` di un **run-record YAML**: data, modo, item, gate eseguiti, agenti, token stimati, esito, gotcha, durata. Sezione **Lezioni** in prosa sopra i record.
- Il run successivo legge le metriche e adatta: quali gate hanno storicamente trovato regressioni (priorità), quale modello per famiglia di item, soglia di stop-condition del triage.
- **Guard-rail**: ogni adattamento (a) registrato con il perché, (b) reversibile azzerando `adaptive:` in `delivery.config.yaml`, (c) **prompt e template mai auto-modificati** — cambiano solo per mano umana o proposta esplicita a Enzo (R15).
- **`/goal`** (built-in Claude Code ≥2.1.139): `goal-recipes.md` fornisce la riga pronta —
  - `build`: `gate matrix verde ∧ 2 verifiche di tipo diverso registrate ∧ 0 rilievi adversarial aperti ∧ blocco evidenza DoD presente`;
  - `ship`: `readyz 200 ∧ /login 200 su entrambi gli host ∧ migrations count locale = remoto ∧ 0 servizi systemd failed`.
- **Degradazione**: tunnel giù → output marcato `[non verificato: DB]`, mai numeri stale spacciati per freschi. Spend-limit a metà → salvataggio parziale + item `INTERRUPTED` nel register con `resume-from`. Gate rosso → **si corregge** (R3), non si bypassa.

## 7. Description e frontiere (anti mis-trigger — 18 skill installate)

Trigger positivi: «lavora Z-NNN» · «chiudi il cluster» · «prossima ondata» · «implementa il modulo» · «porta in prod» · «allinea i cloni» · «deploy» · «rollback» · «CI rosso» · «regressione» · «PROD giù» · `/delivery-loop`.
Frontiere negative **letterali** nella description: NON per chiusura sessione o riscrittura SoT (→ `handoff`) · NON per costruire/aggiornare la conoscenza del progetto (→ `project-atlas`) · NON per audit forense o QA E2E esaustivo (→ `web-qa-audit`, `forensic-100x-kickoff`) · NON per due diligence investor (→ `saas-investor-due-diligence`) · NON per topologia/BFS del grafo (→ `graphify`) · NON per il grafo Ruoli-Dashboard-Pagine (→ `consolida-pagina`).

Vincoli ereditati **per riferimento, mai ricopiati**: R3 (correggere ogni errore) · R5 (test-before-claim) · R12 (git safety) · R14 (anti-bias) · R20 (feasibility 5 criteri) · R23 (autonomia) · DoD live E2E ADR-0026 · OUTPUT RULE S1011 · invarianti I1-I20 · single-writer del register.

## 8. Piano di test (accettazione della skill)

1. Invocazione nuda → `status` con pre-flight reale, confrontato a campione con `status_dashboard.py --net`.
2. `build` su un cluster W1 già chiuso, in dry-run → la gate matrix derivata coincide con quella eseguita a mano in S1029.
3. `build` con due verifiche dello **stesso** tipo → `delivery_gate.py` **rifiuta** (il contratto §4 è meccanico, non esortativo).
4. `ship` su linux-pc con un host artificialmente spento → skip+warn sull'host giù, fail-loud sul canale fallito di un host raggiungibile.
5. `triage` su un CI rosso reale dal log → converge in ≤2 ipotesi, con evidenza contraria cercata e registrata.
6. **Frontiere**: 8 esche («chiudi la sessione», «aggiorna l'atlas», «trova i bug», «fai la due diligence», «consolida la pagina», «mappa il grafo», «quanto vale il progetto», «genera il menu») **non** attivano la skill.
7. `LEARNINGS`: dopo i test esiste ≥1 run-record completo e un adattamento simulato è reversibile azzerando `adaptive:`.

## 9. Effort e rischi

**Effort**: ~9h in 4 tranche — T0 questo design (~1h, fatto) · T1 `SKILL.md` + `references/` + config (~3h) · T2 i tre `delivery_*.py` (~3h) · T3 eval + accettazione §8 (~2h). **Regression risk: basso** — nessun runtime di prodotto toccato, i gate sono read-only finché non si committa.

| Rischio | Probabilità | Impatto | Mitigazione |
|---|---|---|---|
| Mis-trigger con le 18 skill installate | media | medio | frontiere negative letterali §7 + 8 esche nell'eval (§8.6) |
| Sovrapposizione con `handoff` (doppio writer di stato) | bassa | alto | D1: la skill prepara e valida, non committa lo stato |
| Gate matrix che si disallinea dal repo | media | medio | derivazione a runtime §3 + fail-loud sull'area non mappata |
| Skill che diventa un secondo `CLAUDE.md` (duplicazione di regole) | media | medio | vincoli ereditati per riferimento, mai ricopiati (§7) |
| Costo del modo `build` su cluster grandi | media | basso | model-map §5 + `/goal` come contratto di uscita + stima in forma R20 prima di partire |
