# Design — `zero-pending-loop`: motore + driver per portare heuresys-advanced a zero pendenze in autonomia non presidiata

**Data**: 2026-07-25 · **Stato**: BOZZA — in attesa di approvazione Enzo
**Revisione 2026-07-26**: l'impianto è stato costruito, sottoposto a due review ostili e **frenato** (`meta.autorizzato_non_presidiato: false`: versionato e ispezionabile, ma non parte). La review ha invalidato alcune righe di questo documento, corrette qui sotto e segnate `[rivisto 2026-07-26]`: la regola sulle coppie di prove (era per tipo di strumento, ora per livello del sistema), la classificazione per raggio d'impatto (era dedotta dalla descrizione del cluster, ora ha un pavimento imposto dal criterio di chiusura), il deploy di produzione nel rito di chiusura (non era filtrato da niente), e `--max-turns`, che a differenza di quanto V4 dichiarava **non esiste**. I conteggi di cluster e ore restano quelli misurati il 2026-07-25: sono premesse datate, non lo stato corrente — quello lo stampa `python docs/kb/tools/zp_state.py piano`. Referto completo: `.claude/skills/zero-pending-loop/README.md` §9.
**Supersede**: `2026-07-25-delivery-loop-skill-design.md` (bozza mai approvata: descriveva solo il motore, senza il loop) · e l'**autopilot v2 rinviato** della skill `ralph-build-loop` (che dichiara «l'autonomia overnight è rinviata a v2») **limitatamente a questo progetto** — CW2 è congelato per heuresys-advanced dal 2026-05-27.
**Obiettivo di Enzo (verbatim)**: portare il progetto a una fresh session senza pendenze — zero debiti, zero task incompleti, zero pending, zero errori aperti — con censimento come primo passo, poi esecuzione decidendo ogni cosa tecnica, doppia verifica e review adversarial per ogni task, in autonomia non presidiata.

## 0. Vincoli verificati che determinano l'architettura

Nessuna riga di questa tabella è un'assunzione: ognuna è stata verificata in questa sessione.

| # | Fatto verificato | Conseguenza di design |
|---|---|---|
| V1 | `/clear` è un comando built-in **non invocabile da una skill**. Non esiste reset di contesto dentro un'invocazione. Non esiste hook `PreCompact`. `--continue`/`--resume` ricaricano il contesto **pieno**. Nessun autopilot nativo multi-sessione | **Il loop non può stare nella skill.** Vive in un driver esterno; ogni `claude -p` è il `/clear` del punto 7.b, per costruzione |
| V2 | `/goal` esiste: valutatore esterno dopo ogni turno su condizione misurabile (≤4.000 char), auto-continua finché falsa, clausola `or stop after N turns`. Invocabile in `-p` mode | **Contratto di uscita di ogni iterazione**, non del loop intero (un goal raggiunto non si riarma) |
| V3 | Hook disponibili: `SessionStart`, `SessionEnd`, `Stop` (script- e prompt-based). Nessun hook su contesto esaurito | Checkpoint e guardie sui bordi dell'iterazione, non a metà |
| V4 | ~~`--permission-mode`, `--allowedTools`, `--max-turns` esistono~~ **[rivisto 2026-07-26]**: `--max-turns` **non esiste** su `claude` 2.1.220 — verificato con `claude --help`. L'unico tetto quantitativo per invocazione è `--max-budget-usd`; il limite ai turni si ottiene dalla clausola `or stop after N turns` dentro `/goal`, che è prompt e non flag | Il driver tratta l'assenza di `.zp/last-outcome.json` — non l'exit code — come «iterazione troncata». Se qualcuno reintroduce `--max-turns` come flag, il comando muore all'avvio |
| V5 | Il censimento **è già stato eseguito** (S1029): 497 voci grezze da 10 finder → 248 cluster alla data, 3 verificatori adversarial, esito 497 mappati / 0 persi / 0 inventati. Ondate W0-W6, `done when` osservabile. Il totale è cresciuto dopo quel giorno: si conta, non si cita | Il punto 3 diventa **verify + refresh delle sole fonti stale**. Censimento full solo se il piano è assente o oltre soglia, e dietro stima di costo in forma R20 |
| V6 | Ripartizione **misurata il 2026-07-25**: 218 cluster autonomi (~924h) · 30 bloccati su Enzo (~446h): decisione-business, esterno, segreto (app-password Outlook, client secret IdP). Numeri datati: la ripartizione corrente la stampa `zp_state.py piano` | «Zero pendenze» non è raggiungibile in autonomia — e questa conseguenza **non dipende dai numeri**: vale finché esiste un solo cluster che aspetta Enzo. Condizione primaria riformulata (§1) |
| V7 | Invariante **I15 / ADR-0026**: esiste **un solo ambiente ed è produzione**. Rete di sicurezza esistente: `pull-prod-backups.sh` (dump notturni verificati con `pg_restore --list` su linux-pc) + linux-pc è **gemello prod con DB clone locale** | Classificazione per **raggio d'impatto** (§6) + corsia presidiata obbligatoria per la classe D |
| V8 | La skill `handoff` è **unico writer** di `SOT_STATE`/`SOT_BACKLOG`/`DEBT_REGISTER`; `handoff_lint.py` ha 10 check bloccanti; `CLAUDE.md` §SoT impone «single per domain — do not duplicate» | Il motore **prepara e lint-valida** blocchi register; la scrittura di stato passa da `handoff` |
| V9 | `CLAUDE.md` di progetto: l'autorizzazione al `push` è **session-scoped e una nuova sessione torna a «chiedi»** | L'autorizzazione implicita richiesta al punto 7.a è un'**eccezione consapevole**: va dichiarata in config con perimetro esplicito, non assunta (§7) |

