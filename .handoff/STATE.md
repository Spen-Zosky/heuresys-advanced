# heuresys-advanced — STATE (vista rapida)

**Updated**: 2026-06-28 (S1009 — redesign sidebar 5 sezioni + lingua nell'header + tab-merge, live su PROD).

> **Vista rapida** (priorità · open questions). Snapshot granulare (versioni, DB/API/web/CI counts, architettura) → `docs/kb/SOT_STATE.md`. Backlog → `docs/kb/SOT_BACKLOG.md` · debiti → `docs/kb/DEBT_REGISTER.md`. Domini disgiunti — nessun numero qui. Menu generato da `docs/kb/tools/build_menu.py`.

## Last session brief (S1009 — sidebar IA redesign, 3 richieste Enzo + #21 chiuso)

Due blocchi. **(1) #21 chiuso** (a11y shell + perf subpath, `@heuresys/ui@0.1.9`) — già live, vedi Delta S1008. **(2) Ridisegno sidebar autenticata** (richieste Enzo): le 3 prospettive PET sostituite da **5 sezioni** collassabili sempre visibili — Panoramica · Governance · Forza lavoro · Intelligence · Area personale (mig **000163** sul registro `sys_ui_interfaces`). **Dashboard è la prima voce** (req 1). **Lingua IT/EN nell'header** (toggle `DashboardHeader` cablato + persistito su `sys_user_preferences`, ereditabile tra pagine come il tema; rimossa dalla sidebar + tolto il CSS-hide G-03) (req 2). **Selettore prospettiva decaduto** (le 5 sezioni sono gruppi collassabili, stato in localStorage) (req 3). **Merge = navigazione** (decisione Enzo): 6 voci-merge aprono la pagina principale con un **TabNav** verso le pagine assorbite (9 pagine → `is_active=false`, route vive); componente `apps/web/src/components/section-tabs.tsx` montato 1× nel layout. API `me/service` 5 sezioni + shared enum 5 valori + i18n it/en (sezioni + tab labels). **Verifica LIVE www** (login `admin@`): sidebar 5 sezioni in ordine, dashboard prima, lingua header persiste it→en, TabNav su `/analytics/skills`, selettore prospettiva assente. Gate verde end-to-end (typecheck · i18n parity · me-interfaces integration · a11y E2E · CI · deploy VM). **Intoppo risolto**: il CHECK perspective ristretto rompeva l'idempotenza-chain (le mig 000050+ re-inseriscono valori PET prima del remap) → CHECK allargato all'unione PET∪5-sezioni (debito cosmetico D-46).

## Top priorities (next session)

1. **#4 go-to-market — prossimo deliverable** (autorità *cosa* = Enzo): pricing page o altro. P1 sbloccato.
2. **#8 EMAIL dormiente** (WAIT-INPUT): app-password Outlook → EMAIL_OTP + digest live.
3. **D-46** (P3 cosmetico): restringere il CHECK `sys_ui_interfaces_perspective` ai soli 5 valori quando le mig interfaces 000050+ saranno normalizzate (oggi unione per idempotenza).

## Open questions (autorità *cosa* = Enzo)

- **Forma del prossimo deliverable GTM**: pricing page (serve i suoi numeri) vs altro.
- **Sidebar per altri ruoli**: la struttura 5-sezioni vale per tutti, filtrata da RBAC (un employee vede di fatto solo "Area personale"); eventuali viste dedicate per ruolo da definire se servono.

## Verification (next session)

```bash
git -C /d/heuresys-advanced log origin/main..HEAD --oneline    # 0 dopo handoff push
python docs/kb/tools/handoff_lint.py                           # OK (0 fail)
# S1009: sidebar 5 sezioni
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT DISTINCT ui_interface_perspective FROM sys.sys_ui_interfaces ORDER BY 1"  # 5 sezioni
npm view @heuresys/ui version                                  # 0.1.9
```
