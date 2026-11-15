# Forense frontend 15/11/2026 — sorgente, rotte, contratto API, stack (voce I5)

Specialista: sorgente, rotte, contratto API e stack. Sola lettura sul codice del repo; l'unico file scritto è questo. Base: worktree `bridge-cse_01L8VLYX245sXZqq6StzD8sm`, HEAD `e676f6dd`, atlante `docs/kb/atlas/atlas.yaml` dichiarato fresco da `atlante_fresco.py`. Gli script di misura stanno nello scratchpad della sessione e non sono nel repo; ogni comando è riportato sotto.

## 0. Stack (controllo 5)

| comando | uscita | esito |
|---|---|---|
| `pnpm -C apps/web typecheck` (`tsc -p tsconfig.json --noEmit`) | 0 | nessun errore |
| `pnpm -C apps/web lint` (`eslint .`) | 0 | nessun rilievo |
| `pnpm -C apps/web test` (`vitest run`) | 0 | 20 file, 122 test passati |
| `pnpm -C apps/web i18n:check` | 0 | «Parity OK (4423 keys × 2 locales × 10 namespaces)» |
| `python docs/kb/tools/check_pagine_raggiungibili.py` | 1 | NON MISURABILE: il menu si legge con `psql` su `localhost` e la connessione fallisce; `--selftest` 10/10. Rifatto da me con la tabella `sys.sys_ui_interfaces` letta con `sql-sola-lettura.mts` (controllo 3) |
| `python docs/kb/tools/check_pagine_orfane.py` | 2 | NON MISURABILE (database non interrogabile da quello strumento) |
| `python docs/kb/tools/check_permessi_inutili.py` | 2 | NON MISURABILE (idem) |
| `python docs/kb/tools/check_exposure.py` | 1 | 153 tabelle popolate, 143 lette da un modulo API, 9 esentate, 1 NON ESPOSTA: `sys_mandate_act_audit` (migrazione 000475). È un rilievo di esposizione dati, non di pagina: lo passo ai thread dei dati |

Nota: la parità i18n dice solo che le chiavi esistono in entrambe le lingue, non che il testo inglese sia inglese (vedi S-07).

## 1. Contratto web → API (controllo 1)

