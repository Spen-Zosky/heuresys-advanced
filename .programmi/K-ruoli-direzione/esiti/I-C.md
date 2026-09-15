# I-C — L'impronta dei controlli per nome sui moduli dei ruoli nuovi (passo 15; passo 16 dopo I-E) — ESITO

Data: 2026-09-15, sessione S1103. Lettore W1 `I-C` (sonnet, `evidenze/wf_F1_W1_202609150148`), spia trovata, 10 comandi, 2 discrepanze (spia + `roles.includes` 4/5 sull'avviamento). I **conteggi** sono ri-misurati in linea con `tools/controlli_per_nome.py` (stesso perimetro di `rg --no-ignore --hidden`, apici singoli **e** doppi — il lettore usava i soli singoli e dava `auth/` a 0: sono 2); la **classificazione** (a)/(b)/(c) è del lettore, riletta dalla sessione principale sui siti (b), che sono pochi.

> **Per R-1 e S-5, in una riga:** sui 29 moduli dei ruoli nuovi ci sono **81 siti** di controllo per nome (`evidenze/I-C_siti_202609150328.txt`, file:riga:testo); **nessuno è di classe (a)** (per costruzione: (a) vive in `lib/scope/`, escluso dal conteggio); **~19 sono di classe (b)** — capacità che ripete o sostituisce un permesso, e **8 sono definizioni locali del predicato** (copie di `isPlatform`) — e i restanti **~54 sono (c)**, perimetro locale da portare al resolver. La baseline del cricchetto S-5 è scritta: **102 file, 327 controlli** su tutto `apps/api/src` fuori da `lib/scope/` e `config/` (`esiti/controlli-per-nome.baseline.json`).

## Conteggi (ri-misurati)

| gruppo di moduli | siti | comando |
|---|---|---|
| recruiting (candidates, candidate-applications, interviews, interview-feedback, job-offers, job-requisitions, job-postings) | **22** | `python tools/controlli_per_nome.py --siti <7 moduli>` (il lettore: 22, verificato) |
| gdpr | 2 | idem |
| tassonomia (skills 6, skill-taxonomy-edges 2, skill-aliases 2, skill-categories 1, skill-families 1) | **12** | idem (il lettore non contava `skill-aliases`) |
| auth 2, mfa-policy 2, delegations 1 | **5** | idem — `auth/service.ts:707,738` sono `actorRoles.includes("PLATFORM_ADMIN")` con apici **doppi**: il lettore li dava a 0 |
| avviamento (tenants 6, tenant-import-runs 4, tenant-materialization 1, tenant-blueprints 1, seed-acquisition-runs 3, seed-approval-decisions 3, seed-candidate-records 2) | **20** | idem; `.roles.includes(` sull'avviamento = **5** (il verificatore aveva ragione: 5, non 4) |
| observability 0, provenance 1, generated-origins 1, notifications 3, leads 0 | **5** | idem |
| users | **15** | idem (2 definizioni locali + 13 usi) |
| **totale sui moduli dei ruoli nuovi** | **81** | `-- 81 siti` |
| **baseline S-5 (tutto `apps/api/src` fuori da `lib/scope/`, `config/`)** | **327** in 102 file: 270 predicati, 36 stringhe di ruolo, 21 `.roles.includes(` | `python tools/controlli_per_nome.py --baseline esiti/controlli-per-nome.baseline.json` |

## Classificazione (la classe la rilegge la sessione principale sui siti (b); i (c) sono la lista residua nel file di evidenza)

### (b) — capacità che ripete/sostituisce un permesso di rotta → **da sostituire con un predicato di mandato (R-1 `mandati.ts`)**

| sito | che cosa fa | predicato di R-1 |
|---|---|---|
| `users/service.ts:370` (**grantRole**, il caso nominato dal mandato) e `:373`, `:430`, `:442` | «solo PLATFORM/TENANT_ADMIN concedono/revocano ruoli», con vincolo di tenant | `puoConcedereRuoli(actor)` |
| `users/service.ts:102,104,112,246,355,386` | capacità di lettura/scrittura sulle persone per nome di ruolo | `haMandatoHr` / `puoConcedereRuoli` secondo il sito |
| `gdpr/service.ts:43` (`if (isPlatform(actor)) return;` salta il vincolo di tenant) e `:157` | il mandato GDPR deciso per nome | `haMandatoGdpr(actor)` (DPO entra qui: R-2) |
| `skills/service.ts` (6 siti: `authorizeWriteOnSkill` e affini) | «chi scrive una competenza **globale**» = capacità di piattaforma sulla tassonomia | `haMandatoPiattaforma(actor)` per la parte globale; la parte di cliente è (c) |
| `skill-categories/service.ts:31`, `skill-families/service.ts:35`, `tenant-materialization/service.ts:38` (`ensurePlatformAdmin`, lasciato senza classe dal lettore) | `if (!actor.roles.includes("PLATFORM_ADMIN")) throw` — la rotta ha già il permesso; il servizio lo ripete per nome | `haMandatoPiattaforma(actor)` |
| `delegations/service.ts:81` | `scope === "FULL"` solo per la piattaforma: regola di capacità su un valore | `haMandatoPiattaforma(actor)` (giudizio meno netto: non ripete una rotta) |
| `auth/service.ts:707,738` | `actorRoles.includes("PLATFORM_ADMIN")` decide chi può agire su credenziali altrui | `puoConcedereRuoli` o `haMandatoPiattaforma` — da leggere in R-7 (SECURITY_ADMIN entra proprio qui) |

### Definizioni locali del predicato (copie di `isPlatform`) → **si cancellano nel commit che porta il file al resolver** (S-5 scende)

`tenants/service.ts:30` (`function isPlatformAdmin`), `users/service.ts:62-66` (`isPlatformAdmin`, `isTenantAdmin`), `notifications/service.ts:20`, `mfa-policy/service.ts:35,48`, `auth/service.ts:707,738`, `skill-categories/service.ts:31`, `skill-families/service.ts:35`, `tenant-materialization/service.ts:38`.

### (c) — perimetro locale («chi vede quale tenant») → **da sostituire con il resolver / `perimetroClienti` (I-G §4)**

Tutti gli altri siti del file di evidenza: i **22 del recruiting** (idioma identico `isPlatform(actor) ? undefined : actor.tenantId` in 7 file), `skill-aliases/service.ts:25,31`, `skill-taxonomy-edges/service.ts:30`, `tenants/service.ts:70,75,101`, `tenant-import-runs/service.ts:37,41,136`, `seed-*/service.ts` (8), `provenance/service.ts:16`, `generated-origins/service.ts:21`, `notifications/service.ts:29`, `users/service.ts:215`. **Coincidono con le 24 porte di I-G** dove riguardano dati di più clienti.

### Fuori classificazione (non sono controlli di accesso)

`tenant-blueprints/service.ts:273` e `notifications/service.ts:56` (campi informativi di audit, `isPlatform: …`), `tenant-import-runs/repository.ts:366` (`WHERE r.auth_role_code='PLATFORM_ADMIN'` in una query di reportistica), `tenants/provisioning.ts` (assegna il ruolo iniziale al provisioning: è dato, non gate).

## Passo 16 (dopo I-E) — ESEGUITO

Da I-E: 110 tabelle `nativo`/`importato` non dubbie → 15 moduli con cartella omonima (`evidenze/I-C_moduli_passo16.txt`), di cui 7 già contati al passo 15 (recruiting). Sugli **8 nuovi** (branches, calibration-sessions, content-blueprint-links, dashboard, performance-reviews, process-kpi-templates, review-cycles, surveys): **12 siti** (`evidenze/I-C_siti_passo16_202609151628.txt`), classificati dalla sessione principale:

| sito | classe | nota |
|---|---|---|
| `process-kpi-templates/service.ts:23,29` | **(b)** | `if (!isPlatform(actor)) throw Forbidden`: ripete il permesso di rotta → `haMandatoPiattaforma` |
| `content-blueprint-links/service.ts:25` | copia locale | `a.roles.includes("PLATFORM_ADMIN")` (già in I-G §1) |
| `branches/service.ts:31`, `calibration-sessions/service.ts:29,46,59`, `review-cycles/service.ts:24,35`, `surveys/service.ts:24,30,46` | **(c)** | perimetro locale (`isPlatform ? undefined : tenantId`, o «stesso tenant o piattaforma») → resolver / `perimetroClienti` |
| dashboard, performance-reviews | 0 siti | nessun controllo per nome |

Totale sui moduli dei ruoli nuovi **più** quelli di PEOPLE_MANAGER/DATA_STEWARD: **93 siti** (81 + 12): (b) ~21, copie locali 9, (c) ~63. La baseline di S-5 non cambia (copre già tutto `apps/api/src`).

## Verdetto

- **SBLOCCA R-1** con la lista (b) qui sopra (grantRole in testa) e la lista (c) nel file di evidenza; **fissa la baseline di S-5** (`esiti/controlli-per-nome.baseline.json`, 102 file / 327).
- Passo 16: **eseguito** (12 siti sugli 8 moduli nuovi). I-C **CHIUSA**.
