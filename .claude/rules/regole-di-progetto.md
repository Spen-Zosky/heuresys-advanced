# Regole di progetto (portate dalla memoria il 2026-10-21)

- Perimetro: non si va oltre lo scope approvato. Una scoperta strada facendo si riporta e ci si ferma; «procedi» vale per il piano approvato, non per allargarlo (caso del 2026-05-27, sessione annullata per intero).
- Niente percorsi assoluti nei comandi e nei file versionati: lo stesso repository vive su Windows, VM e linux-pc. Si usano percorsi relativi o `git rev-parse --show-toplevel`; i target remoti si parametrizzano.
- Il ruolo `HRMS_MANAGER` (Responsabile Direzione HR) legge, scrive, aggiunge ed elimina qualunque dato di business del tenant e scavalca la regola dei due assi (ADR-0027); `PLATFORM_ADMIN` resta la gestione tecnologica.
