# I-F — La ricetta del custode (passi 18 e 19) — ESITO

Data: 2026-09-15, sessione S1103. Lettore W1 `I-F` (sonnet, `evidenze/wf_F1_W1_202609150148`), spia trovata; completato e corretto **in linea** con `evidenze/I-F_rimisure_202609150308.txt` (elenco file col comando esatto, colonne di ritiro sul vivo, controprova del passo 19).

> **Le due cose che F4 deve sapere prima di far nascere un ruolo.**
> 1. **Il test di deriva NON scatta** quando si aggiunge un ruolo a `role-codes.ts`: provato (passo 19) — 3/3 verdi prima e dopo il ruolo finto. Quel test guarda un'altra cosa (nessuna lista di ruoli locale nei moduli). **Nessun test** confronta `role-codes.ts` con `role-precedence.ts`, `roles-editor.tsx` o `sys_auth_roles` (0 file). Come dice il mandato: **la prima voce di F4 diventa «ripararlo»** — un test che legga `ROLE_CODES` e pretenda che ogni codice sia in `role-precedence.ts`, in `roles-editor.tsx` e nel database (e viceversa).
> 2. **Non esiste alcuna colonna di ritiro** su `sys_auth_role_permissions`, `sys_auth_roles`, `sys_auth_permissions` (misurato sul vivo: `information_schema.columns … ilike '%revoked%'|'%retired%'|'%deleted%'|'%active%'` → 0 righe). R-1 passo 0 le aggiunge. E `requirePermission` **non legge il database**: confronta i ruoli del JWT con `rolePermissionCache`, caricata **una volta all'avvio** senza alcun `WHERE` (`auth/cache-loader.ts:57-99`). Un ritiro marcato con una colonna resta concesso **fino al riavvio dell'API**: R-1 deve filtrare `revoked_at is null` nel caricatore **e** il deploy di ogni migrazione di F4 deve riavviare l'API (già lo fa `vm-deploy.sh`; se si applica con `db:migrate:vm` senza deploy, la cache è stantia).

## La ricetta — 29 file nominano `WHISTLEBLOWING_CUSTODIAN` nel perimetro che conta

`rg --no-ignore --hidden -l WHISTLEBLOWING_CUSTODIAN . --glob '!node_modules' --glob '!.next' --glob '!dist' --glob '!docs/**' --glob '!.programmi/**' --glob '!.git' --glob '!cowork_*/**' --glob '!.codex*/**' --glob '!.zp/**' --glob '!graphify-out/**'` → 29 file (evidenza §1). Per ciascuno: **che cosa fa un ruolo nuovo**.

### A. Da toccare SEMPRE (7 file di codice + 1 migrazione)

| # | file | che cosa si aggiunge |
|---|---|---|
| 1 | `packages/shared/src/schemas/role-codes.ts:24` | il codice nella union `ROLE_CODES` (fonte unica; `RoleCodeSchema` e il tipo `RoleCode` ne discendono). `auth.ts` **non** si tocca: importa `RoleCodeSchema` (`auth.ts:11`) e cita il custode solo in un commento (r.91) |
| 2 | `apps/api/src/lib/scope/domains.ts:81,128` | l'insieme di mandato del ruolo (per il custode: `CUSTODY_ROLES`; per i ruoli di K: gli insiemi di `mandati.ts` di R-1) |
| 3 | `apps/web/src/lib/role-precedence.ts:32` | il ruolo nell'ordine di precedenza dell'etichetta (è `readonly string[]`: nessun tipo lo lega a `ROLE_CODES` → il test di F4 passo 0 deve legarlo) |
| 4 | `apps/web/src/app/(authenticated)/users/[userId]/_components/roles-editor.tsx:43` | il ruolo nell'array `ROLE_CODES` selezionabile dall'editor (stessa deriva del punto 3) |
| 5 | `apps/web/src/locales/it/shell.json`, `apps/web/src/locales/en/shell.json` | l'etichetta i18n del ruolo (il lettore le aveva messe «fuori»: sono dentro, senza etichetta il ruolo appare col codice grezzo) |
| 6 | `db/migrations/000NNN_<ruolo>.sql` (modello: `000181_whistleblowing.sql:29-38, 56-73, 112-132`) | ruolo in `sys_auth_roles`, permessi in `sys_auth_permissions`, grant in `sys_auth_role_permissions`, post-condizione `DO $$ … RAISE EXCEPTION` che conta i permessi. ⚠ La 000181 **cancella** (`DELETE`) i grant di isolamento a ogni riapplicazione: è il modo vecchio; nel mandato K si **ritira** (`revoked_at`, V5) |
| 7 | `db/migrations/000414_…sql:47,134-181` | **un ruolo chiave dichiara la sua famiglia** (`auth_role_category`, post-condizione «0 ruoli senza famiglia dichiarata», r.94-95) e la sentinella `sys.v_whistleblowing_fuori_dal_custode` (r.122): la migrazione del ruolo nuovo deve valorizzare `auth_role_category`, altrimenti la 000414 riapplicata è rossa. Il lettore l'aveva taciuta |
| 8 | `db/migrations/000389_…sql:5` | «un ruolo di cliente non si concede senza cliente»: vincolo di schema su `sys_user_auth_roles` (una concessione di ruolo di cliente con `tenant_id` nullo è impossibile); i ruoli di piattaforma di D9 si concedono con `tenant_id` nullo e devono essere riconosciuti come tali dal vincolo |

