# S1090 — piano di sessione

> **stato**: CHIUSO
> **nasce-da**: la domanda di Enzo all'avvio — *«cosa significa 8 programmi aperti senza corsia?»* —
> e la misura che ne è seguita: sono **falsi allarmi**, e sono la punta di un difetto più grande.

## Il fatto, misurato all'avvio (2026-09-06)

`session_start.py:88-97` incrocia due cose: lo **stato derivato dalle spunte** di ogni
`.programmi/*.md`, e la presenza dell'item in una corsia del menu. Se il piano non risulta chiuso
e l'item non è in corsia, lo stampa fra i «PROGRAMMI APERTI FUORI DAL MENU».

Misurato: **tutti e cinque** gli item nominati (`227`, `235`, `241`, `242`, `243`) sono
`status: DONE` nel register. Il lavoro è finito; è rimasta indietro la **contabilità nel
file-piano**. Chi ha chiuso la voce ha aggiornato register e archivio, non le spunte.

E il cancello che dovrebbe dirlo **lo dice già**: `python docs/kb/tools/programmi.py --verifica`
esce **1** (verificato senza pipe: con `| tail` l'exit code viene mascherato — memoria
`pipe_masks_exit_code`) e nomina **29 difetti**. Nessuno lo interroga alla chiusura.

## Confine di sessione, dichiarato adesso

Questo ciclo copre **gli 8 orfani nominati + lo strumento**. I restanti 21 difetti di
`--verifica` sono **fuori da questo ciclo**: si presentano una volta sola alla fine, e non
entrano in «cosa resta».

Guardiano all'apertura del ciclo: contesto **9,8 %**, finestra 5h **44,0 %** — «si continua».

## Le voci

| id | cosa | chi | cosa significa fatto | stato |
|---|---|---|---|---|
| **V1** | `#227` — F3/F4/F5 chiuse in S1085 e mai spuntate; F2 spuntata **senza evidenza** | io | `--verifica` non nomina più `227-*`; stato `CHIUSO` | ✅ **FATTO** |
| **V2** | `#235` — chiusa in S1085 con prova live su due persone reali; il piano dice `NON AVVIATO` 0/3 | io | `--verifica` non nomina più `235-*`; stato `CHIUSO` | ✅ **FATTO** |
| **V3** | `#241` — 0 fasi, stato `IN CORSO (S1086)` fuori dal vocabolario; V2 era 🟡 in attesa del verde di CI | io | `--verifica` non nomina più `241-*` | ✅ **FATTO** |
| **V4** | `#242` — 0 fasi, stato `✅ **CHIUSA**` che il parser non riconosce | io | `--verifica` non nomina più `242-*` | ✅ **FATTO** |
| **V5** | `#243` — 0 fasi, stato `IN CORSO (S1086)` ma le 7 voci interne sono tutte ✅ | io | `--verifica` non nomina più `243-*` | ✅ **FATTO** |
| **V6** | I `*-piano-sessione.md` non sono programmi multi-sessione: `carica()` li salta | io | `--verifica` non li nomina più; `--selftest` verde; la ragione è scritta nel codice | ✅ **FATTO** |
| **V7** | Ri-misura | io | `session_start.py` non stampa più la sezione «PROGRAMMI APERTI FUORI DAL MENU» | ✅ **FATTO** |
| **V8** | Commit con percorsi espliciti | io | commit depositato, `--verifica` allegato come evidenza | ✅ **FATTO** |

## La simulazione a cinque domande

- **Precondizioni** — che i cinque item siano davvero `DONE` (verificato: `grep` sul register, 5 su 5)
  e che il lavoro sia davvero stato eseguito, non solo dichiarato. Verificato uno per uno:
  - `#227` — F3 mig `000368`, F4/F5 mig `000369`, cronaca con misure nel corpo del piano stesso;
  - `#235` — `esito-S1085` nell'archivio: `surveys` è `PERSONAL`, 10 rotte con `orgGate`,
    prova live `federica.marchetti@rtl-bank.org` 150/150 e `paolo.caputo@rtl-bank.org` 18/150;
  - `#241` — la sola riga 🟡 era V2, «il verde di CI aspetta il push». **Misurato oggi**:
    `Test (api integration)` è `success` su main negli ultimi tre giri consecutivi;
  - `#242` — il file dichiara già `CHIUSA — F1..F4 fatte il 2026-09-05`;
  - `#243` — le 7 voci interne (I1, I2, D1…D5) sono tutte ✅ nel corpo.
