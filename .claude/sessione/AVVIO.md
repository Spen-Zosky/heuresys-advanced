# Avvio — estensione di progetto per heuresys-advanced

Caricata dalla skill user-level `avvio`. Qui l'avvio è **un comando e un giro solo**, e buona parte del
lavoro è già stata fatta da due hook prima che tu legga questo.

---

## Cosa è già girato da sé, e che NON va rifatto

1. **`scripts/session-boot.ps1`** — hook `SessionStart` registrato in `.claude/settings.local.json`.
   Ha già: riaperto il tunnel `:5433` se era giù (fino a 12 tentativi), verificato pgpass e fatto uno
   smoke `select 1` sul database, raccolto branch / HEAD / dirty / unpushed **escludendo la superficie
   Codex** dal conteggio dello sporco, e girato `handoff-lint --warn-only` in sola lettura.
2. **`prompt-hook`** (hook `UserPromptSubmit`) — ha già riconosciuto la modalità dalla tua frase, l'ha
   scritta su disco e ha iniettato il brief corrispondente.

Il brief iniettato ti dice già di eseguire `session_start.py`: **non eseguirlo due volte** e non
ristampare ciò che gli hook hanno stampato.

## La modalità: la stabilisce l'hook, tu la leggi

Due modalità, dichiarate dalla prima frase:

| frase | modalità | cosa cambia |
|---|---|---|
| `avvia sessione` | `canonical` | tutto vale come scritto |
| `avvia sessione lab` | `lab` | sessione di sola analisi, pensata per girare **in parallelo** a una di sviluppo: il verify gate è saltato per quella sola sessione, le scritture sono bloccate a livello di tool, gli artefatti vanno in `<padre del repo>/heuresys-design-lab/`. La lettura è libera — **una lettura bloccata è un difetto della guardia**, non una regola. Navigazione autenticata ammessa, Chrome per primo. **Non presentare il menu delle azioni**: non è una sessione di sviluppo |
| qualunque altra cosa | `canonical` | fail-safe: dimenticare il comando, o scriverlo male, non apre mai un buco |

La modalità è **stato su disco** in `<padre del repo>/.heuresys-session-mode/<session_id>.json`, scritto
dall'hook **prima** che il modello veda il messaggio: non dipende dal fatto che qualcuno si ricordi di
attivarla. Diagnostica: `sh scripts/hooks/hook.sh mode <session_id>` · `... selftest` · `... gc`.

Qui **non esiste** la modalità `gov`: è dei worktree gov-workers, non di questo albero.

## Il comando di boot

```bash
python docs/kb/tools/session_start.py    # --no-db se il tunnel è giù · --show-hold · --net
```

**Esce sempre 0**: è una vista, non un cancello. Non trattare l'uscita come un verdetto — i verdetti
stanno nel suo output.

`--net` aggiunge le sonde di rete (git-fetch, CI, produzione) ed è **spento** di default al boot: si
accende solo se serve davvero, perché costa tempo.

Produce in un giro solo: menu azioni, programmi aperti fuori dal menu, consegne del design-lab non ancora
nel registro, cruscotto, sentinelle del database, istruzioni e pagine raggiungibili.

## Le letture

- `.handoff/STATE.md` — **l'unica lettura grezza ammessa al boot**, per la narrativa. La chiusura lo
  tiene a vista rapida, quindi il suo peso è una frazione degli altri.
- **VIETATI al boot in lettura grezza**: `docs/kb/SOT_BACKLOG.md`, `docs/kb/SOT_STATE.md`,
  `docs/kb/DEBT_REGISTER.md`. Sono i tre documenti più grandi del repository e crescono a ogni sessione;
  `session_start.py` li ha già distillati in menu, debiti, decisioni e drift. Si apre una fonte grezza
  **solo in approfondimento**, per la voce che Enzo ha scelto.

## Il menu: è generato, non lo scrivi tu

Lo produce `build_menu.py` a partire dal registro d'azione taggato di `SOT_BACKLOG.md`, dallo stato
corrente, dai debiti non risolti e dall'avanzamento in `.programmi/`. Le sezioni, in quest'ordine, ognuna
omessa se vuota:

1. `### ▶ INTERRUPTED — riprendi (lavoro in volo)` — **in cima**, per mandato.
2. `### P1 — ACTIVE`, `### P2 — ACTIVE`, `### P3 — ACTIVE`.
3. `### ⛔ GATED — bloccato da una dipendenza tecnica`, con `⚡ SBLOCCABILE ORA` se il trigger scatta.
4. `### ⏳ WAIT-INPUT — aspetta un tuo input`.
5. `### ⏸ HOLD` — fuori dal menu per scelta; si elencano con `--show-hold`, ma quelli il cui trigger di
   riattivazione è ora soddisfatto compaiono comunque.
6. Riga finale di salute: item non terminali, fermi da oltre venti sessioni, HOLD sbloccabili.

Vocabolario di stato chiuso: `ACTIVE` · `GATED` · `WAIT-INPUT` · `HOLD` · `INTERRUPTED` ·
`DONE`/`FATTO`/`WON'T-DO`.

Per ciò che il registro non copre, le fasce si attribuiscono a mano: **P1** alto impatto o sbloccante ·
**P2** qualità e debito · **P3** roadmap e gated.

**Frase finale, testuale**: «Scegli #, aggrega (es. 1+4), o nuovo.»

## L'attesa

**Non iniziare a lavorare prima di aver presentato il menu e ottenuto la scelta**, con due eccezioni:

- il primo messaggio nomina già un compito preciso → si fa quello;
- la modalità è `lab` → **il menu non si presenta affatto**. Si apre leggendo il README del design-lab e
  lo `STATO.md` accanto, e si chiede da dove partire.

## L'eredità della sessione precedente

La rileva l'hook di boot, e sta lì apposta: un'istruzione si può omettere, un hook no. Raccogli dal suo
output:

- **journal non chiuso** — `.handoff/session-journal.ndjson` non vuoto significa che la sessione prima è
  morta senza chiusura: è già stato preservato come `.recovered.ndjson` e va **consolidato alla chiusura**;
- **numero di sessione** — rimosso e ri-derivato da `close-log.sh sessione`, mai reimplementato altrove;
- **chiusura interrotta** — rilevata via `close-log.sh report`;
- **verdetto della verifica** — `.zp/verify-verdict.json`, da confrontare con HEAD: se si riferisce a un
  commit superato è **STANTIO**, e stantio non è verde.

## Dove si esegue un lavoro

Il database **non è su questa macchina**: si arriva via tunnel `:5433`. Prima di lanciare un lavoro
pesante, chiediti su quale macchina va eseguito — il linux-pc è il gemello di produzione, il runner della
CI e la macchina della verifica lunga.

Se l'hook dichiara una parte giù, si riapre a mano — e solo allora:

```bash
ssh -fN -L 5433:localhost:5432 oracle-vm-default
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "\dt sys.sys_auth*"
```

---

*Estensione creata il 2026-08-30 insieme alla skill `avvio`. Il contenuto viene dal protocollo
`## Session start` del CLAUDE.md di questo repository, che resta la fonte canonica: se i due divergono,
vince il CLAUDE.md e questo file va aggiornato.*
