# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-11 (S1054).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`.

## Last session brief (S1054)

Sessione lunga in tre tempi. **Primo**: il freno del cancello di verifica è stato tolto, e nel
farlo si è scoperto perché nessuno ci riusciva — il comando indicato per «rimettere il verdetto
in pari» a working tree pulito **non esegue nulla** e scriveva `green`. Corretto (`not-measured` +
`run --suite`), più le due voci nate lì (#184 il troncamento dichiarato, #185 la batteria che
prova il cancello). **Secondo**: **#124 D4 chiuso su tutti i moduli** — l'intera classe EVALUATION maschera il
giudizio al solo mandato piattaforma, con il frontend che dichiara ciò che non mostra. Tre reperti
che valgono più del codice: la *spiegazione* di un punteggio è più rivelatrice del punteggio (e
sconfinava in COMPENSATION), l'**ordine** di una lista è la graduatoria delle persone, e il
**vincolo 5** sugli aggregati ha morso per la prima volta. **Terzo**: da una domanda di Enzo sulla
velocità, il clone del linux-pc è stato riparato alla radice (#172) e la verifica lunga si sposta
lì — **16 min contro 31**, misurato.

**Coda della sessione, dopo la chiusura formale** (commit `9289a030`): su richiesta di Enzo la
chiusura non finisce più dichiarando ma **leggendo dalle macchine** — `scripts/verifica-deploy.sh`,
chiamato in coda a `close-propagate.sh`, confronta lo sha deployato su ogni host con quello atteso,
conta le corse CI, controlla servizi e produzione, e dichiara con un vocabolario chiuso
(DEPLOYATO · IN-VOLO · CI-ROSSA · DISALLINEATO · **NON-VERIFICATO**). Visto dire sì e dire no nello
stesso pomeriggio: `IN-VOLO` subito dopo l'armamento, `DEPLOYATO` a CI conclusa.

**Tre strumenti che dicevano verde senza aver misurato** sono stati trovati e corretti in questa
sessione: il cancello a scrivania pulita, il typecheck di `apps/web` (leggeva il `dist` di
`@heuresys/shared` fermo al 20 luglio) e il confronto del clone (contava righe, non oggetti).

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti o task incompleti; doppia verifica e review
adversarial; le decisioni tecniche sono di Claude.

## Top priorities (prossima sessione)

1. **#183 policy di cancellazione utente** (~1 sessione, **P1**) — mandato di Enzo del 2026-08-10,
   **non iniziata** in S1054 nonostante fosse in programma: il ciclo si è allungato su #124 e sul
   lavoro di infrastruttura richiesto in corsa. Censimento già in mig `000303`.
2. **#124 residuo minimo**: resta la sola pagina `users/[userId]` del frontend (D6). D4 è chiuso per intero.
3. **Le due leve di velocità NON adottate** (misurate, esiti nel `CLAUDE.md`): `isolate: false`
   manda in rosso quasi tutti i file e richiederebbe di riscrivere `test/helpers/setup.ts`; le
   sessioni di login condivise valgono molto meno di quanto il registro suppone.
   Chi riprende il tema parta da lì, non da capo.
4. **#99 F4** (resolver sull'albero delle unità) e **#92 passi 4-7** restano i due filoni P1 grossi.

## Open questions

- **#182 — i due rami recuperati** (473 righe mai in main): istruire e portare in main, o archiviare?
- **Il ruolo di database `gov_worker`**: si revoca o resta? (read-only, lo script che lo creava non c'è più.)
- **Un censimento che confronti le tre macchine** come ora fa il clone col database — vale ~1h e
  chiuderebbe in modo permanente la domanda «sono equivalenti?». In S1054 la risposta è stata
  data a mano: sì dove conta (PostgreSQL 16.14 su entrambi, Node 22 forzato), no altrove e **per
  design** (servizi, chiavi in denylist).

## Verification

```bash
python docs/kb/tools/session_start.py                       # menu + salute, un giro
python docs/kb/tools/verify_gate.py check                   # cancello di fine turno
python scripts/test/verify-gate-tests.py                    # 12 prove: il cancello sa dire rosso?
bash scripts/clone-vm-db.sh                                 # 70s — clone allineato per costruzione
cd apps/api && pnpm exec tsx scripts/prova-live-124-d4.mts   # prova live #124, 15 endpoint
```
