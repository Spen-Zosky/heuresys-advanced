import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import i18nextPlugin from "eslint-plugin-i18next";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/*.d.ts",
      "**/*.config.js",
      "**/*.config.mjs",
      ".claude/worktrees/**",
      "cowork_code_exchange/**",
      "docs/**",
      "db/**",
      "qa_artifacts/**",
      "apps/showcase/**",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ["apps/api/**/*.ts", "packages/shared/**/*.ts"],
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        ecmaVersion: 2023,
        sourceType: "module",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },

  // eslint-config-next@16 ships a flat-config ARRAY (Linter.Config[]), imported
  // directly — FlatCompat no longer works against it (it JSON-stringifies the flat
  // plugin objects → "Converting circular structure to JSON"). Two adaptations:
  //  1. Exclude the bundled `next/typescript` entry: it registers the @typescript-eslint
  //     plugin (collides "Cannot redefine plugin" with the global
  //     tseslint.configs.recommended) AND re-sets the TS parser. We get both from the
  //     global tseslint config instead.
  //  2. Strip each entry's `languageOptions`: the base `next` entry sets the next/babel
  //     parser, which would override the TS parser on .ts/.tsx and crash
  //     @typescript-eslint/no-unused-vars (it walks a babel AST). We keep only next's
  //     plugins/rules/settings (React/Next/a11y/import) and let the typescript-eslint
  //     parser (set on the apps/web block below) handle parsing.
  ...nextCoreWebVitals
    .filter((cfg) => cfg.name !== "next/typescript")
    .map(({ languageOptions: _next_lo, ...cfg }) => ({
      ...cfg,
      files: ["apps/web/**/*.{ts,tsx,js,jsx}"],
    })),

  {
    files: ["apps/web/**/*.{ts,tsx}"],
    languageOptions: {
      // Explicit TS parser: next@16's base config (whose languageOptions we strip
      // above) used to provide a parser; the typescript-eslint rules need this one.
      parser: tseslint.parser,
      globals: { ...globals.browser, ...globals.node },
    },
    settings: {
      next: { rootDir: "apps/web" },
    },
    rules: {
      "@next/next/no-html-link-for-pages": "off",
    },
  },

  // i18n guardrail (milestone Fasi 0b–5, CLOSED 2026-06-05) — hard-block hardcoded user-facing
  // strings across the WHOLE app router, so the Italian-hardcoded debt cannot re-form anywhere.
  // v6 default only flags plain text in JSX markup (NOT className/data-testid/units/etc.), so it
  // targets exactly the renderable chrome. Now `error` (milestone debt reached 0): every future
  // page MUST render via t(). The showcase/** pages are dev-only design-system docs (English RSC,
  // gated behind NEXT_PUBLIC_ENABLE_SHOWCASE), explicitly out of i18n scope (design §10) → excluded.
  {
    files: ["apps/web/src/app/**/*.{ts,tsx}"],
    ignores: ["apps/web/src/app/showcase/**"],
    plugins: { i18next: i18nextPlugin },
    rules: {
      "i18next/no-literal-string": "error",
    },
  },

  // Node-runtime dev script (D-36 E2E wrapper): plain .mjs run directly by `node`,
  // not browser/Next code — give it Node globals so process/fetch/Buffer/console
  // don't trip no-undef. Scoped to this file (the other apps/web/scripts/*.mjs
  // declare their own `/* global */` incl. `document`, so a broad .mjs block would
  // collide with them via no-redeclare).
  {
    // I tre strumenti della suite E2E: `e2e-node22.mjs` (D-36, Playwright sotto Node 22),
    // `e2e-blocchi.mjs` (#211 ①, S1068: la suite in fasi separate, cosi' un blocco rosso
    // non impedisce ai successivi di girare) e `e2e-triage.mjs` (#219, S1089: legge i
    // referti delle fasi e dichiara l'esito). Restano elencati **uno per uno** e non come
    // `apps/web/scripts/*.mjs`: gli altri script di quella cartella dichiarano i propri
    // `/* global */` includendo `document`, e un blocco largo collideva via no-redeclare.
    //
    // ⚠ IL PREZZO DI QUESTA FORMA, pagato il 2026-09-06 (S1090): un elenco per nome **non
    // si accorge di un file nuovo**. `e2e-triage.mjs` e' nato in S1089 ed e' rimasto fuori,
    // quindi ogni `process`/`console` al suo interno era `no-undef` — CI `Lint` rossa, e il
    // rollout in produzione fermo dietro di essa. Chi aggiunge uno script Node qui dentro
    // deve aggiungerne il nome anche qui: il glob resta escluso per la ragione sopra, ma la
    // ragione ha un costo e va saputo.
    files: [
      "apps/web/scripts/e2e-node22.mjs",
      "apps/web/scripts/e2e-blocchi.mjs",
      "apps/web/scripts/e2e-triage.mjs",
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
  }
);
