# Handoff — sessione S1068 (heuresys-advanced, 2026-08-17)

> ⚠ **NON È UNA FONTE DI STATO.** Sta in `docs/archive/`, che il `CLAUDE.md` dichiara
> «historical records … **not** SoT»: è la **cronaca di una sessione**, vera il giorno in
> cui è stata scritta. Lo stato vivo sta nei due soli posti che lo governano —
> `.handoff/STATE.md` (vista rapida) e `docs/kb/SOT_STATE.md` (granulare) — più il
> registro `docs/kb/SOT_BACKLOG.md`. Se questo file e quelli dicono cose diverse, hanno
> ragione quelli.
>
> Documento per un agente che riprende a freddo. **Non ripete ciò che sta già nei file
> del repo**: quelli si leggono, non si riassumono. Qui c'è solo ciò che vive nella
> conversazione e andrebbe perso.

---

## 1. Dove leggere lo stato (non è qui)

| Cosa | Dove |
|---|---|
| Piano del ciclo, esito binario, scoperte fuori ciclo | `.programmi/mandati/mandato-S1068-p3-p1-p2.md` |
| Voci toccate: `#213` (DONE) · `#214` · `#215` (nuova) · `#198` · `#211` · `#132` | `docs/kb/SOT_BACKLOG.md` |
| Programma della ricerca che genera il modello, 8 fasi (F0 fatta) | `.programmi/132-ricerca-genera-il-modello.md` |
| Cosa fa ogni commit, e perché | `git log 7ada55b9..HEAD` — i messaggi sono lunghi apposta |
| Migrazioni nuove | `db/migrations/000321`, `000322`, `000323` |

Il boot di una sessione nuova (`python docs/kb/tools/session_start.py`) ricostruisce il
menu da queste fonti: **non serve leggerle a mano prima di quello**.

---

## 2. Lo stato del working tree — l'unica cosa che richiede una decisione

- **7 commit locali NON pushati** (`git log origin/main..HEAD`). Il push **non è mai stato
  autorizzato** in questa sessione, e l'autorizzazione è per-sessione: una sessione nuova
  torna a «chiedi».
