# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-08-16 (S1066).
> **Vista rapida** (priorità · open questions). Snapshot granulare → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`.

⚠ **`#196` `#197` `#198` `#199` sono un corpo solo, non quattro voci**: prima di lavorarci leggi
`D:\heuresys-design-lab\2026-08-16--LEGGIMI-PRIMA-consegna-tenant-builder-p3.md` — sequenza,
errori già trovati, cosa è già verificato, cosa non fare (voce `#208`).

## Last session brief (S1066 «Le prove hanno trovato quello che nessuno stava cercando»)

**Eseguite le 7 consegne del design-lab.** Il filo della sessione è che **quattro volte una prova
scritta per dimostrare una cosa ne ha smentita un'altra**, e ogni volta il difetto era più grave di
quello che stavo correggendo: la prova live degli indicatori ha scoperto che **ogni filtro booleano
di querystring dell'API mente** (`z.coerce.boolean()` rende `?flag=false` uguale a `true`, in una
ventina di punti); la prova generale della CI ha fermato una tabella non classificata che sarebbe
stata CI rossa 25 minuti dopo il push; il collaudo del canale ha rivelato un controllo rotto da
prima; e la patch del lab per i numeri doppi, applicata com'era, **li creava ancora**.

**Niente è stato preso per buono.** Ogni consegna verificata contro il sistema vivo: un rilievo
respinto (il documento 2b/2c dà P2a per *costruita*, ma `#132` non è mai stata implementata), una
premessa superata (le due specie di indicatori convivono già in `learning_modules`), e cinque prove
collaudate **sabotandole** per vederle rosse prima di fidarsene.

## Obiettivo permanente (mandato Enzo, S1029)

**Fresh session senza pendenze**: zero debiti o task incompleti; doppia verifica e review
adversarial; le decisioni tecniche sono di Claude.

## Top priorities (prossima sessione)

1. **`#198` P3 — riprendere da T4** (sorgente parametrica e piano di costruzione, E21): 4 task su 9
   sono fatti, `resume-from` nel register. T4 disaccoppia il motore dall'archetipo ed è un
   refactoring di `repository.ts` (370 righe, ~250 dipendono dall'archetipo): **serve il suo spazio**,
   ed è la ragione per cui non è stato aperto a fine sessione
2. **`#209` i venti filtri booleani** che rispondono «tutti» a qualunque domanda — P1 perché ogni
   `?isActive=false` oggi mostra il contrario di ciò che dichiara; la cura è già scritta e in uso
3. **`#142` F3b — i dati dentro le viste**: 27 viste, o tutte o nessuna ·
   `.programmi/142-cruscotti-per-tipologia.md`

## Open questions

- **Due scoperte da decidere, non da eseguire**: `#209` (correggere i 20 filtri residui cambia il
  comportamento di venti endpoint — quando?) e `#210` (`career_paths` e `learning_paths` non hanno
  **nessuna** riga di piattaforma: distinguere due specie dove una è vuota da sempre è informazione
  o rumore?).
- **Si apre davvero il ciclo di valutazione?** È in **bozza** (`RTL-2026-ANNUAL`): farlo avanzare
  mette tutta l'azienda davanti a un compito, e va fatto quando la schermata dell'autovalutazione
  esiste.
- **`/users` è governata al contrario di `/organization`** sulla stessa materia · **`#169`**
  separare password e secondo fattore · **`D-69`** riapertura verificata, nessuna urgenza.

## Verification

```bash
python docs/kb/tools/session_start.py               # menu + salute, un colpo solo
python docs/kb/tools/handoff_lint.py                # cancello di coerenza, bloccante
python docs/kb/tools/completezza_tenant.py --autoprova   # NUOVO nel repo (P3/T8), 2 esiti opposti
bash scripts/verifica-deploy.sh                     # DEPLOYATO · IN-VOLO · CI-ROSSA · DISALLINEATO · NON-VERIFICATO
```

⚠ **La verifica lunga si esegue sul linux-pc, non qui** (standard S1054):
```bash
ssh linux-pc 'source ~/.nvm/nvm.sh; nvm use 22; cd ~/heuresys-advanced/apps/api && pnpm exec vitest run'
```