Misura:
- Riferimenti letterali a `/v1/…` nel sorgente web (commenti esclusi): 400. Chiamate `apiFetch` lette con il compilatore TypeScript (`tsc` API sul programma di `apps/web`): 360.
- Rotte API: 800 voci nell'atlante (metodo, percorso completo con prefissi di `app.ts`, permesso). Il compilatore sul programma di `apps/api` ha estratto 726 registrazioni `app.<metodo>(percorso, {schema:{response}})`.
- Esito percorso+metodo: 400 riferimenti, 12 senza corrispondenza automatica; verificati uno per uno a mano: 11 falsi positivi (percorsi in un elenco di esclusioni di `fetch.ts:166`, metodo POST dichiarato più avanti nel file `login/page.tsx:357-362`, `${qs}` e `${status}` che il lettore tagliava male in `evidence-drawer.tsx:52`, `organigramma/dati.ts:17`, `leads/page.tsx:41`, rotta registrata fuori dai moduli `GET /v1/meta/data-origins` in `lib/origine/origine.ts:150`) e 1 vero: le righe finte di `components/SystemHealthDashboard.tsx:235-240` (S-12). **Chiamate a rotte inesistenti: 0.** `fetch` diretto (non `apiFetch`): `/api/v1/public/platform-stats`, `/api/v1/public/job-postings`, `POST /api/v1/leads`, `download.ts`, gateway agenti (servizio a parte): tutti esistenti.
- Esito campi: delle 360 chiamate `apiFetch`, 40 non confrontabili (URL costruito da variabile: ne ho risolti a mano `BASE`, `RUNS`, `base` e `basePath`, tutti esistenti; oppure senza tipo generico, per lo più POST/DELETE senza corpo letto), 7 DELETE con risposta 204 senza schema, 2 con query in template; **306 chiamate coerenti** (ogni campo del tipo letto dal web esiste nello schema di risposta della rotta, ricorsivamente fino a profondità 6) e 5 divergenze segnalate, di cui 2 falsi positivi (`avviso-bozza-consolidamento.tsx:18`: l'atlante associa a `/pending-approval` la rotta `/:id` di un altro plugin; `registro-corse.tsx:63`: stesso errore di prefisso, lo schema vero `BlueprintRunListResponseSchema` è giusto) e 1 vera con tre punti di ingresso (S-01).
- Limite dichiarato: il confronto vale per i campi dichiarati nei tipi del web, non per ogni lettura `x.y` su valori `any`; non ho trovato letture su `any` di risposta API (`grep 'as any'` e `: any` in `apps/web/src` fuori dai test: 0 occorrenze).

### S-01 — `/v1/auth/me` non restituisce il nome: l'intestazione mostra l'email — gravità ALTA

- Dove: `apps/web/src/lib/api/auth.ts:19-27` (`AuthMeUser` dichiara `displayName`, `tenantId`, `locale`, `timezone`, `roles`), letto in `apps/web/src/app/(authenticated)/layout.tsx:300-307` (`displayName = user.displayName?.trim() || user.email`, iniziali dalle prime due lettere dell'email) e nel piede della barra laterale `layout.tsx:355` (`user.email`). Lato API: `packages/shared/src/schemas/auth.ts:147-152` (`MeResponseSchema` = `userId, email, roles, tenantId`) e `apps/api/src/modules/auth/service.ts:654-662` (`getMe` restituisce solo quei quattro). Stessa divergenza nel corpo di `POST /v1/auth/login` e di `POST /v1/auth/mfa/webauthn/authentication/verify` (`user.displayName/tenantId/locale/timezone/roles` dichiarati dal web e assenti dallo schema), `login/page.tsx:241` e `auth.ts:201`, `auth.ts:220` (`setQueryData(AUTH_ME_QUERY_KEY, {...res.user, roles})`).
- Cosa è sbagliato: il campo `displayName` letto dal layout non arriva mai; in ogni pagina autenticata la persona in alto a destra è l'email e le iniziali sono le prime due lettere dell'email (classe C2). Non ho potuto rifare la chiamata dal vivo (`chiama-come.mts … /v1/auth/me` ha risposto «accesso rifiutato: HTTP 429», limite di richieste mentre gira il giro qa-web); la conclusione poggia sul codice: `getMe` costruisce l'oggetto a mano con quattro campi e lo schema di risposta li esaurisce.
- Correzione centrale: aggiungere il nome (come «Cognome, Nome», con `firstName`/`lastName` dal profilo) a `MeResponseSchema` e a `getMe`, oppure far leggere al layout `/v1/me/profile` (già nella cache di sessione); togliere `locale`/`timezone` da `AuthMeUser` (la lingua viene da `/v1/me/preferences`).

## 2. Permessi: voci di menu e schede contro le rotte (controllo 2)

Misura:
- `sys.sys_ui_interfaces`: 87 righe, 78 attive e 9 inattive. `sys.sys_auth_role_permissions` (non revocate) × `sys.sys_auth_roles` (non ritirati): 24 ruoli, 1.314 coppie. Il ruolo `USER` è implicito per tutti (`apps/api/src/modules/auth/repository.ts:107-125`), quindi i permessi effettivi di ogni ruolo sono i suoi più quelli di `USER`; senza questa correzione la prima passata dava 20 ruoli «senza permesso» sulle pagine `me/*`, risultato sbagliato che ho scartato.
- Per ogni voce attiva: ruoli titolari del permesso della voce (`ui_interface_required_resource:action`) × tutte le rotte `GET` raggiunte dalla pagina (ricavate dal grafo delle importazioni di `page.tsx`, commenti esclusi, 132 pagine) × permesso `requirePermission` della rotta.
- Esito: **0 voci con una `GET` della pagina negata a un ruolo che vede la voce** (la sola candidata, `system-health` → `GET /v1/auth/role-permissions` che richiede `role_matrix:read` e `PLATFORM_OPERATOR` non lo ha, è già gestita da `SystemHealthLive.tsx:149-152` con `useCan("role_matrix:read")`).
- Permessi usati dal web (`useCan`, `perms.has`, 54 codici) contro i 250 del database: tutti esistenti tranne `platform:manage` (`kpis/_components/kpi-forms.tsx:60`, in `||` con `tenant:create`: innocuo, ma è un codice morto) e quelli dei dati finti di `SystemHealthDashboard.tsx:289-297`.
- Scritture (POST/PATCH/DELETE) di una pagina il cui permesso non è di tutti i titolari della voce: 33 coppie; per 30 la pagina nasconde il comando con lo stesso permesso (`useCan`/`perms.has`); le altre sono S-03 e S-04.

### S-02 — Le schede di sezione si mostrano a tutti, anche a chi riceverà «negato» — gravità ALTA

- Dove: `apps/web/src/components/section-tabs.tsx:30-75` (elenco fisso `MERGE_GROUPS`) e `:85-120` (`SectionTabs` disegna tutte le schede del gruppo senza guardare il registro), montato in `app/(authenticated)/layout.tsx:404`. La guardia `lib/page-guard.ts` poi nega la pagina (`layout.tsx:293`), quindi la scheda è un collegamento a una pagina «negata».
- Cosa è sbagliato: i titolari del permesso della pagina principale del gruppo che non hanno il permesso della scheda: scheda `/gaps` (permesso `gap_analysis:read`) senza permesso per `BLUEPRINT_MANAGER`, `PROCESS_OWNER`; scheda `/compensation-intelligence` (`compensation_intelligence:read`) per `BLUEPRINT_MANAGER`, `PROCESS_OWNER`, `MANAGER`; scheda `/insights/succession-readiness` (`insights:view`) per `CEO`; scheda `/analytics/org-network` (`analytics:view`) per 16 ruoli titolari di `organization_unit:read` (nel perimetro del thread organigrammi). Le righe di queste schede nel registro sono tutte `is_active=false` (9 righe), cioè la voce non è nel menu ma la guardia la conosce e nega.
- Perché: stesso criterio della barra laterale («chi non può aprire la pagina non vede la voce», commento di `meService.getInterfaces`, `apps/api/src/modules/me/service.ts:149-152`), non applicato alle schede. Il calcolo è fatto sul solo permesso della voce; che la persona veda anche la scheda principale dipende dalle condizioni aggiuntive del servizio (`requires_admin`, matrice dei domini), ma la scheda compare comunque a chiunque apra la principale.
- Correzione centrale: `SectionTabs` filtra le schede con `routes[].allowed` di `GET /v1/me/interfaces` (la stessa fonte della guardia, `pageVerdict`). Un solo punto.

### S-03 — «Aggiungi/elimina alias» offerti a chi non ha `skill_alias:manage` — gravità MEDIA (403 su un comando visibile)

- Dove: `apps/web/src/app/(authenticated)/skills/_components/skill-relations.tsx:47-80,124-141` (`SkillAliasesPanel` gated da `skill:update`, righe 50-51 di `skills/page.tsx` e `:99`) contro `POST/DELETE /v1/skill-aliases` che richiedono `skill_alias:manage`.
- Perché: `skill:update` lo hanno `HRMS_MANAGER`, `PEOPLE_MANAGER`, `PLATFORM_ADMIN`, `TAXONOMY_STEWARD`, `TENANT_ADMIN`; `skill_alias:manage` solo `HRMS_MANAGER`, `PLATFORM_ADMIN`, `TAXONOMY_STEWARD`, `TENANT_ADMIN`: `PEOPLE_MANAGER` vede il modulo e riceve 403 (misura: query ruolo×permesso su `sys_auth_role_permissions`).
- Correzione: `canManageAliases = perms.has("skill_alias:manage")` nel pannello (un permesso in un punto); nessun cambio di matrice.

### S-04 — «Approva/Rifiuta» nella casella personale senza controllo del permesso — gravità BASSA

- Dove: `apps/web/src/app/(authenticated)/me/inbox/page.tsx:89-92,159-162` chiama `POST /v1/approvals/:id/steps/:stepId/decide` che richiede `approval:decide` (9 ruoli su 24). Il pulsante dipende dal tipo di notifica, non dal permesso: se una notifica di approvazione arriva a un ruolo senza il permesso (delega), riceve 403. Non ho trovato prove di notifiche a ruoli senza permesso; la regola della pagina `approvals/[id]` (`page.tsx` usa `approval:decide`) è quella da portare qui.

## 3. Rotte, collegamenti e raggiungibilità (controllo 3)

Misura:
- Pagine `page.tsx` in `src/app`: 132 (85 autenticate non di dettaglio più dettagli, più le pubbliche); rotte reali = pagine più `route.ts`.
- Collegamenti interni (`href=`, `href:`, `router.push/replace`, `redirect`, `Link`) trovati: 144; **punti a una rotta inesistente: 0**.
- Voci del registro `sys_ui_interfaces` (87) contro le pagine: **0 voci senza pagina** (le `/dashboard/<famiglia>` si risolvono tutte su `dashboard/[famiglia]/page.tsx`, che sceglie la famiglia dal catalogo restituito dall'API).
- Pagine senza porta (non nel registro, non scheda di sezione, nessun collegamento in ingresso da un altro file): `/app` (redirect calcolato dalla sessione, il logo vi porta), `/demo`, `/investors`, `/jobs` (pagine pubbliche, `proxy.ts:20`) e `/dev/agent` (deroga motivata in `docs/kb/tools/pagine_waivers.txt`, dietro `NEXT_PUBLIC_ENABLE_AGENT_DEV`; in produzione risponde 307 al login). Le pagine con parametri (`[id]` ecc.) hanno tutte un collegamento in ingresso da una lista.
- `/showcase/*` (18 pagine con dati fissi): in produzione risponde 404 (`curl -4 https://www.heuresys.com/showcase/system-health` = 404, `layout.tsx:20-24` lo abilita solo con `NEXT_PUBLIC_ENABLE_SHOWCASE=1` o fuori da `NODE_ENV=production`).

Nessun rilievo di rotta, a parte S-02.

## 4. Regole dell'interfaccia C1-C15 nel codice (controllo 4)

### 4.1 Lingua e messaggi (C1)

Misura: 4.423 chiavi in 10 spazi di nomi, parità it/en esatta (`i18n:check`); valori vuoti: 0; chiavi `t("…")` letterali usate nel codice e assenti in `it`: 1 (`jobCatalog.countOf`, falso positivo: la funzione riceve `t` da un componente che ha lo spazio `admin`, la chiave c'è in `admin.json:1543`); chiavi dinamiche `t(\`prefisso.${x}\`)`: 187, di cui 149 risolte con il tipo letterale di `x` (ogni valore ha la voce in it e en, tranne 4 falsi positivi su `investors/page.tsx:50` dove il tipo è più largo dell'elenco), 38 non risolvibili (valori dall'API, per esempio codici di errore: restano alla misura dal vivo del giro qa-web). Stringhe JSX letterali (attributi `title/label/placeholder/aria-label…` e testo fra tag): fuori da `scheda-rapida.tsx`, `quadro-insight.tsx:78` e `global-error.tsx` (ultima spiaggia dichiarata) il codice delle pagine non ne contiene (misura euristica con espressioni regolari, non un analizzatore di JSX: può perdere i testi costruiti in espressioni). Un valore it==en di almeno due parole: 18 chiavi, di cui 2 vere (S-05).

#### S-05 — Due titoli inglesi sono in italiano — gravità MEDIA

- `apps/web/src/locales/en/ess.json:561` `security.title` = «Sicurezza account» e `:678` `team.title` = «Il mio team», identici all'italiano. La parità di chiavi non li vede. Correzione: tradurli («Account security», «My team»). Le altre 16 chiavi it==en sono nomi propri, `v5 · heuresys-advanced`, «min», nomi dei passi della demo (`demo.json` `steps.sNN.persona`) e `Team leader`.

#### S-06 — Testi italiani fuori dai messaggi: in inglese compaiono in italiano — gravità MEDIA (causa radice unica: lib e componenti condivisi non passano da i18n)

- `apps/web/src/lib/glossario.ts` (≈100 voci in italiano; le chiavi di `CONCETTI` sono parole italiane e `spiegazioneDi` confronta con il titolo della colonna: in inglese una colonna «Priority» non trova la voce `priorità` e l'InfoTip non compare; quando compare è in italiano).
- `apps/web/src/lib/lettura-grafico.ts:42-43,56,85,102,126`: la frase che spiega ogni grafico («Il valore più alto è … su N celle») è in italiano in ogni lingua, e così «Asse orizzontale/verticale»; `lettura-grafico.ts` riceve `locale` ma lo usa solo per i numeri. Sta sotto ogni `EChartsCard`.
- `apps/web/src/components/scheda-rapida.tsx` (la scheda a cascata, 24 stringhe: «Non indicato» `:90`, «Questa persona non è nel tuo perimetro» `:121`, «Riporta a», «Nella stessa unità», «Le riportano», «Scoperta», «Percorso» `:256`…) usata fuori dall'organigramma da `layout.tsx`, `positions/[positionId]/page.tsx`, `me/team/page.tsx`, `lib/leggibile.tsx`; `components/quadro-insight.tsx:78` `aria-label="Da guardare"`.
- `apps/web/src/lib/agente/vista-tabella.ts:126-151`, `bozza-oggetto.ts:79-97` (risposte dell'agente alla pagina) e `lib/contratto.ts` (un messaggio di errore).
- Correzione centrale: spostare le stringhe nei dizionari (`common:glossario.*`, `common:lettura.*`, `common:schedaRapida.*`) e far scegliere la lingua a `spiegazioneDi(titolo, lingua)`; una sola passata sui quattro file.

#### S-07 — Anglicismi non glossati nei testi italiani — gravità BASSA

- 30 valori `it` con parole inglesi: `flight-risk` (`admin.json` `insights.*`, `landing`, `investors`), «Span of control (primi 15)» (`analytics.json` `orgNetwork.spanTitle`), «scope», «policy», «workflow», «feedback». Sono termini di mestiere, ma «Span of control» e «flight-risk» non sono nel glossario; un InfoTip basta. Nessun codice grezzo del tipo `APPROVED` è emerso dal sorgente: i valori enumerati passano da `useEnumLabel` (`lib/enum-labels.ts:34-39`, con ripiego `codiceInParole`) o da dizionari `t(\`…${valore}\`)`.

### 4.2 Codici mostrati senza dizionario (C1/C3)

Misura: circa 85 punti di rendering `{x.status|type|kind|…}`: tutti passano da `t(\`…\`)` o `enumLabel`, tranne testo libero (`reason`, `role` di un lead `leads/page.tsx:75`) e codici accanto alla descrizione (corretti). Rilievi:
- `apps/web/src/app/(authenticated)/time-off/page.tsx:50-51`: `{r.amount}` (importo di maturazione con decimali, es. 0.5) e `{r.ccnlType ?? "—"}` (tipo CCNL grezzo, codice di lavoro) senza formattatore né dizionario — gravità MEDIA, rientra in S-08.
- UUID/codici come ripiego del nome: `app/(authenticated)/projects/[id]/page.tsx:103` (`m.fullName ?? m.email ?? m.userId`), `components/semantic-search-panel.tsx:88` (`m.skillName ?? m.skillId`), `blueprints/page.tsx:121` (`v?.name ?? a.variantId`), `org-director/page.tsx:103` (`c.label ?? c.subjectId`) — gravità MEDIA: il ripiego corretto esiste già, `NomeOppure`/`SenzaNome` (`components/senza-nome.tsx`); estenderlo e usarlo in questi quattro punti.

### 4.3 Numeri e date formattati a mano (C4)

#### S-08 — Il formattatore comune è aggirato in 7 punti, e il contratto «4.069» si rompe nel grafico, nella tabella del grafico e nel quadro — gravità MEDIA

Prova della causa: ICU italiano omette il separatore sotto le 5 cifre. Da shell: `(1234).toLocaleString("it-IT")` = `1234`; `new Intl.NumberFormat("it-IT",{maximumFractionDigits:2}).format(4069)` = `4069`; con `useGrouping:"always"` (come fa `lib/format.ts:55,116-144`) = `4.069`. I punti sotto usano la forma senza `always`:
- `app/(authenticated)/_charts-client.tsx:88-89` (`numeroLocale`: assi di valore e riquadro al passaggio di tutti i 26 grafici) e `:174` (`TabellaEquivalente`, tabella sotto ogni grafico: `v.toLocaleString(lingua,{maximumFractionDigits:2})`);
- `components/schede-pagina.tsx:53` e `components/quadro-insight.tsx:40` (`toLocaleString("it-IT")` fisso: anche in inglese esce con la forma italiana);
- `app/(authenticated)/dashboard/[famiglia]/page.tsx:149` (`r.value.toLocaleString(lingua)`);
- `app/(authenticated)/analytics/compensation/page.tsx:98` (`new Intl.NumberFormat(en→en-US, it-IT)`: nel resto del prodotto l'inglese è `en-GB`);
- `components/pannello-agente.tsx:77` (`new Date(iso).toLocaleString(i18n.language)` al posto di `fmt.dataOra`);
- `app/(authenticated)/me/_components/performance-tab.tsx:35` (`overallRating.toFixed(1)`: punto decimale in italiano).
Numeri interi o decimali scritti senza formattatore (valori tipici sotto 1000, da misurare con la classe C4 del giro): `time-off/page.tsx:50` (`r.amount`), `talent-review/page.tsx:41` (`r.score`), `recruiting/requisitions/page.tsx:182` (`r.headcount`), `approvals/page.tsx:282,297` (`p.count`, `st.count`), `analytics/skills-graph/page.tsx:143-153` (`String(d.counts.nodes…)`), `org-director/advisor/page.tsx:75` e `org-director/health/page.tsx:55` (`Math.round(...)`), `analytics/{attendance,overtime,kpi,compensation}` con `Math.round(...)` passato come `value` di `StatsCard` (qui dipende da `StatsCard`: da misurare dal vivo).
- Correzione centrale: una sola funzione `numero()`/`numeroFisso()` di `lib/format.ts` richiamata da `_charts-client.tsx` (`numeroLocale`, `TabellaEquivalente`, `lettura-grafico.ts:37,67,136`), da `schede-pagina`, `quadro-insight` e `dashboard/[famiglia]`; e una regola ESLint `no-restricted-properties` su `toFixed`/`toLocaleString`/`new Intl.NumberFormat` fuori da `lib/format.ts` e `lib/i18n.ts`, che oggi il lint (exit 0) non vede.

### 4.4 Persone (C2)

Misura: elenchi di persone che passano da `NomePersona`/`NomeOppure`/`cognomeNome`/`etichettaPersona` (`lib/person-label.ts`): la maggioranza. Rilievi:
- S-01 (email nell'intestazione, sopra).
- `app/(authenticated)/recruiting/applications/[id]/page.tsx:352` e `organization/_components/org-unit-forms.tsx:212,362`: `<option>{u.displayName}</option>` («Nome Cognome») al posto di `etichettaPersona(u, enumLabel)` che esiste ed è usata altrove — MEDIA.
- `admin/mfa-policy/page.tsx:215,220`: `{e.userDisplayName ?? e.userEmail}` e riga con `{e.userEmail}`; `projects/[id]/page.tsx:103`: `m.fullName ?? m.email` — MEDIA (nome in forma «Nome Cognome» e email come ripiego).
- Titoli di spiegazione `insights/page.tsx:125`, `insights/skill-gap/page.tsx:134`, `insights/succession-readiness/page.tsx:134`: `selected.displayName` in forma «Nome Cognome» — BASSA.
- `me/profile/page.tsx:268` e `leads/page.tsx:66` mostrano email con il marcatore `data-giro-email-ammessa` (ammesso dal giro).
- Correzione centrale: `NomePersona`/`etichettaPersona` come unico modo di scrivere una persona; il dato `fullName`/`displayName` dell'API va sostituito con `firstName`/`lastName` quando il modulo li restituisce.

### 4.5 Grafici (C8, V-11)

Misura: 26 usi di `EChartsCard` fuori dal wrapper; tutti hanno `ariaLabel` e un titolo vicino (2 senza titolo rilevato dal lettore: `engagement/page.tsx:133` e `organigramma/nodi.tsx:119`, quest'ultimo escluso dal perimetro); la frase di lettura e la tabella equivalente sono generate da `letturaDelGrafico` per tutti (ma in italiano, S-06); **19 su 26 senza `assi` (nome e unità degli assi)**: `analytics/kpi/page.tsx:111` (la barra è la percentuale di raggiungimento ma l'asse non dice «%»), `analytics/skills/page.tsx:148,167`, `analytics/workforce/page.tsx:146,160`, `analytics/compensation/page.tsx:199,215`, `analytics/skills-by-category/page.tsx:149,168`, `analytics/skills-group-share/page.tsx:107`, `analytics/overtime/page.tsx:223`, `visualizations/page.tsx:131`, `engagement/[surveyId]/page.tsx:100`, `compensation-intelligence/page.tsx:785`, `career-succession/page.tsx:172`, più le tre di `analytics/org-network` e `organigramma` (altro thread). Gravità MEDIA (C8: «assi senza unità»). Correzione centrale: rendere `assi` obbligatorio nel tipo `EChartsCardProps` (`_charts-client.tsx:141-146`) per le serie cartesiane, o ricavare il nome dell'asse dal `name` della serie quando manca; un solo punto. Il giro qa-web classe C8 lo verificherà dal vivo.

### 4.6 Finestre modali (V-11 ridimensionamento)

Misura: 8 `DialogContent` nel sorgente (`grep -c "<DialogContent"`); il componente di `@heuresys/ui` ha `max-w-lg` e nessun `max-h` né scorrimento (classi `fixed left-[50%] top-[50%] … max-w-lg … p-6`). Cinque lo dichiarano (`max-h-[85vh|90vh] overflow-y-auto`): `data-table-panel.tsx:275`, `okr-checkins-dialog.tsx:35`, `evidence-drawer.tsx:69`, `goal-timeline-dialog.tsx:129`, `scheda-rapida.tsx:249`. Senza: `consolidation/decisione-dialog.tsx:57` (contiene raccomandazione, due elenchi di cascata, scelta tra decisioni, motivazione: su schermo basso o a 390 px il fondo con i pulsanti sta fuori dalla vista — MEDIA), `consolidation/page.tsx:478` (BASSA, testo corto), `components/step-up-dialog.tsx:134` (BASSA). Correzione centrale: `max-h-[90vh] overflow-y-auto` come predefinito di `DialogContent` in `@heuresys/ui` (repo `ux-design-shared`), così tutte le finestre lo ereditano.

### 4.7 Dati finti o fissi (frontend-live-data)

- `components/SystemHealthDashboard.tsx` (334 righe: `GENESIS_DEMO`, `ACME_CORP`, 38.421 richieste, query SQL e log inventati) + 17 pagine `app/showcase/*`: sono la vetrina del marchio, dichiarata «BRAND SHOWCASE ONLY» nel file, 404 in produzione (verificato). Violano la lettera della regola «nessun mock» ma non raggiungono nessun utente: BASSA, proposta: spostare `showcase` in `apps/showcase`/`ux-design-shared` o toglierlo dal build di `apps/web`.
- `/demo`: schermate statiche (`public/demo/*.png`, `app/demo/page.tsx:7-18`) con narrazione in `demo.json`: pagina pubblica di marketing; le immagini non seguono il prodotto — BASSA.
- `investors.json` `whyNow.body`: «36 ADR al 9 settembre 2026» scritto a mano (numero che cambia: CLAUDE.md chiede di scrivere il comando, non il numero) — BASSA.
- Nessun `initialData`/`placeholderData` con dati inventati: `use-paginated-list.ts:86` usa `keepPreviousData` (corretto); `auth.ts:78` rilegge la copia di sessione (legittimo, v. `session-cache.ts`).
- Nessun `Math.random`, `lorem`, `fixture` fuori da showcase.

### 4.8 Componenti riutilizzabili creati in `apps/web` (design-system-ui)

- Dodici componenti di `apps/web/src/components/` non portano né schemi `@heuresys/shared` né `apiFetch`/`useQuery` e quindi non rientrano nell'eccezione «widget specifico di heuresys-advanced»: `status-pill.tsx`, `enum-badge.tsx`, `detail-panel.tsx`, `senza-nome.tsx`, `intestazione-pagina.tsx`, `spiegazione.tsx`, `schede-pagina.tsx`, `stato-pagina.tsx`, `indicatori-leggibili.tsx`, `data-table-panel.tsx` (373 righe, `EntityTable`), `profile-tabs.tsx`, `section-tabs.tsx` (quest'ultimo contiene l'elenco dei gruppi del prodotto: resta qui, ma va reso permission-aware, S-02). Più `app/(authenticated)/_charts-client.tsx` (involucro dei grafici). Gravità BASSA (architettura), correzione centrale: migrarli a `ux-design-shared` quando si tocca `@heuresys/ui` per S-06 e per `DialogContent`; non è un lavoro da fare isolatamente.
- `apps/web/package.json` dichiara `lucide-react` come dipendenza di runtime (39 file lo importano direttamente): è una libreria di icone UI, che la regola assegna a `@heuresys/ui`. BASSA.

### 4.9 Altre classi (misurate, non rilievi)

C5 (pagine lunghe, 16 pagine usano `SchedePagina`), C13 (glossario con ≈100 voci), C15 (`QuadroInsight` montato da `IntestazionePagina`, `components/intestazione-pagina.tsx`): presenti per costruzione; la misura dal vivo spetta al giro qa-web (I1). Nessun `dangerouslySetInnerHTML` tranne lo script del tema (`app/layout.tsx:35`, contenuto costante).

## 5. Per il thread organigrammi (fuori dal mio perimetro)

- Scheda `/analytics/org-network` nel gruppo `org` di `section-tabs.tsx:36-39`: compare a 16 ruoli che non hanno `analytics:view` e che aprono `/organization` (S-02); la correzione è nel componente centrale, non in quella pagina.
- `components/organigramma/blocchi.tsx:75,77` usa `toFixed(2)` per la scala dello zoom (calcolo, non testo: nessun difetto).
- Le chiavi `organigramma.*` risolte in codice (`vista.tsx:64-70`, `blocchi.tsx:133-138`, `nodi.tsx:89`) esistono tutte in it e en.

## 6. Registro dei rilievi (per il registro §3 del piano)

| id | causa radice | gravità | correzione centrale |
|---|---|---|---|
| S-01 | `AuthMeUser` dichiara campi che `/v1/auth/me` e `/v1/auth/login` non restituiscono | alta | aggiungere il nome allo schema e a `getMe` (o leggere `/v1/me/profile` nel layout); togliere `locale`/`timezone` dal tipo |
| S-02 | `SectionTabs` non filtra per permesso | alta | usare `routes[].allowed` di `/v1/me/interfaces` |
| S-03 | pannello alias gated da `skill:update` e non da `skill_alias:manage` | media | un permesso nel pannello |
| S-04 | decisione in casella senza `approval:decide` | bassa | stesso controllo di `approvals/[id]` |
| S-05 | due titoli `en/ess.json` in italiano | media | tradurre |
| S-06 | glossario, lettura dei grafici, scheda rapida, risposte agente in italiano fuori da i18n | media | dizionari + `spiegazioneDi(titolo, lingua)` |
| S-07 | anglicismi non glossati | bassa | voci di glossario |
| S-08 | `toLocaleString`/`Intl` senza `useGrouping:"always"`, `toFixed`, `it-IT` fisso | media | `numero()` di `lib/format.ts` ovunque + regola ESLint |
| S-09 | `displayName` e UUID al posto di «Cognome, Nome» / `NomeOppure` (almeno 7 punti) | media | `etichettaPersona`, `NomeOppure` |
| S-10 | 19 grafici su 26 senza nome e unità degli assi | media | `assi` obbligatorio o derivato nel wrapper |
| S-11 | `DialogContent` senza `max-h`/scorrimento (decisione consolidamento) | media | predefinito in `@heuresys/ui` |
| S-12 | vetrina `showcase` con dati fissi nel build di `apps/web` (404 in produzione) | bassa | spostare fuori da `apps/web` |
| S-13 | dodici componenti riutilizzabili e `lucide-react` in `apps/web` | bassa | migrazione a `ux-design-shared` insieme a S-06/S-11 |
| S-14 | `/demo` con schermate statiche, numero scritto a mano in `investors` | bassa | rigenerare dalla pagina viva / scrivere il comando |

## 7. Riassunto

1. Stack verde: typecheck 0, lint 0, vitest 122/122, parità i18n 4.423 chiavi; i controlli python sul menu non sono misurabili da quello strumento (database), rifatti con il database in sola lettura.
2. Contratto: 400 riferimenti `/v1/*`, 0 rotte inesistenti; 360 chiamate `apiFetch` tipate, 306 coerenti campo per campo con lo schema Zod di risposta, 1 divergenza vera (S-01), 2 falsi positivi.
3. Permessi: 87 righe di registro (78 attive), 24 ruoli con `USER` implicito: 0 voci con una lettura negata; 2 comandi visibili con 403 o rischio 403 (S-03, S-04).
4. Rotte: 132 pagine, 144 collegamenti, 0 rotte rotte, 0 voci senza pagina; solo pagine pubbliche e `/dev/agent` senza porta, tutte con motivo.
5. Rilievi: 14 (2 alti, 7 medi, 5 bassi), nessuna pagina rotta e nessuna chiamata a rotta inesistente; il più urgente tocca ogni pagina.
6. Causa radice 1 (alta): il tipo `AuthMeUser` promette `displayName` che `/v1/auth/me` non restituisce, quindi l'intestazione mostra l'email e due lettere (S-01).
7. Causa radice 2 (alta): le schede di sezione non seguono i permessi e portano a pagine «negate» per `/gaps`, `/compensation-intelligence`, `/insights/succession-readiness` (S-02).
8. Causa radice 3 (media): il formattatore comune è aggirato nel wrapper dei grafici, nella tabella equivalente, nel quadro e in 4 pagine; in italiano 4.069 diventa «4069» (S-08).
9. Causa radice 4 (media): testi italiani fuori da i18n in glossario, lettura dei grafici, scheda rapida e agente, più due titoli inglesi in italiano (S-05, S-06).
10. Causa radice 5 (media): 19 grafici su 26 senza nome e unità degli assi, finestre senza scorrimento nel consolidamento, persone scritte «Nome Cognome»/UUID in 7 punti (S-09, S-10, S-11).
