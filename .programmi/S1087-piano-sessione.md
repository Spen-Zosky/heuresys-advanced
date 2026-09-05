# S1087 — piano di sessione (delega totale)

*Mandato di Enzo, 2026-09-05: «risolvi tutti i punti non verdi e poi affronta tutte le azioni di
P1 P2 P3 automaticamente e autonomamente prendendo le decisioni al posto mio».*

**Confine dichiarato all'inizio (R24 §4).** La somma delle stime del menu supera una sessione:
`#143` ~4-6 · `#54` ~5-7 · `#159` ~3-4 · `#50` ~2. Questa sessione **non le chiude tutte**.
Ordine di esecuzione: prima i non verdi (rendono cieco tutto il resto), poi le voci in ordine di
sbloccaggio e di costo crescente. Il taglio lo decide il guardiano (75% contesto / 80% finestra 5h).

**Regola di scope (memoria cardinale)**: ogni scoperta collaterale si **riporta**, non si esegue.
Le scoperte vanno nel registro in fondo a questo file, non in «cosa resta».

---

## Parte A — i punti non verdi del boot

| id | cosa | chi | fatto significa | stato |
|---|---|---|---|---|
| N1 | Tunnel `:5433` degradato — 78 s per una count su 2 righe, VM scarica (load 0.11) | io | una count torna in pochi secondi | **FATTO** — ricreato, 78 s → 3,2 s |
| N2 | Derivati 2/3 superati | io | `build_derivati.py` verde e registro aggiornato | **FATTO** |
| N3 | Pagine NON MISURABILE (TimeoutExpired) | io | il cancello misura e dichiara un esito | **FATTO** — era il tunnel; 77 pagine, ogni pagina ha una porta |
| N4 | Sentinella `v_incarico_attivo_senza_contratto` = 1 riga | io | sentinella a zero **e** un presidio che la tiene a zero da sola | **FATTO** — mig `000371`, sentinella 0, presidio agganciato all'avanzamento |
| N5 | Allineamento ecosistema Claude rotto (`align-claude-ecosystem.sh:39`) | io | lo script trova il bootstrap, o la riga sparisce con motivo | **FATTO** — sorgente in `~/.claude/scripts/`; allineamento VM+linux-pc exit 0 |
| N6 | Chiusura S1086: 2 passi non sereni (chiusura, propaga) | io | causa nominata; se è N5, si chiude con N5 | **FATTO** — era N5 |
| N7 | **Tre servizi systemd FAILED in produzione**, invisibili al boot (`--no-net`) | io | i tre tornano `Result=success` | **FATTO** — vedi sotto |
| N8 | **CI rossa** su `0d7475d8` (*Lint (all workspaces)*) che blocca il deploy | io | corsa verde su un commit successivo | **FATTO** — il generato era già allineato da `c0e0cbb0`, mancava solo una corsa: *Lint* **verde su `3fd996fd`** |

### N7 — i tre servizi, e i cinque guasti in fila

Scoperti misurando la VM, non dal boot: la dashboard li dichiarava `[? ] --no-net`.

| servizio | era | causa vera | ora |
|---|---|---|---|
| `storia36-avanzamento` | FAILED dal 2026-09-04 | cinque guasti annidati (sotto) | `Result=success`, custodia VERDE |
| `storia36-custodia` | FAILED dal 2026-08-31 | gli stessi | `Result=success`, custodia VERDE |
| `deploy-watch` | FAILED | CI rossa su `0d7475d8` — si rifiutava **correttamente** di deployare | `Result=success`; il deploy resta fermo per N8 |

I cinque guasti, ognuno nascosto dal precedente (regola di bonifica §6):
C4a (pavimento CCNL a chi non è un lavoratore) → C4h(i) (stessa classe) → C10a
(qui mancava il **dato**, non il criterio → mig `000372`) → C11b(ii) (pretendeva
candidati da una corsa `FAILED`) → C8a(ii) (**il check misurava l'orologio e il
seed la frontiera**: 26 giorni di divergenza) → e un sesto trovato dalla batteria
stessa, il selftest di C10a(ii) che sceglieva la riga da guastare a caso.

**Frontiera della storia RTL: 2026-09-04** — arrivata a ieri, come D-STORIA-B chiede.

### N4 — simulazione a 5 domande (R24 §3)

