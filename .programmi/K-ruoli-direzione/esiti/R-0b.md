# R-0b — le porte che R-0 lasciò scollegate, e la loro condizione di riapertura — ESITO

Data: 2026-09-23, sessione S1106 (mandato Cowork, passaggio 3 del ciclo).

## R0b-1 — l'indagine (le quattro lettere, misurate sul vivo)

Comando per il perimetro assegnato oggi:
```
grep -n "PLATFORM_ASSIGNED_MANDATE_ROLES" -A 5 apps/api/src/lib/scope/mandati.ts
```
→ `PLATFORM_OPERATOR`, `SALES`, `BLUEPRINT_MANAGER` (R-5, mig. 000430), `IMPLEMENTATION_CONSULTANT` (R-8, mig. 000431). Non più vuoto: la condizione che R-0 scrisse per riaprire le porte è la prima cosa misurata, non presunta.

Comando per i permessi delle quattro porte:
```sql
select p.auth_permission_code as permission, r.auth_role_code as role
from sys.sys_auth_role_permissions rp
join sys.sys_auth_permissions p on p.auth_permission_id = rp.auth_permission_id
join sys.sys_auth_roles r on r.auth_role_id = rp.auth_role_id
where p.auth_permission_code in ('observability:read','tenant_materialization:execute','content:read','blueprint:read')
  and rp.revoked_at is null
order by p.auth_permission_code, r.auth_role_code
```
(via `python .programmi/K-ruoli-direzione/tools/q.py "<select>"` — nota: le tabelle RBAC reali sono `sys.sys_auth_permissions`/`sys.sys_auth_role_permissions`/`sys.sys_auth_roles`, non `sys_role_permissions`/`sys_permissions` come scritto nel testo del mandato)

Risultato:
- `observability:read` → `PLATFORM_ADMIN`, `PLATFORM_OPERATOR`
- `tenant_materialization:execute` → `PLATFORM_ADMIN` (nessun altro)
- `content:read` → `BLUEPRINT_MANAGER`, `CEO`, `HRMS_MANAGER`, `MANAGER`, `PLATFORM_ADMIN`, `PROCESS_OWNER`, `TENANT_ADMIN`
- `blueprint:read` → `BLUEPRINT_MANAGER`, `CEO`, `HRMS_MANAGER`, `MANAGER`, `PLATFORM_ADMIN`, `PROCESS_OWNER`, `READ_ONLY`, `TENANT_ADMIN`, `USER`

| lettera | porte | (i) esiste dimensione cliente da filtrare | (ii) un ruolo assegnato può esercitarla oggi | esito |
|---|---|---|---|---|
| a) tenant-blueprints | 7 | SÌ — `tenant_blueprint` è per-tenant | SÌ — `BLUEPRINT_MANAGER`/`IMPLEMENTATION_CONSULTANT` hanno `tenant_blueprint:*` | **GIÀ COLLEGATE**. `grep -n "perimetroClienti" apps/api/src/modules/tenant-blueprints/service.ts` → righe 120, 126: usa il punto unico. Nessuna azione: dichiarato e verificato |
| b) tenant-materialization | 1 | SÌ (in teoria — materializza un tenant specifico) | **NO** — `tenant_materialization:execute` è del solo `PLATFORM_ADMIN`, che non ha mai perimetro ristretto (`isPlatform(a)` → `perimetroClienti` torna `undefined`) | **RESTA CHIUSA PER COSTRUZIONE**. La condizione di R-0 non è avverata qui: nessuna richiesta reale userebbe un filtro che scriverei. Non toccato codice |
| c) observability | 1 (3 rotte) | **PARZIALE** — `/system-health` sì per `tenantFleet` (una riga per tenant, `repository.ts` `getTenantFleet`) e `auditFeed` (`tenant_code` per evento, `getAuditFeed`); `/slow-queries` e `/request-series` NO — sono aggregati DB-wide (`pg_stat_statements`, nessun tenant per query normalizzata) e in-memory su tutte le richieste HTTP (`metrics-store.ts`, nessun tenant per bucket) | SÌ — `PLATFORM_OPERATOR` ha `observability:read` ed è in `PLATFORM_ASSIGNED_MANDATE_ROLES` | **SCOLLEGATA → ESEGUITA (R0b-2)**. Vedi sotto |
| d) content-blueprint-links | 3 | SÌ — il link eredita `tenantId` dal documento (`content-blueprint-links/service.ts:25`, `buildScope`) | SÌ — `BLUEPRINT_MANAGER` ha sia `content:read` che `blueprint:read` | **CONDIZIONE AVVERATA ma FERMO SU R0b-3** — misura sotto: toccare `ScopeFilter` condiviso impatta moduli fuori scope |

## R0b-2 — observability, eseguita

Filtrate le due sole parti di `/system-health` che portano una dimensione cliente:

