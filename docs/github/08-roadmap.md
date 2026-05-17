# 08 · Roadmap consigliata di adozione

> Quale feature attivare e quando. Ordina i ~30 step possibili in tier di priorità, con stima effort e prerequisiti. È **prescrittivo** ma non vincolante — usalo come check-list di valutazione.

---

## 1. Filosofia

Tre principi guidano l'ordine:

1. **Sicurezza prima della velocità**: anti-leak e anti-incident vengono prima di automation cosmetica.
2. **Effort < valore**: priorità a step che richiedono 5 minuti e hanno impatto continuo.
3. **Trigger-driven**: certe feature hanno senso solo dopo che si verifica un evento (es. arrivo di un secondo dev → branch protection PR-required).

I tier sotto sono **cumulativi**: completare Tier 0 prima di Tier 1, e così via.

---

## 2. Tier 0 — Allineamento (10 minuti, fai oggi)

Cose che dovrebbero essere già lì in ogni repo public:

| Step | Repo | Effort | Comando |
|---|---|---|---|
| Topics ≥5 | entrambi | 2 min | `gh repo edit ... --add-topic X --add-topic Y` |
| Description impostata | entrambi | ✅ già OK | — |
| Homepage URL (ux-design-shared → Storybook) | `ux-design-shared` | 1 min | `gh repo edit ... --homepage https://spen-zosky.github.io/ux-design-shared/` |
| README.md root (`ux-design-shared` manca) | `ux-design-shared` | 10 min | Crea file + commit |
| LICENSE (anche "proprietary/all rights") | entrambi | 5 min | Web UI: `Add license` o crea `LICENSE.md` |
| Disabilita Wiki (uso `docs/**`) | entrambi | 1 click | `gh repo edit ... --enable-wiki=false` |

**Output Tier 0**: i repo hanno un'identità chiara, navigabile, "professionale".

---

## 3. Tier 1 — Sicurezza zero-effort (15 minuti, fai questa settimana)

Cose che riducono drasticamente rischi senza richiedere mantenimento:

| Step | Repo | Effort | Note |
|---|---|---|---|
| **Dependabot Alerts** abilitato | entrambi | 1 click | Settings → Code security → Dependabot alerts |
| **Dependabot Security updates** abilitato | entrambi | 1 click | Idem (PR auto per CVE noti) |
| **Push protection** per secret | entrambi | 1 click | Settings → Code security → Secret scanning → Push protection |
| **Branch protection Tier 1** (no force, no delete su main) | entrambi | 3 min | Settings → Rules → Ruleset come in `05-security/05-branch-protection.md` |

Capitoli rilevanti: [05.1 Secret hygiene](05-security/01-secret-hygiene.md), [05.2 Dependabot](05-security/02-dependabot.md), [05.5 Branch protection](05-security/05-branch-protection.md).

**Output Tier 1**: niente più rischio di force-push su main, secret scanning bloccante, alert security attivi.

---

## 4. Tier 2 — Setup automation (1-2 ore, fai questo mese)

Cose che richiedono setup ma poi lavorano per te:

| Step | Repo | Effort | Trigger ideale |
|---|---|---|---|
| `.github/dependabot.yml` Version updates | entrambi | 15 min | Tier 1 completo |
| `.github/workflows/codeql.yml` | entrambi | 10 min | Tier 1 completo |
| `.github/workflows/ci.yml` (typecheck minimo) | `heuresys-advanced` | 30 min | Quando vuoi gating PR |
| `.github/workflows/lint.yml` | entrambi | 15 min | Idem |
| Issue labels strutturate (type/severity/area) | entrambi | 15 min via CLI | Quando aprirai la prima issue |
| Issue template YAML (bug + feature request) | entrambi | 20 min | Idem |
| PR template (`.github/pull_request_template.md`) | entrambi | 15 min | Quando attiverai il PR workflow |

Capitoli rilevanti: [03.2 Actions ricette](03-automazione/02-actions-ricette.md), [02.1 Issues](02-collaborazione/01-issues.md), [02.3 Pull requests](02-collaborazione/03-pull-requests.md).

**Output Tier 2**: ogni push verifica typecheck + lint + CodeQL. PR settimanali da Dependabot. Issue strutturate quando le aprirai.

---

## 5. Tier 3 — Pubblicazione (4-8 ore, trigger-driven)

Cose che cambiano il modello di distribuzione. Attiva solo quando un trigger lo giustifica.

| Step | Repo | Effort | Trigger |
|---|---|---|---|
| **GitHub Pages per docs** (mkdocs/Docusaurus) | `heuresys-advanced` | 2-3 h | Vuoi rendere il curriculum + ADR navigabili |
| **Releases manuali** con tag | entrambi | 30 min/release | Vuoi marcare milestone pubblici |
| **`release-please` automation** | entrambi | 30 min setup | Vuoi changelog automatico |
| **GitHub Packages publish** (`@spen-zosky/ui`) | `ux-design-shared` | 4-6 h | Vedi `04-interazioni-tra-repo.md` Fase 1-5 |
| **Auto-merge Dependabot** patch+minor | entrambi | 20 min | Tier 2 + CI verde affidabile |