- **Meccanismo** — `RE_STATO = ^>\s*\*\*stato\*\*:\s*([A-Z ]+?)\s*$`: accetta **solo** maiuscole e
  spazi fino a fine riga. `IN CORSO (S1086)` e `✅ **CHIUSA** — …` **non combaciano**, e il parser
  cade su `?`. È questa la causa meccanica dei tre orfani `241/242/243`, non una dimenticanza.
  In `difetti()` un piano senza fasi è esente **solo** se `stato == "CHIUSO"` letto dal vocabolario.
  `ha_evidenza` esige una data `20\d{2}-\d{2}-\d{2}` **e** più di 20 caratteri di testo.
- **Propagazione** — sono file versionati nel repo: il commit li porta ovunque. Nessun artefatto
  generato, nessuna macchina remota coinvolta, nessun tocco a `db/**`.
- **Chi** — io, per intero. Nessuna voce richiede Enzo.
- **Guardia** — non si spunta niente per cui non esista evidenza **già scritta e datata** nel file
  o nell'archivio. Dove il lavoro non è dimostrabile, la fase resta vuota e lo si dichiara. Nessuna
  cancellazione di file: solo modifiche in luogo.

## Le prove che devono poter fallire

- `--verifica` esce **1** oggi ed è la prova che il cancello funziona: se dopo le correzioni
  uscisse ancora 1 sui file toccati, la cura non ha funzionato. Il verde su **tutti** i file non è
  l'atteso — restano i 21 difetti fuori ciclo.
- V6 può barare in un modo preciso: escludere i piani-sessione **e** per sbaglio anche altri file.
  Si conta il numero di programmi caricati prima e dopo — deve scendere esattamente di 3 — **misurato: 53 → 49, cioè −4**, perché nel frattempo
  esiste anche questo stesso file. La differenza è dichiarata, non ricalibrata a posteriori.
- V7 è la prova d'insieme: se la sezione sparisse per un errore di lettura invece che per la cura,
  sparirebbe anche il resto dell'output. Si guarda che il menu ci sia ancora.

---

## Ciclo 2 — richiesto da Enzo nello stesso turno

> *«devi prevedere che tutto quello che è rimasto fuori da questo ciclo venga fatto nel prossimo.
> inoltre, nella sessione nuova devi processare tutti i P1, P2 e P3 nella sequenza che ritieni
> opportuno in modo automatico. committa e pusha senza deploy e allineamento»*

La lista non si è allungata da sé: l'ha allungata Enzo, esplicitamente, dopo la chiusura del
ciclo 1. Le voci nuove sono tre, e sono di registrazione — nessuna tocca codice di prodotto.

| id | cosa | chi | cosa significa fatto | stato |
|---|---|---|---|---|
| **W1** | I 22 difetti residui diventano una voce viva del register, non una frase in chat | io | `#249` `ACTIVE` nel register **con il suo piano**; `handoff_lint` 0 FAIL | ✅ **FATTO** |
| **W2** | Il mandato «processa tutte le corsie» sopravvive alla riscrittura dello stato | io | memoria di progetto + riga nell'indice, che il boot carica da sé | ✅ **FATTO** |
| **W3** | Chiusura pulita: commit e push, **senza** deploy né allineamento dei cloni | io | `origin/main` allineato; nessun `refs/heads/prod` armato, nessun clone toccato | ✅ **FATTO** |

**Perché `#249` ha preteso un piano prima ancora di esistere come voce**: `handoff_lint` esce
**FAIL T2** su una voce `ACTIVE` senza file in `.programmi/` — «il menu non può mostrare da dove
riprende». Il cancello ha ragione, ed è la stessa deriva che `#249` viene a togliere: una voce
senza piano è una voce che la sessione dopo deve ri-capire da capo.

**Su W3, dichiarato invece che sottinteso**: deploy e allineamento sono **saltati per richiesta di
Enzo**, non perché non servissero. Nessun `refs/heads/prod` è stato armato, il gemello e la VM
restano al commit precedente. Chi riprende non deve leggere questa chiusura come «propagato».
