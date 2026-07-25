# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-07-26 (S1031 — i documenti dell'impianto zero-pendenze allineati a ciò che l'impianto fa davvero).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`.

## Last session brief (S1031)

I documenti dell'impianto zero-pendenze descrivevano com'era prima della review che l'ha
corretto. La sezione «stato attuale» del README, riscritta da Enzo, regge alla verifica:
sette imprecisioni corrette rimisurando (i test automatici sono quindici, il documento ne
dichiarava quattordici). Ma il difetto di fondo non era aritmetico: cinque affermazioni
promettevano garanzie inesistenti, due delle quali nel codice. `zp_gate.py tipi` **stampava
una regola diversa da quella che applica**; `SKILL.md` non conosceva il freno, quindi una
invocazione a mano l'avrebbe scavalcato e «l'impianto non parte» era falso; `blast-radius.md`
insegnava a dedurre la classe di rischio dalla descrizione del cluster, il metodo che aveva
mandato in corsia non presidiata un lavoro che si chiude deployando il sito pubblico. Dove
un numero invecchia ora c'è il comando che lo conta, e il design non è più una bozza in
attesa di approvazione: è implementato, e aspetta solo il tuo via a lavorare non sorvegliato.

## Obiettivo permanente (mandato Enzo, S1029 — vale per OGNI sessione futura)

**Portare heuresys-advanced a una fresh session senza pendenze**: zero debiti, zero task
incompleti, zero pending, zero errori aperti. Il censimento è fatto; ora è esecuzione, con
**doppia verifica e review adversarial per ogni task**, e chiusura completa quando conviene
ripartire puliti. Tutte le decisioni tecniche sono di Claude, il tracciamento del piano
pure; a Enzo vanno solo le voci che dipendono da un suo input.

## Stato del piano

`docs/superpowers/specs/2026-07-25-zero-pending-plan.md` — si conta con `zp_state.py piano`.

- **W0 — NON completa**: resta `Z-034` (segreti TOTP in chiaro nel repo e in plaintext a DB,
  `MFA_ENCRYPTION_KEY` su VM e linux-pc). Tocca segreti in produzione: **serve la tua
  autorizzazione**, non parte da solo.
- **W1** in corso · **W2-W5** non iniziate · **W6** tutta su di te.

## ⚠ Top priorities (next session)

1. **Proseguire W1**, la corsia col miglior rapporto chiusure/ora: `Z-213`/`Z-214` (tracker
   100X), `Z-219` (atlas), `Z-221`/`Z-223` (roadmap e wave in DRAFT), `Z-230`, `Z-239`, `Z-031`.
2. **`Z-250` — la prima corsa presidiata dell'impianto.** Codice e documenti sono a posto;
   manca una corsa vera su un paio di cluster innocui, che chiude anche i quattro controlli
   che richiedono una sessione viva (freno a metà lavoro, troncamento da budget, bootstrap
   che non ri-censisce, frontiere della description).
3. **Gli altri cluster nati in S1030**: `Z-249` due rossi semantici · `Z-251` suite fragile
   alla contesa sul DB · `Z-252` PaletteDropdown inerte · `Z-253` `heuresys_ci` mai
   rinfrescato (è il DB dei gate CI) · `Z-254` disciplina di rilascio upstream.
4. **W2 debito/test**: il pezzo più utile resta il gate E2E in CI.

## Open questions (autorità *cosa* = Enzo)

- **Autonomia non presidiata**: l'impianto esiste, è pubblicato, i documenti sono allineati
  e il freno resta inserito (`meta.autorizzato_non_presidiato: false`). Ciò che aspetta il
  tuo via **non è approvare il design** — è costruito — ma autorizzarlo a lavorare senza
  sorveglianza. Prima la corsa presidiata (priorità 2).
- **Contraddizione GDPR**: il design SuccessFactors dice «nessuna governance PII/GDPR
  richiesta», la due diligence elenca RoPA/DPIA/DPA fra i mancanti. **Wave-3 (#17)**: in
  HOLD, sblocca il Blocco E Fase 3 (#69).
- WAIT-INPUT invariati: **#4** pricing · **#8** app-password Outlook · **#16**
  SuccessFactors · **#52** SSO IdP.

## Verification (next session)

```bash
git log origin/main..HEAD --oneline               # 0 dopo il push handoff
python docs/kb/tools/handoff_lint.py              # OK atteso
python docs/kb/tools/zp_state.py piano            # 255 cluster, 42 chiusi, 183 autonomi
python docs/kb/tools/zp_selftest.py               # 15 passati, 0 falliti, 4 a mano
gh run list --branch main --limit 7               # 7/7 success sull'ultimo commit
```
