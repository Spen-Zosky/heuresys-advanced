# Il driver — contratto, interruzione, ripresa

Il driver (`scripts/zero-pending-driver.sh`) non ragiona sul merito del lavoro: apre sessioni, legge
com'e' andata, decide se riaprire. Tutta l'intelligenza sta nella skill; tutta la **continuita'** sta
qui.

## Interrompere: tre modi, tre costi diversi

| Modo | Come | Cosa costa | Cosa resta da fare alla ripresa |
|---|---|---|---|
| **Pulito** (la via normale) | `New-Item .zp\STOP` (o `touch .zp/STOP`) | il tempo per finire il cluster in corso e chiudere: tipicamente decine di minuti | niente: cancelli il file e rilanci |
| **Fine finestra** | automatico, se hai passato `--window` | zero: la chiusura e' pianificata | niente: la ripresa e' il rilancio successivo |
| **Brutale** | uccidere il processo, chiudere il terminale, staccare la corrente | il lavoro non committato del cluster in corso | una **iterazione di recupero**, che il driver fa da solo |

Il punto che conta: **nessuno dei tre perde stato.** Lo stato vive su file (`.zp/cursor.json`, il
piano, l'Action register) e a ogni chiusura pulita viene pushato su `origin main`. Anche se il PC
muore, il lavoro chiuso e' su GitHub.

## Fermata pulita — `.zp/STOP`

Il file viene controllato a due livelli, e con `clusters_per_iteration: 1` i due coincidono: il
driver lo guarda **fra** le invocazioni, la skill lo guarda fra un cluster e il successivo. Chi lo
trova non tronca: finisce il cluster in corso, esegue `close` per intero (gate, commit, push,
propagazione, handoff) e poi si ferma.

Riprendere: cancella il file e rilancia lo stesso comando. Non c'e' niente da ricostruire, nessun
`INTERRUPTED` da riprendere, il repo e' pulito e allineato ai cloni.

## Fermata brutale — e il recupero

Se il processo muore all'improvviso, nessuno ha scritto `.zp/last-outcome.json` e nessuno ha marcato
il cluster `INTERRUPTED`. Alla partenza il driver riconosce la situazione da tre segni: lock
presente ma PID morto, `cursor.json` con un cluster aperto, e nessun `last-outcome.json` coerente.

In quel caso la **prima invocazione e' di recupero**, non di lavoro nuovo:

```bash
claude -p "/zero-pending-loop recover" --output-format json --max-budget-usd <n>
```

Il modo `recover` legge il cursore per sapere a che passo era il cluster, guarda il working tree, e
decide: se i gate sono verdi committa il parziale (e' progresso reale), altrimenti `git stash` e
marca il cluster `INTERRUPTED` con `resume-from` e il riferimento dello stash. Poi passa la mano a
`resume`.

C'e' un precedente nel repo su cui questo si appoggia: `handoff` gia' gestisce una sessione morta
senza chiusura, tramite il sibling `.recovered` del session journal. Il recupero del loop consolida
il journal nello stesso modo.

## Sospensione lunga — non riprendere alla cieca

Se fra l'ultima chiusura e il rilancio sono passate piu' di `resume_stale_after_hours` (default 24),
il mondo puo' essere cambiato: tu hai lavorato, una sessione CLI ha chiuso cluster, il piano si e'
mosso. In quel caso il driver **non entra da `resume`**: entra da `bootstrap`, che riverifica
l'integrita' del piano e aggiorna le fonti stale prima di scegliere il prossimo cluster.

Riprendere da `resume` dopo tre giorni significherebbe lavorare su una fotografia scaduta — lo
stesso errore che il design evita al primo avvio.

## La finestra oraria: interrompere e riprendere come funzionamento normale

`--window 22:00-07:00` trasforma l'interruzione da eccezione a routine. A fine finestra il driver
non tronca: chiude pulito ed esce. La ripartenza la fa l'attivita' pianificata di Windows, la notte
dopo, e trova esattamente lo stato che la notte prima ha lasciato.

E' il modo consigliato di far girare le ~154 sessioni che il piano richiede: non una maratona da
lanciare e sperare, ma tante finestre brevi con una chiusura verificata ciascuna.

## Guard-rail all'avvio — quando il driver si rifiuta di partire

Ognuno di questi ferma il driver **prima** di aprire una sessione, perche' partire comunque
significherebbe collidere con qualcuno.

| Condizione | Perche' ferma |
|---|---|
| `.zp/STOP` presente | il freno e' tirato: non si parte, si dice che c'e' il file |
| **working tree sporco** all'avvio | qualcuno sta lavorando in quel repo — tu, o una sessione CLI. Due writer sullo stesso working tree e' il modo piu' rapido di perdere lavoro |
| `HEAD` diverso da `origin/main` con commit non pushati non suoi | stessa ragione: c'e' lavoro di qualcun altro in volo |
| lock presente con PID **vivo** | c'e' gia' un driver in esecuzione |
| lock presente con PID morto da < `lock_stale_after_hours` | possibile morte recente: entra in `recover`, non in `resume` |
| `clusters_classified: false` in config | la classificazione per raggio d'impatto e' la precondizione di sicurezza dell'impianto |
| `zp_gate.py` o `zp_zero_check.py` assenti | senza i controlli meccanici la skill non ha le sue garanzie |

Il guard-rail sul working tree sporco e' quello che ti protegge dal caso concreto piu' probabile:
tu apri una sessione CLI per fare una cosa a mano, ti dimentichi che il driver e' pianificato, e a
mezzanotte partirebbe sopra il tuo lavoro. Non parte.

## Lo scheletro

```bash
acquisisci_lock_o_esci
verifica_guardrail_o_esci          # tabella sopra
if sessione_morta_senza_chiusura; then invoca "recover"; fi
if ultima_chiusura_piu_vecchia_di N_ore; then modo=bootstrap; else modo=resume; fi

while true; do
  esci_se .zp/STOP
  esci_se fuori_finestra
  esci_se iterazioni >= max_iterations
  esci_se spesa_cumulata >= hard_stop_usd_total
  zp_zero_check.py && { esci "condizione primaria raggiunta"; }

  out=$(claude -p "/zero-pending-loop $modo" --output-format json \
          --max-budget-usd "$max_usd" --permission-mode "$mode")
  spesa_cumulata += $(jq -r .total_cost_usd <<<"$out")
  registra_run_record

  case $(leggi .zp/last-outcome.json) in
    cluster-closed|session-closed)  modo=resume ;;
    cluster-interrupted)            conta_fallimenti_su_questo_cluster ;;   # 2 -> passa al prossimo
    nothing-to-do|blocked)          esci ;;
    assente)                        modo=recover ;;                          # troncamento
  esac
  riscrivi .zp/PROGRESS.md
done
```

Due dettagli che non sono ovvi. Il driver **non** distingue «errore» da «troncamento» guardando
l'exit code: guarda se `.zp/last-outcome.json` e' stato scritto. E la spesa la misura **fra** le
iterazioni, leggendo `total_cost_usd` dall'output JSON — non c'e' modo di conoscerla durante.
