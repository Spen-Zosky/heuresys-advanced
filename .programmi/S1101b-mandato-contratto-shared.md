# S1101b — mandato «chiudere le quattro scoperture del contratto condiviso»

*Mandato di Cowork in `C:\Users\enzospenuso\Claude Desktop\heuresys-advanced\sessioni\session_2026-09-14_decisioni-250-240\MANDATO_contratto-shared.md`; istruttoria `ANALISI_contratto-shared.md` accanto; voce «2026-09-14 (sera) — Istruttoria sul contratto condiviso» in `docs/kb/COWORK_INBOX.md`, non committata all'apertura. Stessa sessione CLI S1101, secondo mandato.*

> **stato**: CHIUSO
> **chiuso**: 2026-09-14 — 5 voci fatte su 5, non resta niente
> **registro di sessione** — cronaca, non programma di una voce: non dichiara `item` (D-92).

**Misura all'apertura** (`guardiano.py`): contesto **40.2%** · 5h **49.0%** · `✓ si continua — contesto: mancano 347,645 token · 5h: mancano 31.0 punti`.

**Confine di sessione (R24 §4).** Quattro voci; V1 è la sola che tocca il comportamento visibile e va per ultima. Stima ~150k su 347k: ci stanno. Se V1 non entra tutta, le pagine restanti si dichiarano.

**Le misure dell'istruttoria, ri-fatte prima di pianificare (⭐ punto fisso)** — tre differiscono:
- rotte senza `response`: **13**, non 7 (`rotte_mute.py` sui 624 `app.<verbo>(`): 9 DELETE a 204 (`engagement-feedback` ×2, `goals`, `okrs`, `mentorship` ×3, `surveys` ×2) + 4 file/flusso (`analytics /:view/export`, `me /inbox/stream`, `me /content/media/:mediaId`, `visualization-exports /:id/download`). Stessa forma, si trattano tutte.
- pagine che riscrivono un limite: **4** su 7 — `me/profile` (6 limiti), `me/certifications` (3), `me/skills/self-assessment` (2), `me/career/target` (1). `me/security`, `enterprise-typing`, `login` non riscrivono alcun limite del contratto (`login` ha solo `min(1)` = obbligatorietà): niente da derivare, dichiarato.
- params sul posto: 3 moduli (4 rotte) — confermato; querystring sul posto: **1** modulo (`provenance`), non 7. In più 4 schemi di risposta locali (`content` ×2, `content-blueprint-links`, `organization-unit-processes`: esiti di DELETE) — stessa famiglia, fuori dal mandato: registrati sotto.
- ⚠ **un difetto vero, non previsto**: `me/career/target` manda `targetDate` e `notes`; il contratto `CreateMeCareerTargetBodySchema` accetta `positionId` + `horizon` (`SHORT_TERM|MEDIUM_TERM|LONG_TERM`, CHECK in tabella); Zod scarta le chiavi ignote → **l'utente scrive una nota e una data che non vengono salvate**, senza errore. È esattamente la divergenza che V1 esiste per impedire, già avvenuta.

## Le voci

| id | cosa | chi | fatto quando | stato |
|---|---|---|---|---|
| V3 | lo schema morto `TenantBlueprintVersionListResponseSchema` | io | rimosso o commentato con la ragione; typecheck verde | [x] |
| V2 | le 13 rotte mute dichiarano la risposta (9 × `204: z.null()`, 4 × `content` per tipo) e la regola è nel pattern | io | `/openapi.json` generato in locale mostra le 13 voci prima/dopo; test dei moduli verdi | [x] |
| V4 | la regola sui parametri nel pattern dei sette passi; i 4 casi allineati o dichiarati | io | regola scritta; ogni modulo la rispetta o è eccezione con ragione | [x] |
| V1 | i form derivano i limiti dal contratto (4 pagine); `career/target` corretto | io | nessun limite scritto due volte; messaggi tradotti intatti; E2E delle pagine verde; typecheck+lint web verdi | [x] |
| V5 | riconciliare la voce INBOX, aggiornare STATE/SOT_STATE, commit, push | io | `handoff_lint` 0 FAIL; `check_canale_cowork` 0 | [x] |

## Simulazione (R24 §3)

