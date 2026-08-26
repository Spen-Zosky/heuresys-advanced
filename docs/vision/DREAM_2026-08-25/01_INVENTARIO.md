# Inventario funzionale — cosa il prodotto è (2026-08-25)

**Fonte integrale**: la tabella completa — 228 capacità, ognuna con stato e prova `file:riga` — vive in [`_raccolta/inventario_raw.md`](_raccolta/inventario_raw.md), costruita leggendo il codice (il codice vince sulla documentazione) e verificata a campione dal verifier (Onda 4). Questo file è la vista d'insieme; per qualunque riga puntuale si apre il raw.

**Conteggi misurati** (2026-08-25, comandi nel raw): 604 route API su 99 file · 102 pagine web di prodotto (120 − 18 showcase) · **228 capacità lato utente: 226 Complete, 2 Parziali** · 20 aree funzionali.

## Le 20 aree, in una riga ciascuna

| area | cosa copre | note |
|---|---|---|
| A. Accesso e sicurezza | login, MFA (TOTP/passkey/email/SMS), sessioni, policy MFA per tenant, matrice ruoli, system-health | email/SMS OTP: chassis pronto, invio reale bloccato |
| B. Presenza pubblica e lead | landing, demo guidata, investors con statistiche live, privacy, whistleblowing pubblico, gestione lead | |
| C. Home e dashboard | widget per ruolo, catalogo famiglie dashboard, home ESS, timeline | |
| D. Anagrafica utenti e ruoli | elenco, dossier completo, modifica identità, assegnazione ruoli, timeline audit | |
| E. Struttura organizzativa | unità CRUD, organigramma interattivo (admin+ESS), mappa processi per unità | |
| F. Posizioni e catalogo ruoli | posizioni con owner≠incumbent, requisiti skill/KPI/learning, famiglie e ruoli professionali | il PIP integrato è API-only (→ 02_LATENTI) |
| G. Competenze e tassonomia | catalogo ~14k skill, tassonomia/alias/gerarchie, ESCO, ricerca semantica AI (attiva in PROD), gap analysis, heatmap | |
| H. Talent review e carriera | nine-box, fit, readiness, successione, posizioni critiche, flight-risk, obiettivi di carriera ESS | |
| I. Performance e OKR | cicli, calibrazioni, valutazioni (consultazione), goal, OKR, KPI CRUD | la conduzione delle campagne è API-parziale (→ P-06) |
| J. Apprendimento e contenuti | moduli/percorsi CRUD, iscrizioni ESS, certificazioni, CMS versionato con publish, handbook ESS | |
| K. Compensation | bande, distribuzione, variable pay (gate/calcoli/pool/regole), peso economico, cedolini ESS | |
| L. Tempo e assenze | richieste ferie ESS + approvazioni, saldi/accrual, analytics presenze/straordinari | timbratura attiva fuori perimetro (coesistenza) |
| M. Approvazioni e notifiche | motore multi-step con decide/apply, inbox ESS, notifiche con preferenze | |
| N. Engagement e survey | sondaggi e pulse (consultazione + compilazione ESS) | authoring: gated su decisione m2b |
| O. Processi, blueprint, org design | blueprint famiglie/varianti/attivazioni, tenant-builder end-to-end, capability composition/maturity/VRIO, org-health, advisor | un difetto reale trovato: enterprise-typing POST/PUT |
| P. Visualizzazioni | grafi salvati con versioni ed export, org-network analytics, workforce analytics | |
| Q. Amministrazione tenant | tenant CRUD, provenance/lineage console, generated-origins, seed acquisition | |
| R. Whistleblowing console | segnalazioni, dettaglio, gestione — isolamento assoluto | |
| S. Portale ESS | profilo/contratti/esperienze, analytics personale, team, gap, matching semantico | |
| T. Strumenti interni | console agente dev (gated, non accendibile oggi) | |

**I due Parziali**: enterprise-typing (la pagina invia POST, la route è PUT → ogni salvataggio fallisce — difetto reale, consegnato al ciclo di sviluppo) · console agente (flag build-time assente da ogni `.env`).

**Correzione post-verifier recepita**: l'export dati (CSV/XLSX/PDF) esiste lato API su ~85 route lista (hook globale `?format=`) ma nessuna pagina lo espone — l'inventario originario non l'aveva censito (F35).
