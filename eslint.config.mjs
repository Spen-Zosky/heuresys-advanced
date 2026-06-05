import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import i18nextPlugin from "eslint-plugin-i18next";
import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

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
      "scripts/cowork-exchange/**",
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

  // Only next/core-web-vitals here: `next/typescript` also registers the
  // @typescript-eslint plugin, which collides with the global
  // `...tseslint.configs.recommended` above under eslint 9.39 + typescript-eslint
  // 8.60 ("Cannot redefine plugin @typescript-eslint"). tseslint.configs.recommended
  // already provides TS linting for apps/web; next/core-web-vitals adds the
  // Next/React/a11y rules.
  ...compat.extends("next/core-web-vitals").map((cfg) => ({
    ...cfg,
    files: ["apps/web/**/*.{ts,tsx,js,jsx}"],
  })),

  {
    files: ["apps/web/**/*.{ts,tsx}"],
    languageOptions: {
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
  }
);
