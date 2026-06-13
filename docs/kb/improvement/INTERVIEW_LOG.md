# INTERVIEW_LOG — S-100X-0 (2026-06-13)

> Intervista iniziale del programma 100X (gate bloccante §2 del kickoff). 4 temi cardine chiesti via UI (AskUserQuestion), 6 temi a default proposto accettati (correggibili a review). Verbatim delle risposte.

## Temi cardine (risposte UI verbatim)

| # | Tema | Default proposto | **Risposta Enzo** |
|---|---|---|---|
| 1 | Asse "100x" dominante | Robustezza & operability (consigliato) | **Robustezza & operability** |
| 2 | Tolleranza breaking change (API/schema/URL/Zod) | Pubblici intoccabili, interni liberi (consigliato) | **Aperto / radicale** |
| 4 | Appetite radicale | Evoluzione selettiva (consigliato) | **Evoluzione selettiva** |
| 5 | Scope/sequencing | Audit completo, poi decido (consigliato) | **Audit completo, poi decido** |

### Lettura / conciliazione #2 ↔ #4
Enzo ha scelto la massima apertura sui breaking (più del default) MA appetite selettivo. Conciliazione operativa registrata: **nessun contratto pubblico né invariante I1-I14 è pre-sacro** — i dossier POSSONO proporne la rottura — **ma** la postura d'esecuzione di default resta evoluzione selettiva; ogni dossier presenta l'opzione radicale costata e **decide Enzo per-dossier**. Coerente con CLAUDE.md ("invarianti sfidabili solo via dossier").

## Temi a default (accettati, correggibili)

| # | Tema | Default accettato |
|---|---|---|
| 3 | Vincoli ambienti live | PROD live con utenti reali; deploy solo a gate verdi; branch release long-lived ammessi per WS strutturali; niente lavoro diretto su main per cambi strutturali |
| 6 | Compliance | Mantieni ADR-0023 no-PII by-design; GDPR/PII = dossier D-14 gated al primo tenant reale, NON requisito di questa release salvo decisione GTM |
| 7 | Dati | Nessun requisito bit-perfect del DB OCI (migration+seed idempotenti+CI-reproducibili lo garantiscono); aggiungi backup schedulato (R5) come hardening |
| 8 | Storia git | **Intoccabile** (repo pubblico, `.git` sano 23M) — niente rewrite/squash di history; la "squash migration" è un baseline SQL, non un git-rewrite |
| 9 | WS-L ecosistema Claude | Includi come sessione separata **design-only** (skill `claude-ecosystem-optimizer`, da zero come §6); non blocca gli altri WS; priorità extra = bug claude-mem hook |
| 10 | KPI di fine programma | (a) deploy rollback ≤1 cmd + 0 SPOF CI · (b) `/metrics`+auth-counters · (c) CI −50% · (d) unit-layer + integration parallela · (e) footprint −90% · (f) 0 dead-dep/0 env non doc · (g) D-26 risolto (tracked) |

## Note
- I 6 default sono confermabili/correggibili da Enzo alla prima review o in qualsiasi sessione successiva; in assenza di override valgono come sopra.
- D-26 (silent-refresh hard-logout 15min) resta **fuori perimetro** programma (sessione di prodotto dedicata).
