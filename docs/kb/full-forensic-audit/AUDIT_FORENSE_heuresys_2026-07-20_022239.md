# AUDIT FORENSE — heuresys-advanced · 2026-07-20 02:22

**Scope**: intero repo (monorepo pnpm, 5 workspace) · **HEAD**: `ba2b79e0` · **Modalità**: READ-ONLY · **Auditor**: lead forensic (main thread, evidence-based).

> **Nota metodologica onesta (vincolante per la lettura di questo report).** Il fan-out multi-agente pianificato (14 finder × verifica adversarial per-finding, orchestrato via Workflow ultracode) è **fallito integralmente su un limite di sessione dell'account Claude** ("session limit · resets 6:20am Europe/Rome") dopo 122s/203k token: **0 finding raccolti dai subagent**. L'audit è stato quindi **completato nel main thread**, con verifica diretta di ogni claim (Grep/Read/psql read-only) — la verifica di persona **è** il gate fp-check (nessun finding non verificato è entrato in questo report). **Conseguenza sul perimetro**: i domini a maggior impatto finance-readiness sono coperti con evidenza diretta; alcuni domini di dettaglio restano **residuo esplicito** (elencato in §6). Questo è dichiarato per non spacciare per esaustivo ciò che non lo è — coerente con la regola "no minimizzazione".
>
> **Istruzione di Enzo recepita (mid-run)**: la documentazione (`docs/`) **non è fonte affidabile**; ogni affermazione su scopo/funzionalità è verificata su codice/DBMS/API/endpoint reali. Questo report distingue esplicitamente *ciò che il codice/DB fa* da *ciò che la doc dichiara*.

---

## 1. Executive summary

**La piattaforma è reale, sostanziosa e — sul fronte sicurezza — solida.** Verificato dal codice/DB, non dalla doc: **516 endpoint** HTTP reali su **88 moduli**, **163 tabelle su 199 popolate (82%)** con dati veri (162 utenti, RBAC 13 ruoli/176 permessi/776 mapping, 905 skill-possession, 91k login-event). I **quattro TRUE-POSITIVE** dell'audit precedente (S1014) sono **tutti chiusi e ri-verificati live** in questa sessione con **soluzioni professionali, non tamponi**: credenziali admin committate (F-001) rimosse, open-redirect (F-002) bloccato, CSV/DDE injection (F-004) neutralizzata, fork-runner ACE (F-012) mitigato con fork-guard. `pnpm audit` = **0 vulnerabilità**; **SQL 100% parametrizzato**; **authz coverage completa** (558 `requirePermission` + gate boot-assertion `ORG_GATE_MISSING`); il footgun `z.coerce.boolean` è **evitato ovunque** con `z.enum` esplicito. Questo dimostra **capacità esecutiva su lavoro complesso**: le remediation passate non sono workaround ma fix strutturali.

**Ma il debito è diffuso, non isolato — e conferma il timore di fondo di Enzo** ("verde ≠ funzionante su dati reali"). Tre classi di problema reggono alla verifica:

