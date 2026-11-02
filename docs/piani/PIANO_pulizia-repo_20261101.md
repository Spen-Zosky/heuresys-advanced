# Piano: rendere pulito il repository di advanced (1 novembre 2026)

Mandato di Enzo del 2026-11-01 alle 21:17 Roma: «verificare approfonditamente il repo su github, risolvere tutti gli errori, pulire residui e renderlo perfetto». Questo file è il piano del ciclo: una riga per voce, con chi la completa e che cosa vuol dire fatta. Lo stato si aggiorna qui, non in chat.

## Che cosa ho misurato (2026-11-01, circa 21:30 Roma)

Ogni dato si rimisura col comando a fianco; i numeri qui sotto valgono solo per quel momento.

| Ambito | Esito | Comando |
|---|---|---|
| CI su `main` (e1134cf) | Lint, Typecheck, CodeQL, Playwright smoke verdi; Test di integrazione e Build web ancora in corsa; **Atlas freshness rossa** («atlante: vecchio», corsa 41341997910). Sulle ultime 13 corse di Atlas freshness su main, 8 rosse: diventa rossa a ogni unione che tocca moduli o migrazioni, finché qualcuno rigenera l'atlante a mano | `mcp actions_list` su `atlas-freshness.yml`; `python3 docs/kb/tools/atlante_fresco.py` |
| Controllo di integrità dello stato | **1 FAIL**: la §0 di `SOT_STATE.md` dichiara come ultima migrazione la 000467, sul disco c'è la 000468; 2 WARN (HEAD citato vecchio, conteggi in `STATE.md`) | `python3 docs/kb/tools/handoff_lint.py` |
| Altri controlli senza database | Canale Cowork 0 voci aperte; nessun nuovo import dal legacy; istruzioni coerenti; ogni modulo API ha test | `check_canale_cowork.py`, `check_no_legacy_ingest.py`, `check_istruzioni.py`, `check_module_test_coverage.py` |
| Controlli che chiedono il database | Non misurati da qui (il container non raggiunge la VM): pagine orfane, pagine raggiungibili, riferimenti orfani | `check_marciume.py` |
| Aggiornamenti di sicurezza Dependabot | Falliti più volte: glob, minimatch, postcss-selector-parser, @modelcontextprotocol/sdk (dipendenze indirette) | corse «npm_and_yarn in /.» nell'elenco delle Actions |
| Descrizione del repository su GitHub | Superata: dice «Fastify 4 API (277 endpoints, 203 integration tests) + Next.js 15», il codice è Fastify 5.12.6 e Next 16.4.2 | `grep -E '"(fastify|next)"' apps/*/package.json` |
| Storia di `main` | Ricostruita il 2026-10-17: il primo commit di main è ae48916c del 17/10. I rami e i tag di prima non hanno antenati comuni con main | `git log --reverse origin/main \| head -1`; `git merge-base` |
| Rami remoti | 37 in tutto. 22 rami `claude/*`: 19 già uniti con la loro PR, 2 con PR aperta (#132, #136), 1 senza PR ma interamente contenuto in main (`copie-di-prova`) | script di confronto in fondo |
| PR aperte | 8: #136 (giro delle interfacce, escluso), #132 (ADR-0050, bozza di un altro thread), #126 #127 #128 Dependabot del 30/10, #83 #84 #85 Dependabot del 7/9 costruite sulla storia di prima del 17/10 | `mcp list_pull_requests state=open` |
| File residui tracciati | 1 file di log (`sessioni/.../F0_3d_pnpm_test_api_v2.log.err`) e un file di pid; nessun `dist/`, `node_modules/`, `.next/` tracciato; 3.878 file a LF, nessuno a CRLF | `git ls-files \| grep -E '\.(log\|err\|pid)'`; `git ls-files --eol` |
| Cartelle storiche in radice | `cowork_code_exchange/` (186 file; il CLAUDE.md dice che su questo progetto non si usa), `cowork_reserved/` (119), `qa_artifacts/` (111), `sessioni/` (12), `audit/` (4). Tutte citate ancora da qualcosa di vivo (skill, regole, prove E2E, migrazioni), quindi niente si toglie senza indagine | `git grep -l <cartella> -- scripts apps packages docs/kb/tools db .claude` |
| Documenti in radice di `docs/` | 8 file di maggio 2026 (audit a11y, audit showcase, piano di bootstrap, residui del preflight) che sembrano superati | `ls docs/*.md` |

## Fuori da questo ciclo, per scelta

- Il lavoro dei thread aperti: le copie ripristinabili (PR #141 e il ramo `claude/project-thread-ludwew`), il giro delle interfacce (PR #136, ramo `claude/project-thread-hnirpl`), l'ADR-0050 (PR #132, ramo `claude/project-thread-9r3s35`).
- I rami toccati oggi da altri thread (`eld5tl`, `m6ebvp`, `mu2edn`): si guardano al prossimo giro, quando quei thread sono chiusi.
- `.programmi/**` e `docs/vision/**`: hanno sessioni dedicate (CLAUDE.md).
- `refs/heads/prod`, `gh-pages` (pubblica la vetrina), i tag di versione: non si toccano.
- Produzione e rilascio: niente.
- Il censimento dei percorsi assoluti: è già un esercizio a parte (`gemello/CENSIMENTO_RIFERIMENTI_ASSOLUTI_20261101.md`).

## Che cosa non si chiude in questa sessione

- A1 e A3 chiedono il database: si fanno sulla VM, in una sessione lanciata lì, e serve il via di Enzo alla sessione.
- B1, B2, B3 cancellano rami o chiudono PR: serve il sì scritto di Enzo in questo thread.
- Le voci C spostano file: prima si mostrano due campioni, poi il resto.

## Le voci

Chi: **C** = Claude (questo thread), **E** = Enzo, **VM** = Claude in una sessione sulla VM.

| id | cosa | chi | fatta quando | stato |
|---|---|---|---|---|
| A1 | Rigenerare l'atlante dopo #140 e #141, così Atlas freshness torna verde su main | VM | `python docs/kb/tools/build_atlas.py` con il database della VM, commit `docs(kb): rigenera l'atlante`, PR unita, corsa Atlas freshness verde su main | da fare |
| A2 | Indagine: perché l'atlante diventa rosso a ogni unione, e proposta perché si rigeneri da solo (per esempio un passo sul runner della VM che apre la PR di rigenerazione) | C | proposta scritta qui sotto con costo e rischio; la scelta è di Enzo | da fare |
| A3 | Riallineare la §0 di `SOT_STATE.md` (migrazione 000468) e togliere i due avvisi | VM | `python docs/kb/tools/aggiorna_numeri_sot.py` sulla VM, poi `handoff_lint.py` con 0 FAIL | da fare |
| A4 | Aggiornamenti di sicurezza falliti (glob, minimatch, postcss-selector-parser, @modelcontextprotocol/sdk): alzarli con `pnpm.overrides` nella radice, una PR sola | C | PR con lockfile aggiornato, CI verde, elenco delle allerte prima e dopo | in PR #142: `pnpm audit` da 51 allerte (1 critica, 19 alte) a 18 (0 critiche, 3 alte); restano solo salti di versione grossi: nodemailer 10, zod 4, glob 14, minimatch 11, katex 0.18. Typecheck di tutti i pacchetti verde, prove agent-gateway 160/160 e web 15/15 |
| A5 | Descrizione del repository su GitHub superata | E | testo nuovo proposto: «Heuresys Advanced — piattaforma HRMS/BPM agentica: monorepo pnpm, API Fastify 5 su PostgreSQL 16, web Next.js 16, contratti Zod condivisi. Conteggi vivi in docs/kb/SOT_STATE.md». Da incollare in Settings, General, Description (non ho uno strumento che la cambi) | da fare |
| A7 | Prova instabile: `semantic-matching.integration.test.ts`, «GET /skills/:id/similar», rossa una volta sulla PR #142 (lista vuota invece della skill attesa) e verde al rilancio senza cambiare codice. Indagine: ricerca vettoriale approssimata o database di CI condiviso con un'altra corsa | C | causa scritta qui e prova resa stabile, vista rossa prima e verde dopo | da fare |
| A6 | Le due corse ancora in volo su e1134cf (Test di integrazione, Build web) | C | esito letto e riportato qui; se rosse, si correggono | fatto: Test di integrazione verde su e1134cf (corsa 41341997936) |
| B1 | Cancellare 17 rami remoti già uniti e fermi: `claude/project-thread-` 1gi0o4, 53slp1, 5747wc, 62a9r8, 8fmksu, 9g3m0a, a4t9ru, adoo53, g8cpm9, hwz5hr, lo220e, m1vkc1, pkfo64, qe4edy, svndgw; `fix/000280-guardia-fuso-orario`; `claude/copie-di-prova` | C, dopo il sì di E | per ognuno: PR unita (o 0 commit fuori da main), poi cancellato; il commit di punta annotato in questa tabella per poterlo ricreare | sì di Enzo 2026-11-01 21:22; il container non può cancellare rami (403 del proxy) e sulla VM la protezione «Git Destructive» li blocca: serve Enzo |
| B2 | Quattro rami di prima della ricostruzione del 17/10 (`release/v1.0.0`, `d08-f5-offprod-runner`, `f4-livello-contrattuale`, `pe3-voce2`): trasformarli in etichette `archivio/<nome>` e poi togliere il ramo | C, dopo il sì di E | etichetta spinta e verificata sullo stesso commit, poi ramo tolto | etichette `archivio/*` create e verificate sulle punte (53f859883446, c43f7b55ebef, 0a86dbb2e3af, 1a6231bedac5); cancellazione dei rami bloccata dalla protezione «Git Destructive» della VM, serve Enzo |
| B3 | Dependabot: chiudere #83, #84, #85 (costruite sulla storia vecchia, non si possono più unire; Dependabot le rifà se servono) e togliere il ramo `vite-8.1.6` (PR #102 già chiusa) | C, dopo il sì di E | PR chiuse con una riga di motivo, ramo tolto | sì di Enzo 2026-11-01 21:22; #83 #84 #85 chiuse con commento, i loro rami tolti da Dependabot; `vite-8.1.6` bloccato come B1 |
| B4 | Dependabot del 30/10: #126 body-parser (minore) raccolto in una PR col lockfile, come fu fatto per la #124; #127 nodemailer 10 e #128 zod 4 restano ferme (salti grossi: email e contratti condivisi) e lo si scrive sulla PR | C | #126 assorbita e chiusa; #127 e #128 annotate | body-parser 2.4.0 entra con l'override di A4 (PR #142); #126 si chiude quando #142 è unita |
| C1 | `cowork_code_exchange/`: il CLAUDE.md dice che su questo progetto non si usa. Indagine su chi lo legge ancora (`build_index.py`, skill `zero-pending-loop` congelata), poi ritiro | C | elenco dei lettori sistemati, cartella ritirata col metodo dei campioni | da fare |
| C2 | `sessioni/` (forense di maggio, con un `.log.err` e un file di pid) | C | indagine sui lettori (`.claude/sessione`, `.claude/rules/tests.md`), poi ritiro o spostamento in `docs/archive/` | da fare |
| C3 | `cowork_reserved/`, `qa_artifacts/`, `audit/`: censimento di che cosa è ancora letto dal codice vivo (prove E2E, skill, migrazioni) e che cosa è solo storia | C | tabella file per file: resta, va in `docs/archive/`, si ritira | da fare |
| C4 | Gli 8 documenti di maggio nella radice di `docs/`: spostarli in `docs/archive/` se nessun documento vivo li usa | C | `git mv`, riferimenti corretti, `check_istruzioni.py` verde | da fare |
| C5 | `docs/superpowers/` (84 file di piani di sessione): verificare se sono superati e archiviarli | C | elenco con l'esito per file | da fare |
| C6 | Codice morto: file ed export non usati in `apps/` e `packages/` | C | indagine con uno strumento che misura (knip o equivalente), elenco dei falsi positivi, rimozioni solo per ciò che è provato morto, CI verde | da fare |

## Come si toglie un file tracciato senza cancellarlo

Nel repository «spostare in `_da_eliminare/`» non basta: quella cartella è ignorata da git, quindi un file spostato lì da un container cloud sparisce con il container. La proposta è questa: prima di ogni lotto si mette un'etichetta git `ritiro/20261101-<lotto>` sul commit di partenza e la si spinge; poi il lotto si toglie con una PR normale che ne elenca i percorsi. Tutto si ripristina con `git checkout ritiro/20261101-<lotto> -- <percorso>`. Sulla VM, al primo allineamento, la copia fisica va anche in `_da_eliminare/20261101_pulizia-repo/` della radice. La scelta fra questo metodo e lo spostamento in `docs/archive/` è di Enzo.

## Registro delle scoperte fuori ciclo

- I worktree in `.claude/worktrees/` e le copie `~/adv-*` sulla VM: non sono nel repository GitHub, si guardano solo se Enzo lo chiede.

## Comando che ha prodotto l'elenco dei rami

```bash
git fetch origin '+refs/heads/*:refs/remotes/origin/*'
for b in $(git for-each-ref --format='%(refname:short)' refs/remotes/origin); do
  echo "$b fuori-da-main=$(git rev-list --count origin/main..$b) dietro=$(git rev-list --count $b..origin/main)"
done
```

## Chiusura

Da scrivere a fine ciclo, in una delle due forme: «CICLO CHIUSO — N/N voci fatte» oppure «CICLO NON CHIUSO — manca la voce K, serve Enzo per Y».
