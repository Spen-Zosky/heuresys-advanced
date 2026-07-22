# Audit coerenza per-user (ruolo organizzativo ↔ dati collegati) · S1025 · 2026-07-22

> Mandato Enzo S1025: per OGNI user del DBMS verificare (a) ruolo organizzativo assegnato,
> (b) coerenza/realismo di tutti i dati collegati con quel ruolo, con standard da ricerca
> web per il tipo di azienda del tenant (RTL Bank = banca retail regionale italiana,
> CCNL Credito; Heuresys System = software house italiana, CCNL Commercio).
> Correzioni applicate in `db/seeds/rtl-banking-skills/` (tutte idempotenti, UUID v5).

## §1 Standard di riferimento (ricerca web 2026-07-22)

**CCNL Credito — tabelle dal 01/03/2026** (rinnovo 23/11/2023, 4ª tranche; fonte
ccnlbancari.it): mensile ×13 ⇒ RAL tabellare minima per livello:

| Livello | RAL tabellare | Livello | RAL tabellare |
|---|---|---|---|
| QD4 | 67.081 | 3A3L | 39.773 |
| QD3 | 57.159 | 3A2L | 37.575 |
| QD2 | 51.551 | 3A1L | 35.650 |
| QD1 | 48.662 | Area Unificata | 32.233 |
| 3A4L | 43.445 | Dirigente | CCNL dedicato |

**Benchmark di mercato per ruolo** (Michael Page / Glassdoor / Indeed / talent.com /
Jobbydoo, RAL k€): teller ~31 · risk analyst 30-50 · risk manager 34-61 · compliance
45-65 · dealer/treasury specialist 32-75 · treasury manager 45-120 · internal auditor
30-50 (head 60-100) · legal counsel 44-72+ · relationship manager 31-80 · direttore
filiale piccola 42-47, media/grande QD3-4 60-80 · settore RAL media 73,1.

**Standard di carriera** (settore bancario ITA): QD3/QD4 ⇒ età ≥ 35, anzianità ≥ 8 anni;
Dirigente ⇒ età ≥ 42, anzianità ≥ 10; CRO ~80-85% del CEO in una banca regionale.

## §2 Verifica (a) — ogni user ha un ruolo organizzativo

162 → 163 utenti. Dopo i fix: **0 persone reali senza catena assignment→posizione→OU**.
- 2 catene ROTTE riparate (#70): alice.esposito (CRO, assignment ENDED mai sostituito
  dal seed S1024 — riattivata) + alberto.colombo (Securities Dealer, idem).
- chiara.spenuso (HEURESYS, Head of Product con contratto ma SENZA posizione) →
  assegnata a POS-00000003.
- Creato il fondatore reale `enzo.spenuso@heuresys.com` (**credential-less**: nessuna
  identità auth, non può fare login) su POS-00000001 "CEO & Founder" (vacante).
- Restano senza posizione SOLO account tecnici: `admin@heuresys.com` (piattaforma) e
  `platform.admin@heuresys.com` (DEACTIVATED) — corretto per design.

## §3 Verifica (b) — coerenza dati↔ruolo: findings e fix

