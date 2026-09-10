# B15 — Censimento: gli endpoint che nessuna pagina chiama

**Generato da** `docs/kb/tools/censimento_endpoint_senza_pagina.py`, che lo ri-deriva
dall'atlante e si rifiuta di girare se l'atlante non e' fresco. **Non modificare a mano**:
si rilancia. Un censimento battuto a tastiera e' vero il giorno che lo scrivi e falso
poco dopo — bastano due rotte nuove, ed e' successo il giorno stesso in cui e' nato
questo file, con il modulo `branches`.

⚠ **Questo censimento non costruisce niente e non chiede di costruire niente.** La scelta
di cosa fare per prima torna a Enzo.

## I numeri

| | |
|---|---|
| Endpoint che **nessuna pagina chiama** | **290** |
| Endpoint chiamati da almeno una pagina | 179 |
| Riferimenti di pagina che non trovano una rotta | 2 |

### Una seconda misura, che cambia la natura della decisione

Dei moduli che compaiono qui, **54** hanno gia' almeno una pagina che li
chiama e **il resto no**. Non e' un dettaglio: un endpoint di un modulo gia' servito e'
l'**ampliamento** di una pagina che esiste — la direzione che Enzo ha dettato, «allargare
cio' che c'e' senza creare doppioni». Un endpoint di un modulo che nessuna pagina chiama e'
un **dominio intero senza interfaccia**, e costa un lavoro di un altro ordine. La colonna
«il modulo» della tabella lo dice riga per riga.

### Come si distribuiscono le tre etichette

| etichetta | quanti | cosa vuol dire |
|---|---|---|
| `serve-una-pagina` | **219** | nessuna regola li copre: sono quelli su cui decide Enzo |
| `non-serve` | 21 | il destinatario non e' una persona: sonde, servizio, amministrazione di piattaforma |
| `serve-altrove` | 50 | li consuma l'agente, un'integrazione o un lavoro programmato |

## I riferimenti di pagina che non trovano una rotta

⚠ **GUARDATI UNO PER UNO il 2026-09-10, e il verdetto e': l'atlante ha un buco, le pagine
stanno bene.** Nessuno dei due e' un endpoint: sono `<Link href=...>` di NAVIGAZIONE fra
pagine — `/content/[id]` porta al dettaglio di un documento (chiamato da `content/page.tsx`
e da `blueprints/[variantId]/page.tsx`), `/leads` alla pagina dei contatti. L'estrattore
dell'atlante li raccoglie perche' somigliano a un percorso di API, ma nessuna delle due
pagine sta chiamando una rotta che non esiste. Le rotte vere ci sono e hanno un prefisso
diverso (`/v1/content`, `/v1/leads`, registrate in `app.ts`).

**Non e' stato corretto qui**: toccare l'estrattore dell'atlante e' un lavoro suo, con la
sua prova, e questo blocco e' un censimento. Registrato come scoperta fuori ciclo.

- `/content/[id]`
- `/leads`

## Il censimento, per modulo

