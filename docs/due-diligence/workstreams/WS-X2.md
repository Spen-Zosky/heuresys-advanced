# WS-X2 — Legal / IP / Compliance & Data Governance
Agente: Cross-cutting (avversariale) | Modello: Claude Sonnet 5 | Data: 2026-09-28
HEAD: `5faa2bc2ca78c40bec603e77df9da176c6971337`

> Rivalidazione della due diligence del 2026-06-17 (HEAD `ce26608`). Evidenze raccolte con `git`, `pnpm licenses list --prod`, lettura diretta di `apps/api/src/modules/gdpr/`, `apps/api/src/lib/scope/mandati.ts`, ADR, e ricerca web per gli aggiornamenti normativi GDPR/AI Act (fonti dichiarate).

## Sintesi

Il salto più rilevante da giugno è tecnico e positivo: il modulo `apps/api/src/modules/gdpr/` (721 righe fra `service.ts`, `repository.ts`, `routes.ts`, più il test `gdpr.integration.test.ts`) è passato da "zero strato compliance" a un'implementazione reale — export dati (Art. 15/20), erasure transazionale con dry-run e guardia sul soggetto attivo (Art. 17), retention sweep, registro richieste interrogabile. In parallelo, una novità normativa reale allenta la pressione: il Digital Omnibus (Reg. UE 2026/1744, adottato 29/6/2026) ha spostato la scadenza per gli obblighi Annex III high-risk dell'AI Act da agosto 2026 a **2 dicembre 2027**, lasciando ad agosto 2026 solo la trasparenza Art. 50 — fonti: techjacksolutions.com, Morgan Lewis, regulation-ai.eu (vedi Finding X2-002). Resta però un difetto concreto e auto-documentato nel codice: il ruolo `DPO`, appena introdotto (migrazione `000423`, mandato K), riceve via RBAC il permesso `gdpr:retention` ma il service-layer lo respinge comunque con 403 `PLATFORM_ONLY` — un mandato creato per la compliance che non può eseguire l'unica azione GDPR di sua competenza dichiarata. RoPA, DPIA e DPA restano a zero artefatti formali, coerente con lo stato "case-study, nessun tenant con dipendenti reali" ma da preventivare per intero al primo cliente vero.

## Claim del venditore rivalidati

