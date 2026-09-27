# WS-T7 — AI/LLM technical robustness
Agente: Engineering (avversariale) | Modello: Claude Sonnet 5 | Data: 2026-09-28
HEAD: `5faa2bc2ca78c40bec603e77df9da176c6971337`

> Rivalidazione della due diligence T7 di giugno (HEAD `ce26608`, 2026-06-17). ~1978 commit di delta. Metodo: grep/read su HEAD attuale + query live pgvector via tunnel SSH :5433 (sola lettura). Nessuna scrittura su codice/DB.

---

## Sintesi

I tre strati identificati a giugno restano gli stessi, ma **3 dei 4 finding Medium/High sono stati risolti** con evidenza concreta. Il substrato di semantic matching (pgvector + Voyage) è **più usato** che a giugno (HNSW scan skill 363→1.157, occupation 597→2.965) e il catalogo skill è stato risanato (21.939→14.031 dopo pulizia junk, cross-ref WS-T5). I modelli di insights scoring restano deterministici weighted-linear — la caratterizzazione "AI/ML" resta parzialmente fuorviante come a giugno, ma ora con un layer aggiuntivo (write-gate a 3 livelli, incluso un tetto sulle letture di massa per persone distinte, ADR-0040 R2) che rafforza la postura di compliance EU AI Act/GDPR Art.22.

Il **gap architetturale principale resta invariato**: l'agent-gateway continua a girare sulla subscription Claude MAX personale del founder (`AGENT_GATEWAY_SUBSCRIPTION_AUTH=1`), non su una API key commerciale — confermato ancora "non distribuito" nel proprio README (nessuna unit systemd). Non è un GA-blocker oggi (nessun cliente reale), resta un prerequisito obbligatorio al primo deploy commerciale, esattamente come giudicato a giugno.

Le remediation di giugno effettivamente eseguite: **T7-003** (VOYAGE_API_KEY ora nella denylist di `env-key-merge.sh:39`) e **T7-004** (il timer di reindex ha ora `OnFailure=heuresys-unit-failure@%n.service`, S1029 — il fallimento silenzioso non è più possibile) sono **chiuse**. **T7-007** (CI coverage agent-gateway) è **chiusa**: lint/test/typecheck del gateway girano ora in workflow dedicati (`lint.yml`, `typecheck.yml`), con un commento esplicito che documenta il "prima" (fuori da ogni workflow). Restano aperti: **T7-002** (zero eval/golden-set per il kNN, verificato invariato — 0 hit su `eval|golden|fixture.*embedding`), **T7-006** (EMBED_DIM=1024 ancora senza commento sul vincolo dimensionale) e naturalmente **T7-001** (subscription personale). La suite di test dell'agent-gateway è cresciuta da 47 a **154 assert `it(`/`test(`** su 12 file — un segnale di investimento continuo nel gateway nonostante resti un pilota.

---

## Claim del venditore rivalidati

