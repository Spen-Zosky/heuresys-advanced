# S1099 — mandato «tutti da P1 a P3 in autonomia»

*Enzo, 2026-09-13: «esegui tutti da P1 a P3 in autonomia e automaticamente prendendo decisioni
per mio conto, nell'ordine che ritieni più appropriato. l'unico guardiano che comanda è quello
della capienza.»*

> **stato**: IN CORSO
> **registro di sessione** — cronaca di ciò che si fa, non il programma di una voce: non
> dichiara `item` di proposito (D-92). Le fasi che restano aperte vivono nel piano della loro
> voce; questo file le nomina, non le possiede.

**Misura all'apertura del mandato** (`guardiano.py`): contesto **~13%** · finestra 5h **5.0%** ·
verdetto testuale: `✓ si continua — contesto: mancano 611,976 token · 5h: mancano 75.0 punti`.

**Confine di sessione dichiarato (R24 §4).** Le corsie P1-P3 del menu portano **6 voci ACTIVE**
(`#149` F4, `#76` F3, `#214` F6, `#159` F2, `#79` F3, `#205` F2). Capienza utile: ~612k alla
soglia meno ~80k di chiusura → **~530k**. Somma delle stime: ~2k + ~5k + ~40k + ~80k + ~5k +
~250k ≈ **~380k**: ci sta tutto a fase intera, `#159` F2 compresa, se le stime reggono. Ogni
voce si chiude a fase intera, mai a metà. Il taglio lo fa il solo guardiano, misurato dopo ogni
voce e prima di aprire `#159`.

**Fuori dal mandato per natura** (dichiarato una volta sola, R24 §5): `#250` e `#240`
(WAIT-INPUT: cancellazioni, restano sue anche con la delega — divieto globale) · la open-Q
SOSPESA da Enzo (chiave del collaudo) · l'igiene di `C:\Git\` (cancellazione) · `#198` e `#206`
(GATED, fuori dalle corsie P1-P3; `#198` è però la priorità 2 di `STATE.md`: *fuori da questo
ciclo — lo vuoi nel prossimo?*).

**Decisioni prese per conto di Enzo in questa sessione** (elencate qui, una per riga, man mano):
- `#205` F2 — `assoconsult.org` (Assoconsult, associazione di categoria della consulenza di
  direzione, aderente a Confindustria) **entra** nel registro delle fonti per `positions` e
  `organization_units`, criterio `ACCREDITED` (mig 000379): coerente con I21 (Heuresys System =
  `MGMT_CONSULTING`) e proposta da una corsa (`7550b570`, S1096). Reversibile: una riga di
  `sys_research_sources`, si porta a `REJECTED` senza cancellare.
- `#76` F3 — il driver zero-pendenze **non si accende** in parallelo a questa sessione:
  contesa del database misurata (`Z251`) e la finestra 5h è unica per tutte le sessioni. Qui
  si riporta il conteggio.

---

## Ordine deciso, e perché

Prima i continuativi (misura di oggi, tengono verdi i cancelli): `#149` F4 e `#76` F3. Poi
`#214` F6 (un perimetro, ~1 pagina). Poi `#205` F2 (decisione sulla fonte + corsa: se produce,
sblocca F3 e popola tabelle → `#79` F3 subito dopo). `#159` F2 per ultima perché è la più
grande e coinvolge un **altro repo con una sessione viva** (`ux-design-shared-1e918fae`,
perimetro `ui/src/`): prima di scrivere lì si manda un messaggio a quella sessione.

## Simulazione (R24 §3) — le cinque domande per voce

