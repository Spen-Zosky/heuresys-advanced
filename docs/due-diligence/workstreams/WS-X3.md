# WS-X3 — Execution Risk / Team & Bus Factor + Trasparenza (peso 5)

> Cross-cutting · postura avversariale · data 2026-06-17 · HEAD `ce26608` (S994).
> Evidenze: `git shortlog/rev-list/log`, conteggio doc, lettura DEBT_REGISTER + ADR + workstream cross-WS già prodotti. Include la **META-FINDING trasparenza** richiesta dal mandato.

## Sintesi

L'execution risk di heuresys-advanced è dominato da **un singolo fattore strutturale che è anche il rischio #1 per qualunque investitore: bus factor = 1**. Il `git shortlog` è inequivocabile: **un solo essere umano** (Enzo Spenuso sotto due identità, stessa persona) firma 845/848 commit; l'unico altro "autore" è `dependabot[bot]`. Non c'è co-founder tecnico, non c'è secondo committer, non c'è PR-review (0 merge su 350 commit dal v1.0.0 — tutto direct-to-main). Tutta la conoscenza — l'architettura idiosincratica (no-Docker, DB via tunnel-SSH su VM free-tier, agent-gateway su abbonamento personale, self-hosted CI runner che è la VM prod) — vive in una sola testa. Per un acquirente, **se il founder sparisce, il progetto si ferma**: non per mancanza di codice, ma per mancanza di chi sappia operarlo.

Il contrappeso è una **base documentale fuori-norma per un solo sviluppatore**: 23 ADR, 18 kb-doc, 289 file `.md`, SoT governate da handoff con counts ri-derivati ogni sessione, DEBT_REGISTER notevolmente onesto. Ma la doc è un segnale **ambivalente**: tanta quantità, **drift cronico** (D-01, WS-I, counts stale rivalidati in Discovery — i numeri SoT erano *sotto* la realtà di +3 moduli/+22 migration/+111 test in ~4 giorni). La doc abilita l'onboarding ma non è affidabile alla lettera senza rivalidazione live → un nuovo dev deve fidarsi del codice, non delle SoT.

La **META-FINDING trasparenza è il risultato più rilevante di questo workstream e gioca a favore del venditore**: confrontando i claim del materiale interno con la realtà osservata attraverso *tutti* i workstream, il pattern è sistematico e univoco — **il venditore sottostima sé stesso, non si gonfia**. I counts SoT sono per-difetto; l'auto-audit 100X marca come "assenti" feature che esistono nel codice (export CSV/XLSX/PDF, inbox notifiche, a11y automatica); il claim "0/13 actions SHA-pinned" è SMENTITO (sono pinnate — un asset); il DEBT_REGISTER espone spontaneamente i CRITICAL più imbarazzanti (fork-PR ACE D-08, refresh rotto D-26). Un venditore che *under-promises* abbassa il rischio di frode/sorpresa in DD — ma il drift resta un rischio di **governance**, non di malafede.

