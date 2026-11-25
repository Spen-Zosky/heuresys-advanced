# Unit che girano solo sulla VM e non si installano da sole

`scripts/vm-deploy.sh` installa e abilita ogni `*.service` / `*.timer` di `deploy/systemd/`, sia sulla VM sia sul gemello linux-pc. Il glob non è ricorsivo: le unit di questa sottodirectory restano fuori e si installano a mano, una volta, solo sulla VM. È lo stesso schema di `../solo-linux-pc/`.

## heuresys-advanced-atlante (piano di pulizia, voce A2)

Ogni 20 minuti, solo se origin/main è cambiato dal giro prima, `scripts/atlante-automatico.sh` chiede a `atlante_fresco.py`, su una copia di prova da `origin/main`, se l'atlante è ancora vero. Se è «vecchio» lo rigenera con `build_atlas.py` leggendo il database (sola lettura, coordinate dal `.env` della VM), committa su un ramo `atlante/<AAAAMMGG>`, apre la PR, aspetta la sua CI e la unisce solo se è tutta verde (fino a 60 minuti, poi la lascia da unire a mano). Non apre una seconda PR finché una `atlante/*` resta aperta. Sul linux-pc non va installata: rigenererebbe dal clone.

Installazione sulla VM (dalla radice del checkout che il timer deve usare):

```bash
REPO_DIR="$(git rev-parse --show-toplevel)"
sed "s#@@REPO_DIR@@#$REPO_DIR#g" deploy/systemd/solo-vm/heuresys-advanced-atlante.service \
  | sudo tee /etc/systemd/system/heuresys-advanced-atlante.service >/dev/null
sudo install -m 644 deploy/systemd/solo-vm/heuresys-advanced-atlante.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now heuresys-advanced-atlante.timer
```

Prova a mano senza timer: `bash scripts/atlante-automatico.sh`. Esito della notte: `journalctl -u heuresys-advanced-atlante --since today`.

## heuresys-advanced-lint-verita (riordino della documentazione, voce R13)

Il lunedì alle 06:30 `scripts/lint-verita.sh`, su una copia di prova da `origin/main`, esegue i controlli deterministici della documentazione (`check_documenti.py`, `build_wiki.py --check`, `build_adr_index.py --check`) e poi un agente in sola lettura (strumenti Read, Grep, Glob; modello in `LINT_VERITA_MODELLO`, predefinito Sonnet) che confronta le pagine del wiki con il codice, gli ADR e i registri. Se trova qualcosa, scrive `docs/wiki/lint/<AAAAMMGG>.md`, aggiunge una riga a `docs/wiki/log.md` e apre una PR in bozza sul ramo `lint-verita/<AAAAMMGG>`. Non unisce mai: le correzioni si applicano nella PR. Il token dell'abbonamento lo carica lo script con `token-agenti.sh carica`.

Installazione sulla VM (dalla radice del checkout che il timer deve usare):

```bash
REPO_DIR="$(git rev-parse --show-toplevel)"
sed "s#@@REPO_DIR@@#$REPO_DIR#g" deploy/systemd/solo-vm/heuresys-advanced-lint-verita.service \
  | sudo tee /etc/systemd/system/heuresys-advanced-lint-verita.service >/dev/null
sudo install -m 644 deploy/systemd/solo-vm/heuresys-advanced-lint-verita.timer /etc/systemd/system/
# aggiungere heuresys-advanced-lint-verita.service a ~/.claude/tools/token-agenti.unita, nella forma delle righe che ci sono già
bash ~/.claude/tools/token-agenti.sh collega
sudo systemctl daemon-reload
sudo systemctl enable --now heuresys-advanced-lint-verita.timer
```

Prova a mano senza PR: `LINT_VERITA_PROVA=1 bash scripts/lint-verita.sh` (stampa il rapporto e chiude la copia). Esito: `journalctl -u heuresys-advanced-lint-verita --since today`.