| voce | precondizioni | meccanismo | propagazione | chi | guardia |
|---|---|---|---|---|---|
| `#149` F4 | inbox lab vuota (misurata: `lab_inbox.py` → vuota); tutte le consegne citate hanno marker (`check_verifica_consegne.py` VERDE) | nessuna consegna nuova → la fase non scatta oggi; si registra la misura | commit del piano | io | non distruttiva |
| `#76` F3 | `zp_state.py piano` risponde | riporto del conteggio nel piano `76` | commit | io | non distruttiva |
| `#214` F6 | atlante fresco (boot: OK); `check_concetti_agente.py` produce la coda | riga in `agent-perimetri.json` + migrazione di grant se serve (come 000411) + prova live 3 domande sul gateway | migrazione → `pnpm db:migrate:vm` dopo il push; `ci-rehearsal.sh` prima | io | migrazione additiva (grant); rollback = `REJECTED` nel json + revoca |
| `#205` F2 | catena della ricerca: `claude` autenticato su Windows, API+lettore sul gemello, `ssh -R 8790`; tunnel non degradato | INSERT della fonte (via rotta API o SQL con giornale), poi `percorri-dominio.mts positions` sul gemello | la fonte va in **produzione** (registro), non sul solo gemello: si applica via API sulla VM o SQL via tunnel | io | INSERT singolo, reversibile a `REJECTED`; nessuna cancellazione |
| `#79` F3 | `#205` F2 ha scritto righe | `check_exposure.py` | commit | io | read-only |
| `#159` F2 | sessione `ux-design-shared-1e918fae` avvisata; `@heuresys/ui` linkato (boot: OK); pagina `dev/agent` = 183 righe da estrarre in componente | componente in `ux-design-shared/ui/src/`, export, build, bump, consumo in `dev/agent/page.tsx`; prove: vitest web, typecheck, lint, E2E della pagina | link locale (junction) subito; pubblicazione npm/bump al ciclo di quel repo | io (repo mio, sessione parallela da avvisare) | nessuna cancellazione; `git add` con path espliciti in entrambi i repo |

| # | voce | fase | chi | fatto quando | stato |
|---|---|---|---|---|---|
| 1 | `#149` | F4 — la prossima consegna | io | inbox misurata; ogni consegna citata ha marker | ✅ FATTA: inbox vuota, 6/6 con marker, la fase non scatta oggi |
| 2 | `#76` | F3 — riporto del conteggio | io | `zp_state.py piano` riportato nel piano 76 | ✅ FATTA: 157 · 131 · 26, invariato |
| 3 | `#214` | F6 — il prossimo perimetro neutro | io | riga in `agent-perimetri.json` + `check_concetti_agente.py` verde + prova live 3 domande | ✅ FATTA: `blueprint-processes`, mig 000412 (prod 13 s), prova live VERDE 8/8 dopo due rimedi al gateway (z.record → catchall; settingSources: []) |
| 4 | `#205` | F2 — la fonte di settore e la corsa | io | `assoconsult.org` nel registro; corsa su `positions` con esito letto: proposte o ragione misurata | ✅ FATTA a fase-di-sessione: fonte in prod (000413), seconda via delle mappe (REST WordPress), corsa `9e921576` letta — 0 proposte, ragione misurata (contenuto in PDF). La fase F2 resta aperta nel piano 205 |
| 5 | `#79` | F3 — il lavoro che popola tabelle | io | `check_exposure.py` → 0 lacune dopo la voce 4 | ✅ FATTA: nessuna lacuna, exit 0 |
| 6 | `#159` | F2 — il componente in `ux-design-shared` | io | componente pubblicato via link, pagina `dev/agent` lo consuma, cancelli verdi, `--budget` verde prima di aprire | ⏳ |

## Registro delle scoperte (fuori da questo ciclo — R24 §5)

- **`#205`: il lettore delle fonti apre solo HTML; i rapporti di settore (Osservatorio Assoconsult) sono PDF.** Finché non li apre, la ricerca su `positions`/`organization_units` per la consulenza risponde vuoto anche con la fonte giusta. *Fuori da questo ciclo: lo vuoi nel prossimo?*
- **Il gateway girava con gli hook di sessione dentro** e con `tools/list` rotto dal 3 settembre: corretti in questa sessione (voce 3), ma i file `webapps-*.md` in `~/.claude/sessioni/attive/` sono le sessioni SDK registrate per errore — non cancellati (divieto).
- ⚠ **Errore mio, corretto nella stessa voce**: la prima `migrate-on-vm --no-pull` della 000413 ha risposto «385 applied» — lo stesso numero della 000412 — e l'ho letta come esito senza confrontarla: il file era sul gemello e **non sulla VM**. Il `select` in produzione dava zero righe. Ri-copiata e ri-applicata: «386 applied», due righe presenti. La regola già scritta («prima serve che il file sia sulla VM») vale anche per chi l'ha scritta.
