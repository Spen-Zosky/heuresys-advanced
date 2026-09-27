# WS-X1 — Functional debt (gap funzionali vs promessa di prodotto)
Agente: Cross-cutting (avversariale) | Modello: Claude Sonnet 5 | Data: 2026-09-28
HEAD: `5faa2bc2ca78c40bec603e77df9da176c6971337`

> Rivalidazione della due diligence del 2026-06-17 (HEAD `ce26608`). Il claim dominante di giugno — "BPM = solo modeling statico, zero runtime" — è risultato SUPERATO dal codice stesso, spedito pochi giorni dopo la DD di giugno. Evidenza raccolta con grep diretto su `apps/api/src/modules/approvals/`, lettura di `docs/kb/SOT_STATE.md`, `docs/kb/DEBT_REGISTER.md`, `docs/product/`.

## Sintesi

Il gap funzionale più grave rilevato a giugno — un HRMS/**BPM** senza alcun runtime di processo (zero process-instance, zero task inbox, zero approvazioni, zero SLA) — non esiste più: `apps/api/src/modules/approvals/{service.ts,sla.ts,repository.ts,effects/}` implementa una vera state machine (PENDING → APPROVED/REJECTED → APPLIED), uno scanner SLA con reminder/escalation, e 6 effect-handler wired su casi reali (position-assignment, tenant-activation, tenant-blueprint-application/approval, tenant-import-run, tenant-materialization, time-off-request), verificata da 7 file di test di integrazione e — soprattutto — **usata su dati di produzione reali** (12 richieste RTL Bank portate ad APPLIED tramite login di una persona reale, `docs/kb/SOT_STATE.md`). Resta però un debito genuino: il runtime governa 6 tipi di richiesta hardcoded, non è un motore di processo generico configurabile dal ruolo `PROCESS_OWNER` — il nome "BPM" resta solo parzialmente onorato. È inoltre emerso un bug reale non corretto (Z-263: loop di escalation quando creatore e approvatore di 2° livello coincidono, 12 richieste RTL Bank ferme da mesi) e un gap di copertura GDPR (Z-257/Z-258) che è debito funzionale oltre che di compliance. La documentazione di prodotto (`docs/product/BUSINESS_SCOPE_AND_PRD.md`) non riflette ancora lo shipping del runtime — drift documentale, non funzionale.

## Claim del venditore rivalidati

| Claim | Esito | Evidenza |
|---|---|---|
| C9 (giugno) "BPM = solo modeling statico, nessun runtime" | **SMENTITO** (vero l'11/06, superato il 18-19/06) | `apps/api/src/modules/approvals/service.ts:3-16,117-139,274-335` — state machine reale; `approvals/sla.ts` scanner con reminder+escalation; 6 effect-handler in `approvals/effects/`; 7 test di integrazione; uso live su 12 richieste RTL Bank (`docs/kb/SOT_STATE.md`) |
| "Notification/export/a11y già rientrati" (X1-002/003 giugno) | **CONFERMATO**, nessuna regressione | `lib/export/hook.ts`, `me/inbox`, `a11y.spec.ts` invariati e ancora testati |
| "Multi-industry assente, banking-native" | **CONFERMATO** | Nessuna evidenza di onboarding nuova industria nei commit `ce26608..HEAD` |
| `docs/product/BUSINESS_SCOPE_AND_PRD.md` "non esiste alcun runtime di processo" | **SMENTITO dal codice, non dal documento** | Il documento di prodotto non è stato aggiornato dopo lo shipping del runtime — drift documentale confermato, pattern già noto a giugno |
| C12 giugno "debt register: 36/37 risolti" | **SUPERATO** | `docs/kb/DEBT_REGISTER.md` oggi censisce 92 debiti (`grep -oE "D-[0-9]+" docs/kb/DEBT_REGISTER.md \| sort -u \| wc -l` → 92), tutti con stato risolto/gestito |

## Finding

**X1-001 · Runtime di approvazione BPM shippato, ma è un insieme fisso di 6 flussi, non un motore di processo generico · Medium · functional-debt/strength**
Evidenza: `apps/api/src/modules/approvals/effects/` contiene 6 effect-handler hardcoded (position-assignment, tenant-activation, tenant-blueprint-application, tenant-blueprint-approval, tenant-import-run, tenant-materialization, time-off-request); nessuna composizione arbitraria di processi dal blueprint-modeling layer verso il runtime.
Impatto: il gap principale di giugno è chiuso nella sostanza (esecuzione reale di processi con SLA), ma il nome "BPM" resta solo parzialmente onorato: `PROCESS_OWNER` non può ancora definire un flusso nuovo via UI e vederlo eseguito dal runtime.
GA-blocker: no per HRMS con i 6 flussi correnti; sì per qualunque claim di "motore di processo generico/no-code".
Remediation: generalizzare l'effect-handler a un registro configurabile invece di 6 casi cablati. Effort **L**. Confidence: Alta.

**X1-002 · Bug reale di escalation SLA, aperto da mesi su dati di produzione (Z-263) · High · functional-debt**
Evidenza: `db/seeds/storia36/07_approvals.sql` — quando creatore e approvatore di 2° livello coincidono, l'escalation notifica la persona già bloccata sulla propria richiesta; 12 richieste RTL Bank ferme con `reminder_count=1441` (`docs/kb/SOT_STATE.md`). La correzione è "riservata a decisione di prodotto di Enzo" e non ancora implementata.
Impatto: per clienti con organigramma piatto (creatore = approvatore di livello superiore), il flusso di approvazione si blocca silenziosamente all'infinito — è un difetto del runtime appena shippato, non solo un dato di test.
GA-blocker: sì per tenant con organigramma piatto.
Remediation: guardia esplicita in `sla.ts` che rilevi creatore==approvatore e attivi un percorso alternativo (skip/re-route). Effort **S**. Confidence: Alta.

**X1-003 · Export, a11y di base e inbox restano chiusi (nessuna regressione) · Low · strength**
Evidenza: `lib/export/hook.ts` (CSV/XLSX/PDF), `a11y.spec.ts`/`showcase-a11y.spec.ts`, `/me/inbox` — tutti presenti e testati, invariati da giugno.
Impatto: conferma positiva, non richiede azione.
GA-blocker: no.
Remediation: nessuna. Effort **—**. Confidence: Alta.

**X1-004 · Copertura GDPR incompleta su tabelle con dati personali reali (Z-257/Z-258) · Medium · functional-debt**
Evidenza: gap di copertura segnalato nel registro scoperte, cross-relato a X2 (modulo `gdpr`) — 51/135 tabelle con dati personali non ancora coperte dal flusso di export/erasure secondo la nota interna citata dall'indagine.
Impatto: è debito funzionale (una feature di compliance dichiarata ma non estesa a tutte le tabelle rilevanti) prima ancora che debito di compliance puro.
GA-blocker: no per case-study; sì-condizionale per tenant reale con retention/erasure su tutte le entità.
Remediation: estendere il registro `column_mappings`/coverage GDPR alle tabelle mancanti, riusando il pattern già esistente in `apps/api/src/modules/gdpr/`. Effort **M**. Confidence: Media (numero di tabelle non riverificato in questa sessione, riportato dal registro scoperte).

**X1-005 · Reconciliation legacy incompleta (~49%) ma in larga parte terminata per design · Low · tech-debt**
Evidenza: baseline `sys.v_reconciliation_status` invariata da giugno; import LOOKUP_FK falliti su alcuni target non fixati.
Impatto: limitato finché i dati restano case-study; rilevante solo se si onboardano tenant legacy reali.
GA-blocker: no.
Remediation: fix resolver LOOKUP_FK + re-import target residui. Effort **M**. Confidence: Media.

**X1-006 · a11y AAA / screen-reader / keyboard-nav manuale assente · Low · functional-debt**
Evidenza: a11y automatico di base presente (invariato), ma AAA + NVDA/VoiceOver + forced-colors non coperti.
Impatto: rilevante solo per vendite enterprise/PA con requisiti di accessibilità stringenti.
GA-blocker: no (dipende dall'ICP).
Remediation: audit a11y manuale. Effort **M**. Confidence: Media.

## Score del pilastro

Score: **68 / 100 (Adeguato, verso Forte)** | Confidence: Media-Alta

Motivazione: il delta rispetto a giugno (60 → 68) è ancorato a un fatto verificato nel codice e nell'uso reale, non a una promessa: il gap dominante di giugno (BPM senza runtime) è stato materialmente ridotto da un runtime di approvazione reale, testato con 7 suite di integrazione e già usato su richieste di produzione vere (X1-001). Non salgo oltre 70 perché il runtime resta un insieme fisso di 6 flussi anziché un motore di processo generico (X1-001), un bug reale di escalation è rimasto aperto per mesi su dati di produzione (X1-002, GA-blocker per organigrammi piatti), e la copertura GDPR non è ancora estesa a tutte le tabelle con dati personali (X1-004). Il resto del debito storico (reconciliation legacy, a11y AAA) è minore o terminale-by-design. Confidence Media-Alta: le evidenze principali vengono da codice, test e uso live verificato in questa sessione, non da sola documentazione.