| # | Claim | Esito | Evidenza |
|---|---|---|---|
| C10b | "GDPR tooling = 0, gated al primo tenant reale" | **SMENTITO (superato in positivo)** | `apps/api/src/modules/gdpr/{service.ts,repository.ts,routes.ts}` (721 righe) + `gdpr.integration.test.ts` (491 righe secondo l'indagine): export, erasure transazionale con dry-run, retention sweep, registro `sys_gdpr_requests` |
| — | "IP pulito, sole-owner, 0 copyleft virale" | **CONFERMATO, invariato** | `git shortlog -sn --all`: 2656 Enzo Spenuso + 173 Spen-Zosky (stessa persona) + 15 dependabot; `LICENSE` proprietaria; `pnpm licenses list --prod`: profilo permissivo invariato (MIT/ISC/Apache-2.0/BSD-3 dominanti), nessuna AGPL/SSPL |
| — | "AI Act mitigato per design (scoring deterministico, no ML)" | **CONFERMATO, rafforzato** | `insights/service.ts` invariato (weighted-linear, explainable); in più ADR-0040 (2026-09-14) ha introdotto governance umana sull'agente (contatore persone-distinte, ponte di approvazione sulle letture, diario interrogabile — commit `e14e4856`, HEAD-3), coerente con gli obblighi di trasparenza/human-oversight Art. 12/14 AI Act |
| — | "Deadline AI Act high-risk imminente (agosto 2026)" | **SUPERATO da novità normativa** | Digital Omnibus (Reg. UE 2026/1744, 29/6/2026): scadenza Annex III high-risk spostata al 2/12/2027; resta ad agosto 2026 solo la trasparenza Art. 50. Fonti: https://techjacksolutions.com/ai-brief/eu-ai-act-annex-iii-december-2-2027-deadline-confirmed/, https://www.morganlewis.com/pubs/2026/06/changes-to-eu-ai-act-deadlines-what-it-means-for-employers-and-hr-technology-providers, https://www.regulation-ai.eu/en/annex-iii/ |
| — | "Residency EU su VM personale free-tier, nessun DPA" | **CONFERMATO, invariato** | Nessuna evidenza di migrazione a infra contrattualizzata; `agent-gateway` resta su abbonamento Claude MAX personale (decisione presa, non gap tecnico, ma resta gap DPA/sub-processor se toccasse dati reali) |
| — | "Nessun tenant reale, dati no-PII by design (ADR-0023)" | **CONFERMATO** | Nessuna evidenza contraria; postura invariata |

## Finding

**X2-001 · Strato GDPR tecnico shippato: export, erasure, retention, registro richieste · Low · strength**
Evidenza: `apps/api/src/modules/gdpr/service.ts` (179 righe), `repository.ts` (450 righe), `routes.ts` (92 righe); dry-run su erasure, guardia sul soggetto ancora ACTIVE, transazionalità, registro `sys_gdpr_requests` rileggibile; copertura del registro dati estesa (indicata dall'indagine come passata da 27 a tutte le 71 FK rilevanti secondo `docs/kb/SOT_STATE.md`).
Impatto: colma il gap più grave rilevato a giugno; è un asset per un acquirente che voglia muoversi verso un tenant reale.
GA-blocker: no.
Remediation: nessuna correttiva; capitalizzare mantenendo i test verdi. Effort **—**. Confidence: Alta.

**X2-002 · Difetto RBAC/service sul ruolo DPO: permesso concesso, azione negata · Medium · antipattern**
Evidenza: `apps/api/src/lib/scope/mandati.ts:21-24,71-74` — commento esplicito nel codice: "`DPO` (R-2, migration 000423) NON entra in `GDPR_MANDATE_ROLES`... hanno lo stesso permesso RBAC `gdpr:retention` ma lo stesso 403 `PLATFORM_ONLY` da `runRetention` (difetto preesistente, registrato in REGISTRO_SCOPERTE, non risolto qui)"; `GDPR_MANDATE_ROLES` = `Set(["PLATFORM_ADMIN"])` (riga 74).
Impatto: il ruolo DPO, introdotto esplicitamente per la governance dati, non può eseguire l'unica azione GDPR di sua competenza dichiarata (retention). Al primo DPO reale onboardato, è un blocco operativo immediato, non solo un'incoerenza cosmetica.
GA-blocker: no oggi (nessun DPO reale); sì se un DPO viene onboardato prima della correzione.
Remediation: allineare `runRetention` al mandato dichiarato (ammettere `DPO`) oppure restringere il permesso RBAC per coerenza. Effort **S**. Confidence: Alta (auto-documentato nel codice, non inferito).

**X2-003 · RoPA / DPIA / DPA: zero artefatti formali · Medium (condizionale) · Compliance/Data-governance**
Evidenza: nessun documento dedicato trovato sotto `docs/` per Registro dei Trattamenti (Art. 30), Data Protection Impact Assessment (Art. 35), o Data Processing Agreement con i sub-processor (OCI, Anthropic).
Impatto: nullo per lo stato attuale (case-study, no-PII, ADR-0023). Diventa prerequisito hard e non aggirabile al primo tenant con dipendenti reali: senza RoPA/DPIA/DPA il deployment commerciale UE non è legale.
GA-blocker: no per case-study; sì per GA commerciale con tenant reale.
Remediation: RoPA per-categoria di dato, DPIA template per HRMS+scoring (riusando l'explainability già presente in `insights/service.ts`), DPA con Oracle (residency) e con Anthropic (se l'agent-gateway tocca dati reali). Effort **M**, gated da decisione GTM. Confidence: Alta.

**X2-004 · AI Act: scoring su lavoratori, mitigato per design ma non classificato formalmente · Medium · Compliance AI**
Evidenza: `insights/service.ts` — modello deterministico weighted-linear, pesi PM-signed-off, `FlightRiskFeatureContribution` espone il contributo per-feature, RBAC-gated (`insights:view`); nessuna classificazione formale vs Annex III §4 presente nel repo.
Impatto: se e quando lo scoring viene attivato su dipendenti reali, l'architettura esplicativa riduce di ordini di grandezza il costo di conformità rispetto a un sistema ML black-box, ma la classificazione formale, il conformity assessment e la documentazione di human-oversight restano da produrre. La proroga al 2/12/2027 (Digital Omnibus) toglie urgenza mantenendo comunque l'obbligo.
GA-blocker: no oggi; sì-condizionale per deployment commerciale UE con scoring attivo, con effort ridotto grazie alla mitigazione architetturale.
Remediation: classificazione formale dei moduli di scoring, conformity-assessment doc, policy di human-oversight (già RBAC-gated, va scritta). Effort **M**, gated da GTM. Confidence: Media (la classificazione finale richiede legal counsel).

**X2-005 · IP e licenze OSS: profilo pulito, invariato · Low · strength**
Evidenza: `git shortlog -sn --all` conferma titolarità unica (2656+173 commit stessa persona, 15 dependabot); `pnpm licenses list --prod` conferma assenza di copyleft virale in produzione.
Impatto: positivo per un acquirente — IP acquisibile in blocco, nessun rischio di contaminazione da dipendenze OSS.
GA-blocker: no.
Remediation: generare un SBOM (CycloneDX) per la due diligence di un acquirente futuro. Effort **S**. Confidence: Alta.

**X2-006 · Residency EU su infra personale, nessun DPA con i sub-processor · Medium (condizionale) · Data-governance/Infra**
Evidenza: nessuna evidenza di migrazione della VM OCI da free-tier personale a infra contrattualizzata; `agent-gateway` su abbonamento Claude MAX personale del founder.
Impatto: nullo per case-study; per un tenant reale serve migrazione a infra contrattualizzata + DPA Oracle + DPA Anthropic (se l'LLM tocca dati reali).
GA-blocker: no oggi; sì-condizionale per tenant reale.
Remediation: migrazione a OCI Managed PG EU (Opzione C già prevista in `.env.example`) + catena DPA. Effort **M**, gated da GTM e funding. Confidence: Media.

## Score del pilastro

Score: **71 / 100 (Adeguato, verso Forte)** | Confidence: Media

Motivazione: il delta rispetto a giugno (66 → 71) è ancorato a un fatto verificato nel codice: lo strato GDPR tecnico è passato da assente a implementato con transazionalità, dry-run ed export/erasure reali (X2-001), e la normativa AI Act si è mossa a favore del venditore allentando la scadenza di 16 mesi (X2-004). Il punteggio non sale oltre 71 perché resta un difetto concreto e auto-documentato sul ruolo DPO (X2-002, GA-blocker se onboardato prima della fix) e perché RoPA/DPIA/DPA restano a zero artefatti (X2-003) — corretto per lo stato attuale di case-study, ma un intero work-package da preventivare al primo tenant reale. Nessuno showstopper legale oggi: l'IP resta pulito e l'assenza di PII è coerente con la postura dichiarata (ADR-0023). Confidence Media perché la classificazione AI Act finale e l'entità esatta del gap RoPA/DPIA richiedono validazione legale che esula dagli strumenti di questa sessione.