## 1. Condizione primaria — contratto di terminazione misurabile

La condizione «zero pendenze» come scritta non è raggiungibile senza Enzo (V6): un loop che la usa come uscita non si ferma mai. Riformulazione che conserva l'obiettivo e taglia solo la parte impossibile:

> **Zero cluster eseguibili in autonomia rimasti aperti**, più un **vassoio esplicito** di N cluster bloccati su Enzo, ciascuno con la ragione verificata e cosa serve esattamente per sbloccarlo.

La valuta uno script, non un giudizio del modello — `docs/kb/tools/zp_zero_check.py` esce `0` **solo se tutte** queste sono vere, altrimenti esce `1` e stampa cosa manca:

1. cluster con `status ∈ {ACTIVE, INTERRUPTED}` **e** `needsEnzo = NO` → **0**
2. gate matrix verde su `HEAD` per tutte le aree toccate dall'ultima ondata
3. `handoff_lint.py` esce 0 (10 check)
4. ultimo run CI per workflow = `success`
5. 0 servizi systemd `failed` su VM e linux-pc; `/api/readyz` e `/login` → 200 su entrambi
6. 0 alert di sicurezza dipendenze aperti non registrati come debito con rischio accettato
7. `git status` pulito e `HEAD` == `origin/main`

**Sub-condizione per iterazione** (quella passata a `/goal`, V2): *il cluster corrente ha gate verde ∧ 2 verifiche di tipo diverso registrate ∧ 0 rilievi adversarial aperti ∧ blocco evidenza DoD presente ∧ piano e register aggiornati — or stop after N turns*.

## 2. Architettura a due pezzi (il punto che cambia tutto)

```
scripts/zero-pending-driver.sh                    ← IL LOOP (fuori dalla sessione)
  └─ per ogni iterazione:
       claude -p "/zero-pending-loop resume" --permission-mode … --max-turns N
                    │
                    ↓  contesto vergine per costruzione  =  il /clear del punto 7.b
       .claude/skills/zero-pending-loop/           ← IL MOTORE (una sola iterazione)
         SKILL.md  +  references/                    modi: bootstrap · resume · close · report
                    │
       docs/kb/tools/zp_*.py                       ← I GIUDIZI DETERMINISTICI
         zp_state.py · zp_gate.py · zp_evidence.py · zp_zero_check.py

  STATO TRA ITERAZIONI — SEMPRE SU FILE, MAI IN CONVERSAZIONE:
    docs/superpowers/specs/2026-07-25-zero-pending-plan.md   piano + checkbox + note di chiusura
    docs/kb/SOT_BACKLOG.md                                   Action register (INTERRUPTED + resume-from)
    .handoff/STATE.md · .handoff/session-journal.ndjson       narrativa + fatti in corsa
    .zp/                                                     cursore · run-record · lock · budget · PROGRESS.md   [gitignored]
```