| # | Finding (misurato live) | Fix | Dove |
|---|---|---|---|
| 1 | 26 contratti RTL **sotto il minimo CCNL** (22×3A1L, 4×3A2L) | RAL = tabellare + 300-1.500 € deterministici | `seed_ccnl_floors.sql` |
| 2 | 6 ruoli chiave vacanti (CRO, Head Treasury/Audit/Legal/Marketing, dealer) | riassegnazioni interne per seniority/affinità; band MG-1 alle 4 posizioni head | `seed_key_roles_coverage.sql` |
| 3 | manager OU incoerenti (IT Director su DIV-RISK; Retail Director su DIV-MKT; CRO su DIV-LEGAL) + lead team disallineati | manager/lead = head effettivo; membership aggiornata | idem |
| 4 | 4 job_title contratto ≠ titolo posizione (promossi Blocco C con titolo stantio) | sync titolo ← posizione (rule-based) | `seed_user_role_coherence.sql` |
| 5 | 8 outlier età/anzianità (Bank Manager 26-31enni con 2-3 anni; Operations Director 33enne; CEO 37enne) | shift coerente birth/hire/seniority/start del solo deficit (floors §1) | idem |
| 6 | CRO 211k ≈ CEO 212k | CRO → 178k (~84% CEO) | idem |
| 7 | 33 righe employment (salary/pay_scale_level) disallineate dal contratto | sync employment ← contratto (ultimo step) | idem |
| 8 | inquadramenti HEURESYS: COO "Quadro", Head of Product "Livello 2" | COO → Dirigente, HoP → Quadro (CCNL Commercio) | `seed_ccnl_floors.sql` |
| 9 | catalogo learning: **6.454 righe junk** (completamenti/rating/raccomandazioni legacy ingeriti come "moduli", title=code illeggibile) — 0 referenze | purge con archivio (`audit.learning_junk_archive`) | mig `000197` |
| 10 | 21 career path residuo-test ("Test Auth Path"/"test", presenti GIÀ nel legacy e importati fedelmente) — 0 referenze | purge con archivio | mig `000198` |
| 11 | **0 skill richieste con formazione collegata** (skill bancarie Blocco B senza moduli) | 15 moduli bancari reali (temi ABIFormazione: AML, MiFID II, credito/NPL, risk, Basilea, IFRS 9, PSD2, tesoreria, private, ESG, trade finance, audit, core banking, cyber/DORA) + mapping completo | `seed_banking_learning_catalog.sql` |
| 12 | payload gap = array nudo (rompeva Zod → **500** su `/v1/learning-gaps/analysis-results`) | shape canonica `{skill_gaps:[...]}` + provenance PSR `banking-seed-v1` | `seed_banking_skills.sql` |
| 13 | righe orfane nei punteggi flight-risk/skill-gap quando un soggetto esce dalla coorte | prune su recompute PLATFORM (fix API) | `modules/insights` |
| 14 | dedup 000189: 2 skill referenziate da 132 evidenze avevano perso categoria/gruppo | eredità categoria+gruppo dall'archivio dedup + unique index ripristinato | mig `000196` |

## §4 Findings NON corretti (registrati, decisione rinviata)

- **85 KPI con suffisso numerico** ("NPS clientela retail 1..6"): NON junk — sono il
  layer template blueprint W2 (85/100 org-unit KPI templates, metric-def 1:1, unità
  diverse per variante, 0 target RTL). Solo leggibilità dei nomi; eventuale rename in
  una passata dedicata.
- **DIR-RISKM** (Direzione Risk Management): lead/manager ancora da rivedere (candidata
  naturale: martina.gentile, Risk Analyst più senior della direzione) — richiede
  decidere se promuoverla; lasciato al prossimo giro.
- **Combo titolo di studio↔ruolo** talvolta insolite (es. "MSC LUISS in Lettere" per un
  bancario): atenei reali e coerenza d'insieme buona; raffinamento a bassa priorità.
- **Doppio Operations Director** nella stessa OU (bianchi + caputo): tollerato (director
  + deputy plausibile); eventuale ridisegno con #68.

## §5 Validatore ripetibile

I check di questo audit sono ri-eseguibili via SQL (sezioni post-condition dei seed).
Invarianti ora garantiti fail-loud a ogni ri-esecuzione: minimi CCNL rispettati ·
titolo contratto = titolo posizione · floor età/anzianità per inquadramento ·
employment sync contratto · 1 solo PRIMARY ACTIVE per user · 0 utenti-con-dati senza
catena OU · lead team = manager OU · ogni skill richiesta ha formazione collegata ·
ogni PSR ha provenance dichiarata.
