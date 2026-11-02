# Unit che girano solo sulla VM e non si installano da sole

`scripts/vm-deploy.sh` installa e abilita ogni `*.service` / `*.timer` di `deploy/systemd/`, sia sulla VM sia sul gemello linux-pc. Il glob non è ricorsivo: le unit di questa sottodirectory restano fuori e si installano a mano, una volta, solo sulla VM. È lo stesso schema di `../solo-linux-pc/`.

## heuresys-advanced-atlante (piano di pulizia, voce A2)

Ogni mattina alle 05:00 (ora di Roma) `scripts/atlante-automatico.sh` chiede a `atlante_fresco.py`, su una copia di prova da `origin/main`, se l'atlante è ancora vero. Se è «vecchio» lo rigenera con `build_atlas.py` leggendo il database (sola lettura, coordinate dal `.env` della VM), committa su un ramo `atlante/<AAAAMMGG>` e apre la PR. Non unisce mai, e non apre una seconda PR finché una `atlante/*` resta aperta. Sul linux-pc non va installata: rigenererebbe dal clone.

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