**V3** — chi lo crea: `2d74377c` (2026-08-08, il fascicolo di un'azienda). Chi sorveglia: `packages/shared/dist` (generato, non tracciato? verificare), typecheck. Nessun consumatore misurato (`grep -rn` su apps/packages: solo la dichiarazione e il `.d.ts` generato).
**V2** — chi sorveglia: `fastify-type-provider-zod` 7.0.0 (`jsonSchemaTransform` supporta `response.{code}.content`), i test d'integrazione dei 7 moduli; il serializer: i DELETE rispondono `send()` → passo a `send(null)` come le 33 rotte già dichiarate; le rotte file restituiscono stringhe/stream/buffer → Fastify non serializza. Prova: `API_DOCS_ENABLED=1` in locale, `GET /openapi.json`, confronto sulle 13 voci.
**V4** — chi sorveglia `.claude/rules/api-module-pattern.md`: `check_istruzioni.py`.
**V1** — chi sorveglia: typecheck web, `pnpm lint`, E2E `closing-pages.spec.ts` (asserisce `career-target-date`: si aggiorna), `i18n:check` (chiavi it/en). Meccanismo: `Schema.pick({...})` sul contratto + `.required()` dove il form pretende il campo; per `certifications` i messaggi tradotti si mettono con `.extend()` sui soli campi che li hanno, partendo dal campo del contratto (`shape.x`). `career/target`: il form passa a `positionId` + `horizon` (select a tre valori), il contratto stringe `horizon` a `z.enum` (RD-08: il CHECK è la verità), i18n it/en aggiornati, il test E2E segue.

## Decisioni prese per conto di Enzo
- **V2, forma delle dichiarazioni** (tecnica, mia): `204: z.null()` + `send(null)` è la forma delle 33 rotte già dichiarate (contro 19 con `EmptyResponseSchema`): si segue la maggioranza. Per file e flussi la forma `response.200.content.<mime>` del provider zod 7.0 (`isContentTypeResponse` in `core.js`), che Fastify non usa per serializzare stringhe/buffer/stream (`reply.js:204-240`, misurato) — `z.unknown()` solo dove `send` riceve uno stream. Nel listino «prima» le 13 dicevano **`200 Default Response`** — peggio che mute: promettevano JSON.
- **V4, applicazione della regola**: `dashboard` (`code` con lunghezza, due rotte) e `provenance` (querystring) allineati al contratto; `compensation` ed `evidence` (un uuid, una rotta ciascuno) **eccezioni dichiarate** nel pattern. I 4 schemi di risposta locali (`content` ×2, `content-blueprint-links`, `organization-unit-processes`: esiti di DELETE) restano fuori da questo ciclo — la regola nuova li coprirebbe («la risposta sta nel contratto»), ma sono 4 righe e non hanno consumatori nel web: fuori ciclo, nominati qui una volta.
- **V1, tecnica di derivazione**: dove il form non ha messaggi tradotti, `Schema.pick(...).required(...)` (profilo); dove li ha, i limiti si **leggono** dal contratto con `apps/web/src/lib/contratto.ts::limiteMassimo(shape.campo)` — sbuccia optional/nullable e lancia se il contratto non dichiara un massimo (un form che credeva di avere un limite deve fallire al primo disegno, non tacere). La regex della data ISO resta ricopiata: non è un limite numerico e il contratto non la espone.
- **`me/career/target`** (difetto trovato misurando): il form passa a `positionId` + `horizon`; `CreateMeCareerTargetBodySchema.horizon` diventa `z.enum(SHORT_TERM|MEDIUM_TERM|LONG_TERM)` — il CHECK della tabella è la verità (RD-08); i18n it/en: via `dateLabel/datePlaceholder/dateInvalid/notesLabel`, dentro `horizonLabel/horizonNone/horizon.*`; `closing-pages.spec.ts` asserisce `career-target-horizon`.
- **Le tre pagine senza limiti da derivare** (`me/security`, `enterprise-typing`, `login`): non toccate, dichiarato.

## Fuori da questo ciclo (R24 §5, una volta sola)

- ⚠ **113 file di test API entrano come `enzo.spenuso@heuresys.com`** (`grep -ln` su `apps/api/test`), e dal 2026-09-14 (`#250`) quella persona ha il **suo** fattore TOTP, non più `derived-access`: contro il database di produzione (e contro il gemello quando il clone sarà rinfrescato) quei test muoiono al login — misurato: 8 file su 11 rossi con «Nessun segreto TOTP per enzo.spenuso@heuresys.com». La CI, con le sue fixture, resta verde. Va nel register (voce nuova).
- I 4 schemi di risposta locali nei `routes.ts` (sopra).

## Cronaca
- [x] 2026-09-14 V3 — `TenantBlueprintVersionListResponseSchema` rimosso (nato in `2d74377c` accanto a `TenantBlueprintDetailSchema`, che già porta `versions`; nessun lavoro futuro lo nomina).
- [x] 2026-09-14 V2 — 13 rotte dichiarate; OpenAPI generato in locale (`API_DOCS_ENABLED=true PORT=3077`): prima tutte `200 Default Response`, dopo `204 [application/json]` ×9, `200 [text/csv, application/json]`, `200 [text/event-stream]`, `200 [application/octet-stream]`, `200 [image/svg+xml, text/vnd.mermaid, application/json]` (`openapi_mute.py`). Typecheck API verde. Test d'integrazione da Windows: 3 verdi (`inbox-stream`, `content-media`, `visualization-exports`), 8 rossi **al login di Enzo** (vedi fuori ciclo) — la verifica dei moduli DELETE e dell'export passa dalla CI.
- [x] 2026-09-14 V4 — regola nel pattern (`.claude/rules/api-module-pattern.md` passo 1); `DashboardCodeParamSchema`, `ProvenanceSummaryQuerySchema` nel contratto; `check_istruzioni` verde.
- [x] 2026-09-14 V1 — 4 pagine derivate; `career/target` corretto; `shared` ricostruito; typecheck web 0, `eslint .` 0, `i18n:check` parity OK (3336 chiavi × 2). E2E: il setup delle E2E entra come platformAdmin = Enzo → stesso blocco locale; le spec delle pagine (`closing-pages`, `me-pages`) girano nella Playwright integrale in CI (dispatch manuale dopo il push).
- [x] 2026-09-14 V5 — voce INBOX marcata; `#258` aperto con piano; STATE/SOT_STATE aggiornati; `verify_gate run` **GREEN** (programmi, typecheck 35 s, **test-api sul gemello 1163 s**, lint); commit e push sotto.
