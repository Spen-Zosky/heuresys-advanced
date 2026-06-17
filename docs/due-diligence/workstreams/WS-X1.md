# WS-X1 — Functional debt (gap funzionali vs promessa di prodotto)

> Pilastro X1 (peso 5). Analista: Product/Market (avversariale). HEAD `ce26608` (S994), 2026-06-17. Confidence-cap: no Forte/Eccellente né confidence Alta senza evidenza funzionale concreta (uso route/codice reali come evidenza).

## Sintesi

Il debito funzionale di heuresys-advanced ha **una voce dominante che è anche un problema di naming/posizionamento**: il prodotto si chiama HRMS/**BPM**, ma il lato BPM è **solo modeling statico** — verificato: zero process-instance, zero task inbox, zero approvazioni, zero SLA, zero state-machine. Il ruolo `PROCESS_OWNER` esiste nel RBAC ma non ha un runtime da governare. I moduli "blueprint-*" (24 endpoint) sono CRUD su definizioni di processo, non un workflow engine. Gli altri gap storici (export, notification, a11y) sono **in larga parte già chiusi nel codice** — il dossier interno che li elencava come aperti è obsoleto. Restano gap minori e una coda di reconciliation legacy parzialmente terminata per design (no-PII). Per l'investitore: il prodotto mantiene la promessa "HRMS" ma **non** la promessa "BPM" in senso operativo; è un debito di sostanza-vs-nome, non un dettaglio.

## Claim del venditore rivalidati

| Claim | Esito | Evidenza |
|---|---|---|
| C9 "BPM = solo modeling statico, nessun runtime" | **CONFERMATO** | `grep -niE "process.instance|task.inbox|workflow.engine|approval|sla|bpmn|state.machine|transition"` su `modules/blueprint-processes` + `operating-models` → **0 match**. Endpoint blueprint = CRUD definizioni (5+5+5 = families/variants/processes) |
| "Notification: nessuno avvisato" (§3.4) | **PARZIALE/SMENTITO** | Inbox in-app reale (`GET/PATCH /v1/me/inbox`, `emitNotification` con dedupe, `notifySkillGaps`); email digest = chassis SMTP-gated (`digest.ts`) |
| "Export CSV/XLSX/PDF = zero" (§3.5) | **SMENTITO** | `lib/export/hook.ts` + `serializers.ts` (exceljs/pdfkit), hook globale su list-route; test `export-list/analytics-export/export-serializers` |
| "Multi-industry assente, banking-native" | **CONFERMATO** | Tassonomia processi banking-native (S970); SmartFood/EcoNova non onboardati (POST_V1_ROADMAP §1.B) |
| C12 "debt register: 36/37 risolti" | **NON VERIFICATO direttamente qui** (delegato a X3/T3); spot inverso: §3.4/§3.5/R10 chiusi nel codice ma non sempre riflessi nei doc → la contabilità del debito è ottimista sui doc, accurata sul codice |

## Finding

**X1-001 · BPM senza runtime: il prodotto non mantiene la promessa del proprio nome · High · functional-debt**
Evidenza: `grep` su `blueprint-processes`/`operating-models` per process-instance/task/approval/sla/state-machine → 0 match. POST_V1_ROADMAP §3.3 lo confessa: "nessun process-instance, task inbox, approvazioni, SLA — il ruolo PROCESS_OWNER non ha un runtime da possedere". 24 endpoint blueprint sono CRUD di definizioni.
Impatto: chi compra un "HRMS/BPM" si aspetta esecuzione di processi (onboarding workflow, approval chains, escalation/SLA). Qui c'è solo la modellazione. È il gap più grande tra promessa e sostanza; è anche un rischio di reclamo/posizionamento (claim "BPM" non sostanziato).
GA-blocker: no per HRMS; **sì** per qualunque claim "BPM"/process-automation.
Remediation: workflow engine (process-instance + task inbox + approvazioni + SLA). Roadmap lo stima L (ondata-1 #9 / 3.3). Effort **XL**. Confidence: Alta.

**X1-002 · Notification loop chiuso solo in-app; email delivery è un guscio · Medium · functional-debt**
Evidenza: `lib/notifications/digest.ts:7-8` "Email delivery is SMTP-gated... senza creds il mailer è no-op/log → digest è un chassis"; `makeMailer` → ConsoleMailer senza SMTP. Inbox in-app invece reale.
Impatto: la piattaforma calcola flight-risk/skill-gap/matching e li notifica in-app, ma nessuna email proattiva raggiunge l'utente che non apre l'app. Per un HRMS l'email digest è atteso. Gate = solo config SMTP (codice pronto), quindi debito basso-costo.
GA-blocker: no.
Remediation: provisioning creds SMTP (ricette Outlook/Gmail già in `.env.example`). Effort **S** (config) — il codice esiste. Confidence: Alta.

**X1-003 · Export, a11y di base e inbox NON sono più gap (debito già rientrato) · Medium · strength**
Evidenza: export CSV/XLSX/PDF (`lib/export/`), a11y spec (`a11y.spec.ts`, `showcase-a11y.spec.ts`), inbox (`/me/inbox`) tutti presenti e testati. Il POST_V1_ROADMAP §3.4/§3.5/R10 li elenca come aperti → obsoleto.
Impatto: il debito funzionale reale è *minore* di quanto i doc del venditore suggeriscano per queste voci. Plus per l'acquirente, ma sintomo del drift documentale (vedi P1-003/X3).
GA-blocker: no.
Remediation: aggiornare i doc al codice. Effort **S**. Confidence: Alta.

**X1-004 · Reconciliation legacy incompleta (~49%) ma in larga parte terminata per design · Low · tech-debt**
Evidenza: `sys.v_reconciliation_status` = 148 POP / 21 NO_SOURCE / 9 EXCL / 1 REF (baseline); B-50 umbrella; alcuni import LOOKUP_FK falliti (CW-B60-A, ~59% lost su 3 target) non fixati. Trattandosi di dati sintetici no-PII, molti deferred sono terminali-by-design.
Impatto: limitato finché i dati sono case-study; diventa rilevante solo se si onboardano tenant legacy reali (decisione PM). Non un blocker di prodotto.
GA-blocker: no.
Remediation: fix resolver LOOKUP_FK + re-import 3 target (backlog: ~40-60k token, regression risk MED-HIGH, 0 integration test). Effort **M**. Confidence: Media.

**X1-005 · a11y AAA / screen-reader / keyboard-nav manuale assente · Low · functional-debt**
Evidenza: a11y automatico di base presente, ma R10 (POST_V1_ROADMAP): "A/AA automatico... questo è il tail manuale" — AAA + NVDA/VoiceOver + forced-colors non coperti.
Impatto: per vendite enterprise/PA (gare pubbliche IT richiedono accessibilità) è un gap di compliance potenziale. Per SMB meno critico.
GA-blocker: no (dipende dall'ICP).
Remediation: audit a11y manuale. Effort **M** (~6-10h). Confidence: Media.

## Score del pilastro

**Score: 60 / 100 (Adeguato, limite basso) · Confidence: Media**

Motivazione: il debito funzionale è **concentrato e onesto**. La voce dominante (X1-001, BPM senza runtime) è seria perché è un gap promessa-vs-nome, non un dettaglio — e da sola tiene il punteggio lontano dal "Forte". Ma la coda di gap che i documenti del venditore elencavano (export, notifiche, a11y) si è in realtà già chiusa nel codice (X1-003), il che è un segnale positivo di igiene del debito e alza il punteggio sopra la soglia "Debole". Il resto è minore o terminale-by-design (X1-004/005). Non salgo sopra 62 perché un prodotto che si vende come "BPM" senza alcun runtime di processo ha un debito funzionale strutturale; non scendo sotto 55 perché il grosso del debito storico è genuinamente rientrato. Confidence Media: i gap sono verificati nel codice, ma l'esperienza funzionale completa non è stata esercitata live da me.
