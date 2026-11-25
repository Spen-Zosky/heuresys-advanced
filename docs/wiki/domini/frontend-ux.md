---
dominio: frontend-ux
natura: riferimento
stato: vivo
aggiornato_il: 2026-11-25
sintesi: SPA Next.js e portale ESS su dati vivi, design system @heuresys/ui, regole d'interfaccia di Enzo
fonti: [.claude/rules/design-system-ui.md, .claude/rules/frontend-live-data.md, apps/web]
concetti: [design-system, dati-vivi, organigramma]
---

# Frontend e UX

## Com'è oggi

- `apps/web` è la SPA di amministrazione e il portale ESS; nessun mock, fixture o endpoint finto: ogni dato arriva da `/v1/*` ([frontend-live-data](../../../.claude/rules/frontend-live-data.md)).
- I componenti riutilizzabili e le dipendenze UI di runtime vivono in `@heuresys/ui` ([design-system-ui](../../../.claude/rules/design-system-ui.md)).
- Ogni pagina ha il selettore italiano/inglese, con l'italiano predefinito, ed è tutta nella lingua scelta.
- La verifica forense di tutte le pagine ha il suo giro in `docs/piani/forense-frontend_20261123/`.

## Decisioni in vigore

<!-- generato:decisioni -->
| ADR | Decisione | Status nel file |
|---|---|---|
| [0007](../../architecture/adr/0007_frontend_next15_app_router.md) | Frontend: Next.js 15 App Router + React 19 + Tailwind 4 + shadcn/ui | Accepted |
| [0009](../../architecture/adr/0009_visualization_node_layouts_separate_table.md) | Visualization: Dedicated `sys_visualization_node_layouts` Table | Accepted |
| [0013](../../architecture/adr/0013_showcase_sot_policy.md) | Showcase SoT Policy: 4-Level Source-of-Truth Layering | Accepted |
| [0031](../../architecture/adr/0031_ess_self_view_computed_intelligence.md) | Self-view ESS dell'intelligence calcolata (capability + flight-risk) | Accepted |
<!-- /generato -->

## Come si fa

| cosa | comando |
|---|---|
| suite E2E completa | `cd apps/web && pnpm test:e2e:prod` |
| parità delle traduzioni | workflow `i18n-parity.yml` |

## Storia

<!-- generato:storia -->
Il riordino del 2026-11-25 ha ritirato **26** documenti di questo dominio (lotti: B 25, B-campioni 1). Si recuperano con `git show <commit>:<percorso>` dai commit 87d7ce9d9, a1872a180, oppure dalla copia nel cestino della cartella del progetto; l'elenco completo è nel [registro dei ritiri](../../piani/riordino-documentazione_20261125/REGISTRO_RITIRI.tsv).

Da dove venivano: `ux-design/heuresys_uxix_brand_identity_bundle_v1/docs` 9, `ux-design/heuresys_uxix_brand_identity_bundle_v1/templates` 5, `ux-design/heuresys_uxix_brand_identity_bundle_v1` 3, `docs/superpowers/plans` 2, `ux-design/heuresys_uxix_brand_identity_bundle_v1/prompts` 2, `ux-design/heuresys_uxix_brand_identity_bundle_v1/showcase` 2, `docs` 1, `ux-design/heuresys_uxix_brand_identity_bundle_v1/assets` 1.
<!-- /generato -->

## Vedi anche

[qualita-verifica](qualita-verifica.md), [prodotto-visione](prodotto-visione.md).