Score: **58/100 (Debole)** — il numero è tirato verso il basso dal bus factor=1 non mitigato (fattore di peso 5, il terrore dell'investitore) e dalla governance leggera (no review, no CI/PROD separation, drift cronico). È tirato verso l'alto dalla trasparenza eccezionale e dalla documentazione abbondante. Il risultato netto è **Debole ma non Critico**: il rischio è reale e strutturale, ma onestamente esposto e parzialmente mitigato dalla doc — un acquirente lo prezza come "key-person dependency" da neutralizzare con retention del founder + hiring del secondo dev, non come red flag occulto.

## Claim del venditore rivalidati

| # | Claim del venditore | Verdetto | Evidenza |
|---|---|---|---|
| — | "Single developer / sole coder" | **CONFERMATO** | `git shortlog`: 845/848 commit = Enzo Spenuso ⊕ Spen-Zosky (stessa persona); +32 `dependabot[bot]`. 3 email totali, 1 sola umana |
| — | "v1.0.0 GA rilasciata, programma post-v1 in corso" | **CONFERMATO (cadenza reale)** | 350 commit `v1.0.0..HEAD`, 0 merge; cadenza 20-41 commit/giorno (ultimi 14gg). Velocity individuale alta e continua |
| C12 | "DEBT_REGISTER: 37 debiti, 36 risolti con evidenza, 1 aperto" | **CONFERMATO (e onesto)** | DEBT_REGISTER espone CRITICAL spontaneamente (D-08 fork-PR ACE su prod, D-26 refresh rotto in PROD live). Trasparenza notevole — non nasconde i debiti gravi |
| — | "SoT counts accurati" (implicito) | **SMENTITO per-difetto (onesto/conservativo)** | Discovery: counts live > SoT (+3 moduli, +17 endpoint, +22 migration, +111 test). Drift cronico (D-01/WS-I) ma **sempre per-difetto** → sottostima, non gonfiaggio |
| — | "Reporting/export = ZERO; inbox = nessuno avvisato; a11y = zero" (auto-audit 100X) | **SMENTITO a favore del prodotto (3×)** | WS-P1/X1: `lib/export/hook.ts` (CSV/XLSX/PDF reale), `me/inbox` + `emitNotification`, `a11y.spec.ts` esistono. L'auto-audit è obsoleto **per difetto** |
| — | "0/13 GitHub Actions SHA-pinned" (WS-G interno) | **SMENTITO (positivo — asset)** | WS-T8/T9: 6/6 action-ref uniche SHA-pinned con commento versione. Il venditore si è auto-accusato di un problema che non ha |

## Finding

---

**X3-001 · Bus factor = 1: dipendenza da key-person totale e non mitigata · Severità: Critica · Tipo: Execution/Team**

- **Evidenza:** `git shortlog -sne --all` → un solo umano (Enzo Spenuso `enzo.spenuso@outlook.com` 692 + Spen-Zosky `spen.zosky@gmail.com` 153 = stessa persona/owner) firma il **99.6%** dei commit; unico altro autore = `dependabot[bot]` (32, automazione). Discovery Q7: "single developer oggi; scalare il team è use-of-funds". Architettura idiosincratica che amplifica la dipendenza: no-Docker (ADR-0004), DB raggiunto via **tunnel-SSH a VM OCI free-tier personale**, self-hosted CI runner = la VM PROD stessa (WS-G/T8 SPOF), `agent-gateway` su **abbonamento Claude MAX personale del founder** (`project_agent9_subscription_max`), deploy via `vm-deploy.sh` con quirk noti (self-modify-buffer, NVM PATH). Ogni pezzo di questa catena è "tribal knowledge" non trasferito.
- **Impatto:** È il rischio dominante per un investitore. Se il founder diventa indisponibile: (a) il prodotto non si **opera** (chi rinnova il tunnel, riavvia i systemd, gestisce il CI-runner-che-è-la-prod, paga/rinnova l'abbonamento MAX che fa girare l'agent-gateway?); (b) la roadmap si **ferma** (nessun secondo dev con context); (c) la valutazione di un'acquisizione **crolla** se l'asset è inseparabile dalla persona. Anche con doc abbondante, l'onboarding di un sostituto su questa architettura è ripido (X3-002).
- **GA-blocker:** No (GA tecnica già raggiunta da una persona). **Sì come investment-risk** — condiziona term-sheet (retention founder, vesting, key-person insurance).
- **Remediation:** (1) **hiring secondo dev** = primo use-of-funds (riconosciuto dal venditore); (2) de-personalizzare l'infra: migrare DB a OCI Managed (Option C già prevista), spostare CI runner fuori dalla VM prod, spostare agent-gateway da abbonamento personale ad API-key/Bedrock contrattualizzato; (3) **CONTRIBUTING.md/ONBOARDING.md** (oggi assenti — verificato `ls`) + runbook operativo; (4) founder retention (lock-up/earn-out) come clausola d'acquisizione. **Effort: organizzativo + ~M tecnico per de-personalizzare l'infra. Non risolvibile in codice da solo.**
- **Confidence:** Alta.

---

**X3-002 · Onboarding ripido: doc abbondante ma con drift cronico → non affidabile alla lettera · Severità: Alta · Tipo: Execution/Knowledge-transfer**

- **Evidenza:** KT surface = **23 ADR + 18 kb-doc + 289 file `.md`** (`find docs -name '*.md'`), SoT governate da handoff con counts ri-derivati. *Ma*: (a) **nessun CONTRIBUTING.md né ONBOARDING.md** (verificato — assenti); (b) **drift cronico** documentato dal venditore stesso (D-01 🔴, WS-I, QW-I1..4) e confermato in Discovery: i counts SoT erano sotto la realtà (+3 moduli/+22 migration/+111 test in ~4 giorni); (c) architettura non-standard che contraddice i pattern che un dev medio si aspetta (no-Docker, no-ORM-query-builder, tunnel-SSH-DB, RLS proibito → tenant-isolation a mano via middleware). Il CLAUDE.md è ricchissimo ma **enorme** (centinaia di righe di regole/invarianti) → curva d'apprendimento alta anche solo per le convenzioni.
- **Impatto:** Un nuovo dev può ricostruire l'intento (la doc *esiste* ed è densa), ma deve **rivalidare ogni numero contro il codice live** (le SoT non sono affidabili alla lettera per design-drift). Il time-to-productivity è settimane, non giorni, su un'architettura idiosincratica documentata-ma-derivante. Amplifica X3-001: la doc riduce il bus factor da "catastrofico" a "gestibile-con-effort", non lo elimina.
- **GA-blocker:** No.
- **Remediation:** (1) CONTRIBUTING.md + ONBOARDING.md + runbook operativo (gap netto, ~S); (2) chiudere il drift cronico delle SoT (D-01/WS-I — re-derivazione automatica già parzialmente in handoff skill, va resa enforcing in CI); (3) un "architecture decision summary" navigabile sopra i 23 ADR. **Effort ~S-M.**
- **Confidence:** Alta.

---

**X3-003 · Governance leggera: zero PR-review, direct-to-main, CI=PROD non separati · Severità: Media · Tipo: Execution/Process**

- **Evidenza:** **0 merge** su 350 commit `v1.0.0..HEAD` → tutto direct-to-main, nessun PR-based review (coerente con bus-factor=1: non c'è chi reviewi). CI gira su **un solo runner self-hosted = la VM PROD** e i test girano sul **DB PROD live** (WS-G/T8: "elimina la separabilità CI/PROD"). Rollback manuale (nessun `vm-rollback.sh`). Branch residui non-puliti (`backup-s940-rollback`, `feat/zod4-ftpz6`, 5 worktree-agent). Il fork-PR ACE su host prod (D-08 CRITICAL) è una conseguenza diretta di CI=PROD.
- **Impatto:** Per un solo dev, direct-to-main è pragmatico (non c'è review da fare). Ma per un team post-funding è un **modello operativo da rifondare**: serve branch-protection, PR-review, CI separata dalla prod, runner isolato. È rischio di *scalabilità del processo*, non di qualità del codice attuale (che è verificato green altrove: typecheck pulito, audit prod 0-vuln, 1012 test).
- **GA-blocker:** No (case-study/solo-dev). Diventa prerequisito al primo hire.
- **Remediation:** Branch-protection + PR-review obbligatoria + CI runner isolato dalla VM prod + `vm-rollback.sh` (D-08 remediation già scoping ~0.5 sessioni) + cleanup branch stale. **Effort ~M, gated dal secondo hire.**
- **Confidence:** Alta.

---

**X3-004 · META-FINDING — Trasparenza: il venditore sottostima sé stesso (riduce execution-risk) · Severità: Positiva (asset DD) · Tipo: Trasparenza/Governance**

- **Evidenza (convergente su tutti i workstream):**
  - **Counts SoT per-difetto** (Discovery): live > dichiarato su *ogni* metrica (moduli, endpoint, migration, test). Drift sistematicamente **conservativo**.
  - **Auto-audit obsoleto per-difetto** (WS-P1/X1): "export = ZERO" SMENTITO (`lib/export/hook.ts` CSV/XLSX/PDF reale + 6 test); "nessuno avvisato" SMENTITO (`me/inbox` + `emitNotification` + dedupe); "a11y = zero" SMENTITO (`a11y.spec.ts` esiste).
  - **Auto-accusa infondata** (WS-T8/T9): claim interno "0/13 actions SHA-pinned" SMENTITO — 6/6 sono pinnate. Il venditore si è attribuito un difetto di sicurezza che non ha.
  - **DEBT_REGISTER onesto** (C12): espone spontaneamente i CRITICAL più gravi e imbarazzanti — D-08 (fork-PR ACE su host prod), D-26 (silent-refresh rotto → utenti reali sloggati ogni 15 min in PROD live). Nessun tentativo di nasconderli.
  - **ADR-0023 §4 "negative/bounded"**: dichiara esplicitamente che il no-PII è una scelta che "must be revisited" al primo tenant reale — non lo vende come fatto compiuto.
  - **Contro-evidenza (l'unico over-claim):** "v1.0.0 GA" è il termine più ambizioso usato — è GA *tecnica*, non commerciale (0 monetizzazione, WS-P3 SMENTITO implicito; BPM runtime assente, WS-X1). Ma è etichettatura ottimistica, non occultamento.
- **Impatto:** Per la DD è un **fattore di de-risking forte**. Un venditore che under-promises e auto-espone i CRITICAL abbassa drasticamente il rischio di sorprese post-acquisizione (lo scenario peggiore in DD è "claim gonfiati che crollano alla verifica"). Qui l'opposto: la verifica trova *più* prodotto del dichiarato. Riduce l'execution-risk di trasparenza quasi a zero. **MA** il drift cronico — pur conservativo — resta un rischio di governance: SoT non affidabili alla lettera = ogni numero va rivalidato, e su un team più grande il drift per-difetto diventa caos.
- **GA-blocker:** No (è positivo).
- **Remediation:** Nessuna correttiva — solo capitalizzazione: chiudere il drift (X3-002) trasforma la trasparenza onesta in trasparenza *affidabile*. La sola etichetta "GA" andrebbe qualificata "GA tecnica, pre-revenue" per evitare l'unico over-claim.
- **Confidence:** Alta.

## Score

**Score: 58/100 — Debole · Confidence: Alta**

**Motivazione:** Bus factor=1 totalmente non mitigato (peso 5, rischio #1 per l'investitore) + governance leggera (0 review, CI=PROD, no rollback, drift cronico) tirano il punteggio sotto la soglia "Adeguato". Controbilanciati da una documentazione fuori-norma per un solo dev (23 ADR/289 md) e — soprattutto — da una **trasparenza eccezionale**: il venditore sistematicamente *sottostima* sé stesso (counts per-difetto, auto-audit obsoleto a favore del prodotto, CRITICAL auto-esposti), il che è il pattern opposto a quello che terrorizza in DD. Il risultato è **Debole ma non Critico**: il rischio key-person è reale, strutturale e non risolvibile in codice (serve hiring + de-personalizzazione infra + founder-retention), ma è onestamente esposto e parzialmente tamponato dalla doc. Un acquirente lo prezza come dipendenza da neutralizzare con clausole contrattuali e use-of-funds, non come red flag occulto. Non più basso perché la trasparenza e la velocity individuale sono asset genuini; non più alto perché un singolo punto di fallimento umano su un'infra idiosincratica e personale è, per definizione, fragile.