Il driver non ricorda niente e non deve: **rilegge**. È questa proprietà che rende il `/clear` innocuo e la ripresa (punto 7.c) banale.

## 3. Il driver — `scripts/zero-pending-driver.sh`

Responsabilità (e **solo** queste: il driver non ragiona sul merito del lavoro, orchestra):

1. **Lock** (`.zp/driver.lock` con PID + timestamp): una sola istanza. Lock orfano > 2h → recupero con warning.
2. **Pre-flight**: `zp_zero_check.py`. Se esce 0 → **termina con successo**, scrive il report finale, non lancia niente.
3. **Finestra e budget**: rispetta `--window` (default nessuna) e i tetti `--max-iterations` / `--budget-tokens`. Sforato un tetto → chiusura ordinata, non troncamento.
4. **Kill switch**: se esiste `.zp/STOP` → completa l'iterazione in corso, chiude la sessione e si ferma. È il modo in cui Enzo interrompe da remoto senza entrare in sessione.
5. **Invocazione**: `claude -p "/zero-pending-loop resume" --output-format json --permission-mode <da config> --max-turns <da config>`; cattura `session_id`, exit code, token spesi.
6. **Classificazione dell'esito**: `completata` · `troncata` (V4: exit non-zero da `--max-turns` — **non** è un fallimento) · `chiusura richiesta dal motore` · `errore reale`.
7. **Backoff e cambio direzione** (R14): due iterazioni consecutive che falliscono sullo **stesso** cluster → il cluster va `INTERRUPTED` con la ragione verificata e il driver **passa al prossimo**. Mai un terzo tentativo nella stessa direzione.
8. **Report cumulativo**: riscrive `.zp/PROGRESS.md` a ogni iterazione (§9).

```bash
bash scripts/zero-pending-driver.sh \
  --lane safe            # safe (classi A+B) | full (A+B+C). D mai in non presidiato — §6
  --max-iterations 12 \
  --budget-tokens 4000000 \
  --window 22:00-07:00 \
  --dry-run              # stampa il piano di iterazioni senza invocare claude
```

## 4. Il motore — modi della skill

| Modo | Quando | Cosa fa |
|---|---|---|
| **bootstrap** | prima chiamata sul progetto, o piano assente/stale oltre soglia | esegue la procedura codificata di avvio sessione (`session_start.py`) · **verifica** il piano S1029 esistente (integrità: tutte le voci lette senza scarti silenziosi, `dependsOn` risolti, checkbox coerenti col register) · refresh delle **sole** fonti stale · ricostruisce la todo tracciabile · dichiara l'incarico compreso e le regole di autonomia con cui opererà |
| **resume** (default) | ogni iterazione successiva | legge il cursore, seleziona il prossimo cluster ammissibile per corsia, esegue il protocollo §5, aggiorna piano + register, decide se continuare nella stessa sessione o passare a `close` |
| **close** | contesto o budget in esaurimento, kill switch, o fine ondata | il punto 7.a completo: gate → commit atomico → push (perimetro §7) → `close-propagate.sh --delta --resilient --auto-deploy` (repo + payload + ecosistema + deploy VM + clone DB linux-pc) → `handoff` → segnala al driver «chiudi e riparti» |
| **report** | su richiesta, anche a loop fermo | stato leggibile: cluster chiusi/aperti per ondata, vassoio bloccati-su-Enzo con la ragione, spesa, prossimi 5 candidati |

**Selezione del prossimo cluster — deterministica, non a intuito.** In quest'ordine: `INTERRUPTED` con `resume-from` (priorità assoluta) → `blocking = HARD` → ondata corrente → `dependsOn` tutti risolti → classe ammessa dalla corsia (§6) → effort che sta nel budget residuo dell'iterazione. A parità, l'effort minore prima (libera checkbox e riduce il rumore).

## 5. Protocollo di esecuzione di un cluster (il cuore)

È il «Protocollo di chiusura di un cluster» del piano S1029, reso **meccanico e rifiutabile** invece di esortativo.

