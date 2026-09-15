# I-G — Le porte di piattaforma verso i clienti (passo 20) — ESITO

Data: 2026-09-15, sessione S1103. Lettore W1 `I-G` (sonnet, rilancio `evidenze/wf_F1_W1_202609150148_b`), spia trovata; il verificatore ha scambiato atteso/ottenuto su 6 discrepanze, quindi **tutti i numeri qui sotto sono ri-misurati in linea** dalla sessione principale (comandi riportati). Il lettore aveva letto 2 moduli dell'avviamento su 10 candidati e contato 9 porte: la misura completa ne dà **24**.

> **Per R-0, in una riga:** le porte da filtrare sono **24 rotte GET in 10 moduli** (sotto la soglia di 40 → **R-0 vale 1 sessione**); **non esiste** una tabella utente↔più clienti né un utente di piattaforma con `tenant_id` nullo (R-0 parte da zero, come previsto da D9); e **non esiste un punto unico**: il perimetro «tutti i clienti» si decide per nome in **20 file** e in **3 righe del resolver**. Il punto unico va **costruito** — in `lib/actor.ts` — e le 24 porte vi si portano una per una.

## 1. Come un attore di piattaforma ottiene «tutti i clienti» (file:riga)

- **Fonte del predicato**: `apps/api/src/lib/actor.ts:28-30` — `isPlatform(a) = a.roles.includes('PLATFORM_ADMIN')`. Sul vivo `auth_role_is_platform = true` è solo di `PLATFORM_ADMIN` (1 ruolo).
- **Resolver** (`rg -n "PLATFORM_ADMIN|isPlatform" apps/api/src/lib/scope/resolver.ts`): riga 62 (l'insieme di mandato che lo contiene), **87, 140** (`if (actor.roles.includes("PLATFORM_ADMIN"))` aprono il perimetro gerarchico a tutto), **200** (`return audit(true, "platform")`). `domains.ts:126` aggiunge il dominio `platform_mandate`; `domains.ts:319-322` ritorna il tier `PLATFORM` prima di guardare i mandati di cliente.
- **Il controllo è ridefinito per nome in 20 file** (`rg --no-ignore --hidden -l -e 'function isPlatformAdmin\(' -e 'includes\("PLATFORM_ADMIN"\)' -e "includes\('PLATFORM_ADMIN'\)" apps/api/src`): `lib/actor.ts`, `lib/scope/domains.ts`, `lib/scope/resolver.ts`, `middleware/tenantContext.ts`, e 16 `modules/*/service.ts` (auth, content, content/media, content-blueprint-links, engagement, job-families, mfa-policy, notifications, organization-unit-processes, positions, semantic-matching, skill-categories, skill-families, tenant-materialization, tenants, users). **82** file `service.ts` chiamano `isPlatform(` (`rg -l 'isPlatform\(' apps/api/src --glob '*service.ts' | wc -l`; il lettore diceva 79).

## 2. Le porte: rotte GET che restituiscono dati di PIÙ clienti a un attore di piattaforma

Metodo: per ciascuno dei 14 moduli candidati (`ls apps/api/src/modules | grep -E "tenant|blueprint|observab|provenance|generated|leads|materializ"`) conteggio delle `app.get(` in `routes.ts` e lettura del sito in `service.ts`/`repository.ts` dove il filtro di cliente si azzera per la piattaforma (evidenza: output in questa sezione, comandi in `evidenze/wf_F1_W1_202609150148_b/I-G_lettore.json` più i `rg -n` qui citati).

| modulo | GET | porte | dove il filtro si azzera | nota |
|---|---|---|---|---|
| tenants | 3 | **2** | `service.ts:70` `ownTenantOnly = isPlatformAdmin(actor) ? undefined : requireOwnTenant(actor)` (lista) e `getById` | la terza GET (`:31`) è l'elenco dei codici ATECO, non dati di clienti. **È l'elenco commerciale completo dei clienti**: la porta più sensibile per D9 |
| tenant-import-runs | 2 | **2** | `service.ts:136` (lista: `tenantId = isPlatform(a) ? undefined : …`), `service.ts:37` (`canReadRun` lascia passare la piattaforma su qualunque cliente) | |
| tenant-blueprints | 7 | **7** | `service.ts:115-119` e altri 7 metodi con `_a: ActorContext` **ignorato**: nessun filtro di cliente per nessuno | oggi regge solo il permesso di rotta; con BLUEPRINT_MANAGER assegnato (R-5) diventa la porta più larga |
| tenant-materialization | 1 | **1** | `service.ts:57` legge lo stato di `body.tenantId` qualunque esso sia | |
| blueprint-activations | 2 | **2** | `service.ts:24` `tenantId = isPlatform(actor) ? undefined : actor.tenantId` | |
| blueprint-overrides | 2 | **2** | `service.ts:24` stesso schema | |
| content-blueprint-links | 3 | **3** | `service.ts:25-26` `tenantId: isPlatform ? null : a.tenantId` | |
| provenance | 2 | **2** | `service.ts:16` `if (isPlatform(a)) return undefined` | |
| generated-origins | 2 | **2** | `service.ts:21` stesso schema | |
| observability | 3 | **1** | `/system-health`: `repository.ts:30-49` `getTenantFleet()` = una riga per cliente (nome, codice, stato, utenti, ultimo accesso) | le altre 2 GET (slow-queries, request-series) non toccano dati di clienti |
| blueprint-families / -processes / -variants | 2+2+2 | 0 | `service.ts:25-48` solo `if (!isPlatform(actor)) throw Forbidden` | **cataloghi di piattaforma** (il semilavorato), senza colonna di cliente: non sono «dati di più clienti». Un consulente assegnato li vede per natura |
| leads | 1 | 0 | nessuna occorrenza di `tenant` nel modulo | i lead sono **prospect**, non clienti: non hanno `tenant_id`. R-0 non li filtra; SALES (R-9) li vede tutti per natura. Non è una decisione: è la forma del dato |
| **totale** | | **24** | | **< 40 → R-0 = 1 sessione** |

## 3. Esiste già un asse utente↔più clienti?

**No.** `information_schema.tables` sui quattro schemi applicativi (`sys`, `staging`, `reference_sync`, `audit`) per `%user_tenant%|%tenant_user%|%platform_user%|%user_tenants%` → 0. `sys.sys_users.user_tenant_id` è **NOT NULL**: anche i 2 PLATFORM_ADMIN vivi appartengono a un cliente «di casa» (Heuresys System). `sys.sys_user_auth_roles.user_auth_role_tenant_id` (nullable) è solo metadato del grant (`users/repository.ts:316-439`, 10 occorrenze; `auth/repository.ts:104`), **mai** letto da `resolver.ts`/`domains.ts`: non è un asse di perimetro. R-0 crea `sys.sys_platform_user_tenant_assignments` come scritto nel passo 36.

## 4. Il punto UNICO — non esiste, va costruito

Nessuna delle 24 porte consulta il resolver: ciascuna chiama `isPlatform(actor)` (o la sua copia locale) nel proprio `service.ts`. Raccomandazione per R-0 passo 37, **misurata, non decisa**: il posto in cui tutte e 24 passano è `lib/actor.ts` (che `isPlatform` sia importata o ricopiata, il concetto vive lì). R-0 aggiunge in `actor.ts` un predicato `perimetroClienti(actor): undefined | Set<tenant_id>` — `undefined` (tutti) per `PLATFORM_ADMIN`; l'insieme delle assegnazioni con `revoked_at is null` per i ruoli in `haMandatoPiattaformaAssegnato` (R-1), **vuoto = nessun cliente**; il solo `actor.tenantId` altrimenti — caricato nel contesto attore da `middleware/tenantContext.ts:22` (dove oggi il tenant si decide) e portato alle 24 porte **un commit per porta** (`isPlatform(actor) ? undefined : actor.tenantId` → `perimetroClienti(actor)`), facendo scendere la baseline di S-5. `resolver.ts:87/140/200` restano: sono il perimetro **gerarchico** (su quali persone), non quello di cliente, e `PLATFORM_ADMIN` non cambia (D9).

## Verdetti

- **SBLOCCA R-0**, 1 sessione: 24 porte file:riga (tabella §2), tabella nuova (§3), punto unico da costruire in `actor.ts` (§4).
- **Per S-5** (cricchetto): i 20 file che ridefiniscono il controllo per nome sono la baseline «controlli di piattaforma», da far scendere.
- **Per R-9/R-5/R-8**: `tenant-blueprints` (7 porte senza alcun filtro, actor ignorato) e `tenants` (elenco clienti) sono le due porte da filtrare **prima** di dare i ruoli assegnati.
- Nessuna decisione nuova per Enzo (i lead non sono clienti: è il dato a dirlo).
