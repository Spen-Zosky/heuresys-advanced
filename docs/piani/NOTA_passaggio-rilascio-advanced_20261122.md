# Nota di passaggio: gate di rilascio di heuresys-advanced (2026-11-22)

**Stato del gate.** Il blocco era l'atlante vecchio: il controllo `atlas-freshness` falliva su main dopo i PR 381 e 383. La PR 391 rigenera l'atlante (`docs/kb/tools/build_atlas.py`), e `python3 docs/kb/tools/atlante_fresco.py` risponde `fresco`.

**Cosa resta.** Il rilascio passa al progetto heuresys ecosystem: questo repo non lancia nulla. Non è stato verificato dal vivo che il gate sia sbloccato su main dopo il merge.

**Nota.** Il controllo `atlas-freshness` si ripete a ogni commit che tocca il codice descritto dall'atlante: dopo ogni merge va rigenerato di nuovo.
