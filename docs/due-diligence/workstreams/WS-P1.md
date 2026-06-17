# WS-P1 — Product readiness & GA-gap

> Pilastro P1 (peso 11). Analista: Product/Market (avversariale). HEAD `ce26608` (S994), 2026-06-17. Postura: diavolo dell'investitore. Confidence-cap: P1 senza esercizio live profondo → max banda Adeguato/Forte, no Eccellente (regola DD).

## Sintesi

`heuresys-advanced` è un HRMS funzionalmente **largo e tecnicamente curato**: 75 moduli API / 424 endpoint, 85 pagine web, copertura HRMS quasi completa (org/positions/skills/performance/goals/learning/compensation/succession/engagement/KPI/mentorship), admin SPA + portale ESS (13+ pagine `/me/*`), deployato live in HTTPS (`www.heuresys.com`, login funzionante verificato). La profondità funzionale è reale e superiore alla media di un prodotto single-developer. **Ma "v1.0.0 GA" è una GA tecnica, non commerciale**: il prodotto non ha mai servito un tenant reale, gira su 2 tenant case-study sintetici, e — verificato nel codice e sulla PROD live — **non esiste alcun percorso prodotto per acquisire un cliente**: zero signup, zero pricing, zero onboarding/provisioning self-service, zero trial. È un prodotto *completo come demo*, *non avviato come business*. Il "B" di BPM è solo modeling statico (vedi X1). Per un investitore: l'asset è un codebase HRMS maturo e ben testato che ha però ancora davanti l'intero ultimo miglio commerciale (GTM, multi-tenant onboarding, billing, compliance al primo dato reale).

## Claim del venditore rivalidati

| Claim | Esito | Evidenza |
|---|---|---|
| C1 "v1.0.0 GA, live in PROD HTTPS" | **CONFERMATO (tecnico) / PARZIALE (commerciale)** | WebFetch `https://www.heuresys.com/login`: login HRMS funzionante in IT ("Accedi a Heuresys", "Console di amministrazione e portale dipendente"). Ma **nessun signup/pricing/trial/demo CTA** — login-only per utenti esistenti |
| "Copertura HRMS completa (75 moduli)" | **CONFERMATO** | `ls -d apps/api/src/modules/*/` = 75 moduli; coprono org/positions/skills/performance/goals/learning/compensation/succession/engagement/KPI/mentorship/analytics |
| "Admin SPA + ESS portal shipped" | **CONFERMATO** | `find apps/web/src/app -name page.tsx`: 85 pagine; 19 sotto `/me/*` (ESS: career, skills, kpis, learning, gaps, matching, certifications, documents, handbook, inbox, security, team) |
| "Reporting/export = ZERO" (dossier interno §3.5) | **SMENTITO (a favore del prodotto)** | `apps/api/src/lib/export/hook.ts` + `serializers.ts`: export CSV/XLSX/PDF reale (exceljs+pdfkit) su ~85 list-route via hook `onSend`, RBAC-safe; 6 file di test inclusi `analytics-export.integration.test.ts`, `export-list.integration.test.ts`. **Il dossier interno è obsoleto** |
| "Notification center = nessuno avvisato" (dossier §3.4) | **PARZIALE** | Inbox in-app REALE (`GET/PATCH /v1/me/inbox`, `emitNotification`, dedupe); **email digest = chassis SMTP-gated** (`lib/notifications/digest.ts`: "no-op/log senza creds"). Loop chiuso in-app, NON via email |
| "a11y automatico = zero totale" (POST_V1_ROADMAP R10) | **SMENTITO (parz.)** | `apps/web/tests/e2e/a11y.spec.ts` + `showcase-a11y.spec.ts` esistono. A11y automatico di base presente; tail manuale AAA/screen-reader resta aperto (R10) |
| "0 tenant reali, dati sintetici" | **CONFERMATO** | `count(*) sys.sys_tenancies = 2` (RTL_BANK + Heuresys), 162 user — case-study legacy (ADR-0023) |

## Finding

**P1-001 · GA è tecnica, non commerciale: nessun percorso di acquisizione cliente · High · functional-debt**
Evidenza: PROD live (`www.heuresys.com/login`) è login-only; `grep -riE "stripe|billing|subscription|pricing|checkout|signup"` su `apps/api/src` + `apps/web/src` → 0 match funzionali (solo `AGENT_GATEWAY_SUBSCRIPTION_AUTH` e showcase landing copy). Nessuna pagina `signup/register/onboard/pricing/plan`. 0 tenant reali (`sys_tenancies=2` sintetici).
Impatto: il prodotto non può convertire un visitatore in cliente senza intervento manuale del founder. L'intero motore di go-to-market self-service è da costruire. Per l'investitore: la "GA" non riduce il rischio commerciale, lo sposta solo a valle.
GA-blocker: **sì** (per una GA *commerciale*; no per la GA *tecnica* dichiarata).
Remediation: provisioning self-service + tenant lifecycle + GDPR-at-first-tenant (roadmap §3.1 IBRIDO + 3.9). Effort **XL** (≥L su provisioning, +XL su GTM/billing).
Confidence: Alta.

