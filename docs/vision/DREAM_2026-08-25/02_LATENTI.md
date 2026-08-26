# Funzionalità latenti — costruite e non raggiungibili (2026-08-25/26)

**Fonte integrale**: [`_raccolta/latenti_raw.md`](_raccolta/latenti_raw.md) (misure psql+grep del 2026-08-25) **corretta dai verdetti del verifier** ([`_raccolta/verifier_verdetti.md`](_raccolta/verifier_verdetti.md)). I conteggi di righe vive sono evidenza datata del 25-08: prima di trasformarne uno in esecuzione, si rimisura (PUNTO FISSO).

**Correzioni del verifier recepite qui** (la lezione di metodo: «zero occorrenze nel web» non basta — serve il secondo controllo «chi altro lo importa?» e «esiste il pezzo che dovrebbe consumarlo?»):
- La ricerca semantica free-text NON è latente: è **accesa in produzione** (voce #40 DONE). Rimossa dall'elenco.
- I 316 node-layouts salvati NON sono «a una pagina di distanza»: **non esiste un canvas** che possa onorarli (il renderer è Mermaid, che calcola le posizioni; un canvas interattivo è lavoro cross-repo in `ux-design-shared`).
- `research` e `reference-sync` NON sono latenti: hanno **consumer non-web** (import da 3 moduli + CLI canonica).
- L'**export dati** è una latente in più che il raccolto non aveva: motore completo su ~85 route (`?format=csv/xlsx/pdf`), zero pagine che lo espongono (F35).

## Le latenti che valgono, con la distanza dall'utente

| cosa | dati vivi (25-08) | distanza | proposta |
|---|---|---|---|
| **Position Intelligence Profile** — GET `/:id/intelligence-profile` senza chiamanti (solo test) | VIEW pronta | una pagina | P-13 (**MUST-T2**) |
| **Mentorship** — 17 route CRUD complete | 5 programmi, 63 rapporti, 150 sessioni | una pagina admin (+ modulo `/v1/me/*` nuovo per l'ESS, ADR-0011) | P-20 |
| **Console GDPR admin** — data-map, richieste, export/erasure/retention | 8 richieste, 85 righe data-map | una pagina — MA 3 route su 5 sono distruttive: guardie obbligatorie | P-14 |
| **Export dati** — hook `?format=` su ~85 route + export analytics dedicato | — | un bottone e la scelta formato | P-29 |
| **Predictions read-model** — 4 GET (registro modelli + predizioni) | 4 modelli, 468 predizioni — **SOT le qualifica "precomputed legacy": rimisurare la provenienza prima di mostrarle** | una pagina, dopo la verifica | P-15 |
| **Sentinelle qualità** — 2 viste vive mai lette dall'API | 161 posizioni con gap critici · 43/45 unità con violazioni | un endpoint + card in org-health — dopo la bonifica dati RTL | P-17 |
| **Broadcast admin** — POST invio + GET audit | — | una pagina | P-23a |
| **Deleghe di mandato** — 4 route | 0 righe (mai esistita una UI per crearne) | una pagina | P-24 |
| **Authoring valutazioni** — assessments 4 route, results 3, methods 1; review-cycles con POST e transition | — | il flusso di campagna: scrivere una review e creare una scala NON hanno endpoint | dentro P-06 |
| **Authoring survey** — modulo 12 route | — | **GATED**: scrive sul cluster JSONB che l'ESS non legge (decisione m2b di Enzo) | P-07 |
| **Prometheus /metrics** — fasi 1-4 + collector systemd già in repo | — | accendere il flag (decisione fase 5 di Enzo) | P-25 |
| **Email (digest, EMAIL_OTP)** — chassis+timer pronti | — | credenziale SMTP: voce #39 già in HOLD con motivo — non si ripropone | — |
| **SMS OTP** — factory sempre ConsoleSms | — | un ramo mai scritto (provider reale): non è un flag, è codice nuovo | — |
| **Role CRUD** — assente anche in API («lands in MVP-3») | 14 ruoli, 224 permessi, 980 mapping in lettura | rotte di scrittura + UI + invalidazione cache RBAC (oggi boot-only) + convivenza con 76 INSERT della catena | P-05 |

## Il triage che resta

31 moduli senza consumer web (elenco nel raw). Criterio deciso in V11 (P-27), a **tre esiti**: entra in una proposta · ha un **consumer non-web** dichiarato · si ritira formalmente (ADR-0035: il costo si misura in file da emendare). Il triage è lavoro del ciclo di sviluppo, dopo questo ciclo.