| Claim | Esito | Evidenza |
|---|---|---|
| pgvector embeddings in produzione, HNSW attivo | CONFERMATO (uso cresciuto) | `pg_extension` vector **0.8.5** (era 0.8.2); scan HNSW skill **1.157** (era 363), occupation **2.965** (era 597), job_role/user_profile **0/0** (invariato) |
| voyage-4-lite, dim 1024, ~22k skill embedded | CONFERMATO CON DELTA SPIEGATO | `sys_skill_embeddings`: **14.031** righe `model_id=voyage-4-lite` (era 21.939 — sceso dopo pulizia 7.846 junk record, mig `000160`, cross-ref WS-T5); copertura resta **100%** (14.031/14.031 skill) |
| Flight-risk / succession / skill-gap scoring live | CONFERMATO — con lo stesso caveat di giugno | `sys_flight_risk_scores`=176, `sys_succession_readiness_scores`=468, `sys_skill_gap_scores`=156; `insights/service.ts:5` commento invariato: *"The 'model' is a DETERMINISTIC, documented weighted-linear rule (NO ML, NO...)"* |
| Agent SDK gateway con HITL write-gate | CONFERMATO (rafforzato) | `write-gate.ts` ora dichiara **3 livelli**: allowlist deny-by-default, read/write split, e (nuovo da giugno) un **tetto sulle letture di massa** per persone-distinte oltre cui anche una lettura richiede conferma umana (ADR-0040 R2, #252) — non presente a giugno |
| Agent-gateway su subscription MAX personale, non commerciale (T7-001, giugno) | **CONFERMATO invariato** | `apps/agent-gateway/src/subscription-auth.ts` (nuovo modulo dedicato, S1029 — refactor da `server.ts:44` per un bug di ordine di import: gli ESM sono hoisted, quindi la `delete` di `server.ts` arrivava troppo tardi); README del gateway dichiara esplicitamente "distribuito: NO — nessuna unit systemd, misurato" |
| VOYAGE_API_KEY assente dalla denylist di `env-key-merge.sh` (T7-003, giugno) | **SMENTITO oggi — risolto** | `scripts/env-key-merge.sh:39`: denylist ora include esplicitamente `VOYAGE_API_KEY` |
| Reindex timer: fail silenzioso non monitorato (T7-004, giugno) | **SMENTITO oggi — risolto** | `deploy/systemd/heuresys-advanced-reindex.service`: `OnFailure=heuresys-unit-failure@%n.service` presente, con commento S1029 che spiega il perché |
| Agent-gateway CI coverage non verificata end-to-end (T7-007, giugno) | **SMENTITO oggi — risolto** | `.github/workflows/lint.yml:97-101` e `typecheck.yml:96-99`: job dedicati `pnpm --filter @heuresys/agent-gateway run {lint,test,typecheck}`, con commento esplicito sul "prima" (fuori da ogni workflow) |
| Nessun eval/golden-set per la qualità del kNN (T7-002, giugno) | CONFERMATO invariato | `grep -rniE "eval|golden|fixture.*embedding" apps/api/test/*.ts` → 0 hit rilevanti (stesso esito di giugno) |
| `voyage-4-lite` hardcoded, dimension lock-in non documentato (T7-006, giugno) | CONFERMATO invariato | `voyage-client.ts:9-10`: `EMBED_DIM = 1024`, `VOYAGE_MODEL = "voyage-4-lite"` — nessun commento sul vincolo di migrazione schema in caso di switch a dimensione diversa |
| Modulo `predictions`: read-only legacy, nessun modello attivo (T7-008, giugno) | CONFERMATO invariato | `predictions/service.ts:4`: *"READ-ONLY: legacy precomputed predictive-analytics values exposed as-is. No writes."* |

---

## Finding

### T7-101 — RISOLTO: reindex timer ora con alerting su fallimento (era T7-004, Medium)
- **Severità**: Info (era Medium)
- **Tipo**: strength (era risk)
- **Evidenza**: `deploy/systemd/heuresys-advanced-reindex.service` — `OnFailure=heuresys-unit-failure@%n.service` (commento: "S1029: senza questo, un fallimento notturno resta invisibile finche' qualcuno non guarda `systemctl --failed` per caso").
- **Impatto**: Chiude il rischio di obsolescenza silenziosa del substrato embedding.
- **GA-blocker**: N/A
- **Confidence**: Alta

### T7-102 — RISOLTO: `VOYAGE_API_KEY` ora nella denylist di propagazione env (era T7-003, Medium)
- **Severità**: Info (era Medium)
- **Tipo**: strength (era risk)
- **Evidenza**: `scripts/env-key-merge.sh:39` include `VOYAGE_API_KEY` nella denylist esplicita.
- **Impatto**: Chiude il rischio di propagazione additiva di una chiave dev/staging verso la VM prod.
- **GA-blocker**: N/A
- **Confidence**: Alta

### T7-103 — RISOLTO: agent-gateway ora in CI dedicata (era T7-007, Low)
- **Severità**: Info (era Low)
- **Tipo**: strength
- **Evidenza**: `.github/workflows/lint.yml` e `typecheck.yml` eseguono `pnpm --filter @heuresys/agent-gateway run {lint,test,typecheck}`; suite cresciuta a **154** assert su 12 file (`write-gate.test.ts` 29, `persone-distinte.test.ts` 22, `audit-sink.test.ts` 17, `write-gate-soglia-letture.test.ts` 17 — nuovo file, non esisteva a giugno).
- **Impatto**: Le regressioni nel write-gate HITL sono ora catturate automaticamente ad ogni push.
- **GA-blocker**: N/A
- **Confidence**: Alta

### T7-001 (invariato) — Agent-gateway su subscription Claude MAX personale: prerequisito obbligatorio al primo deploy commerciale
- **Severità**: High
- **Tipo**: risk (compliance/ToS)
- **Evidenza**: `apps/agent-gateway/src/subscription-auth.ts` — modulo dedicato (refactor S1029 da un bug di module-hoisting che rischiava di rendere inefficace la `delete` della chiave); `AGENT_GATEWAY_SUBSCRIPTION_AUTH=1` documentato in `.env.example:284-292`; il README del gateway dichiara esplicitamente "distribuito: NO — nessuna unit systemd, misurato" (D-91, DEBT_REGISTER).
- **Impatto**: Invariato da giugno — al primo cliente reale l'agente non può essere acceso su questa architettura senza una API key Anthropic (o Bedrock/Vertex) a pagamento, con conseguente costo AI da budgetare.
- **GA-blocker**: No (nessun cliente oggi), prerequisito commerciale
- **Remediation**: Invariata — procurare API key Anthropic pay-per-use o AWS Bedrock/GCP Vertex prima del primo cliente reale. Effort: S (configurazione) + decisione di budget.
- **Best-practice ref**: Anthropic Commercial Terms; serving commerciale richiede API key dedicata
- **Confidence**: Alta

### T7-002 (invariato) — Nessun eval/golden-set per la qualità del retrieval kNN
- **Severità**: Medium
- **Tipo**: functional-debt / ML rigor
- **Evidenza**: 0 hit su `eval|golden|fixture.*embedding` in `apps/api/test/`; il substrato embedding è cresciuto in uso (scan HNSW 3-8× più frequenti) senza che sia comparsa una misura di recall@K o precision.
- **Impatto**: Nessuna regressione di qualità (es. dopo un cambio di modello Voyage, o dopo la pulizia dei 7.846 junk-skill che potrebbe aver alterato la distribuzione dei vicini) verrebbe catturata dal CI. Il rischio è cresciuto in proporzione all'uso reale della feature.
- **GA-blocker**: No
- **Remediation**: Invariata — 5-10 golden test su un profilo seed RTL_BANK con top-K atteso da un esperto di dominio. Effort: S-M.
- **Best-practice ref**: MTEB benchmark practice
- **Confidence**: Alta

### T7-003 (invariato, ex T7-005) — Label "AI/ML" sui modelli di scoring deterministici resta parzialmente fuorviante
- **Severità**: Medium
- **Tipo**: risk (claim accuracy)
- **Evidenza**: `insights/service.ts:5,48` — commento invariato che dichiara esplicitamente il modello come regola deterministica pubblica, non ML.
- **Impatto**: Invariato da giugno — un investitore che legge "AI/ML scoring" nella narrativa commerciale si aspetta un modello addestrato; il delta percepito resta un rischio reputazionale in pitch, mitigato dalla piena spiegabilità (asset EU AI Act).
- **GA-blocker**: No
- **Remediation**: Solo narrativa — documentare come "explainable rule-based scoring". Effort: zero codice.
- **Confidence**: Alta

### T7-004 (invariato, ex T7-006) — `EMBED_DIM=1024` hardcoded senza commento sul vincolo dimensionale
- **Severità**: Low
- **Tipo**: tech-debt / vendor lock-in
- **Evidenza**: `voyage-client.ts:9-10`, nessun commento sul costo di un eventuale switch a modello con dimensione diversa (richiederebbe migration schema sui 4 indici HNSW da 372+43 MB di dati vivi, cross-ref WS-T5).
- **Impatto**: Rischio basso e stabile (i modelli Voyage compatibili restano tutti a 1024-dim), ma la documentazione mancante resta un piccolo debito di manutenibilità invariato da giugno.
- **GA-blocker**: No
- **Remediation**: Invariata — commento da 15 minuti nel file sorgente e nella migration che crea `vector(1024)`. Effort: S.
- **Confidence**: Alta

### T7-005 (nuovo, asset) — Write-gate esteso a un tetto sulle letture di massa (ADR-0040 R2)
- **Severità**: Info (asset)
- **Tipo**: strength
- **Evidenza**: `write-gate.ts` — terzo livello aggiunto da giugno: le letture allowlisted auto-consentite "fino alla soglia alta di persone distinte" oltre la quale anche una lettura si ferma e richiede conferma umana (#252, ADR-0040 R2); nuovo file `write-gate-soglia-letture.test.ts` (17 test) e moduli dedicati `persone-distinte.ts`/`soglie-persone.ts`.
- **Impatto**: Riduce il rischio che un agente esegua una query di lettura massiva su dati sensibili di molte persone senza supervisione — un gap che il modello HITL di giugno (limitato alle sole write) non copriva.
- **GA-blocker**: N/A
- **Confidence**: Alta

### T7-006 (nota, non un finding) — Riferimento di pricing/modello di giugno (`claude-opus-4-8`) non trovato nel codice attuale
- **Severità**: Info
- **Tipo**: correzione di nota
- **Evidenza**: `grep -rn "claude-opus\|claude-sonnet\|model.*:.*\"claude"` in `apps/agent-gateway/src/*.ts` e `.env.example` → 0 hit di un nome-modello hardcoded; il gateway non fissa un modello nel codice, eredita quello attivo della sessione CLI/subscription.
- **Impatto**: La tabella di costo AI stimato di giugno (basata su `claude-opus-4-8`) va considerata una stima indicativa dell'epoca, non un parametro di configurazione verificabile nel codice — non è possibile validare un costo-per-sessione specifico da questo audit senza una misura diretta di token consumati.
- **GA-blocker**: N/A
- **Confidence**: Media

---

## Score del pilastro

Score: 71 | Confidence: Alta

Motivazione: 3 dei 4 finding Medium/Low di giugno relativi a operatività e supply chain sono chiusi con evidenza concreta (denylist VOYAGE_API_KEY, alerting sul reindex, CI coverage del gateway), e il write-gate ha guadagnato un livello di sicurezza aggiuntivo sulle letture di massa che non esisteva a giugno — segnale di investimento continuo e coerente nella robustezza del pilastro AI. Il substrato embedding è più maturo (dati risanati, uso reale 3-8× cresciuto). Il punteggio resta in banda "Adeguato" alta perché il gap strutturale più importante — l'agent-gateway su subscription personale, non commercializzabile — è **esattamente invariato** da giugno (confermato "non distribuito" dal README stesso), e il gap di eval/golden-set sul kNN è cresciuto in rilevanza pratica proprio perché l'uso della feature è aumentato senza che sia comparsa una misura di qualità. La caratterizzazione "AI/ML" per gli score deterministici resta un rischio di percezione investitore non affrontato nella narrativa (anche se il codice è onesto al riguardo).

---

*Comandi di riproduzione (HEAD `5faa2bc2ca78c40bec603e77df9da176c6971337`, tunnel SSH :5433 attivo):*
```bash
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT extversion FROM pg_extension WHERE extname='vector';"
# → 0.8.5

psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT model_id, count(*) FROM sys.sys_skill_embeddings GROUP BY model_id;"
# → voyage-4-lite | 14031

psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "
  SELECT indexrelname, idx_scan FROM pg_stat_user_indexes JOIN pg_class i ON i.oid=indexrelid
  WHERE schemaname='sys' AND i.relname LIKE '%hnsw%';"
# skill: 1157 · occupation: 2965 · job_role: 0 · user_profile: 0

grep -n "VOYAGE_API_KEY" scripts/env-key-merge.sh                 # denylist, riga 39
grep -n "OnFailure=" deploy/systemd/heuresys-advanced-reindex.service
grep -rn "agent-gateway" .github/workflows/lint.yml .github/workflows/typecheck.yml
grep -rniE "eval|golden|fixture.*embedding" apps/api/test/*.ts    # 0 hit rilevanti
```

*Audit read-only — nessuna modifica a codice/CI/deploy, zero scritture DB. Output: solo questo file WS-T7.md.*
