# Development Lines — Serie E: verticali dal cantiere evo (porting concettuale)

> **Stato**: PROPOSTO — selezione = Enzo. **Provenienza**: sweep legacy:cantiere S1016 su `/home/ubuntu/heuresys.com.evo` (produzione matura: 231 pagine, 1.481 endpoint, jest 3.099; 12 macro-aree presenti lì e ASSENTI in advanced). Regola T2.
> **Perimetro e metodo**: porting **concettuale**, MAI di codice (stack diverso: Express/Prisma vs Fastify/raw-SQL; il legacy usa RLS che advanced VIETA — I5). Il cantiere è la prova che il dominio funziona e la miniera di requisiti; advanced lo ricostruisce col proprio pattern. Ordinate per rapporto valore/effort per l'ICP dichiarato (mid-market EU regolato).

## Le linee

### E1 — Whistleblowing ⭐ (compliance obbligatoria per l'ICP italiano)
- **Perché**: obbligo **D.Lgs 24/2023** per aziende >50 dipendenti — un HRMS italiano senza canale segnalazioni è fuori gara nel segmento regolato; il legacy lo ha (`whistleblowing.ts`).
- **Costruire**: modulo segnalazioni con anonimato garantito, stati, assegnatario, audit; canale di invio FUORI dall'auth ordinaria (anonimato) + console gestione.
- **Webapp**: **NUOVE**: `/whistleblowing` (console gestione, ruoli dedicati) + canale pubblico di invio (route pubblica dedicata, pattern `/v1/leads` per rate-limit/honeypot). ESS: voce informativa in `/me/handbook`.
- **Effort**: ~2-3. **Nota design**: dominio a MASSIMA sensibilità — data-class dedicata, accesso NON per gerarchia org (deroga esplicita da progettare vs ADR-0027: il segnalante non è "visibile" al manager).

### E2 — SSO enterprise (Azure AD / Google OAuth)
- **Perché**: blocker tipico di ogni vendita enterprise/mid-market IT; advanced ha solo login locale + TOTP. Il legacy lo ha con lezione inclusa (fix open-redirect `be6df068`).
- **Costruire**: OIDC (Azure prima, ICP banking IT) con JIT-link a `sys_auth_*` esistenti (I7), MFA policy compatibile.
- **Webapp**: `/login` (bottoni SSO) · `/me/security` (identità collegate) · `/admin/mfa-policy` (esenzioni SSO). Nessuna pagina interamente nuova.
- **Effort**: ~1,5-2.

### E3 — Time & Attendance verticale
- **Perché**: advanced ha GIÀ i dati (attendance 3.180 righe, time_off_* tabelle) e zero feature; il legacy ha il verticale completo (attendance/leave/time-off/overtime/time-analytics).
- **Costruire**: sopra Serie A-L8 (read) → richieste ferie/permessi con submission + approvazione (aggancia B3: handler approvals TIME_OFF!) + saldi/maturazione.
- **Webapp**: **NUOVA** `/me/time-off` (richieste ESS, submission) · `/approvals` (riuso) · `/analytics/attendance` + `/analytics/overtime` (esistenti, si arricchiscono) · **NUOVA** `/attendance` (console admin).
- **Effort**: ~2-3. **Nota**: il write ESS è una decisione prodotto (register #23 la teneva chiusa: "solo consultazione" — questa linea la riapre esplicitamente).

### E4 — Payroll ops (lettura estesa)
- **Perché**: i cedolini ESS ci sono già (F4 S1011, `sys_user_pay_slips` 42); il legacy ha salary-bands, merit-cycles, benefits.
- **Costruire**: salary bands + merit cycle read (import dati dal legacy = incrocio con Serie D) dentro compensation.
- **Webapp**: `/compensation-intelligence` (bande, cicli) · `/me/profile` tab Cedolini (già live). Nessuna pagina nuova.
- **Effort**: ~1-1,5. **Non-goal**: payroll EXECUTION resta fuori (non-goal PRD §2.9 + I8).

### E5 — Recruiting/ATS (il verticale più grande)
- **Perché**: assente del tutto in advanced; il legacy ha il ciclo completo (requisitions, candidates, interviews, offers, job-postings). Apre il modulo "hire" del ciclo H2R.
- **Costruire**: nuovo dominio (schema+moduli+UI): requisition→posting→candidate→interview→offer→onboarding (aggancia posizioni I1: una requisition nasce da una position vacante).
- **Webapp**: **NUOVO cluster** `/recruiting` (pipeline kanban — componente Kanban di @heuresys/ui mai usato!, requisitions, candidate detail, interviste) + posting pubblico (percorso prospect ADR-0026).
- **Effort**: ~5-7 (il più grande del portafoglio; multi-sessione con slice). **Valore**: completa la storia "position-centric hiring" unica sul mercato (una requisition CHE NASCE dal grafo posizioni è il wedge).

### E6 — Pattern portabili (trasversale, quick)
- FilterBuilder/paginate stile ADR-012 legacy → risolve la paginazione hardcoded (con C4) · metodo a11y sistematico del cantiere · anti-pattern da EVITARE già catalogato: status-color data-driven senza contrasto minimo (lezione cantiere).
- **Effort**: assorbito nelle altre serie.

## Webapp impattate (riepilogo serie)

| Pagina | Linee | Nuova? |
|---|---|---|
| **/whistleblowing** + canale pubblico segnalazioni | E1 | **SÌ** |
| /login, /me/security, /admin/mfa-policy | E2 | no |
| **/me/time-off**, **/attendance** | E3 | **SÌ** (+ riuso /approvals, /analytics/*) |
| /compensation-intelligence, /me/profile | E4 | no |
| **/recruiting** (cluster: pipeline, requisitions, candidati, interviste) + posting pubblico | E5 | **SÌ** (cluster) |

## Sequenza raccomandata

E2 (abilitatore vendite, contenuto) → E1 (compliance ICP) → E3 (dati già in casa, riusa B3) → E4 → E5 (programma dedicato multi-sessione). Totale ~12-17 sessioni se tutto (E5 domina).