1. **Implementazione** secondo i pattern del repo (modulo 7-step di `CLAUDE.md`; invarianti I1-I20 come vincoli, non suggerimenti).
2. **Due verifiche su livelli diversi del sistema** — non due esecuzioni dello stesso test. `zp_gate.py` **rifiuta** una coppia omogenea. **[rivisto 2026-07-26]** La regola qui scritta raggruppava per *tipo di strumento* e finiva per rifiutare `integration + e2e` e `psql + runtime`, cioè proprio le coppie che la Definition of Done del progetto impone, mentre ammetteva `staticcheck` come mezza evidenza. La domanda giusta non è «che strumento è» ma «queste due prove possono sbagliare insieme?»: da qui i livelli — codice-isolato · sistema-api · sistema-ui · stato · produzione · ripetibilità — e `staticcheck` che non conta mai, essendo la soglia d'ingresso. L'elenco delle coppie non si ricopia qui: `python docs/kb/tools/zp_gate.py tipi` e `zp_gate.py prove A B`.

3. **Review adversarial** via **Workflow tool** (mai `Agent` sciolti): 3 verificatori su **lenti distinte** — correttezza · sicurezza e isolamento tenant · riproducibilità. Prompt istruito a **demolire, non a confermare**. Il rilievo cade se ≥2 lo refutano.
4. **Correzione dei rilievi confermati + ri-test.** Loop interno **massimo 2 giri**; al terzo il cluster va `INTERRUPTED` con la ragione, e si passa al prossimo (R14).
5. **Commit atomico** con evidenza DoD (ADR-0026): nessun cluster si chiude su mock, placeholder o green-test. `zp_evidence.py` produce il blocco canonico. Manca un input che solo Enzo può dare → `blocked-on-Enzo: <cosa, perché>`, **mai** «done».

Il `done when` del cluster è già un criterio osservabile con un comando nel piano S1029: il motore lo **esegue**, non lo interpreta.

## 6. Classificazione per raggio d'impatto — la rete di sicurezza

Esiste **un solo ambiente ed è produzione** (V7). Un loop non presidiato che tocca indiscriminatamente `db:migrate`, `vm-deploy.sh` (riavvia i systemd `api`/`web`) e `push` su `main` per centinaia di ore non è autonomia, è roulette. Ogni cluster aperto porta una classe in `zp.config.yaml`, e la classe determina la corsia.

**[rivisto 2026-07-26]** La classe **non si deduce dalla descrizione del cluster**: si deriva da ciò che il suo criterio di chiusura *fa*, ed è un pavimento che vince anche sugli override scritti a mano. Il caso che l'ha insegnato: un cluster descritto «favicon e webmanifest, asset statici» stava in classe B — corsia non presidiata — e si chiude con un `curl` sul dominio pubblico, cioè deployando il sito. Sette cluster che toccavano la produzione sono usciti dalla corsia non presidiata quando il pavimento è stato applicato. Dettaglio in `references/blast-radius.md`.

| Classe | Cosa tocca | Corsia non presidiata | Precondizione aggiuntiva |
|---|---|---|---|
| **A · inerte** | docs, spec, register, commenti, test aggiunti | **sì** | gate verde |
| **B · codice reversibile** | `apps/api`, `apps/web`, `packages/shared` senza migrazione e senza cambio di contratto pubblico | **sì** | gate verde + adversarial · rollback = revert del commit |
| **C · schema e dati** | `db/migrations`, seed, brownfield | **sì, solo in `--lane full`** | prova prima su **linux-pc** (DB clone locale) + dump verificato `< 24h` + migrazione idempotente due volte con diff `pg_dump` vuoto |
| **D · runtime produzione** | `vm-deploy`, restart systemd, `.env`/secrets, alerting, retention, backup, disco | **no, mai** | il driver **accoda** e stampa il lotto; Enzo autorizza per lotto in una corsia presidiata |
| **E · bloccato su Enzo** | i cluster di W6 (decisione di business · dipendenza esterna · segreto) | **no** | input di Enzo — è il vassoio della condizione primaria |

`--lane safe` esegue A+B. `--lane full` aggiunge C. **D non entra mai in corsia non presidiata, per costruzione dello script** — non per disciplina del modello. **[rivisto 2026-07-26]** Con un'avvertenza che la review ha pagato cara: il filtro governa la *selezione* del cluster, non il rito di chiusura, che invocava `close-propagate --auto-deploy` a ogni ciclo. Una corsia che promette di non toccare la produzione va verificata in **ogni** punto del ciclo capace di toccarla, non solo dove sceglie il lavoro. Il veto sul deploy ora è dentro `close-propagate.sh` e vince sui flag.

## 7. Autonomia: il perimetro esatto