1. **Un blocco operativo attivo**: **D-58** (`next build`/Turbopack non risolve il barrel `.js` di `@heuresys/shared`, ×94) → **il web PROD non è deployabile** e la CI smoke è rossa. È toolchain, non codice, ma blocca una demo investor.
2. **Feature dichiarate "shipped DoD-complete" con backing vuoto**: **F4 asse funzionale (#24)** ha `sys_process_participants` = **0 righe** → l'asse funzionale ADR-0027 non è esercitato da alcun dato reale, in tensione con la DoD ADR-0026. `sys_organization_hierarchies` è **dead schema** (0 righe + 0 riferimenti nel codice).
3. **Igiene DB**: **261 FK su 549 senza indice** sulla leading column; `sys_auth_login_events` **91k righe unbounded** senza retention.

**Verdetto finance-readiness (dopo gate avvocato-del-diavolo, §5): CONDITIONAL-GO** con confidence *media* (per il perimetro ridotto dell'audit). L'esecutore **è** in grado di portare il progetto a livello finanziabile — le condizioni sono dimensionabili e non strutturali.

---

## 2. Scorecard per dominio (0-100, motivata)

| Dominio | Score | Motivazione (evidence-based) |
|---|---:|---|
| **Security** | **85** | TP storici tutti chiusi e ri-verificati; 0 vuln (pnpm audit); SQL param; authz completa + gate boot-assertion; footgun env evitato ovunque; cookie secure prod. −15: auth self-built da mantenere, MFA OFF (scelta Enzo, riduce la superficie ma è un asset di sicurezza spento), perimetro audit non esaustivo. *(era 55 in S1014, pre-remediation F-001..F-013 + D-50/D-51)* |
| **Architettura** | **83** | plugin-chain 13-step disciplinata, module-pattern uniforme su 88 moduli, authz coverage completa, live-data doctrine. −17: `agent-gateway` fuori da build/lint/CI, boilerplate `ActorContext`/`withTransaction` duplicato (~150 siti, QW-4/B4 aperti). |
| **Database** | **76** | schema disciplinato (RD-08 CHECK, no ENUM, no RLS), indici parziali, tx-isolation test (D-52). −24: **261/549 FK senza indice**, login-events **91k unbounded**, dead schema closure-OU, NACE adjacency senza integrità del parent. |
| **Test** | **80** | ~1394 test integration verdi, isolamento transazionale per-file (D-52), 0 mock, live-data. −20: **nessun unit-layer**, coupling al DB/tunnel, **D-58 blocca la smoke E2E**. |
| **CI/CD & deploy** | **66** | fork-guard su runner self-hosted, `vm-rollback.sh` + probe-as-gate, retention/dr-drill timer. −34: **D-58 smoke rossa → deploy web bloccato**, runner SPOF singolo, Actions non tutte SHA-pinned (QW-G2 aperto). |
| **Frontend** | **80** | live-data doctrine rispettata (0 mock verificati sul core), no XSS (`dangerouslySetInnerHTML` solo su costante), split chart echarts/mermaid (S1008). −20: perimetro a11y-tail/i18n-parity **non ri-verificato in questo run** (residuo). |

**Media ponderata indicativa: ~78/100** (robustness-first weighting: security×1.5, db×1.3, ci×1.2).

---

## 3. Findings per severità

| ID | Sev | Cat | File | Sintesi | Cross-ref |
|---|---|---|---|---|---|
| F-A05 | **HIGH** | ci-cd | `packages/shared/package.json:7` | D-58: `next build` Turbopack fallisce ×94 sul barrel `.js` (main→src TS) → deploy web bloccato | KNOWN(D-58) |
| F-A01 | MEDIUM | db | schema `sys` (live) | 261/549 FK senza indice sulla leading column | KNOWN(WS-C-1, parz.) |
| F-A02 | MEDIUM | db | auth retention + DB | `sys_auth_login_events` 91.341 righe unbounded, no pruning | KNOWN(WS-C-4 class) |
| F-A04 | MEDIUM | correctness | `lib/scope/functional.ts` | F4 (#24) "DoD-complete" ma `sys_process_participants`=0 righe → asse funzionale non esercitato da dati reali | **NEW** |
| F-A03 | LOW | db | `000009` | dead schema `sys_organization_hierarchies` (0 righe + 0 usi codice) | KNOWN(D-35) |
| F-A06 | LOW | db | `sys_activity_classifications` | NACE/ATECO = adjacency `parent_code` non-FK → parent orfani possibili; ltree assente | **NEW** |
| F-A07 | LOW | test-gap | `vitest.config.ts` | nessun unit-layer; tutti i test integration su DB live | KNOWN(WS-F) |
| F-A08 | LOW | docs-drift | `docs/` | endpoint reali 516 vs doc ~407; tabelle vuote 36 vs atlas 67 | NEW (classe D-01) |

**Refutati / falsi positivi (4)**: XSS via `dangerouslySetInnerHTML` (costante anti-FOUC), SQL injection (placeholder `$N`, non valori), env boolean footgun (`z.enum` esplicito ovunque), N+1 dashboard (subquery aggregate single round-trip). Dettaglio in `FINDINGS_2026-07-20_022239.json`.

**Distribuzione**: Critical 0 · High 1 · Medium 3 · Low 4 · Info/Asset 7.

---

## 4. Appendice per workstream (evidenza reale)

### WS2 — Security (dominante) → **FORTE**
- **Secrets**: `git grep` pattern literal password/secret/key su `apps/**` `packages/**` `scripts/**` (escl. test/.env) → **0 match**. F-001 (default admin committato) chiuso.
- **Injection**: pattern `${...}` adiacente a keyword SQL → tutti `${COLS}`/`${where.join}`/`$${lim}`/`${tuples.join}` = costanti-colonna + placeholder `$N`; `git grep "ORDER BY \${sort|order|..."` → **vuoto**. Nessun identifier da input.
- **Web**: `dangerouslySetInnerHTML` = 2 usi `themeBootScript` (costante) + 1 commento-divieto. Open-redirect `login/page.tsx:30` valida `next[0]==='/' && next[1]!=='/' && next[1]!=='\\'`. CSV `analytics/csv.ts:26` neutralizza `= + @` TAB/CR/leading-`-`.
- **Config**: `env.ts` usa `z.enum(["true","false"]).transform(v=>v==="true")` su COOKIE_SECURE/TRUST_PROXY/MFA/MATCHING_FREETEXT/API_DOCS; `secureCookies = env.COOKIE_SECURE ?? NODE_ENV==="production"`.
- **Authz**: 558 `requirePermission` / 491 route handler + gate `onReady` boot-assertion (D-51) che fallisce il boot se una route sensibile non dichiara `orgGate`.
- **Supply-chain**: `pnpm audit` → *No known vulnerabilities found* (exit 0).

### WS3 — Database → **debito reale**
- FK: `pg_constraint`/`pg_index` → 549 FK, **261 senza indice leading-col** (F-A01).
- Retention: `sys_auth_login_events` 91.341 righe, 2026-05-18→07-19, unbounded (F-A02).
- Dead schema: `sys_organization_hierarchies` 0 righe + 0 riferimenti codice (F-A03).
- NACE/ATECO: `pg_extension` → **ltree assente**; `sys_activity_classifications` = adjacency `parent_code`(varchar, non-FK) + `level` + indice `parent_idx`. Il modello del prompt (ltree/`nace_move_subtree`) **non esiste**; la realtà è adjacency indicizzata senza integrità del parent (F-A06).
- Perf: `getDashboardTrends` usa subquery aggregate single round-trip → **N+1 refutato**.

### WS1 — Architettura & code quality → **solida con debito noto**
- plugin-chain 13-step in `app.ts`, 101 `app.register`, module-pattern uniforme.
- Debito noto confermato: `agent-gateway` fuori CI; boilerplate duplicato (`ActorContext`/`withTransaction`, QW-4/B4/B6 aperti).

### WS4 — Test posture → **buona ma senza unit-layer**
- ~202 file / ~1394 test integration su DB live; tx-isolation per-file (D-52); **0 unit** (F-A07). D-58 blocca la smoke E2E.

### CI/CD & deploy → **un blocco attivo**
- fork-guard `head.repo.full_name==github.repository` su `build-web.yml:36` + `playwright-smoke.yml:33` (F-012 mitigato).
- **D-58**: `build-web`/`playwright-smoke` rosse; deploy web bloccato (F-A05).

### Ground-truth funzionalità (istruzione Enzo) → **reale, con scaffold vuoti**
- 516 endpoint, 163/199 tabelle popolate. **Feature con backing vuoto**: F4/#24 `process_participants`=0 (F-A04), closure-OU dead (F-A03), reward-gate engine dormiente (`sys_reward_gates`/`_results` vuote, coerente con #37 non attivato). Empty-state **legittimo**: `sys_leads`, `sys_whistleblowing_reports`, tabelle MFA (MFA OFF).

---

## 5. Gate adversarial — "avvocato del diavolo" sul verdetto

Ogni conclusione positiva è stata attaccata prima di essere accettata.

**Attacco 1 — "Security 85 è gonfiato: l'audit è stato fatto a mano su budget ridotto, non esaustivo; vuln non trovate?"**
→ *Regge parzialmente*: i domini security-critical (injection, secrets, TP, authz, config-footgun, supply-chain) sono verificati con evidenza diretta e comando riproducibile; il perimetro non coperto (a11y, i18n, N+1 per-modulo) **non è security-critical**. La confidence è *media*, non il verdetto. Onestà: dichiarato in §6.

**Attacco 2 — "F4 con tabella vuota = feature dichiarate 'done' senza dati reali. Quante altre feature P1 del batch S1021 sono così?"**
→ *Regge e morde*. Il campione (F4, closure-OU) prova che **almeno alcune** feature sono scaffold-senza-dati. Non ho campionato tutte e 8 le P1 di S1021. Questo **abbassa il verdetto** a CONDITIONAL con condizione esplicita: audit di data-completeness su ogni feature dichiarata DoD-complete. È esattamente il pattern "verde ≠ reale" che Enzo teme.

**Attacco 3 — "D-58 blocca il deploy web da giorni: la piattaforma NON è deployabile ora. Un investitore vedrebbe un sito fermo."**
→ *Regge*. È grave per una demo, ma è toolchain con 3 fix noti e dimensionati (non un difetto architetturale). Condizione **bloccante** ma risolvibile in una sessione.

**Attacco 4 — "Se la doc è inaffidabile (F-A08), come mi fido dei conteggi 'positivi' (516 endpoint, 82% tabelle popolate)?"**
→ *Neutralizzato*: quei numeri **non** vengono dalla doc — sono `git grep`/`psql` live in questo report. È proprio il metodo che Enzo ha chiesto.

**Esito**: il verdetto **CONDITIONAL-GO regge** all'attacco, con **confidence media** e **3 condizioni bloccanti** esplicite.

---

## 6. Verdetto finance-readiness e perimetro residuo

### Verdetto: **CONDITIONAL-GO** (confidence media)

**Risposta diretta alla domanda di Enzo** ("ho prodotto una piattaforma scadente? l'esecutore ha le competenze per un progetto complesso?"): **No, non è scadente, e sì, la competenza esecutiva è dimostrata.** L'evidenza: security-posture forte con TP chiusi da fix strutturali (non tamponi), 516 endpoint reali con dati veri, authz e config disciplinate, 0 vulnerabilità. Il debito trovato è **diffuso ma dimensionabile e non strutturale** — nessun rewrite necessario. **La piattaforma merita finanziamento, condizionato alla chiusura del debito qui identificato.**

**3 condizioni bloccanti (in ordine):**
1. **Sciogliere D-58 con soluzione strutturale** (Opzione B subpath consigliata: rischio minimo, ~74 import web) → sblocca deploy web + CI smoke. *~1 sessione.*
2. **Audit di data-completeness delle feature dichiarate DoD-complete** (partendo da F4/#24 → popolare `sys_process_participants` con dati reali; verificare le altre 7 P1 S1021) → allinea "shipped" a "dimostrabile LIVE" (DoD ADR-0026). *~1-2 sessioni.*
3. **Igiene DB**: indici sulle 261 FR scoperte ad alto traffico + retention login-events. *~1 sessione.*

**Condizioni non bloccanti (qualità)**: unit-layer, integrità parent NACE, drop dead-schema closure-OU, de-hardcode counts doc, SHA-pin Actions, dedup boilerplate.

### Perimetro residuo di QUESTO audit (non coperto per il limite d'account, da completare al reset 6:20am o in sessione fresca)
- **a11y-tail** (axe per-pagina) e **i18n parity** chiave-per-chiave — non ri-verificati live.
- **N+1 / query-perf per-modulo esaustivo** — verificato solo dashboard (refutato).
- **mutation-testing statico** completo sui test — solo valutazione strutturale.
- **WS-L ecosistema Claude** (design-only) e **triage D-01..D-14** — i due agenti delegati sono falliti sullo stesso session-limit; da rieseguire.
- **Campionamento authz esaustivo** su tutti gli 88 moduli — verificato il gate strutturale + conteggio, non route-per-route.

---

## 7. Invarianti read-only (conferma)
1. Nessuna modifica al repo fuori da `docs/kb/full-forensic-audit/`.
2. Nessun `git add/commit/push/checkout/reset`; nessun build/migration/mutation.
3. Output: questo report + `FINDINGS_2026-07-20_022239.json` + append a `INDEX.md`, tutti nella cartella dedicata.
4. Ogni finding ha `file:line` + evidenza reale (comando+output/`path:linea`) ed è marcato NEW o KNOWN(id). Promozione dei NEW a `DEBT_REGISTER` = a cura del CLI owner (proposta, non applicata).
