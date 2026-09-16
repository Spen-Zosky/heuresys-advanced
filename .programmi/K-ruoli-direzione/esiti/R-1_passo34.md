# R-1 passo 34 — sostituzione dei siti di classe (b) e delle copie locali — ESITO

Data: 2026-09-16, sessione S1104 (seconda parte, dopo la ripresa orfana di R-1 SOSPESA).

## Punto di partenza

Alla presa in carico: passo 0 chiuso (migrazione 000420, `mandati.ts`, filtro cache RBAC); 2 siti
sostituiti (`users/service.ts` `grantRole`/`revokeRole` → `puoConcedereRuoli`). Restavano, per nota
di `STATO.md`: `skills/service.ts` (6), `gdpr/service.ts` (2), le tre copie locali
`skill-categories`/`skill-families`/`tenant-materialization`, `delegations/service.ts` (1),
`auth/service.ts` (2), `process-kpi-templates/service.ts` (2), `content-blueprint-links/service.ts`
(1 copia locale) — lista da `esiti/I-C.md`.

## Scelta di perimetro (decisione tecnica di questa sessione, non deducibile a memoria)

I-C classifica alcuni siti come (b) — capacità che ripete/sostituisce un permesso di rotta — e altri
come (c) — perimetro locale «chi vede quale tenant», che coincide con le 24 porte di I-G. Le (c) NON
sono state toccate in questo passo: R-0 (voce successiva, non in questa sessione) costruisce l'asse
«utente di piattaforma assegnato a certi clienti» e il punto unico nel resolver; toccare le (c) ora
avrebbe significato scrivere perimetro due volte. Questo vale anche DENTRO `skills/service.ts`: dei 6
siti misurati da I-C, solo i 2 che decidono «chi scrive/edita una competenza GLOBALE» (create, update)
sono (b); i 4 rimanenti (visibilità, filtro di lista, filtro del grafo, edit non-globale) restano
perimetro tenant e restano `isPlatform(actor)`.

## Sostituzioni fatte (9 file, 19 siti)

| file | siti | predicato |
|---|---|---|
| `skills/service.ts` | 2 (create/update di competenze globali) | `haMandatoPiattaforma` |
| `gdpr/service.ts` | 2 (`assertTenantScope`, `runRetention`) | `haMandatoGdpr` |
| `skill-categories/service.ts` | 1 (`ensurePlatformAdmin`) | `haMandatoPiattaforma` |
| `skill-families/service.ts` | 1 (`ensurePlatformAdmin`) | `haMandatoPiattaforma` |
| `tenant-materialization/service.ts` | 1 (`ensurePlatformAdmin`) | `haMandatoPiattaforma` |
| `delegations/service.ts` | 1 (ambito `FULL`) | `haMandatoPiattaforma` |
| `auth/service.ts` | 2 (`adminRevokeUser`, `adminListSessions`) | `ruoliHannoMandatoPiattaforma` (variante di `mandati.ts` per input senza `ActorContext`, `actorRoles: RoleCode[]`) |
| `process-kpi-templates/service.ts` | 2 (`upsert`, `delete`) | `haMandatoPiattaforma` |
| `content-blueprint-links/service.ts` | 1 (`buildScope`) | `haMandatoPiattaforma` |
| **totale** | **13 siti diretti + 6 conteggiati nella baseline come "già presenti in skills"** | |

Nessun cambio di comportamento: tutti gli insiemi di mandato di oggi (`PLATFORM_MANDATE_ROLES`,
`GDPR_MANDATE_ROLES`) contengono solo `PLATFORM_ADMIN`, identico a `isPlatform(actor)`. Il guadagno è
che un ruolo futuro con lo stesso mandato entra in UN insieme (`mandati.ts`), non in N siti.

## Baseline S-5

Da 102 file / 327 controlli a **94 file / 306 controlli** (`tools/controlli_per_nome.py --baseline`).
8 file sono scesi a zero controlli (rimossi dalla baseline): `auth`, `content-blueprint-links`,
`delegations`, `gdpr`, `process-kpi-templates`, `skill-categories`, `skill-families`,
`tenant-materialization`. `skills/service.ts` è sceso da 6 a 4 (i 4 rimasti sono perimetro, non
mandato). Le due copie della baseline (`apps/api/test/unit/` e `.programmi/.../esiti/`) sono
identiche.

## Prove

- `pnpm typecheck` (apps/api): verde.
- Cricchetto S-5 (`controlli-per-nome.ratchet.unit.test.ts`): **ROSSO** con la baseline vecchia
  (9 file «scesi», compresa la spia di autoverifica) → **VERDE** dopo l'aggiornamento della baseline.
- `role-codes-drift.unit.test.ts`, `role-lists-drift.unit.test.ts`: verdi (nessun ruolo perso dalla
  sostituzione).
- 11 file di test di integrazione dei moduli toccati (`skills`, `skills-i18n`, `gdpr`, `delegations`,
  `auth`, `skill-categories`, `skill-families`, `tenant-materialization`, `process-kpi-templates`,
  `content-blueprint-links`, `role-codes-db-drift`): **82/82 test verdi**, via tunnel da Windows.
- Batteria intera `pnpm --filter @heuresys/api test` (unit + integrazione) sul gemello (linux-pc),
  dopo `git pull --ff-only` (25 commit, residuo pre-esistente sul gemello messo da parte con
  `git stash`, verificato quasi tutto identico a `origin/main` — vedi `REGISTRO_SCOPERTE.md`):
  **verde per intero, nessun `--bail`** (V9).

## Verdetto

R-1 passo 34 **ESEGUITO PER INTERO** sui siti (b) e sulle copie locali indicati da `esiti/I-C.md`.
I siti (c) (perimetro multi-tenant, ~63) restano `isPlatform`/idiomi locali: li porta al resolver
`R-0`, voce successiva del grafo, che costruisce anche il punto unico. **R-1 CHIUSA.**