**Decide da sé, senza chiedere** (R22 CLASSE A + R23): scelta implementativa · quali test creare e come · wording del commit · ordine dei cluster · modello ed effort per task · correzione dei rilievi adversarial · cleanup e rename con convention nota · retry e workaround tecnici · quando chiudere l'iterazione.

**Non decide, e non ci prova**: i 30 cluster `needsEnzo` · qualunque cluster di classe D · qualunque cosa che richieda un segreto · qualunque cosa che contraddica un'invariante `I1-I20` → **stop e vassoio, mai workaround** (`CLAUDE.md`: «when a new requirement seems to conflict with these, stop and ask»).

**Autorizzazione `push` implicita** (eccezione consapevole a V9, dichiarata in `zp.config.yaml`): perimetro `origin main` · mai `--force` · mai su gate rosso · mai su `handoff_lint` rosso · `pull --rebase` + re-lint prima del push (pattern `handoff` Step 4) · ogni push registrato nel run-record con SHA. Revocabile azzerando una chiave di config.

Il divieto R23 di delegare all'utente **resta pieno**: il vassoio non è delega, è la registrazione di un blocco *verificato*, con l'evidenza di perché è tale.

## 8. Model-map e budget

| Attività | Modello | Effort |
|---|---|---|
| Pre-flight, inventari, probe, checkbox, letture di liste | haiku | low |
| Implementazione su pattern ripetuto (modulo 7-step, fix noto) | sonnet | medium |
| Verifica su DB reale, SQL, SSH, migrazioni | sonnet | medium |
| Review adversarial · decisione rollback · sintesi del vassoio · scelta di chiudere | modello di sessione (opus/fable) | high |

