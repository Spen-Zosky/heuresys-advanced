# WS-P4 — AI/LLM business value
Agente: Product/Market (avversariale) | Modello: Sonnet 5 | Data: 2026-09-28
HEAD: `5faa2bc2ca78c40bec603e77df9da176c6971337`

## Sintesi

Rivalidato a oltre tre mesi dalla baseline di giugno (`ce26608`, S994): il quadro di fondo **non è cambiato nella sostanza**. Gli "insights predittivi" restano dichiaratamente **non-ML** ("DETERMINISTIC weighted-linear rule (NO ML, NO external service)", invariato in `insights/service.ts`); il semantic-matching resta AI genuina (Voyage embeddings + kNN pgvector, ancora presente e invariato); la difendibilità resta bassa (dati pubblici ESCO, embeddings di terzo fornitore, regole replicabili). **La novità dei tre mesi è quasi tutta infrastrutturale e interna**: ADR-0040 (2026-09-14) ha spostato il "freno" dell'agente dal tipo di dato all'uso, con un contatore di persone distinte per conversazione e — nel commit più recente della serie, `e14e4856` (2026-09-28) — un diario del write-gate ora interrogabile via tabella `audit.agent_gateway_decisions` invece che solo JSONL su file. È un salto di maturità nella *governance* di un agente che però **resta non distribuito in produzione** (nessuna unit systemd sulla VM), **dietro un flag spento in ogni ambiente** (`/dev/agent`, `NEXT_PUBLIC_ENABLE_AGENT_DEV`), e **autenticato con l'abbonamento personale Claude MAX di Enzo**, non con un modello di auth/billing scalabile per cliente. In tre mesi non è comparsa nessuna feature AI generativa (career-coach, JD generation, narrativa) esposta al cliente finale. L'unico uso AI realmente "di prodotto" nuovo scoperto è `research-propose.ts` (Tenant Builder, #132): estrazione strutturata via LLM da pagine web pubbliche per popolare il fascicolo di una nuova azienda-cliente — bene ingegnerizzato (nessun tool, nessuna decisione autonoma, nessun nome cliente nel prompt) ma è uno strumento di *back-office per l'onboarding*, non un'esperienza AI che il cliente pagante vede o per cui pagherebbe un premio.

## Claim del venditore rivalidati

| Claim | Esito | Evidenza |
|---|---|---|
| "AI/ML: flight-risk/skill-gap/matching/succession" | **PARZIALE → fuorviante su 'ML', invariato da giugno** | `apps/api/src/modules/insights/service.ts:5-7` (letto oggi, HEAD attuale): "The 'model' is a DETERMINISTIC, documented weighted-linear rule (NO ML, NO external service)"; pesi `tenure .15 · attendance/OT .20 · KPI .25 · engagement .25 · comp .10 · promo .05` invariati |
| "pgvector embeddings, Voyage-client" | **CONFERMATO, invariato** | `apps/api/src/modules/semantic-matching/voyage-client.ts`, `backfill.ts:5,11`, `service.ts:18` — `VOYAGE_API_KEY`, `makeEmbedder()` ancora presenti |
| "agent-gateway = capacità AI di prodotto" | **SMENTITO come feature di prodotto shippata, anche a 3 mesi di distanza** | `apps/agent-gateway/README.md` (sezione Status, letta oggi): "**Distribuito — no**: nessuna unit systemd `agent-gateway` sulla VM ... Si accende a mano, dove serve, per la durata di una prova"; `apps/web/src/app/(authenticated)/dev/agent/page.tsx:1-13`: "DEV-only agent console", "Gating: the whole page is behind NEXT_PUBLIC_ENABLE_AGENT_DEV" |
| "l'agente è diventato più capace/più sicuro (governance)" | **CONFERMATO — ma è maturità di governance interna, non nuovo valore per il cliente** | ADR-0040 (`docs/architecture/adr/0040_...md`, 2026-09-14): freno spostato da tipo-dato a uso, contatore persone distinte; commit `e14e4856` (2026-09-28): `DbAuditSink`, tabella `audit.agent_gateway_decisions` (mig `000452`), `sys.v_agente_persone_per_conversazione` |
| "esiste un motore di ricerca web AI per l'onboarding (Tenant Builder, #132)" | **CONFERMATO, ma è tool interno di back-office, non self-service cliente** | `apps/agent-gateway/src/research-propose.ts:1-24`: "riceve del testo e restituisce del JSON", `allowedTools: []`, nessun accesso a `/v1`, nessuna decisione autonoma, nome cliente mai passato; corsa live 2026-08-19 su `bancaditalia.it` citata in `docs/kb/SOT_STATE.md:1075` |
| "feature LLM-generative (career-coach, narrativa, JD generation)" | **SMENTITO, ancora roadmap dopo 3 mesi** | `grep -rn -i "career-coach\|jd-generation\|narrativa.*skill.gap"` su `apps/api/src`, `apps/web/src`: zero risultati |
| "ESCO 21.939 skill = asset dati" | **PARZIALE — numero stantio, il catalogo è stato ripulito** | `docs/kb/SOT_STATE.md`: catalogo sceso a 14.093 dopo scarto di 7.846 "junk-skills" (mig `000160`) e poi a 14.031 dopo ulteriore dedup (mig `000351`); resta comunque dataset pubblico ESCO, non proprietario |

## Finding

**P4-001 · "AI/ML predictions" resta scoring euristico a regole, non machine learning · High · risk (claim overreach) · invariato da giugno**
Evidenza: `apps/api/src/modules/insights/service.ts:5-7` (letto su HEAD attuale, identico a giugno): header dichiara esplicitamente "NO ML"; pesi e soglie hardcoded.
Impatto: il differenziatore "AI/ML" non regge a due diligence tecnica AI-literate; a distanza di 3 mesi nessun investimento è andato a colmare questo gap.
GA-blocker: no.
Remediation: riposizionare come "explainable rule-based scoring" (vedi P4-004) o costruire un modello addestrato reale. Effort **XL**. Confidence: Alta.

**P4-002 · Semantic-matching resta AI genuina e ben ingegnerizzata · Medium · strength · invariato**
Evidenza: `voyage-client.ts`, `backfill.ts`, `service.ts` — stack Voyage+pgvector confermato presente e non modificato in modo sostanziale.
Impatto: resta il pezzo AI realmente vendibile.
GA-blocker: no (plus).
Remediation: n/a. Confidence: Media (qualità dei risultati kNN non misurata con eval, invariato — nessuna nuova evidenza di misurazione trovata in 3 mesi).

**P4-003 · Difendibilità AI resta bassa: embeddings di terzi + dati pubblici + regole replicabili · High · risk · invariato**
Evidenza: nessun modello fine-tuned proprietario trovato (`grep -rn -i "fine-tun|training data|modello addestrato"` su `apps/api/src` e `apps/agent-gateway/src`: zero risultati); ESCO resta dataset pubblico; scoring resta documentato e replicabile.
Impatto: nessun moat AI dopo 3 mesi aggiuntivi di sviluppo. Un competitor con accesso alle stesse API (Voyage/Claude/OpenAI) replica lo stack in settimane.
GA-blocker: no.
Remediation: dati proprietari da outcome reali di clienti (dipende da avere clienti reali paganti, non solo il tenant pilota RTL Bank). Effort **XL**, gated su go-to-market. Confidence: Alta.

**P4-004 · Spiegabilità deterministica resta un asset di compliance (AI Act) · Medium · strength · invariato**
Evidenza: `insights/service.ts` produce ancora `features[]` con contribution/rule_id/model_version; RBAC `insights:view` invariato.
Impatto: per EU AI Act (HR = high-risk), un sistema esplicabile e deterministico resta più difendibile di un black-box ML — plus regolatorio se posizionato correttamente.
GA-blocker: no (plus).
Remediation: documentare come feature di compliance esplicita. Effort **S**. Confidence: Media.

**P4-005 · Tre mesi di investimento AI sono andati quasi interamente in governance interna di un agente non distribuito, non in valore AI per il cliente pagante · High · risk (opportunity cost) · aggiornato da giugno**
Evidenza: ADR-0040 (2026-09-14) + commit `e14e4856` (2026-09-28, "il diario del gate diventa interrogabile") sono lavoro sostanziale e di qualità — ma `apps/agent-gateway/README.md` dichiara ancora "Distribuito — no: nessuna unit systemd sulla VM"; la console è ancora dietro `NEXT_PUBLIC_ENABLE_AGENT_DEV` "spento in ogni ambiente" (`docs/kb/SOT_STATE.md:1534`); l'autenticazione resta `AGENT_GATEWAY_SUBSCRIPTION_AUTH=1` sull'abbonamento Claude MAX personale di Enzo, non un modello API-key/billing per tenant (annotato nello stesso SOT come "PROD-port agente = API key reale/Bedrock/Vertex", mai eseguito in 3+ mesi).
Impatto: per un investitore, il segnale è che il team ha continuato a investire ingegneria AI di alta qualità (sicurezza, audit, RBAC-awareness) in uno strumento che resta interno/dev, invece di chiudere il gap "roadmap→prodotto" già segnalato a giugno. Il rischio di esecuzione sul time-to-market della componente AI-per-il-cliente è più alto oggi, non più basso, perché il debito è aumentato in complessità (nuova tabella audit, nuovo ADR, nuove soglie) senza avvicinarsi al rilascio.
GA-blocker: no (l'AI non è nel percorso critico del GA-gap di prodotto, vedi P1), ma è un blocker per il claim di "valore AI differenziante" verso un investitore.
Remediation: decisione di prodotto di Enzo — o (a) dichiarare esplicitamente che l'agente resta strumento interno/di sviluppo e togliere il claim di valore AI-di-prodotto dal pitch, o (b) pianificare un percorso a produzione (auth per-tenant, billing, unit systemd) con costo e tempo dichiarati. Effort **L** per (b). Confidence: Alta.

**P4-006 · Nuovo: research-propose (Tenant Builder #132) è un accelerator AI reale ma di back-office, non un'esperienza cliente · Medium · strength/functional-debt misto · nuovo dal 2026-08-19**
Evidenza: `apps/agent-gateway/src/research-propose.ts:1-24` — estrazione strutturata via LLM da pagine web pubbliche, con tre guardie esplicite in commento (nessun tool, nessuna decisione autonoma, nome cliente mai passato); corsa live citata in `docs/kb/SOT_STATE.md` (2026-08-19, fascicolo `RTL-BANK-CONFIG`, una pagina di bancaditalia.it, 1 proposta `PASSED`).
Impatto: è un vero risparmio di tempo nell'onboarding di un nuovo tenant enterprise (leggere norme di settore e proporre una configurazione di blueprint) — un differenziatore di vendita B2B legittimo (accelera il ciclo di setup) — ma lo usa il team Heuresys per configurare un cliente, non è una funzione che il cliente stesso vede o paga in più. Il registro backlog mostra passaggi ancora `blocked-on-Enzo`/gated su fonti approvate in date recenti, quindi la sua maturazione a strumento ripetibile non è ancora piena.
GA-blocker: no.
Remediation: se si vuole rivendicarlo come "AI nel prodotto", va esposto come funzione self-service del Tenant Builder per il cliente/partner di implementazione, non solo come strumento interno. Effort **M**. Confidence: Media (stato esatto di chiusura di `#132` non riletto in ogni dettaglio nel tempo a disposizione).

## Score del pilastro

Score: 50 / 100 (Debole) | Confidence: Media

Motivazione: il punteggio resta sostanzialmente stabile rispetto a giugno (52→50), con un lieve arretramento. I due pilastri positivi di giugno reggono invariati — semantic-matching è AI genuina e ben scoped (P4-002), e la spiegabilità deterministica resta un plus di compliance EU (P4-004) — e tengono il punteggio fuori dalla fascia critica. Ma il problema di fondo, la mancanza di un moat AI (P4-003) e l'overclaim "ML" sugli insights (P4-001), è rimasto **del tutto irrisolto** dopo tre mesi. Il lieve arretramento (-2) riflette un fatto nuovo e specifico per un investitore: l'ingegneria AI del trimestre è andata quasi interamente in governance/sicurezza di un agente che **resta non distribuito in produzione, dietro un flag spento e sull'abbonamento personale del fondatore** (P4-005) — un segnale di opportunity cost, non di progresso verso il monetizzabile. L'unico elemento di prodotto AI genuinamente nuovo (P4-006, ricerca web per il Tenant Builder) è reale ma resta uno strumento di back-office interno, non un'esperienza che il cliente pagante sperimenta o per cui pagherebbe un premio "AI". Confidence Media: codice riletto in profondità su HEAD attuale, ma — come a giugno — manca una eval quantitativa della qualità dei risultati AI (kNN matching) e non è stato eseguito un esercizio live end-to-end dell'agente con un utente reale del tenant.