- `apps/api/src/modules/observability/repository.ts`: `getTenantFleet(q, tenantIds)` aggiunge `WHERE t.tenant_id = ANY($1)` quando `tenantIds !== undefined`; `getAuditFeed(q, limit, tenantIds)` aggiunge `AND a.action_tenant_id = ANY($2)`.
- `apps/api/src/modules/observability/service.ts`: `getSystemHealth(actor)` calcola `perimetroClienti(actor)` (dal punto unico in `lib/actor.ts`, lo stesso di R-0/R-9) e lo passa a entrambe le funzioni.
- `apps/api/src/modules/observability/routes.ts`: commento in testa corretto — non più «PLATFORM_ADMIN-only audience» (era falso dal giorno in cui R-9 ha dato `observability:read` a `PLATFORM_OPERATOR`).
- `/slow-queries` e `/request-series` **non toccati**: non hanno una dimensione cliente da filtrare (misurato sopra), quindi restano platform-wide per un `PLATFORM_OPERATOR` come per un `PLATFORM_ADMIN` — non è una scelta, è un fatto sui dati.

**Prova — ROSSO prima, VERDE dopo** (`cd apps/api && pnpm exec vitest run test/observability.integration.test.ts`), nuovo blocco `describe("mandato K, R-0b — observability filtrato per perimetro cliente (PLATFORM_OPERATOR)")` in `apps/api/test/observability.integration.test.ts`, con `PLATFORM_OPERATOR` (email `platform-operator@collaudo.invalid`) assegnato/revocato su RTL_BANK via `/v1/platform-tenant-assignments` (stesso pattern di R-9):

- PRIMA del fix: 3 test rossi — `tenantFleet` non vuoto senza assegnazione (2 tenant invece di 0), `tenantFleet.length` 2 invece di 1 con RTL assegnato, `tenantFleet` non vuoto dopo revoca (2 invece di 0).
- DOPO il fix: **14/14 verdi** — nessuna assegnazione → `tenantFleet: []`; assegnato a RTL_BANK → vede SOLO `RTL_BANK` (mai `HEURESYS`) sia in `tenantFleet` che in `auditFeed`; revocata l'assegnazione → torna a `[]`; controprova `PLATFORM_ADMIN` → vede sempre entrambi; `/slow-queries` e `/request-series` restano 200 platform-wide anche per l'operator assegnato.

`pnpm typecheck:test` verde.

## R0b-3 — content-blueprint-links, FERMO (misura, decisione a Enzo)

Censimento (`chi_sorveglia.py content/repository.ts` → NON MISURATO sul lato sentinelle: `«il database ha rifiutato la connessione»` in quel momento specifico, tunnel comunque su per il resto della sessione — dichiarato, non ignorato; nessun cancello/test/scrittore/migrazione trovati con la stringa esatta perché il tool cerca il path letterale e i consumer lo importano con path relativi diversi — quindi censimento rifatto a mano con `grep`):

`ScopeFilter` (`content/repository.ts:17-19`, `{ tenantId: string | null; isPlatform: boolean }`) è usato con filtro **scalare** (`= $N`, mai `ANY`) in **10 funzioni** di `content/repository.ts` (`listCategories`, `findCategoryById`, `updateCategory`, `deleteCategory`, `listDocuments`, `findDocumentById`, `searchDocuments`, `updateDocumentAppendVersion`, `deleteDocument`, `restoreVersion`), consumate da:
- `content/service.ts` — 16 chiamate (tutte le rotte documenti/categorie del modulo `content`)
- `content/media-service.ts` — 4 chiamate
- `content-blueprint-links/service.ts` — 5 chiamate (il perimetro di questa voce)

5 file di test di integrazione dipendono da questa catena: `content.integration.test.ts`, `content-blueprint-links.integration.test.ts`, `content-media.integration.test.ts`, `content-search.integration.test.ts`, `me-content-media.integration.test.ts`.

**Perché mi fermo**: cambiare `ScopeFilter.tenantId: string | null` in una forma che accetti un insieme (per `ANY($N)`) tocca — anche se in modo logicamente equivalente per i ruoli con un solo tenant — **10 query condivise con `content` e `media-service`**, moduli che questa voce non ha il mandato di riverificare end-to-end. È esattamente il caso per cui R-0 stesso si fermò (`esiti/R-0.md`, righe 73-77: «cambiarne la forma [...] toccherebbe moduli che I-G non ha mai contato fra le 24 porte»), e la condizione che R-0 scrisse per riaprirla (un ruolo assegnato con `content:read`+`blueprint:read`) **si è avverata** — ma la misura del costo resta la stessa di allora: non è una porta isolata, è un tipo condiviso da 3 moduli e 5 suite di test.

**Non toccato codice.** `content-blueprint-links` resta con `haMandatoPiattaforma` (predicato di mandato, non perimetro) come lasciato da R-0/R-1: un `BLUEPRINT_MANAGER` assegnato a un solo cliente vede oggi i link del **proprio tenant intero** (comportamento invariato, non peggiorato — nessuna regressione), non ancora ristretto al sotto-insieme dei clienti assegnati. **Decisione per Enzo**: autorizzare l'estensione di `ScopeFilter` a un insieme (impatto: 10 query + 3 service + 5 test file) o lasciare questa porta con lo stesso debito dichiarato da R-0.

## Riepilogo

| lettera | condizione di R-0 avverata | esito |
|---|---|---|
| a) tenant-blueprints (7) | sì | già collegate (fatte da R-5/R-8) |
| b) tenant-materialization (1) | NO | resta chiusa per costruzione |
| c) observability (1 porta, 3 rotte — 2 con dimensione cliente) | sì (parziale) | collegata dove esiste la dimensione (`tenantFleet`, `auditFeed`) |
| d) content-blueprint-links (3) | sì | condizione avverata, ma costo condiviso misurato → fermo, decisione a Enzo |