- **`apps/web/next-env.d.ts` modificato, e non da mano umana**: l'ha riscritto `next build`
  durante la corsa E2E, cambiando una riga da `./.next/dev/types/routes.d.ts` a
  `./.next/types/routes.d.ts` (build di produzione contro build di sviluppo). Il file
  stesso dichiara «non va modificato a mano». **Oscillerà a ogni build di tipo diverso**:
  va deciso una volta (committarlo com'è, o ripristinarlo), non ri-scoperto ogni volta.
- I quattro non tracciati (`.agents/`, `.codex-review/`, `.codex/`, `AGENTS.md`) sono di
  Codex e restano fuori **per disegno** (CLAUDE.md): non sono da pulire.

**Cancelli tutti verdi al momento della chiusura**: `verify_gate` GREEN (typecheck, lint,
handoff-lint) · `handoff_lint` 0 fail · `programmi.py --verifica` 0 difetti · `db_health`
20/20 sentinelle a zero.

---

## 3. Processi lasciati in esecuzione (nessuno riparte da solo)

| Servizio | Porta | Stato |
|---|---|---|
| API | 3001 | **su** — serve ai test di integrazione e alle prove live |
| Gateway agente | 8790 | **su** — avviato in questa sessione per la prova live di `#214`; si può fermare |
| Web (dev) | 3000 | **giù** — fermato di proposito per la corsa E2E di produzione (`reuseExistingServer: false` pretende la porta libera) |

---

## 4. La direzione che Enzo ha chiesto come ultima cosa

Domanda testuale: *«devi dirmi se e quando sarà possibile testare la creazione di un nuovo
tenant/azienda»*. La risposta data, e **da riprendere**, distingue due livelli:

1. **Provare il meccanismo** (crea → costruisci → misura → archivia): manca il **campo di
   prova sul gemello** (G4 del ciclo precedente — procedura + `scripts/banco_tenant.py` coi
   due pulsanti *crea usa-e-getta* / *disfa*) più **T9 di `#198`**. Nessuna dipendenza
   aperta: **una sessione**. È il candidato naturale per il prossimo ciclo.
2. **Provare che l'azienda creata sia del suo settore**: oggi la costruzione produce
   **sempre una banca** (l'archetipo `RETAIL_BANK_REFERENCE`, 7 unità e 11 posizioni —
   contro le 158 posizioni di RTL vera). Serve `#132`, 7 fasi su 8 residue. Stima
   **dichiarata, non misurata: 4-6 sessioni**. ⚠ Il register porta ancora «~2 sessioni»,
   che è del 5 agosto — **precedente** alla riscrittura E29/E30 che ha cambiato la natura
   della voce. Chi legge quella stima legge un numero vecchio.

**Cosa Enzo può già provare da solo, oggi**: aprire un fascicolo → *Costruzione* → il piano
mostra cosa nascerebbe e cosa esiste già, **senza scrivere niente**.

---

## 5. Trappole incontrate qui, che costerebbero tempo a chi non le sa

Sono tutte già scritte nei commit e nel register; qui l'elenco secco per riconoscerle.

1. **`.gitignore` ingoia le rotte che si chiamano `build`** — in un App Router la cartella
   è un segmento di URL. Risolto con un'eccezione mirata, ma il pattern `build/` resta:
   attenzione a rotte future con nomi da artefatto (`dist`, `out`).
2. **Il dev server stale serve 404 sulle pagine nuove**, e `curl` risponde **307** senza
   rivelarlo (il middleware redirige prima di sapere se la rotta esiste). L'unica prova è
   un E2E con login reale.
3. **La seconda passata di `ci-rehearsal.sh` trova ciò che la prima dichiara verde** — due
   difetti pre-esistenti sono emersi così. Non saltarla mai.
4. **Il typecheck dei test risolve `@heuresys/shared` al dist compilato**: dopo aver
   aggiunto un export alla sorgente serve `pnpm --filter @heuresys/shared build`, o gli
   errori sembrano del test.
5. **Il clone di CI non ha i dati importati da script**: una post-condizione che conta
   righe è verde in locale e rossa in CI. La `000323` gestisce il caso **dichiarando**
   «installato, non verificato» invece di fingere — è il modello da copiare.
6. **In Playwright un progetto la cui dipendenza fallisce viene saltato.** Ha fatto sì che
   263 casi non girassero in silenzio. Ora la suite passa da `scripts/e2e-blocchi.mjs`, che
   invoca Playwright **una volta per fase** e conta i casi eseguiti.

---

## 6. Ciò che resta aperto e non è nel menu

Sono nel registro delle scoperte del piano di ciclo (§ *Registro delle scoperte*), e vanno
presentate a Enzo **una volta sola** come «lo vuoi nel prossimo?»:

- `#215` — lo stato impossibile in `sys_compensation_bands` (29) e `sys_skills` (3), dove la
  cura è **l'opposto** di quella applicata ai percorsi: quelle 29 righe sono i CCNL e i
  sindacati, e cancellarle sarebbe stato l'errore.
- **80 casi E2E non eseguiti**, causa **non isolata** (escluse `maxFailures` e i blocchi
  `serial`).
- La suite E2E **lascia righe di collaudo in produzione**: seconda volta di fila che vanno
  ritirate a mano. La cura sta nel `global-teardown`, che copre alcune famiglie e non altre.

---

## 7. Suggested skills

Il prossimo agente dovrebbe invocare, con il tool `Skill`:

| Skill | Quando, e perché |
|---|---|
| **`full-alignment-deploy`** | **Per prima**, se si decide di pushare i 7 commit: la dottrina di allineamento (VM + linux-pc) e il comportamento di `close-propagate.sh`, che **arma** il deploy e non lo esegue. Serve anche a leggere `verifica-deploy.sh`, il cui vocabolario chiuso distingue `NON-VERIFICATO` da «a posto» |
| **`storia36-custodia`** | Solo se il controllo storia36 risulta rosso all'avvio, o se un lavoro ha scritto righe nel dataset di RTL |
| **`project-atlas`** | Se servono domande cross-layer («cosa abbiamo per X») invece di leggere i file a mano. ⚠ Pretende l'atlante fresco: dopo migrazioni nuove va rigenerato con `build_atlas.py`, e il cancello se ne accorge da solo |
| **`superpowers:systematic-debugging`** | Se si apre il reperto degli **80 casi E2E non eseguiti**: la causa non è isolata, ed è esattamente un caso da metodo, non da intuizione |

**Non** invocare `handoff` a inizio sessione: è una procedura di chiusura.

---

## 8. Misure di chiusura (datate, non affermazioni sul presente)

Guardiano al momento della chiusura: **residuo 326.613 token** sulla finestra da 1M —
mancavano **76.613** alla soglia del 75% · finestra 5h **0,0%** (si era appena azzerata) ·
verdetto **«si continua»**.

Il ciclo si è chiuso **NON CHIUSO — 7 voci su 13**, con la ragione scritta accanto a ognuna
delle sei non aperte: due bloccate da dipendenze reali, quattro con costo stimato oltre il
residuo misurato. Il confine era dichiarato all'apertura.
