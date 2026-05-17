# 05.4 · Signed commits

> Un commit firmato (signed) ha una firma crittografica che prova chi l'ha autorato. GitHub mostra `Verified` accanto al commit nella UI. Due metodi: **GPG** (storicamente standard) e **SSH** (più nuovo, semplice se hai già una SSH key). Opt-in: i tuoi commit funzionano lo stesso senza firma — la firma aggiunge solo proof of authorship.

---

## 1. Concetto

### Cosa firma un commit?

La firma copre il **commit object intero** (tree, parent, author, message). Una modifica anche minima invalida la firma.

Chi può verificare? GitHub (mostra badge `Verified`) + chiunque clona il repo con la chiave pubblica.

### Perché firmare?

| Motivo | Quanto conta nel nostro caso |
|---|---|
| **Anti-spoofing**: nessuno può commit a nome tuo | ⚠️ Basso oggi (sole-coder + repo public con audit chiaro) |
| **Compliance / audit**: alcune org richiedono signed | ⚠️ Non rilevante per ora |
| **Proof of integrity**: storia non-tamperable | ⚠️ Basso (push protection + branch protection coprono di più) |
| **Estetica**: badge `Verified` look more professional | ✅ Sì, è una motivazione legittima |

Per sole-coder + repo public, signed commits sono **nice to have**, non critical. Diventano critical quando:
- Più developer + branch protection con "require signed commits".
- Audit compliance esterno.
- Pubblicazione di package npm/container (signature certifica chi ha rilasciato la versione).

### GPG vs SSH signing

| | GPG | SSH |
|---|---|---|
| **Setup complexity** | Medio (genera keypair, configura GPG agent) | Basso (usa SSH key già esistente) |
| **Tool richiesto** | `gnupg` | `git` ≥2.34 + OpenSSH |
| **Storage chiave** | GPG keyring | `~/.ssh/` (stesse SSH key di auth) |
| **Multi-device** | Export/import keyring | Generi una chiave per device |
| **GitHub support** | Yes, da sempre | Yes (dal 2022) |
| **Standard de facto** | Più ampio adopt | Meno diffuso ma più semplice |

**Raccomandazione**: per setup nuovo, prefer SSH (semplicità). Per repo con team che già usa GPG, GPG.

---

## 2. Modello mentale

```
   ┌──────────────────────────────────────────────────────┐
   │   Local machine                                      │
   │                                                      │
   │   git commit                                         │
   │     │                                                │
   │     ▼                                                │
   │   - costruisce commit object                         │
   │   - chiama gpg/ssh per firmare hash                  │
   │   - firma allegata al commit                         │
   │                                                      │
   │   git push                                           │
   └─────────────────────┬────────────────────────────────┘
                         │
                         ▼
   ┌──────────────────────────────────────────────────────┐
   │   GitHub server                                      │
   │                                                      │
   │   Riceve commit + firma                              │
   │   Verifica con chiave pubblica registrata in         │
   │   Settings → SSH and GPG keys                        │
   │     │                                                │
   │     ├─ Match → mostra "Verified" badge               │
   │     ├─ Mismatch → mostra "Unverified"                │
   │     └─ Nessuna firma → niente badge                  │
   └──────────────────────────────────────────────────────┘
```

---

## 3. Applicato ai nostri repo

### Stato attuale: nessun commit firmato

Tutti i commit dei due repo sono **unsigned**. Mostrano nome+email autore ma nessun badge `Verified`.

Visualmente, sul repo GitHub:
```
docs(github): batch 4 — publishing (...)
└── Spen-Zosky  4 hours ago         ← no badge
```

Con commit firmato:
```
docs(github): batch 5 — security (...)
└── Spen-Zosky ✓ Verified   4 hours ago   ← badge verde
```

### Setup raccomandato: SSH signing

Più semplice della GPG e usa la chiave SSH che probabilmente hai già.

**Step 1 — Verifica SSH key esistente**

```bash
ls ~/.ssh/
# Cerca: id_ed25519.pub o id_rsa.pub
```

Se non esiste, generala:
```bash
ssh-keygen -t ed25519 -C "spen.zosky@gmail.com"
# Premi enter per usare ~/.ssh/id_ed25519 e nessuna passphrase
```

**Step 2 — Configura git per signing SSH**

```bash
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub
git config --global commit.gpgsign true     # auto-firma tutti i commit
git config --global tag.gpgsign true        # auto-firma anche i tag

# (Windows con OpenSSH)
git config --global gpg.ssh.program "C:/Windows/System32/OpenSSH/ssh-keygen.exe"

# (Mac/Linux)
git config --global gpg.ssh.allowedSignersFile ~/.ssh/allowed_signers
echo "spen.zosky@gmail.com $(cat ~/.ssh/id_ed25519.pub)" > ~/.ssh/allowed_signers
```

**Step 3 — Registra la chiave su GitHub**

```bash
# Copia la pubblica
cat ~/.ssh/id_ed25519.pub
# Output: ssh-ed25519 AAAAC3NzaC... spen.zosky@gmail.com

# Aggiungi a GitHub (richiede gh auth con admin:public_key)
gh ssh-key add ~/.ssh/id_ed25519.pub --title "Signing key — dev machine" --type signing
```

Oppure via Web UI:
- `Settings → SSH and GPG keys → New SSH key`
- Title: "Signing key — dev machine"
- **Key type: Signing Key** (NOT "Authentication key" — questa è diversa)
- Paste

> **Importante**: la stessa SSH key può essere registrata **sia** come Authentication key **che** Signing key. Sono 2 entry separate.

**Step 4 — Test**

