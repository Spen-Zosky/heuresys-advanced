# Chiusura sessione — dottrina del dubbio + diario · S1046

**Deciso da**: Enzo, 2026-08-06 · **Origine**: referto adversarial su
`heuresys-design-lab/2026-08-06--analisi-procedura-di-chiusura.md`

**Perimetro deliberatamente ridotto.** Il documento d'origine proponeva 7 voci, fra cui la
riscrittura della chiusura in quattro verbi. **Quella NON è in questo ciclo**: la statistica che la
giustificava non regge (148 commit di chiusura su 108 sessioni, ma dentro il numero convivono
chiusure singole con due commit — `S954`, 1 minuto — e sessioni riprese il giorno dopo — `S1041`,
18 ore). Si misura prima con il diario (C2), si ristruttura dopo, con i numeri veri.

---

## Voci

| id | cosa | chi | fatto quando | stato |
|---|---|---|---|---|
| C1 | `align-clones.sh` — deploy: nel dubbio NON si deploya, e si dice perché | Claude | marcatore assente + `--auto-deploy` ⟹ `DEPLOY=0` con ragione stampata | **FATTO** |
| C2 | `scripts/close-log.sh` + `.handoff/close-log.ndjson` (gitignored) | Claude | una chiusura reale produce righe leggibili; `report` le aggrega | **FATTO** |
| C3 | `close-propagate.sh` — il messaggio del clone-DB smette di affermare il falso | Claude | marcatore assente ⟹ «ignoto», mai «no change this session» | **FATTO** |
| C4 | Gli script scrivono il diario da soli (non dipende dalla memoria del modello) | Claude | `--dry-run` e una run reale lasciano traccia senza che nessuno la scriva a mano | **FATTO** |
| C5 | Skill `handoff` — cosa fare quando non c'è nulla da committare | Claude | la skill copre il caso invece di lasciarlo improvvisare | **FATTO** |
| C6 | Test in `scripts/test/run-shell-tests.sh` per i casi «marcatore assente» | Claude | i due rami (deploy, clone) sono coperti e verdi | **FATTO** |

---

## Simulazione (R24 §3) — svolta PRIMA di eseguire

### C1 — deploy nel dubbio

- **Precondizioni**: `align-clones.sh` righe 84-94 leggibili e invariate rispetto al referto. ✔ lette.
- **Meccanismo**: il ramo `else` di `case DEPLOY_FLAG in auto)` oggi assegna `DEPLOY=1` con il
  commento *«no reliable delta → conservative: deploy»*. Non è prosa da interpretare: è la riga 92.
- **Propagazione**: lo script è versionato ⟹ arriva su VM e linux-pc via `git reset --hard` nel
  canale 1. Nessun payload da portare a mano.
- **Chi**: Claude, per intero.
- **Guardia**: la modifica **riduce** le azioni (da «deploya» a «non deploya»), quindi il caso limite
  pericoloso non è il deploy mancato ma il deploy atteso che non parte. Mitigazione: il messaggio
  stampa la ragione e il rimedio (`--deploy`), e `--deploy` esplicito resta incondizionato.
  **Effetto collaterale accettato e voluto**: `align-clones.sh all --auto-deploy` in modalità *full*
  (senza `--delta`) oggi deploya, dopo la modifica no. È il comportamento richiesto dalla dottrina —
  in full mode non esiste una finestra su cui misurare, quindi non si sa, quindi non si agisce.

### C3 — verità del clone-DB

- **Precondizioni**: `close-propagate.sh` righe 72-93 e 114-126. ✔ lette.
- **Meccanismo**: `need_clone` resta `0` quando il marcatore manca — **il comportamento è già
  quello giusto** (azione cara, stato ignoto ⟹ non agire). A mentire è solo il messaggio di riga 125,
  che dichiara *«no db/migrations|seeds change this session»* affermando un fatto che in quel ramo il
  sistema non può conoscere. Quindi C3 è una correzione di **verità**, non di comportamento.
- **Propagazione**: come C1, versionato.
- **Chi**: Claude.
- **Guardia**: nessuna azione cambia ⟹ nessun caso limite distruttivo. Il rischio residuo è
  puramente di forma (un messaggio sbagliato al posto di un altro), coperto da C6.

### C2/C4 — il diario

- **Precondizioni**: esiste già il pattern `scripts/journal-append.sh` (NDJSON, escape a mano, zero
  dipendenze, non-fatale). ✔ letto — si riusa alla lettera invece di inventare un formato.
- **Meccanismo**: `close-log.sh` appende una riga per passo. **Nessuna decisione lo legge** — è
  rendiconto, non stato: se il file sparisce, la chiusura resta corretta. È la differenza con il
  registro JSON proposto dal documento d'origine, che invece faceva dipendere la correttezza dalla
  memoria (e duplicava un fatto già misurabile, contro la regola SoT del CLAUDE.md).
- **Propagazione**: il file è **per-macchina e gitignored**, come il marcatore e il journal. Non deve
  propagarsi: descrive cosa ha fatto *questa* macchina. Lo script che lo scrive, sì (versionato).
- **Chi**: Claude.
- **Guardia**: ogni chiamata è `|| true`. Un diario che fallisce non deve mai far fallire una
  chiusura — è un osservatore, non un attore.

### C5 — nothing to commit

- **Precondizioni**: `~/.claude/skills/handoff/SKILL.md` v5.1, Step 4 righe 71-80. ✔ lette: il caso
  non è coperto da nessuna riga.
- **Meccanismo**: la skill è globale-utente, fuori dal repo; si propaga alle altre macchine con
  `align-claude-ecosystem.sh` (canale 2 della chiusura).
- **Chi**: Claude.
- **Guardia**: modifica di sola prosa su un file non eseguibile. Nessun caso limite.

---

## Cosa NON entra in questo ciclo

- La riscrittura in quattro verbi (`registra · verifica · pubblica · propaga`) — **si decide fra due
  settimane leggendo `close-log.ndjson`**, non il `git log`.
- `handoff_lint.py --json`: utile altrove, inutile qui (i predicati non usano il linter — vedi il
  rilievo R5 del referto: `D4` è giallo per costruzione e `D1-D3` sono verdi su uno stato stantìo).