| modulo | metodo | percorso | etichetta | il modulo | perche' |
|---|---|---|---|---|---|
| `activity-classification-mappings` | — | `/v1/activity-classification-mappings` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `activity-classification-mappings` | — | `/v1/activity-classification-mappings/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `activity-classifications` | — | `/v1/activity-classifications/:param` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `advisor` | — | `/v1/advisor/audit` | **serve-altrove** | amplia una pagina | raccomandazioni prescrittive: le consuma l'agente |
| `analytics` | — | `/v1/analytics/:param/export` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `assessment-methods` | — | `/v1/assessment-methods` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `assessment-results` | — | `/v1/assessment-results` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `assessment-results` | — | `/v1/assessment-results/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `assessments` | — | `/v1/assessments` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `assessments` | — | `/v1/assessments/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `auth` | — | `/v1/auth/admin/revoke-user/:param` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/admin/users/:param/sessions` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/email-otp/enroll` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/email-otp/resend` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/email-otp/resend-login` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/email-otp/verify-setup` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/enroll` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/enroll-confirm` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/enroll-confirm/resend` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/factors` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/factors/:param` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/login` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/logout` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/me` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/mfa/admin/revoke-user/:param` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/mfa/admin/users/:param/sessions` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/mfa/email-otp/resend-login` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/mfa/login` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/mfa/logout` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/mfa/me` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/mfa/password-reset/complete` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/mfa/password-reset/request` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/mfa/recovery-codes` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/mfa/refresh` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/mfa/role-permissions` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/mfa/sessions/current` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/mfa/sms-otp/resend-login` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/mfa/verify-login` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/password-reset/complete` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/password-reset/request` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/recovery-codes` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/refresh` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/sms-otp/enroll` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/sms-otp/resend` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/sms-otp/resend-login` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/sms-otp/verify-setup` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/verify-login` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/verify-setup` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/webauthn/authentication/options` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/webauthn/authentication/verify` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/webauthn/registration/options` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `auth` | — | `/v1/auth/webauthn/registration/verify` | **serve-altrove** | amplia una pagina | flusso di autenticazione: lo guida il client (login, rinnovo, CSRF, secondo fattore), non una pagina che chiama un dato |
| `blueprint-activations` | — | `/v1/blueprint-activations/:param` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `blueprint-families` | — | `/v1/blueprint-families/:param` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `blueprint-overrides` | — | `/v1/blueprint-overrides` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `blueprint-overrides` | — | `/v1/blueprint-overrides/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `blueprint-processes` | — | `/v1/blueprint-processes/:param` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `branches` | — | `/v1/branches` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `branches` | — | `/v1/branches/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `calibration-sessions` | — | `/v1/calibration-sessions/:param` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `calibration-sessions` | — | `/v1/calibration-sessions/:param/discussions` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `candidate-applications` | — | `/v1/candidate-applications` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `candidate-applications` | — | `/v1/candidate-applications/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `candidates` | — | `/v1/candidates` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `candidates` | — | `/v1/candidates/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `capability-composition` | — | `/v1/capability/composition/:param/:param` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `capability-composition` | — | `/v1/capability/composition/recompute` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `capability-composition` | — | `/v1/capability/maturity/org-units/:param` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `capability-composition` | — | `/v1/capability/maturity/recompute` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `career-path-steps` | — | `/v1/career-path-steps` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `career-path-steps` | — | `/v1/career-path-steps/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `career-paths` | — | `/v1/career-paths` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `career-paths` | — | `/v1/career-paths/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `compensation` | — | `/v1/compensation/bonus-pools` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `compensation` | — | `/v1/compensation/handoff-records` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `compensation` | — | `/v1/compensation/objective-reward-rules` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `compensation` | — | `/v1/compensation/payout-curves` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `compensation` | — | `/v1/compensation/position-economic-weight` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `compensation` | — | `/v1/compensation/profiles/:param` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `compensation` | — | `/v1/compensation/recommendations` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `compensation` | — | `/v1/compensation/reward-gates` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `compensation` | — | `/v1/compensation/variable-pay` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `content` | — | `/v1/content/:param/media` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `content` | — | `/v1/content/:param/publish` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `content` | — | `/v1/content/:param/return-to-draft` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `content` | — | `/v1/content/:param/submit-for-review` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `content` | — | `/v1/content/:param/unpublish` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `content` | — | `/v1/content/media/:param` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `content-blueprint-links` | — | `/v1/content-blueprint-links/by-process` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `dashboard` | — | `/v1/dashboard/catalog/:param` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `delegations` | — | `/v1/delegations` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `delegations` | — | `/v1/delegations/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `delegations` | — | `/v1/delegations/:param/revoke` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `engagement` | — | `/v1/engagement/templates` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `engagement-feedback` | — | `/v1/engagement-feedback` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `engagement-feedback` | — | `/v1/engagement-feedback/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `engagement-feedback` | — | `/v1/engagement-feedback/action-plans` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `engagement-feedback` | — | `/v1/engagement-feedback/action-plans/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `enterprise-size-bands` | — | `/v1/enterprise-size-bands/:param` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `enterprise-typing-profiles` | — | `/v1/enterprise-typing-profiles/:param` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `evidence` | — | `/v1/evidence/for-score` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `evidence` | — | `/v1/evidence/subject/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `gdpr` | — | `/v1/gdpr/data-map` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `gdpr` | — | `/v1/gdpr/requests` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `gdpr` | — | `/v1/gdpr/retention/run` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `gdpr` | — | `/v1/gdpr/users/:param/erasure` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `gdpr` | — | `/v1/gdpr/users/:param/export` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `generated-origins` | — | `/v1/generated-origins` | **non-serve** | amplia una pagina | registro dell'origine delle righe generate: diagnostica |
| `goals` | — | `/v1/goals` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `goals` | — | `/v1/goals/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `goals` | — | `/v1/goals/:param/alignments` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `goals` | — | `/v1/goals/:param/check-ins` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `goals` | — | `/v1/goals/:param/comments` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `goals` | — | `/v1/goals/:param/milestones` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `goals` | — | `/v1/goals/:param/timeline` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `goals` | — | `/v1/goals/:param/updates` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `goals` | — | `/v1/goals/templates` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `insights` | — | `/v1/insights/users/:param/flight-risk` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `interview-feedback` | — | `/v1/interview-feedback` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `interview-feedback` | — | `/v1/interview-feedback/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `interviews` | — | `/v1/interviews` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `interviews` | — | `/v1/interviews/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `job-offers` | — | `/v1/job-offers` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `job-offers` | — | `/v1/job-offers/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `job-postings` | — | `/v1/job-postings` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `job-postings` | — | `/v1/job-postings/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `job-requisitions` | — | `/v1/job-requisitions` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `job-requisitions` | — | `/v1/job-requisitions/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `kpi-definitions` | — | `/v1/kpi-definitions/:param/measurements` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `kpi-definitions` | — | `/v1/kpi-definitions/:param/metrics` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `kpi-definitions` | — | `/v1/kpi-definitions/assessment-methods` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `kpi-definitions` | — | `/v1/kpi-definitions/weighting-rules` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `leads` | — | `/v1/leads` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `learning-gaps` | — | `/v1/learning-gaps` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `learning-gaps` | — | `/v1/learning-gaps/:param` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `learning-gaps` | — | `/v1/learning-gaps/:param/closure-actions` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `learning-gaps` | — | `/v1/learning-gaps/analysis-results` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `learning-gaps` | — | `/v1/learning-gaps/closure-plans` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `me` | — | `/v1/me/assessments` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `me` | — | `/v1/me/career` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `me` | — | `/v1/me/consents` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `me` | — | `/v1/me/content` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `me` | — | `/v1/me/content/media/:param` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `me` | — | `/v1/me/delegations` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `me` | — | `/v1/me/evidence` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `me` | — | `/v1/me/gaps/closure` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `me` | — | `/v1/me/gdpr/export` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `me` | — | `/v1/me/goals/:param/timeline` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `me` | — | `/v1/me/inbox/:param` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `me` | — | `/v1/me/inbox/stream` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `me` | — | `/v1/me/interfaces` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `me` | — | `/v1/me/mentor-matches` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `me` | — | `/v1/me/mentorships` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `me` | — | `/v1/me/notification-preferences` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `me` | — | `/v1/me/permissions` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `me` | — | `/v1/me/predictions` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `me` | — | `/v1/me/preferences` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `me` | — | `/v1/me/processes` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `me` | — | `/v1/me/pulse-checks` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `me` | — | `/v1/me/skill-gap-scores` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `me` | — | `/v1/me/timeline` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `me` | — | `/v1/me/timeline/summary` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `mentorship` | — | `/v1/mentorship/match-scores` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `mentorship` | — | `/v1/mentorship/match-scores/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `mentorship` | — | `/v1/mentorship/pairings` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `mentorship` | — | `/v1/mentorship/pairings/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `mentorship` | — | `/v1/mentorship/pairings/:param/sessions` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `mentorship` | — | `/v1/mentorship/programs` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `mentorship` | — | `/v1/mentorship/programs/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `mentorship` | — | `/v1/mentorship/sessions/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `notifications` | — | `/v1/notifications` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `notifications` | — | `/v1/notifications/broadcasts` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `observability` | — | `/v1/observability/request-series` | **non-serve** | dominio senza interfaccia | sonde e misure di sistema: destinatario un sistema, non una persona |
| `observability` | — | `/v1/observability/slow-queries` | **non-serve** | dominio senza interfaccia | sonde e misure di sistema: destinatario un sistema, non una persona |
| `observability` | — | `/v1/observability/system-health` | **non-serve** | dominio senza interfaccia | sonde e misure di sistema: destinatario un sistema, non una persona |
| `occupation-classifications` | — | `/v1/occupation-classifications` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `occupation-classifications` | — | `/v1/occupation-classifications/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `okrs` | — | `/v1/okrs` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `okrs` | — | `/v1/okrs/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `okrs` | — | `/v1/okrs/:param/check-ins` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `okrs` | — | `/v1/okrs/:param/key-results` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `operating-models` | — | `/v1/operating-models/:param` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `organization-unit-history` | — | `/v1/organization-unit-history` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `organization-unit-history` | — | `/v1/organization-unit-history/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `organization-unit-kpi-templates` | — | `/v1/organization-unit-kpi-templates` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `organization-unit-kpi-templates` | — | `/v1/organization-unit-kpi-templates/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `organization-unit-processes` | — | `/v1/organization-unit-processes` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `organization-unit-processes` | — | `/v1/organization-unit-processes/:param` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `organization-unit-processes` | — | `/v1/organization-unit-processes/by-ou/:param` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `performance-reviews` | — | `/v1/performance-reviews` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `performance-reviews` | — | `/v1/performance-reviews/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `position-career-paths` | — | `/v1/position-career-paths` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `position-career-paths` | — | `/v1/position-career-paths/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `position-succession-relevance` | — | `/v1/position-succession-relevance` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `position-succession-relevance` | — | `/v1/position-succession-relevance/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `positions` | — | `/v1/positions/:param/intelligence-profile` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `positions` | — | `/v1/positions/:param/kpis/:param` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `positions` | — | `/v1/positions/:param/skill-requirements/history` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `positions` | — | `/v1/positions/:param/skills/:param` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `predictions` | — | `/v1/predictions` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `predictions` | — | `/v1/predictions/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `predictions` | — | `/v1/predictions/models` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `predictions` | — | `/v1/predictions/models/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `process-kpi-templates` | — | `/v1/process-kpi-templates` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `process-kpi-templates` | — | `/v1/process-kpi-templates/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `projects` | — | `/v1/projects/:param/members/:param` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `projects` | — | `/v1/projects/:param/progress` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `provenance` | — | `/v1/provenance` | **non-serve** | amplia una pagina | tracciabilita' tecnica dei dati: da dove vengono, non di chi sono |
| `public-stats` | — | `/v1/public/platform-stats` | **non-serve** | dominio senza interfaccia | statistiche della vetrina pubblica, gia' consumate dalla landing |
| `reference-sync` | — | `/v1/reference-sync/runs` | **non-serve** | dominio senza interfaccia | sincronizzazione ISTAT/ATECO/ESCO: lavoro di servizio |
| `reference-sync` | — | `/v1/reference-sync/runs/:param` | **non-serve** | dominio senza interfaccia | sincronizzazione ISTAT/ATECO/ESCO: lavoro di servizio |
| `reference-sync` | — | `/v1/reference-sync/sources` | **non-serve** | dominio senza interfaccia | sincronizzazione ISTAT/ATECO/ESCO: lavoro di servizio |
| `review-cycles` | — | `/v1/review-cycles/:param` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `review-cycles` | — | `/v1/review-cycles/:param/transition` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `seed-acquisition-runs` | — | `/v1/seed-acquisition-runs` | **non-serve** | dominio senza interfaccia | corse tecniche di acquisizione |
| `seed-acquisition-runs` | — | `/v1/seed-acquisition-runs/:param` | **non-serve** | dominio senza interfaccia | corse tecniche di acquisizione |
| `seed-acquisition-runs` | — | `/v1/seed-acquisition-runs/:param/candidates` | **non-serve** | dominio senza interfaccia | corse tecniche di acquisizione |
| `seed-approval-decisions` | — | `/v1/seed-approval-decisions` | **non-serve** | dominio senza interfaccia | approvazioni delle corse di acquisizione |
| `seed-approval-decisions` | — | `/v1/seed-approval-decisions/:param` | **non-serve** | dominio senza interfaccia | approvazioni delle corse di acquisizione |
| `seed-candidate-records` | — | `/v1/seed-candidate-records` | **non-serve** | dominio senza interfaccia | candidati grezzi di una corsa di acquisizione |
| `seed-candidate-records` | — | `/v1/seed-candidate-records/:param` | **non-serve** | dominio senza interfaccia | candidati grezzi di una corsa di acquisizione |
| `seed-candidate-records` | — | `/v1/seed-candidate-records/:param/decision` | **non-serve** | dominio senza interfaccia | candidati grezzi di una corsa di acquisizione |
| `seed-candidate-records` | — | `/v1/seed-candidate-records/:param/evidence` | **non-serve** | dominio senza interfaccia | candidati grezzi di una corsa di acquisizione |
| `seed-candidate-records` | — | `/v1/seed-candidate-records/:param/validations` | **non-serve** | dominio senza interfaccia | candidati grezzi di una corsa di acquisizione |
| `semantic-matching` | — | `/v1/matching/reindex` | **serve-altrove** | amplia una pagina | somiglianza semantica: la consuma l'agente e il ponte competenze |
| `semantic-matching` | — | `/v1/matching/search` | **serve-altrove** | amplia una pagina | somiglianza semantica: la consuma l'agente e il ponte competenze |
| `semantic-matching` | — | `/v1/matching/skills/:param/similar` | **serve-altrove** | amplia una pagina | somiglianza semantica: la consuma l'agente e il ponte competenze |
| `semantic-matching` | — | `/v1/matching/users/:param/job-roles` | **serve-altrove** | amplia una pagina | somiglianza semantica: la consuma l'agente e il ponte competenze |
| `semantic-matching` | — | `/v1/matching/users/:param/occupations` | **serve-altrove** | amplia una pagina | somiglianza semantica: la consuma l'agente e il ponte competenze |
| `semantic-matching` | — | `/v1/matching/users/:param/positions` | **serve-altrove** | amplia una pagina | somiglianza semantica: la consuma l'agente e il ponte competenze |
| `semantic-matching` | — | `/v1/matching/users/:param/similar` | **serve-altrove** | amplia una pagina | somiglianza semantica: la consuma l'agente e il ponte competenze |
| `succession-pools` | — | `/v1/succession-pools` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `succession-pools` | — | `/v1/succession-pools/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `successor-candidates` | — | `/v1/successor-candidates` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `successor-candidates` | — | `/v1/successor-candidates/:param` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `successor-readiness` | — | `/v1/successor-readiness` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `successor-readiness` | — | `/v1/successor-readiness/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `surveys` | — | `/v1/surveys` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `surveys` | — | `/v1/surveys/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `surveys` | — | `/v1/surveys/:param/responses` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `surveys` | — | `/v1/surveys/responses/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `surveys` | — | `/v1/surveys/templates` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `surveys` | — | `/v1/surveys/templates/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `talent-review` | — | `/v1/talent-review/critical-coverage` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `talent-review` | — | `/v1/talent-review/critical-positions` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `talent-review` | — | `/v1/talent-review/fit` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `talent-review` | — | `/v1/talent-review/nine-box` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `talent-review` | — | `/v1/talent-review/readiness` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `talent-review` | — | `/v1/talent-review/succession` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `teams` | — | `/v1/teams` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `teams` | — | `/v1/teams/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `teams` | — | `/v1/teams/:param/members/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `tenant-blueprints` | — | `/v1/tenant-blueprints/:param/link-tenant` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `tenant-blueprints` | — | `/v1/tenant-blueprints/:param/versions` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `tenant-blueprints` | — | `/v1/tenant-blueprints/:param/versions/:param` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `tenant-blueprints` | — | `/v1/tenant-blueprints/:param/versions/:param/apply-research` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `tenant-blueprints` | — | `/v1/tenant-blueprints/:param/versions/:param/identity` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `tenant-blueprints` | — | `/v1/tenant-blueprints/:param/versions/:param/model` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `tenant-blueprints` | — | `/v1/tenant-blueprints/:param/versions/:param/model-proposal` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `tenant-blueprints` | — | `/v1/tenant-blueprints/:param/versions/:param/processes` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `tenant-blueprints` | — | `/v1/tenant-blueprints/:param/versions/:param/processes/:param` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `tenant-blueprints` | — | `/v1/tenant-blueprints/:param/versions/:param/research` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `tenant-blueprints` | — | `/v1/tenant-blueprints/:param/versions/:param/submit` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `tenant-blueprints` | — | `/v1/tenant-blueprints/research-domains` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `tenant-materialization` | — | `/v1/tenant-materialization` | **non-serve** | dominio senza interfaccia | costruzione di un cliente: amministrazione di piattaforma |
| `tenant-materialization` | — | `/v1/tenant-materialization/sources` | **non-serve** | dominio senza interfaccia | costruzione di un cliente: amministrazione di piattaforma |
| `tenants` | — | `/v1/tenants/provision` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `time-off` | — | `/v1/time-off/accrual-rules` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `time-off` | — | `/v1/time-off/balance-transactions` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `time-off` | — | `/v1/time-off/requests` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `training-initiatives` | — | `/v1/training-initiatives` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `training-initiatives` | — | `/v1/training-initiatives/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `user-career-plans` | — | `/v1/user-career-plans` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `user-career-plans` | — | `/v1/user-career-plans/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `user-target-positions` | — | `/v1/user-target-positions` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `user-target-positions` | — | `/v1/user-target-positions/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `user-target-positions` | — | `/v1/user-target-positions/:param/review` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `user-timeline` | — | `/v1/user-timeline` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `user-timeline` | — | `/v1/user-timeline/summary` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `users` | — | `/v1/users/:param/purge` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `visualization-edges` | — | `/v1/visualization-edges/:param` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `visualization-exports` | — | `/v1/visualization-exports/:param` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `visualization-exports` | — | `/v1/visualization-exports/:param/download` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `visualization-layouts` | — | `/v1/visualization-layouts` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `visualization-layouts` | — | `/v1/visualization-layouts/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `visualization-node-layouts` | — | `/v1/visualization-node-layouts` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `visualization-node-layouts` | — | `/v1/visualization-node-layouts/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `visualization-nodes` | — | `/v1/visualization-nodes/:param` | **serve-una-pagina** | amplia una pagina | nessuna regola la copre: la decisione e' di Enzo |
| `visualization-styles` | — | `/v1/visualization-styles` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |
| `visualization-styles` | — | `/v1/visualization-styles/:param` | **serve-una-pagina** | dominio senza interfaccia | nessuna regola la copre: la decisione e' di Enzo |

**Totale righe: 290.** Il censimento e' completo o non e': se questo
numero non coincide con il conteggio in cima, il file e' stale — rilancia lo strumento.