**Misura, prima.** Parco contratti RTL, misurato 2026-09-05 via tunnel:

| tipo | senza data di fine | già scaduti | scadono entro 1 anno | totale |
|---|---|---|---|---|
| `permanent` | 108 | 0 | 0 | 108 |
| `fixed_term` | 25 | **1** | **26** | 52 |

Scadenze dei `fixed_term`: 2026-09 **9** · 2026-10 **3** · 2026-11 **3** · 2026-12 **7** ·
2027-01 **3** · 2027-02 **2**.

**Il difetto non è la riga di oggi: è che ne arrivano altre 26 nei prossimi cinque mesi**, una
alla volta, perché l'avanzamento giornaliero della storia porta la finestra a ieri e i contratti
a termine scadono da soli. È la **terza** occorrenza dello stesso fenomeno (`000289`: 23 casi il
2026-08-06 · `000311`: 7 casi il 2026-08-14 · oggi: 1). Le prime due sono state fotografie.

- **Precondizioni** — `staging.storia36_floor_at(livello, data)` esiste (dichiarata dalla `000289`);
  `sys.sys_user_contracts` ha `user_contract_type` / `user_contract_end_date` /
  `user_contract_gross_annual_salary`; il giornale `staging.contratti_scaduti_undo` esiste (`000311`).
- **Meccanismo** — il perimetro di `13_avanzamento.sql` **esclude i contratti** (dichiarato:
  calendario, presenze/assenze, buste paga). Quindi non basta correggere: il rinnovo va reso
  **ricorrente** e agganciato all'avanzamento, con lo **stesso criterio della `000311`** — non una
  politica nuova.
- **Propagazione** — migrazione → `pnpm db:migrate:vm` (17 s sulla VM contro ~80 min da qui) +
  gemello; l'avanzamento gira di notte sulla VM, che è la sola macchina che lo dichiara.
- **Chi** — io, per intero.
- **Guardia** — scrive solo su chi soddisfa il criterio della vista **al momento dell'esecuzione**
  (mai ereditato); post-condizione che protegge anche ciò che **non** doveva cambiare (i 108
  `permanent` e i 25 `fixed_term` senza fine restano intatti); rollback nel giornale esistente.

---

## Parte B — le azioni del menu

| id | voce | costo dichiarato | stato |
|---|---|---|---|
| P1-1 | `#198` T9b — la costruzione vera in produzione | ~1 sessione | da fare |
| P1-2 | `#149` F4 — consegne del lab non verificate | continuativo | ✅ **onorata** — inbox vuota (misurata), e il presidio ha smentito 2 affermazioni dei *nostri* programmi |
| P1-3 | `#143` F3 — asse funzionale vivo | ~4-6 sessioni | **fuori confine dichiarato** |
| P2-1 | `#231` S7 — triage dei 10 falliti (= `#219` F5d) | continuativo | da fare |
| P2-2 | `#242` trustProxy per indirizzo + fastify 5.12.3 | ~1 sessione | ✅ **CHIUSA** — F2+F3+F4, voce a DONE nel register |
| P2-3 | `#219` F5 — la corsa che chiude la voce | ~1-2 sessioni | **in corso** — vedi sotto |
| P2-4 | `#214` F6 — consumo della coda dei neutri | continuativo | ✅ **OTTAVO perimetro aperto** (`visualization-exports`), guardia su 4 porte, mig `000373` |
| P2-5 | `#159` F2 — il ponte | ~3-4 sessioni | **fuori confine dichiarato** |
| P2-6 | `#79` F3 — cancello di esposizione | continuo | ✅ **onorata** — 73/73 esposte; il dato scritto dalla `000372` è letto dal modulo `gdpr` |
| P2-7 | `#54` F3 — recruiting/ATS, API | ~5-7 sessioni | **fuori confine dichiarato** |
| P3-1 | `#205` F1 — coda dei domini ricercabili | ~1 sessione | ⏳ **gate caduto, ma manca la materia** — 1 sola fonte approvata: R2 darebbe una coda vuota. Due domande a Enzo, registrate nel programma |
| P3-2 | `#50` F3 — la vista del grafo delle competenze | ~2 sessioni | da fare |

---

## Registro delle scoperte — *fuori da questo ciclo* (R24 §5)

Si presentano **una volta sola**. Non entrano in «cosa resta», non bloccano la chiusura.