### B. Da toccare SE il ruolo ha una persona di collaudo (F4 lo pretende sempre)

| # | file | che cosa |
|---|---|---|
| 9 | `db/migrations/000205_whistleblowing_custodian_and_console.sql:24,48` | modello del **grant a una persona** (`sys_user_auth_roles`) + voce di menu (`sys_ui_interfaces`) |
| 10 | `apps/web/tests/e2e/fixtures.ts:130-132` | la persona di prova con il ruolo (oggi solo commento: si aggiunge la fixture se il ruolo ha una pagina da provare) |
| 11 | `db/seeds/storia36/10_security_privacy.sql`, `db/scripts/verify-storia36.sql` | la storia di RTL conosce il custode; un ruolo nuovo che tocca RTL entra nella custodia della storia (verifica: `bash db/scripts/storia36.sh custodia`) |
| 12 | `db/scripts/populate-reference-translations-governance.sql` | le traduzioni di riferimento del ruolo |

### C. Test che asseriscono sul codice (la ricetta del lettore ne aveva zero)

| # | file | che cosa |
|---|---|---|
| 13 | `apps/api/test/whistleblowing.integration.test.ts:57`, `whistleblowing-isolation.integration.test.ts:71` | modello delle **prove positive e negative** del ruolo (200 sul suo modulo, 403 fuori, isolamento): ogni ruolo di F4 ha il suo file (R-11 li unisce nella matrice) |
| 14 | `apps/api/test/domains-f7.integration.test.ts:126` | prova dei **domini** del resolver: se il ruolo entra in un insieme di mandato, questo test lo deve vedere |
| 15 | `apps/api/test/unit/role-lists-drift.unit.test.ts:42` | **non** lo testa: cita il custode in un commento delle eccezioni ammesse. Il ruolo nuovo **non** deve comparire qui, salvo che un modulo lo elenchi in una lista locale (vietato da #99 F3) |
| 16 | `apps/api/scripts/prova-live-99-f7.mts` | prova sul vivo dei domini (script, non test): si estende se il ruolo ha un perimetro gerarchico |

### D. Nominano il custode ma NON si toccano per un ruolo nuovo

`apps/api/src/modules/whistleblowing/{routes,service}.ts` (il modulo del custode), `packages/shared/src/schemas/whistleblowing.ts`, `apps/web/src/app/(authenticated)/whistleblowing-console/page.tsx:5` (commento), `apps/api/test/unit/role-lists-drift.unit.test.ts` (commento), `packages/shared/src/schemas/auth.ts:91` (commento), `.storia36/PROGRESS.md`, `qa_artifacts/**` (artefatti), `.secrets/accessi.csv` (**gitignored, credenziali: non letto**; nomina il ruolo perché elenca le persone di prova — un ruolo con persona di collaudo vi finisce, fuori dal repo).

## Verdetti

- **SBLOCCA R-2…R-9 con la ricetta A+B+C** (non con gli 8 file del lettore). Costo per ruolo: 8 file sempre + 4 se ha persona/pagina + 2-3 file di test.
- **R-1 passo 0 è CONFERMATO necessario** (nessuna colonna di ritiro), e deve toccare anche `auth/cache-loader.ts` (filtro `revoked_at is null`) — non solo `requirePermission`, che non legge il DB.
- **Prima voce di F4 = riparare la deriva**: test unitario `role-codes` ↔ `role-precedence.ts` ↔ `roles-editor.tsx` ↔ `sys_auth_roles` (quest'ultimo confronto è d'integrazione). Oggi nessuno scatta: provato.
- Nessuna decisione nuova per Enzo.