**P1-002 · Ampiezza e profondità funzionale HRMS genuine · High · strength**
Evidenza: 75 moduli, 424 endpoint, 85 pagine; ESS a 19 pagine; analytics a 10 endpoint (workforce/attendance/compensation/kpi/skills/overtime/org-network) con export. La copertura tocca tutte le aree HRMS attese e diverse aree avanzate (succession pools/candidates/readiness, career-paths, blueprint/operating-models, semantic-matching).
Impatto: per un acquirente è un asset di codice sostanziale — anni-uomo equivalenti di funzionalità HRMS già implementati e testati su DB reale (no mock — invariante di progetto).
GA-blocker: no (è un plus).
Remediation: n/a — preservare. Confidence: Media (ampiezza verificata via inventario route+codice; non esercitata feature-by-feature live da me).

**P1-003 · Il prodotto è più avanti del suo stesso dossier interno (drift documentale cronico) · Medium · risk**
Evidenza: export CSV/XLSX/PDF e a11y test esistono nel codice ma il POST_V1_ROADMAP_DOSSIER §3.4/§3.5/R10 li dà per assenti; baseline counts (moduli/endpoint/test) drifted (D-01, WS-I). 242+ commit direct-to-main dal v1.0.0.
Impatto: la documentazione del venditore sottostima il prodotto in alcuni punti e lo sovrastima in altri (es. "GA") → un investitore non può fidarsi delle SoT senza rivalidazione. Rischio di mis-pricing in entrambe le direzioni.
GA-blocker: no.
Remediation: freeze SoT + re-derivazione al handoff (già pratica). Effort **S**. Confidence: Alta.

**P1-004 · UX maturity non esercitata; un solo flusso utente reale provato (login) · Medium · risk**
Evidenza: non ho esercitato live le 85 pagine; l'evidenza di maturità UX è il codice (TanStack Query, `@heuresys/ui` design-system, live-data-only doctrine, 48 spec Playwright) + login PROD. Empty-state/error-handling reali sono codificati ma non osservati end-to-end da me.
Impatto: la qualità percepita per un HR-admin reale (la metrica che vende un HRMS) resta non misurata indipendentemente.
GA-blocker: no.
Remediation: QA E2E esaustivo multi-ruolo (skill web-qa-audit). Effort **M**. Confidence: Bassa (per design: non esercitato live).

**P1-005 · Single-industry (banking-native) spacciato come piattaforma multi-tenant · Medium · functional-debt**
Evidenza: tassonomia processi/KPI v5 è banking-native (decisione S970); SmartFood/EcoNova (food/energy) NON onboardati per scelta; reference tenant RTL_BANK. Backlog §B-50/process_kpi: keyspace banking `BP-001..011`.
Impatto: il TAM servibile reale oggi è "banche/financial-services IT" non "HRMS generico". Riduce SAM rispetto alla promessa di prodotto orizzontale (vedi P2).
GA-blocker: no (ma vincola il pricing del business).
Remediation: generalizzazione tassonomica multi-industry. Effort **L**. Confidence: Alta.

## Score del pilastro

**Score: 58 / 100 (Debole→Adeguato, limite basso) · Confidence: Media**

Motivazione: il codebase ha profondità e larghezza funzionale HRMS genuine e una GA *tecnica* reale e live (P1-002, C1), il che alza la base ben sopra il "Critico". Ma il pilastro misura *product readiness* per un investitore, e qui il gap dominante è strutturale: la GA dichiarata è tecnica, non commerciale — manca l'intero ultimo miglio (acquisizione cliente, provisioning, billing, compliance-at-first-tenant), confermato sia in codice sia sulla PROD live (P1-001). A questo si somma il vincolo single-industry mascherato da piattaforma (P1-005), il drift documentale che impedisce di fidarsi delle SoT (P1-003) e l'assenza di una verifica UX indipendente (P1-004). Non scendo sotto 55 perché ciò che esiste è sostanziale, testato su DB reale e live; non salgo sopra 60 perché "pronto per il mercato" è semplicemente falso allo stato attuale. Confidence Media (non Alta) per la regola DD: non ho esercitato il prodotto feature-by-feature live.
