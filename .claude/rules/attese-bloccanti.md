---
paths:
  - "apps/web/**"
  - "apps/showcase/**"
---

# Attese che bloccano — regola permanente di piattaforma (Enzo, 2026-11-16)

Regola di Enzo del 2026-11-16 alle 01:13 UTC, con l'aggiunta del segnale sonoro alle 01:15 UTC: ogni lavoro in corso che blocca fino alla sua conclusione mostra un'animazione evidente e, quando l'avanzamento si può misurare, una barra di avanzamento moderna e professionale; alla fine di un lavoro lungo la notifica è accompagnata da un segnale sonoro essenziale e discreto, che si può disattivare. Vale per tutta la piattaforma (Heuresys è agentica: i giri degli agenti durano minuti, non millisecondi).

## Che cosa è un'attesa che blocca

Un'azione dopo la quale la persona aspetta l'esito prima di poter continuare: un pulsante o una pagina che si fermano finché la chiamata non torna (`useMutation` in corso, `disabled={x.isPending}`), un giro dell'agente, un'applicazione in blocco, una costruzione, un'importazione, una generazione. Non lo è il caricamento iniziale di una pagina, che usa `Skeleton`.

## Come si mostra

1. **Ogni attesa, sempre**: la barra in cima alla pagina (`TopProgress` di `@heuresys/ui`), accesa per tutta l'app da `apps/web/src/components/attesa-globale.tsx` finché c'è almeno una scrittura in corso (`useIsMutating`). Non si spegne pagina per pagina e non si duplica.
2. **Il pulsante che ha avviato il lavoro** cambia testo («Applicazione in corso…») ed è fermo, come oggi.
3. **Un lavoro lungo** (oltre qualche secondo, o un giro in sottofondo) mostra il riquadro `LavoroInCorso` (`apps/web/src/components/lavoro-in-corso.tsx`, che compone `WorkInProgress` di `@heuresys/ui`) nel punto della pagina in cui arriverà l'esito, con titolo, dettaglio (il passo in corso, che cosa succede alla fine) e, se l'avanzamento si misura (domini fatti su domini, righe su righe), la barra determinata. L'avanzamento arriva dall'API (`/v1/*`), mai stimato a tempo nel frontend.
4. **Alla fine di un lavoro lungo** (almeno tre secondi) `LavoroInCorso` suona il segnale `playEndSignal()`; per i giri in sottofondo arriva anche l'avviso nella casella delle notifiche (`sys_inbox_notifications`, voce G3 del piano di allineamento). Il segnale si spegne per persona con l'interruttore «Segnale sonoro alla fine» nel riquadro (la scelta resta nel browser), non suona se il browser blocca l'audio, e non sostituisce mai l'esito scritto.
5. **Movimento ridotto**: con `prefers-reduced-motion` la barra resta visibile, ferma e a righe; il testo dice comunque che il lavoro è in corso. Mai un'attesa che si vede solo dal movimento.

I componenti vivono in `@heuresys/ui` (≥ 1.5.0: `ProgressBar`, `WorkInProgress`, `TopProgress`, `playEndSignal`), non in questo repo (`.claude/rules/design-system-ui.md`).

## Il censimento

`python docs/kb/tools/censimento_attese.py` elenca le pagine con un'attesa che blocca, dice quali sono coperte dalla barra globale e quali hanno un lavoro lungo che chiede il riquadro. `--check`, che gira nella CI (`.github/workflows/attese-bloccanti.yml`), esce rosso se una pagina con un lavoro lungo non ha `WorkInProgress` e non è nel registro dei debiti `docs/kb/tools/attese_debiti.json`; chi la corregge toglie il suo debito nella stessa PR.
