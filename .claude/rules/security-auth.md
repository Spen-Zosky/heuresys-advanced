---
paths:
  - "apps/api/src/modules/auth/**"
  - "apps/api/src/middleware/**"
  - "apps/api/src/plugins/**"
  - "db/scripts/seed-test-admin.ts"
---

# Modello di sicurezza — leggi prima di toccare l'auth

- **Password**: **Argon2id 64 MiB / 3 iterazioni / 4 parallelism** (ADR-0005). Il percorso `needsRehash` ruota automaticamente al login riuscito.
- **Access token**: JWT RS256, TTL 15 minuti, emesso come cookie `HttpOnly + SameSite=Lax`. Chiavi in `.secrets/jwt_{private,public}.pem` (gitignored).
- **Refresh token**: 30 giorni, monouso, rotazione con replay detection. Un tentativo di replay revoca l'intera famiglia e ritorna `401 REFRESH_REPLAY_DETECTED`.
- **CSRF**: double-submit cookie via `csrfPlugin`. Opt-in per rotta — applica il preHandler `app.verifyCsrf` a tutte le rotte che cambiano stato (POST/PATCH/DELETE).
- **Login ritorna `200` con body**, non 204: Fastify strippa i body dai 204. Errata documentata nel commit `7450f77`.

## Ruoli

**Il conteggio non si cita a memoria da qui**: sta in `docs/kb/SOT_STATE.md` e si ri-deriva con
`SELECT count(*) FROM sys.sys_auth_roles`. Questa riga diceva «11 ruoli» mentre il database ne aveva
**14** (misurato S1052) — un numero fermo in un documento che nessuno ri-deriva è un numero che mente.

Gli 11 storici: `PLATFORM_ADMIN`, `TENANT_ADMIN`, `BLUEPRINT_MANAGER`, `HRMS_MANAGER`, `PROCESS_OWNER`, `MANAGER`, `USER`, `READ_ONLY`, più i 3 funzionali senza holder dell'epica S953/R2 (migrazione 000049): `CEO`, `TEAM_LEADER`, `TEAM_MEMBER`. Per l'elenco corrente: `SELECT role_code FROM sys.sys_auth_roles ORDER BY 1`.

Le mappature ruolo×permesso: `SELECT count(*) FROM sys.sys_auth_role_permissions`.

## Personas di test

Dopo il rebuild RTL di S950 sono **utenti RTL_BANK reali**, non i vecchi account `*.test` (cancellati). `pnpm db:seed-test-admin` è ora idempotente e solo-login: garantisce un'identità auth LOCAL più credenziale ARGON2ID per gli utenti creati dai seed di rebuild, password dalla env `TEST_ADMIN_PASSWORD` — nessun default committato (F-001).

| Persona | Ruolo |
|---|---|
| `federica.marchetti@rtl-bank.org` | TENANT_ADMIN |
| `paolo.caputo@rtl-bank.org` | MANAGER |
| `tommaso.fiore@rtl-bank.org` | USER, report di paolo |
| `antonio.parisi@rtl-bank.org` | USER, outsider |

⚠️ **`admin@heuresys.com` NON esiste più** — rimosso dalla migrazione `000295`, verificato S1052 con
`SELECT ... WHERE user_email LIKE 'admin@heuresys%'` → **0 righe** (le altre quattro ci sono tutte).
Era ancora citato qui e in `.claude/rules/tests.md`, e ha già fatto fallire la custodia della storia
RTL per giorni (`#153`). Chi serve un `PLATFORM_ADMIN` deriva l'attore **dal ruolo**, non da un
indirizzo scritto a mano.

L'arco manager→employee reports-to è una relazione organizzativa reale. Autorità della mappatura: `db/scripts/seed-test-admin.ts`.

## Ricorda

L'autorizzazione bi-assiale (I16-I20) è negli invarianti non negoziabili del `CLAUDE.md`: il ruolo risponde a *questa azione può avvenire*, l'asse risponde a *sui dati di chi*. Il dato sensibile passa **solo** per la catena organizzativa.