Capitoli rilevanti: [04.1-04.4 Publishing](04-publishing/), [07.4 Interazioni tra repo](07-nostri-repo/04-interazioni-tra-repo.md).

**Output Tier 3**: design system pubblicato come npm package; consumer linkato a versione esplicita; docs navigabili online.

---

## 6. Tier 4 — Team enablement (1-2 giorni, solo con 2° dev)

Cose che hanno senso solo se non sei più sole-coder:

| Step | Trigger |
|---|---|
| **Branch protection PR-required** + approvals = 1 | Secondo dev nel progetto |
| **CODEOWNERS file** in `.github/` | Idem |
| **CONTRIBUTING.md** | Idem (o contributor esterno via OSS) |
| **CODE_OF_CONDUCT.md** | Repo open per contributor pubblici |
| **SECURITY.md** | Idem, definisce come segnalare vuln |
| **Discussions abilitate** (Q&A categoria) | Audience che fa domande |
| **GitHub Project v2** cross-repo | Quando >10 Issue aperte |
| **Slack/Discord integration** | Team chat asincrona |
| **Issue Forms YAML strutturati** | Triage assistito |
| **Required signed commits** | Compliance esterna |
| **Organization creation** (`Heuresys` org) | Brand separato + multi-developer permanente |

Capitoli rilevanti: [02 Collaborazione](02-collaborazione/), [05.4 Signed commits](05-security/04-signed-commits.md).

**Output Tier 4**: workflow PR-based, governance pulita, contributor onboardable senza chiedere a te.

---

## 7. Tier 5 — Audience e visibility (open-ended, solo con audience)

Cose che hanno senso quando il progetto attira esterni:

| Step | Trigger |
|---|---|
| **GitHub Sponsors** | Audience disposta a finanziare |
| **Pinned repos sul profilo** | Definisci "i progetti di Spen-Zosky" |
| **Profile README** (`Spen-Zosky/Spen-Zosky`) | Bio pubblica + showcase |
| **Custom domain per Pages** | Brand `heuresys.com` |
| **GitHub Marketplace** (action pubblicata) | Tooling riusabile da terzi |
| **Releases con binary assets** | Distribuzione installer/binary |
| **Star count optimization** (README, demo, GIF) | Open source growth |
| **Translation contributors** | Reach multi-lingua |

---

## 8. Visualizzazione: cosa attivare quando

```
                  Oggi
                  ────
   Tier 0: ████████████  ✓ allineamento (10 min)
                                 │
                                 ▼  questa settimana
   Tier 1: ████████████  ✓ sicurezza zero-effort (15 min)
                                 │
                                 ▼  questo mese
   Tier 2: ████████████  ✓ automation (1-2 ore)
                                 │
                                 ▼  quando hai trigger
   Tier 3: ████████████  ⏳ pubblicazione (4-8 ore)
                                 │
                                 ▼  con secondo dev
   Tier 4: ████████████  ⏳ team enablement (1-2 giorni)
                                 │
                                 ▼  con audience esterna
   Tier 5: ████████████  ⏳ visibility (open-ended)
```

---

## 9. Step rejection list — cose esplicitamente NON consigliate ora

Per scoraggiare ottimizzazione prematura:

| Non fare | Perché |
|---|---|
| **GitHub Pages per `heuresys-advanced`** | SPA `apps/web` richiede backend; out of scope |
| **Custom domain** | Niente audience; spreco di setup DNS |
| **Codespaces** | Tu lavori bene su Win/Mac/VM esistenti; €4/mese personal limit basso |
| **GitHub Actions self-hosted runner** | I 2000 min/mese gratis bastano |
| **Multi-org structure** (`Heuresys-Platform` + `Heuresys-Design`) | Personal account `Spen-Zosky` basta; org ha overhead |
| **GitHub Enterprise tier** | $21/utente — niente da giustificarlo |
| **Force signed commits** | Tier 4-only; aggiungi friction senza necessità |
| **Auto-merge tutti i Dependabot PR** | Senza CI verde solido, è cieco |
| **Discussions categoriche complete** | Nessuna conversazione da nessuno; tieni `disabled` |
| **Wiki** | Usa `docs/**` invece; meno integrazione con il codice |
| **GitHub Mobile app** notifications | Solo se ti serve "on-call style" monitoring |
| **Slack/Discord integration** | Sole-coder; email + browser bastano |

---

## 10. Per approfondire

- Tutti i capitoli precedenti del curriculum (vedi indice in [README.md](README.md))
- Documentazione ufficiale GitHub: <https://docs.github.com>
- Status page (per outage tracking): <https://www.githubstatus.com>

---

> **Fine del curriculum.** Hai ora 34 file Markdown (1 README + 1 glossario + 32 contenuti) che coprono in modo strutturato l'ecosistema GitHub applicato ai tuoi 2 repo. Usalo come reference + roadmap. Le sezioni più "fluide" (Tier 2-5) si aggiorneranno organicamente man mano che attiverai feature nuove.