```bash
git commit --allow-empty -m "test: signed commit"
git log --show-signature -1
# Output: gpg: Good "principal" key SSH ED25519 ...

git push
```

Su GitHub Web UI: vedi il badge `Verified` accanto al commit.

### Setup alternativo: GPG signing

Solo se preferisci GPG o se devi integrarti con team che usano GPG.

```bash
# Mac
brew install gnupg
# Windows
winget install GnuPG.GnuPG

# Genera chiave (4096-bit RSA o ED25519)
gpg --full-generate-key
# Scegli: ECC (sign and encrypt) → Curve 25519 → no expiration → name+email

# Lista chiavi
gpg --list-secret-keys --keyid-format=long
# Estrai KEY_ID (es. 3AA5C34371567BD2)

# Esporta pubblica
gpg --armor --export <KEY_ID>
# Copia output a GitHub: Settings → SSH and GPG keys → New GPG key

# Config git
git config --global user.signingkey <KEY_ID>
git config --global commit.gpgsign true
git config --global tag.gpgsign true

# Test
git commit --allow-empty -m "test: GPG signed"
git log --show-signature -1
```

### Auto-firma su CI

Per commit fatti da workflow (`actions/github-script`, `git-auto-commit-action`, ecc.), il commit non è firmato di default. Per firmarlo serve setup GPG/SSH nel workflow.

GitHub offre `web_commit_signoff_required` (repo flag) per **forzare** signed commit anche da Web UI. Default `false`. Per i nostri repo: lascia `false` finché non sei in setup signed-everything.

### Cosa farebbe scattare l'attivazione signing

| Trigger | Effort | Vale la pena oggi? |
|---|---|---|
| "Tutti i miei commit pubblici devono avere il badge Verified" | ~15 min setup SSH | ✅ Yes, se badge cosmetico ti piace |
| Branch protection con "Require signed commits" | Setup + tutto il team deve firmare | ❌ No, sole-coder |
| Tag GPG/SSH-signati per release (es. release-please) | ~20 min | ⚠️ Solo se distribuisci binari pubblici |

---

## 4. Comandi / checklist

### Verifica commit firmati

```bash
# Local
git log --show-signature -5

# Remoto (via API)
gh api repos/Spen-Zosky/heuresys-advanced/commits/aeea62d \
  --jq '.commit.verification'
# Output: {verified: false, reason: "unsigned", signature: null, ...}
```

### Disabilita signing temporaneamente

```bash
# Per il singolo commit
git commit --no-gpg-sign -m "..."

# Globalmente (rollback)
git config --global commit.gpgsign false
```

### Setup multi-machine

Hai SSH key diverse per Mac, Windows, VM. Aggiungi ciascuna come Signing key separata su GitHub. Tutte mostrano `Verified` per i commit firmati da quella macchina.

### Force-resign della storia (riscrive history!)

⚠️ Sconsigliato. Ma se vuoi firmare commit vecchi:

```bash
git rebase --root --exec 'git commit --amend --no-edit -S'
git push --force-with-lease
```

Distrugge la storia condivisa — solo per repo personal pre-distribuzione.

### Checklist signing setup

- [ ] Decidi SSH (consigliato) o GPG.
- [ ] Genera o usa SSH/GPG key esistente.
- [ ] Aggiungi key a GitHub come **Signing Key** (non auth!).
- [ ] Configura git: `commit.gpgsign true` + `gpg.format ssh` (per SSH).
- [ ] Commit di test → verifica badge.
- [ ] (Multi-device) Ripeti su ogni macchina.

---

## 5. Trappole comuni

- **Authentication key vs Signing key**: stessa SSH key può servire entrambi i ruoli ma devi aggiungerla **due volte** su GitHub (una come Authentication, una come Signing). Sono 2 entry diverse nella stessa pagina settings.
- **Email mismatch**: il commit ha `user.email = spen.zosky@gmail.com` ma la chiave GPG è linked a `enzo@altraemail.it` → GitHub mostra `Unverified` con reason `bad email`. Fix: aggiungi entrambe le email al GPG key, o cambia git config.
- **Passphrase prompt ogni commit**: con GPG, agent può non essere persistente. Setup `gpg-agent` per cachare il PIN. SSH spesso non ha questo problema.
- **VM senza chiave**: i commit fatti dalla VM OCI sarebbero unsigned se non setup. Generare una signing key dedicata per la VM e aggiungerla a GitHub.
- **Commit da Web UI (Edit + Commit) non firmati**: se editi via github.com, il commit è fatto da `web-flow` machine GitHub. È auto-signed da una chiave GitHub di sistema — `Verified` ma autore = web-flow.
- **`require_signed_commits` blocca push non-firmati**: branch protection rule. Se attivi e qualcuno (incluso te) prova un push unsigned, fail. Setup signing primo, rule dopo.
- **SSH key passphrase + Windows OpenSSH**: a volte git non riesce a leggere la passphrase. Workaround: aggiungi a `ssh-agent`:
  ```bash
  Start-Service ssh-agent   # PowerShell admin (Windows)
  ssh-add ~/.ssh/id_ed25519
  ```

---

## 6. Per approfondire

- **About commit signature verification**: <https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification>
- **Generating SSH signing key**: <https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent>
- **Telling git about your signing key**: <https://docs.github.com/en/authentication/managing-commit-signature-verification/telling-git-about-your-signing-key>
- **Signed Git commits with SSH** (post): <https://calebhearth.com/sign-git-with-ssh>
- File curriculum: [05-branch-protection.md](05-branch-protection.md) · [02-account-e-repo.md](../01-fondamenti/02-account-e-repo.md)
