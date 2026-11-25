# Regole di progetto (portate dalla memoria il 2026-10-21)

- Perimetro: non si va oltre lo scope approvato. Una scoperta strada facendo non si esegue e non ferma il lavoro chiesto: si annota nel registro fuori ciclo e si propone a Enzo una volta, a fine lavoro; «procedi» vale per il piano approvato, non per allargarlo (caso del 2026-05-27, sessione annullata per intero).
- Niente percorsi assoluti nei comandi e nei file versionati: lo stesso repository vive su Windows, VM e linux-pc. Si usano percorsi relativi o `git rev-parse --show-toplevel`; i target remoti si parametrizzano.
- Il ruolo `HRMS_MANAGER` (Responsabile Direzione HR) legge, scrive, aggiunge ed elimina qualunque dato di business del tenant e scavalca la regola dei due assi (ADR-0027, superato da ADR-0036: oggi è l’invariante I22 di CLAUDE.md); `PLATFORM_ADMIN` resta la gestione tecnologica.
