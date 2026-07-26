# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-07-26 (S1032 — prima corsa presidiata dell'impianto, e il modello organizzativo che ne è uscito).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md` · pattern di dati → `docs/kb/DATA_PATTERNS.md`.

## Last session brief (S1032)

Prima corsa **presidiata** dell'impianto zero-pendenze, autorizzata in sessione col freno che resta
inserito. Il cluster è stato chiuso, ma il valore vero è quello che ha fatto emergere.

Tre revisori adversarial hanno demolito la **mia** evidenza, non la mia modifica: il test che chiudeva
il criterio era una tautologia, il fixture poteva passare contro il bug, due metodi su tre erano
scoperti, e l'ADR raccontava un allargamento di accesso come se fosse solo la chiusura di un falso
diniego. Tutto corretto e ri-verificato iniettando la regressione in ciascuno dei tre metodi.

Da lì Enzo ha stabilito il modello: **la SoT è l'organigramma; i ruoli RBAC si popolano da lì, quindi
non possono contraddirlo**. I ruoli si dividono in organizzativi (derivati dalle catene gerarchiche)
e funzionali (team e processi), più i mandati conferiti. Ricerca sul CCNL credito e terziario per
capire chi è manager davvero: **il vertice di una direzione o divisione, non chi ha dei riporti**.
Misurato: 11 responsabili di unità su 17 senza ruolo manageriale; e — scoperta tardiva, dopo aver
dichiarato il contrario — l'inquadramento contrattuale **esiste già** in `sys_user_contracts`.

Un team di sei lenti sul DBMS ha poi trovato che il gate di copertura GDPR **non copre**: dichiara di
derivare dal grafo delle chiavi esterne e poi filtra per nome tabella, guardandone 74 su 248.

## Obiettivo permanente (mandato Enzo, S1029 — vale per OGNI sessione futura)

**Portare heuresys-advanced a una fresh session senza pendenze**: zero debiti, zero task incompleti,
zero pending, zero errori aperti. Il censimento è fatto; ora è esecuzione, con **doppia verifica e
review adversarial per ogni task**. Tutte le decisioni tecniche sono di Claude, il tracciamento del
piano pure; a Enzo vanno solo le voci che dipendono da un suo input.

## Stato del piano

`docs/superpowers/specs/2026-07-25-zero-pending-plan.md` — si conta con `zp_state.py piano`.
Programma strutturale nuovo: `2026-07-26-organizational-model-and-role-derivation-design.md` (F0-F5).

- **W0 — NON completa**: resta `Z-034` (segreti TOTP). Classe D: **serve la tua autorizzazione**.
- **W1** in corso · **W2-W5** non iniziate · **W6** tutta su di te.

## ⚠ Top priorities (next session)

1. **`Z-257` — il gate GDPR che non gatea.** Il test dichiara «la SoT è `pg_constraint`, mai una
   lista scritta a mano» e poi restringe con `LIKE 'sys.sys_user\_%'`: molte tabelle con dati
   personali veri non sono mai confrontate col registro. Piccolo, specificato, chiude una **classe**.
2. **Derivazione dei ruoli organizzativi** — calcolabile già oggi senza F0/F1: *Dirigente + vertice
   di unità → `MANAGER`*. I dati contrattuali sono sani (9 Dirigenti su 10 sono vertici di unità);
   è lo strato RBAC a non seguirli (solo 5 su 9 hanno il ruolo).
3. **F0** — catalogo dei tipi di unità legato al settore. Fondamenta: contesto fresco.
4. `Z-258` (ambito tenant in tre classi) · `Z-256` (`similarPeople` filtra il bersaglio, non le righe)
   · i sette pattern del team ancora da verificare.

## Open questions (autorità *cosa* = Enzo)

- **Autonomia non presidiata**: il freno resta inserito. Dopo questa prima corsa presidiata restano
  tre dei quattro controlli su sessione viva (bootstrap ✅; freno a metà lavoro, troncamento da
  budget, frontiere della description ancora da fare).
- **Ranghi delle unità organizzative**: F0 confermata sull'articolazione bancaria; resta da fissare
  quali ranghi esistono per RTL Bank e quali hanno un manager al vertice.
- **Contraddizione GDPR** (design SuccessFactors vs due diligence) · **Wave-3 (#17)** in HOLD.
- WAIT-INPUT invariati: **#4** pricing · **#8** app-password Outlook · **#16** SuccessFactors · **#52** SSO IdP.

## Verification (next session)

```bash
git log origin/main..HEAD --oneline               # 0 dopo il push handoff
python docs/kb/tools/handoff_lint.py              # OK atteso
python docs/kb/tools/zp_state.py piano            # 258 cluster, 43 chiusi, 185 autonomi
python docs/kb/tools/session_start.py             # menu + salute
```
