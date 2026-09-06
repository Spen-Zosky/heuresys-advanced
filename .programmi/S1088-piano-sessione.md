# S1088 — piano di sessione

> **mandato**: istruzione di Enzo alla chiusura S1087 — *«alla prossima sessione riprendi da `#219` F5e»*.
> **confine dichiarato all'inizio**: F5e è **la corsa di conferma + il triage di ciò che resta rosso**.
> Se i falliti sono 0, la voce si chiude col passaggio in CI, che è dentro questa sessione. Se non sono 0,
> il triage e le correzioni possono eccedere la sessione: lo si dichiara quando il numero è misurato,
> non prima.
> **guardiano al via**: contesto 9,9 % · finestra 5h 18,0 % → *si continua*, largo su entrambi i rami.

## Tabella dei deliverable

| id | cosa | chi | fatto significa | stato |
|---|---|---|---|---|
| A | Allineare il gemello a `b28081d8` e ricostruire ciò che ne dipende | io | `git rev-parse HEAD` sul gemello = `b28081d8`, `pnpm install` fatto, web ricostruito con la destinazione giusta del proxy | ✅ **FATTO** — gemello a `b28081d8`; `@heuresys/ui` 1.0.0 → **1.1.0**; web ricostruito (manifest → `http://localhost:8013`); **e il preflight ha trovato un'incoerenza vera**: il bundle dell'API era delle 17:34 e `b3723129` (modulo `candidates` di `#54` F3) delle **17:56** — bundle rifatto (1.93 MB) e API riavviata, `mappingsLoaded: 986` (combacia con la produzione; a fine S1087 il gemello ne aveva 980) |
| B | Preflight pulito su tutti i controlli | io | `node scripts/e2e-blocchi.mjs --solo-preflight` esce 0 e non porta avvisi | ✅ **FATTO** — `EXIT=0`, «nessun avviso — l'ambiente e' quello che la suite presume». Load `1.38`, **0 job CI in corso** |
| C | Corsa integrale 4/4 fasi sul gemello, a macchina scarica | io | referti JSON delle 4 fasi su disco + conteggio eseguiti = totale dichiarato | 🔄 **IN CORSO** — lanciata 2026-09-06 02:52 sotto `setsid nohup` (PID 20250), log `/tmp/e2e-s1088.log`, esito in `/tmp/e2e-s1088.esito` |
| D | Triage dei falliti per **firma**, letto dai referti | io | un file di triage con ogni firma, la sua occorrenza e la sua ipotesi di causa | ⬜ |
| E | Se falliti = 0 → passaggio della suite in CI (criterio `#211` F4) | io | il workflow esegue la suite e la CI è verde | ⬜ |
| F | Registrare l'esito in `.programmi/219-*` e nel register | io | il file porta la misura con la data | ⬜ |

## Simulazione — le cinque domande, per la voce che conta (C)

**Precondizioni.** ① il gemello dev'essere **scarico** — misurato ora: load `0.38`, `gnome-software` allo
0,8 % (a fine S1087 era 4.08 con `gnome-software` all'86 %, ed è la ragione per cui la corsa non era
partita); ② la CI non deve girare sul gemello, che ne è il runner; ③ il gemello deve essere allineato a
`b28081d8`; ④ l'API dev'essere viva e il suo bundle non più vecchio dell'ultimo commit che tocca
`apps/api/src` o `packages/shared/src`; ⑤ il `.next` del web dev'essere compilato verso `:8013`, non
verso la 3001.

**Meccanismo.** `node apps/web/scripts/e2e-blocchi.mjs` sul gemello: quattro **invocazioni separate** di
Playwright (processi separati, così un rosso non salta ciò che sta a valle), preflight che dichiara le
incoerenze d'ambiente, referto JSON per fase, e un conteggio finale che confronta gli eseguiti col totale
di `--list` — «non ho eseguito» non è «passato». Letto il file, non ricordato.

**Propagazione.** Le correzioni nascono qui e arrivano al gemello con `git pull`; ciò che il pull **non**
porta sono gli artefatti generati — il bundle dell'API e il `.next` del web — che vanno ricostruiti a
mano. È esattamente il punto cieco che ha nascosto la causa tre volte in S1087.

**Chi.** Io, interamente.

**Guardia.** La corsa **scrive**: la guardia è che scriva nel **clone** del gemello e non in produzione.
Il pericolo è reale e già misurato in S1085 — un build del gemello con l'indirizzo della VM inlinato
avrebbe fatto scrivere la suite nel database di produzione. Si verifica **prima** che il `.next`
compilato punti a `localhost:8013` e non alla VM. Seconda guardia: la corsa gira sotto `nohup` sul
gemello, perché un lavoro remoto in foreground muore con la sessione CLI.

## Registro delle scoperte fuori ciclo

*(voci nuove che emergono strada facendo: si presentano una volta sola a fine sessione, non entrano in
«cosa resta»)*

- drift `RBAC-map`: live 986 non presente in `SOT_STATE §0` — rosso dello STALENESS SELF-CHECK all'avvio.