1. **25 contratti `fixed_term` senza data di fine** (misurato 2026-09-05). È la contraddizione
   **speculare** a quella che la `000311` ha corretto (due `permanent` *con* data di fine). Nessuna
   sentinella li vede, perché la vista cerca chi non ha più un contratto in vigore e uno senza fine
   è in vigore per sempre. Non li tocco: è una scrittura di massa su produzione fuori dal punto non
   verde che mi è stato chiesto di risolvere. Lo vuoi nel prossimo ciclo?


---

## `#219` F5 — quello che ho trovato preparando la corsa

Il programma dichiara la cura, misurata in S1083: **la corsa integrale si esegue sul gemello**,
perche' da Windows il collo di bottiglia e' il tunnel e «i rossi di una corsa lanciata da qui
sono rumore, non misura». Preparando l'ambiente ho trovato **due affermazioni del programma
che oggi non reggono**, entrambe misurate:

1. **«`linux-pc` ha Node 22.19.0 come default nvm, quindi nemmeno il wrapper serve».**
   Misurato il 2026-09-05: `bash -lc "node -v"` sul gemello dà **v12.22.9**. Il servizio web
   gira davvero con 22.19.0, ma solo perche' la sua unit systemd se lo dichiara nel `PATH`.
   Una corsa Playwright lanciata da una shell qualsiasi userebbe il 12, dove non parte.
2. **Il web del gemello rispondeva `500`** (`renderToPipeableStream is not implemented`), con
   un `.next` costruito il 4 settembre — cioe' prima del pull di oggi. Non e' un guasto del
   prodotto: e' un artefatto stantio, ed e' della stessa famiglia gia' registrata in memoria
   («pagine nuove 404 se il server e' stale»).

Nessuna delle due e' colpa di chi ha scritto il programma: sono **fatti che cambiano**, ed e'
la ragione per cui il PUNTO FISSO dice di misurarli invece di ereditarli.


---

## `#219` — quello che la corsa ha trovato, ed e' piu' di quello che cercavo

Il programma prescriveva la corsa sul gemello, e la cura era giusta come **pratica**. La
**diagnosi** che l'aveva motivata — «il collo di bottiglia e' il tunnel SSH» (S1083) — era
invece sbagliata, e si e' visto solo eseguendola: sul gemello il tunnel **non c'e'**, l'API era
viva e sana (zero errori, zero timeout di pool nel suo log), e i quattro `auth.setup` cadevano
uguale, trascinando 82 test.

**La causa vera, in due strati.**

1. Un ripiego cablato — `|| "http://localhost:3001"` — scritto **due volte**, in
   `next.config.js:17` e in `e2e-blocchi.mjs:107`. Il web che Playwright avvia e' un altro
   processo e non eredita `NEXT_PUBLIC_API_PROXY_BASE_URL` da nessuna parte.
2. E soprattutto: **quel valore si CONGELA al `next build`**, dentro
   `.next/routes-manifest.json`. `next start` non lo ri-valuta. Quindi la prima correzione —
   passare la variabile al processo Playwright — era **giusta e inutile**: arrivava troppo tardi.

⭐ **Ed e' questa la ragione per cui il difetto e' sopravvissuto a tre sessioni di diagnosi.**
Il valore non sta nel codice: sta in un **artefatto generato**, quindi gitignored. Nessuna
ricerca nei sorgenti poteva trovarlo — e' la stessa specie di punto cieco gia' registrata in
memoria per i rename. Ogni volta la colpa e' finita su qualcosa di plausibile: prima `aide` che
satura la VM di notte, poi il tunnel. Due spiegazioni ragionevoli, due volte la cosa sbagliata.

**Il rimedio che resta**: il preflight guadagna un quarto controllo che **legge il manifest**,
non il sorgente, e confronta la destinazione compilata con l'API misurata. Provato in entrambi
i versi: tace quando combaciano, protesta e dice come rimediare quando no.

⚠ **Un secondo fatto, che vale per la prossima corsa**: il gemello fa tre mestieri insieme —
clone di produzione, **runner della CI**, desktop. Misurato durante la corsa: `git` al 124%,
`Runner.Worker` al 58%, load oltre 3. La corsa che chiude F5e va lanciata **quando la CI non
gira**, o la macchina e' carica per costruzione e i rossi tornano non attribuibili.