Regola non negoziabile: **il giudizio non si delega in giù.** In dubbio → eredita il modello di sessione. Budget per iterazione dichiarato in config. **[rivisto 2026-07-26]** La riga originale diceva «superato l'80% il motore passa a `close`»: non è realizzabile, perché dentro l'invocazione il motore non ha modo di sapere quanto ha speso — il costo è leggibile solo *fra* le iterazioni, dal driver, in `total_cost_usd`. Al posto della percentuale valgono due limiti osservabili: **un cluster per iterazione** (il consumo è limitato per costruzione) e i tetti esterni del driver (`--max-budget-usd` per invocazione, `hard_stop_usd_total` cumulato, `--budget-ore` sull'effort del cluster).

## 9. Osservabilità da remoto (Enzo controlla senza entrare in sessione)

`.zp/PROGRESS.md`, riscritto a ogni iterazione, in italiano e leggibile da telefono: ondata corrente · cluster chiuso in questa iterazione con una riga di evidenza · cluster rimasti per ondata · **vassoio bloccati-su-Enzo con cosa serve** · spesa cumulata vs tetto · prossimi 5 candidati · eventuali `INTERRUPTED` con la ragione. Più `.zp/runs.ndjson` (un record per iterazione, per le metriche §12).

Kill switch: `touch .zp/STOP`. Ripresa: cancellare il file e rilanciare il driver.

## 10. Degradazione ed errori (tutti i casi previsti, nessuno lasciato al caso)

| Evento | Comportamento |
|---|---|
| Tunnel :5433 giù | riprova 3×, poi `bootstrap` lo rialza; se fallisce → esegue solo cluster di classe A e marca `[non verificato: DB]` |
| CI rossa | **è un errore da correggere** (R3), diventa il cluster corrente con priorità HARD, non si bypassa |
| Contesto esaurito a metà cluster | il lavoro parziale va in commit **solo se il gate è verde**; altrimenti `git stash` + cluster `INTERRUPTED` con `resume-from` e il percorso dello stash nel run-record |
| Spend-limit a metà | salvataggio parziale + `INTERRUPTED` + chiusura ordinata (lezione S1016 già codificata) |
| Host VM o linux-pc giù | `skip + warn`, mai blocco del close; canale fallito su host **raggiungibile** = `fail-loud` (design 2026-06-20 §13.3) |
| Conflitto di rebase con una sessione umana | risolve unendo i fatti di entrambe le sessioni; mai `-X ours/theirs` cieco, mai `--no-verify` |
| Cluster che fallisce 2 volte | `INTERRUPTED` con ragione verificata, si passa al prossimo (R14) |
| Lock orfano > 2h | recupero con warning nel run-record |

## 11. Piano di test (accettazione)

1. `--dry-run` del driver → stampa la sequenza di iterazioni e i cluster candidati, senza invocare `claude`.
2. `bootstrap` su piano esistente → **non** ri-censisce; verifica l'integrità di **tutte** le voci del piano (una riga non conforme è un errore, non un silenzio: è così che `Z-110` restò invisibile per giorni) e segnala eventuali `dependsOn` rotti.
3. `zp_gate.py` con due verifiche dello **stesso** tipo → **rifiuta** (il contratto §5.2 è meccanico).
4. Cluster di classe **D** messo in coda con `--lane safe` → **non** viene eseguito, compare nel lotto presidiato.
5. Cluster di classe **C** con dump più vecchio di 24h → **non** viene eseguito, motivo esplicito.
6. `touch .zp/STOP` a metà iterazione → completa, chiude ordinatamente, si ferma.
7. Terminazione: con tutti i cluster autonomi chiusi in un fixture, `zp_zero_check.py` esce 0 e il driver termina con successo e vassoio corretto.
8. Iterazione troncata dal tetto di spesa (`--max-budget-usd`; **non** `--max-turns`, che non esiste — V4) → classificata `troncata` dall'assenza di `.zp/last-outcome.json`, il cluster **non** risulta fallito, la successiva riprende dal `resume-from`.
9. **Frontiere**: 8 esche non attivano la skill — «chiudi la sessione», «aggiorna l'atlas», «trova i bug», «fai la due diligence», «consolida la pagina», «mappa il grafo», «quanto vale il progetto», «genera il menu».

## 12. Effort, tranche, rischi

**Effort**: ~14h in 4 tranche. **T1** classificazione di tutti i cluster aperti per raggio d'impatto + `zp.config.yaml` (~3h — è il lavoro che rende sicuro tutto il resto). **T2** `SKILL.md` + `references/` (~4h). **T3** i quattro `zp_*.py` + `zero-pending-driver.sh` (~5h). **T4** accettazione §11 (~2h). Regression risk della *costruzione*: **basso** (nessun runtime toccato). Il rischio vero è nell'*esecuzione*, ed è governato da §6.

| Rischio | Prob. | Impatto | Mitigazione |
|---|---|---|---|
| Danno a produzione in non presidiato | media | **alto** | classi §6 + D mai automatica + prova su linux-pc per C + dump verificato < 24h + rollback = revert |
| Push non presidiato che rompe `main` | media | alto | perimetro §7: mai su gate o lint rossi, `pull --rebase` + re-lint, mai `--force` |
| Il loop non termina | media | medio | condizione primaria eseguibile §1 + tetti iterazioni/budget + kill switch |
| Spesa fuori controllo (~924h di lavoro autonomo) | **alta** | medio | budget per iterazione e globale, `--window`, `PROGRESS.md` leggibile da remoto |
| Sovrapposizione con `handoff` / `ralph-build-loop` / `project-atlas` | media | medio | V8 (la skill prepara, non scrive lo stato) + supersede dichiarato + frontiere §11.9 |
| Qualità che degrada senza supervisione | media | alto | doppia verifica eterogenea rifiutabile + adversarial 3 lenti + giudizio mai delegato in giù (§8) |

## Appendice A — Gate matrix derivata a runtime (anti-drift)

I gate **non sono hardcoded**: si derivano a ogni run dallo scope reale (`git diff --name-only`). Area toccata **senza** gate mappato in `zp.config.yaml` → **errore bloccante**, mai skip silenzioso. Mai «lancia tutta la suite»: costa e nasconde quali gate contano.

| Area | Gate |
|---|---|
| `apps/api/**` | `typecheck` · `lint` · vitest sui file toccati **e** sui moduli dipendenti · integration su DB reale |
| `apps/web/**` | `typecheck` · `lint` · `i18n:check` · Playwright sulle spec pertinenti (`test:e2e:prod:node22` se Node ≥23 — D-36) |
| `packages/shared/**` | `typecheck` a monte + rebuild dei consumer (`api`, `web`, `showcase`) |
| `db/migrations/**` | `db:migrate` due volte con diff `pg_dump` vuoto · `db:validate` (7 viste) |
| `scripts/**`, `deploy/**` | lint shell + dry-run del percorso modificato |
| `docs/kb/**` | `handoff_lint.py` (10 check bloccanti) |
