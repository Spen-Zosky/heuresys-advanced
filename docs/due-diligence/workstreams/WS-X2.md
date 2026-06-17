# WS-X2 — Legal / IP / Compliance & Data Governance (peso 5)

> Cross-cutting · postura avversariale (il diavolo dell'investitore) · data 2026-06-17 · HEAD `ce26608` (S994).
> Evidenze raccolte con `git`, `pnpm licenses list --prod`, `node` parse del lockfile, Read di codice/ADR/migration, WebSearch normativo. Materiale interno = rappresentazione del venditore, rivalidato con tool reali.

## Sintesi

Il profilo legale di heuresys-advanced è **insolitamente pulito per uno stadio così precoce**, ma riposa interamente su una postura di prodotto — *"case-study sintetico, no-PII by design"* (ADR-0023) — che è un **interruttore on/off**: oggi non c'è alcuna esposizione GDPR/AI-Act, ma il giorno del primo tenant reale **tre prerequisiti non-negoziabili** (base giuridica/retention/diritti interessati + classificazione AI Act + DPA/residency) passano da "0% fatto" a "bloccante". Il venditore lo riconosce esplicitamente e lo ha posizionato come fase additiva gated (roadmap §3.9, GTM ibrido S987) — onestà che riduce il rischio di sorpresa, ma non l'effort residuo.

Sui due fronti verificabili oggi il giudizio è positivo: **(a) IP pulito** — sole-coder, repo proprietario (`LICENSE` All Rights Reserved), nessun contributo terzo non assegnato, nessuna licenza copyleft virale (AGPL/SSPL/GPL-linked) nelle dipendenze di produzione; **(b) AI Act** — il sistema *fa* scoring su dipendenti (flight-risk, succession-readiness, skill-gap) = potenziale Annex III high-risk, MA l'implementazione è **deterministica weighted-linear, NO-ML, fully-explainable, RBAC-gated admin/manager-only** con contributo-per-feature esposto: è esattamente il profilo che le obbligazioni AI-Act per high-risk chiedono di documentare, quindi il gap è di *formalizzazione* (conformity assessment, logging, human-oversight docs), non di *riarchitettura*.

Score: **66/100 (Adeguato)** — non è la 0-exposure di oggi a fare il numero (sarebbe un falso confortante), ma la combinazione "IP pulito + AI Act mitigato per design + tooling GDPR assente ma onestamente gated". Il tetto è imposto dal fatto che *nessun* deliverable GDPR esiste (retention parziale, export grezzo, zero erasure-flow, zero DPA/RoPA/DPIA) → un acquirente che voglia un tenant reale entro 6 mesi deve preventivare l'intero strato compliance.

## Claim del venditore rivalidati

| # | Claim del venditore | Verdetto | Evidenza |
|---|---|---|---|
| C10 | "Nessun tenant reale; dati sintetici no-PII (ADR-0023)" | **CONFERMATO** | `0023_data_source_doctrine.md` §2.3: 1225/1225 `column_mappings` `pii_disposition=NONE`; 2 tenant case-study (RTL_BANK + Heuresys); 0 persone reali. Discovery: 162 users sintetici |
| C10b | "GDPR tooling gated al primo tenant reale" | **CONFERMATO (e coerente)** | `POST_V1_ROADMAP_DOSSIER.md` §3.9 (gated da 3.1); decisione S987 GTM=IBRIDO con GDPR tooling come fondazione additiva, no pilota reale ora |
| Q5 | "IP 100% del founder; OSS deps prevalenti permissive" | **CONFERMATO** | `git shortlog`: 1 solo umano (Enzo Spenuso ⊕ Spen-Zosky, stessa persona/owner) + `dependabot[bot]`. `LICENSE` proprietaria. Licenze prod: 692 MIT / 77 ISC / 32 Apache-2.0 / 16 BSD-3 — 0 copyleft virale |
| Q6 | "`heuresys-evo` legacy = sorgente dati autorizzata, stesso owner" | **CONFERMATO (per dichiarazione) / NON VERIFICABILE indipendentemente** | ADR-0023 + CLAUDE.md dichiarano legacy come fonte autorizzata stesso-owner; non c'è una licenza scritta del legacy nel repo advanced → asserzione del venditore, plausibile ma non documentata qui |
| — | "OCI region = eu-milan-1 (residency EU)" | **CONFERMATO (per config) / PARZIALE** | `.env.example:58` `*.adb.eu-milan-1.oraclecloud.com` (Option C futura); CLAUDE.md region eu-milan-1; VM attuale `80.225.82.207`. Residency EU coerente, ma su VM free-tier personale, non su infra contrattualizzata con DPA |
| — | "AI predictions = ML" (implicito nei materiali marketing) | **SMENTITO (riduce rischio AI-Act)** | `insights/service.ts`: *"DETERMINISTIC weighted-linear rule (NO ML, NO external service)"*; `predictions` module = read-model di valori legacy precomputati, read-only |

## Finding

---

**X2-001 · GDPR-readiness: zero strato compliance operativo (deliberato ma incompleto) · Severità: Alta (condizionale) · Tipo: Compliance/Data-governance**

- **Evidenza:** Scansione `apps/api/src` per retention/erasure/export/anonymize:
  - **Retention**: esiste *una sola* policy — mig `000129_auth_audit_prune.sql` (S993): `DELETE login_events WHERE created_at < now()-'180 days'` (retention forward-policy reale) + `DELETE refresh_tokens revoked OR expired` (cleanup perf-driven). È retention **solo sulle tabelle auth-audit**, motivata come D-18-class anti-bloat; **nessuna retention sui dati business** (`sys.sys_users`, compensation, KPI, attendance). Il pruning è quindi *metà retention, metà performance* — non una data-retention policy GDPR.
  - **Right-to-erasure**: `users/routes.ts:81,134` espone `DELETE` (admin cancella un utente) e `me/routes.ts:263` `DELETE /security/sessions/:familyId` (revoca sessione). **Nessun erasure-flow GDPR** (cancellazione utente + satelliti + audit + cascade verificato; nessun `anonymize`/`pseudonymize` endpoint — coerente con no-PII).
  - **Data-portability**: esiste un export generico `lib/export/hook.ts` (CSV/XLSX/PDF, RBAC-scoped, ~85 list-route) → è un *mattone* riusabile per la portabilità Art. 20, ma non un "scarica i miei dati" per-interessato.
  - **DPA / RoPA / DPIA / base giuridica / informativa**: 0 artefatti nel repo (atteso: no-PII).
- **Impatto:** Finché il prodotto resta case-study, **impatto nullo**. Al primo tenant con dipendenti reali, GDPR diventa prerequisito hard: senza base giuridica, RoPA (Art. 30), retention per-categoria, erasure/portabilità per-interessato (Artt. 17/20), DPIA (Art. 35 — HRMS + scoring = trattamento ad alto rischio), il deploy commerciale è **illegale in UE**. È il singolo gate che "prezza tutte le altre direzioni" (roadmap §3.1).
- **GA-blocker:** **No** per GA tecnica/case-study (stato attuale dichiarato). **Sì** per GA commerciale con tenant reale.
- **Remediation:** Strato GDPR additivo (roadmap §3.9 lo stima M): (1) RoPA + base giuridica per-categoria di dato; (2) retention policy per-tabella business (estende il pattern mig 000129 / D-18); (3) erasure-flow per-interessato (cascade su `sys_users` + satelliti, riusa `withTransaction`); (4) data-export per-interessato (riusa `lib/export`); (5) DPIA template HRMS+scoring; (6) DPA con sub-processor (OCI). **Effort ~M (3-6 sessioni), gated da decisione GTM** — non eseguibile prima del go-to-market (giustamente).
- **Confidence:** Alta.

---

**X2-002 · AI Act: sistema di scoring su lavoratori = potenziale high-risk (Annex III), oggi non classificato/non documentato · Severità: Media · Tipo: Compliance AI**

- **Evidenza:** Il prodotto fa valutazione algoritmica di dipendenti su più moduli: `insights/service.ts` (flight-risk, succession-readiness, skill-gap), `position-succession-relevance`, `successor-readiness`, `succession-pools`, `predictions`. L'EU AI Act **Annex III §4** classifica come **high-risk** i sistemi AI usati in *employment* per "evaluation… of persons in work-related relationships, decisions on promotion/termination, task allocation, monitoring performance". Lo scoring flight-risk/succession cade in questa descrizione.
  - **Fattori mitiganti forti (verificati nel codice):** (a) `insights/service.ts` — *"The 'model' is a DETERMINISTIC, documented weighted-linear rule (NO ML, NO external service)"*; pesi PM-signed-off (tenure .15 / attendance .20 / KPI .25 / engagement .25 / comp .10 / promo .05, Σ=1.0); (b) explainability nativa: `service.ts:159` *"Deterministic scoring: pure function of the raw features (the explainability guarantee)"* + `FlightRiskFeatureContribution` espone il contributo per-feature; (c) `model_version` + `RULE_ID` riproducibili; (d) RBAC-gated admin/manager-only (`insights:view`, D-6) → nessun auto-decisione self-service; (e) `predictions` è read-only su valori legacy precomputati.
  - **Cosa manca per AI-Act compliance:** la *classificazione formale* del rischio, il conformity assessment, il logging/record-keeping Art. 12, la documentazione di human-oversight (Art. 14), la trasparenza verso il lavoratore (informativa che è soggetto a scoring), il fundamental-rights impact assessment (Art. 27).
- **Impatto:** L'AI Act è in vigore (Reg. UE 2024/1689); le obbligazioni high-risk per i sistemi Annex III si applicano progressivamente (deployer obligations da agosto 2026; provider high-risk pieni entro agosto 2027). Per un *case-study* nessuna obbligazione (no deployment reale su persone). Al primo tenant reale, lo scoring su dipendenti attiva obbligazioni da provider+deployer. **L'architettura deterministica/explainable è un asset enorme** — la differenza tra "documentare un sistema già trasparente" e "spiegare una black-box ML" è di ordini di grandezza.
- **GA-blocker:** **No** (case-study). **Sì** per deployment commerciale UE con scoring attivo, ma a basso effort grazie alla mitigazione architetturale.
- **Remediation:** (1) classificare formalmente i moduli scoring vs Annex III §4 (probabile high-risk per flight-risk/succession; skill-gap forse limited-risk); (2) producibile conformity-assessment docs sfruttando l'explainability già presente; (3) human-oversight policy (già RBAC-gated, va documentata); (4) informativa lavoratore + opt-out da decisioni solely-automated (Art. 22 GDPR — già coperto: nessuna decisione è solely-automated, sono advisory admin-gated). **Effort ~M, gated da GTM**, ma molto inferiore a un sistema ML. Nota: il plugin `human-resources-plus` include skill `hr-ai-act-readiness` + `compliance-guard` (Art.22/Art.9/human-in-the-loop gate) → il know-how di compliance è già nell'ecosistema.
- **Confidence:** Media (la classificazione finale Annex III richiede legal counsel; l'evidenza tecnica di mitigazione è Alta).

---

**X2-003 · IP & licenze OSS: profilo pulito, nessun copyleft virale in produzione · Severità: Bassa (asset, non rischio) · Tipo: IP/Legal**

- **Evidenza:**
  - **Titolarità:** `git shortlog -sne` → un solo essere umano: `Enzo Spenuso <enzo.spenuso@outlook.com>` (692) ⊕ `Spen-Zosky <spen.zosky@gmail.com>` (152+1) = stessa persona/owner; unico altro autore = `dependabot[bot]` (32, automazione bump deps). **Zero contributi di terzi non-assegnati** → IP concentrato e pulito (il rovescio è il bus factor, vedi WS-X3).
  - **Licenza repo:** `LICENSE` = proprietaria *"All rights reserved … PROPRIETARY SOFTWARE — NO PUBLIC LICENSE GRANTED"*, con clausola di assegnazione obbligatoria per contributi non sollecitati. Repo pubblico su GitHub ma con licenza che nega esplicitamente l'uso ("viewing for public technical inspection does not constitute a license"). **Coerente con vendita/acquisizione** — l'IP è chiuso, non open-source diluito.
  - **Licenze dipendenze prod** (`pnpm licenses list --prod`): 692 MIT, 77 ISC, 32 Apache-2.0, 16 BSD-3-Clause, 5 BlueOak-1.0.0, 3 Unlicense, 3 BSD-2, 1 Zlib, 1 0BSD, 1 AFL-2.1 — **tutte permissive**. Copyleft trovate (5 entry): tutte benigne — `jszip` `(MIT OR GPL-3.0)` → si sceglie MIT; `dompurify` `(MPL-2.0 OR Apache-2.0)` → Apache; `json-schema` `(AFL-2.1 OR BSD-3)` → BSD; `caniuse-lite` CC-BY-4.0 (dato build-time, non linkato); `@img/sharp-win32-x64` `Apache-2.0 AND LGPL-3.0` (binario nativo libvips dynamically-linked → uso conforme LGPL §4, nessun copyleft sul codice applicativo). **Nessuna AGPL/SSPL/GPL staticamente linkata** → nessun rischio di contaminazione virale per un SaaS commerciale closed-source.
  - **`@heuresys/ui`** = npm-published, stesso owner (Spen-Zosky/ux-design-shared), consumata come dep normale `^0.1.x` → no live-link, no rischio terzi.
- **Impatto:** **Positivo.** Per un acquirente, l'IP è acquisibile in blocco (un solo titolare, licenza chiusa) e il supply-chain OSS non impone obblighi copyleft sul prodotto. Punto debole: la titolarità del *legacy* `heuresys-evo` come data-source è asserita ma non documentata da una licenza scritta nel repo advanced (X2-004).
- **GA-blocker:** No.
- **Remediation:** (1) formalizzare per iscritto il diritto d'uso del legacy `heuresys-evo` (anche solo una nota di proprietà/licenza inter-repo, dato stesso owner); (2) generare un **SBOM** (CycloneDX) + license-attribution file per la due diligence di un acquirente — `pnpm` produce già il JSON, ~1h. **Effort trascurabile.**
- **Confidence:** Alta.

---

**X2-004 · Data residency & sub-processor: EU coerente ma su infra personale free-tier, nessun DPA · Severità: Media (condizionale) · Tipo: Data-governance/Infra**

- **Evidenza:** Runtime su OCI VM `80.225.82.207`, region dichiarata `eu-milan-1` (CLAUDE.md); `.env.example:58` Option C futura `*.adb.eu-milan-1.oraclecloud.com`. La residency è **EU** (positivo per GDPR), ma: (a) la VM è OCI **Free Tier su account personale del founder** (Discovery Q2), non un'infra produttiva contrattualizzata; (b) **nessun DPA** con Oracle come sub-processor nel repo (atteso: no-PII); (c) backup/DR drill esistono (WS-C/T8) ma su stessa region/account. L'`agent-gateway` gira sull'abbonamento **Claude MAX personale** del founder (memoria `project_agent9_subscription_max`) → al primo tenant reale, far passare dati-dipendente reali attraverso un LLM richiede DPA Anthropic + base giuridica + DPIA.
- **Impatto:** Per case-study: nullo. Per tenant reale: la residency EU è metà del lavoro fatto, ma serve migrazione da free-tier-personale a infra contrattualizzata (OCI Managed PG = Option C già prevista) + catena DPA (Oracle + Anthropic se LLM tocca dati reali). Rischio non-tecnico ma di **maturità operativa**.
- **GA-blocker:** No (case-study). Sì-condizionale per tenant reale.
- **Remediation:** Migrazione a Option C (OCI Managed PG EU) + DPA Oracle + DPA Anthropic (se LLM su dati reali) + spostamento agent-gateway da abbonamento personale a API-key/Bedrock/Vertex contrattualizzato (già identificato come scope futuro in `project_agent9_subscription_max`). **Effort M, gated da GTM + funding.**
- **Confidence:** Media.

## Showstopper legali

**Nessuno** per lo stato attuale dichiarato (case-study sintetico, no tenant reale, no-PII verificato 1225/1225 `pii_disposition=NONE`). L'IP è pulito e acquisibile; nessuna licenza OSS contaminante; nessuna PII trattata oggi.

**Condizionali (si attivano al primo tenant reale, tutti dichiarati e gated dal venditore — non occulti):** lo strato GDPR completo (base giuridica/retention/erasure/portabilità/RoPA/DPIA/DPA) e la classificazione+documentazione AI-Act high-risk sono **prerequisiti hard** per il deployment commerciale UE. Non sono showstopper *oggi*, ma un acquirente che pianifichi go-to-market entro 6-12 mesi deve trattarli come work-package obbligatorio e preventivarne l'effort (M ciascuno). L'architettura deterministica/explainable dello scoring **riduce sostanzialmente** il costo AI-Act rispetto a un competitor ML-based.

## Score

**Score: 66/100 — Adeguato · Confidence: Media**

**Motivazione:** IP pulito e acquisibile (sole-owner, licenza proprietaria, 0 copyleft virale) + AI-Act mitigato per design (scoring deterministico/explainable/RBAC-gated, non ML) + no-PII verificato → nessuno showstopper attuale. Il tetto è imposto dall'**assenza totale di strato GDPR operativo** (retention solo auth-audit, zero erasure/portabilità/DPIA/DPA/RoPA) e dalla **non-classificazione AI-Act**: corretti per design oggi (case-study), ma interi work-package al primo tenant reale. Il venditore è **trasparente** su questo (gating esplicito in roadmap §3.9, ADR-0023 §4 "negative/bounded") → premia la governance, non sposticipa il costo. Punteggio non più alto perché un investitore prezza il prodotto *per andare in mercato*, e da case-study a tenant-reale c'è uno strato compliance interamente da costruire. Non più basso perché la fondazione (residency EU, explainability, IP chiuso, know-how compliance già nel plugin HR) è solida e l'effort è additivo-noto, non un buco architetturale.
