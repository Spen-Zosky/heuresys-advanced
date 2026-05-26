#!/usr/bin/env node
/* global console, process, document */
/**
 * scripts/generate-social-kit.mjs
 *
 * Generates the Heuresys social media kit (3 PNG images) for use in
 * OpenGraph / Twitter card / LinkedIn banner contexts. Uses headless
 * Chromium via Playwright (already a dev dep of apps/web).
 *
 * Outputs (all in D:/ux-design-shared/ui/src/assets/brand/social/):
 *   - og-image-1200x630.png         Standard OpenGraph image
 *   - twitter-card-1200x628.png     Twitter summary_large_image
 *   - linkedin-banner-1200x627.png  LinkedIn post share
 *
 * Design: canonical HeuresysWordmark large + tagline + minimal pulse-dot
 * accent on bg-foreground (inverse-contrast dark surface). Matches the
 * /showcase/landing-page hero band pattern committed in c3cc69d.
 *
 * Usage:
 *   cd apps/web && node scripts/generate-social-kit.mjs
 */

import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const OUT_DIR = "D:/ux-design-shared/ui/src/assets/brand/social";

const TARGETS = [
  { name: "og-image-1200x630", width: 1200, height: 630 },
  { name: "twitter-card-1200x628", width: 1200, height: 628 },
  { name: "linkedin-banner-1200x627", width: 1200, height: 627 },
];

const BRAND_BLUE = "hsl(221 83% 53%)";
const BRAND_PURPLE = "#a855f7";
const BG_DARK = "#0F1828"; // matches --color-foreground in light theme + bg-foreground utility
const FG_LIGHT = "rgba(255,255,255,0.9)";
const FG_MUTED = "rgba(255,255,255,0.6)";
const ACCENT_GREEN = "#16A34A"; // --color-success

function html(width, height) {
  return `<!doctype html>
<html><head><meta charset="utf-8" /><style>
  @import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@400;500;600;700&display=swap');
  html, body {
    margin: 0;
    padding: 0;
    width: ${width}px;
    height: ${height}px;
    background: ${BG_DARK};
    font-family: 'Exo 2', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: ${FG_LIGHT};
  }
  body {
    display: grid;
    grid-template-rows: 1fr auto 1fr auto auto auto 1fr;
    row-gap: 0;
    padding: 64px 80px;
    box-sizing: border-box;
  }
  .eyebrow {
    grid-row: 2;
    font-size: 14px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: ${BRAND_BLUE};
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .pulse {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${ACCENT_GREEN};
    box-shadow: 0 0 0 4px rgba(22,163,74,0.18);
  }
  .wordmark {
    grid-row: 3;
    font-size: 96px;
    font-weight: 700;
    line-height: 1;
    letter-spacing: -2.4px;
    margin: 24px 0 0;
  }
  .wm-y { color: ${BRAND_PURPLE}; }
  .wm-body { color: ${BRAND_BLUE}; }
  .tagline {
    grid-row: 4;
    margin-top: 32px;
    font-size: 36px;
    font-weight: 500;
    line-height: 1.2;
    letter-spacing: -0.5px;
    max-width: 880px;
  }
  .accent-text { color: ${BRAND_PURPLE}; }
  .sub {
    grid-row: 5;
    margin-top: 16px;
    font-size: 18px;
    font-weight: 400;
    color: ${FG_MUTED};
    max-width: 800px;
  }
  .meta {
    grid-row: 6;
    margin-top: 48px;
    display: flex;
    gap: 32px;
    font-size: 14px;
    font-weight: 500;
    color: ${FG_MUTED};
  }
  .meta span:not(:last-child)::after {
    content: '·';
    margin-left: 32px;
    color: rgba(255,255,255,0.3);
  }
</style></head>
<body>
  <div class="eyebrow"><span class="pulse"></span>Heuresys · v1</div>
  <h1 class="wordmark">
    <span class="wm-body">heures</span><span class="wm-y">y</span><span class="wm-body">s</span>
  </h1>
  <p class="tagline">
    Workforce intelligence,<br />
    <span class="accent-text">position-first.</span>
  </p>
  <p class="sub">HRMS + BPM mapped into a single tenant-isolated graph. PostgreSQL 16 · Fastify · Next.js 15.</p>
  <div class="meta">
    <span>EU-only data residency</span>
    <span>No Docker · No RLS</span>
    <span>heuresys.com</span>
  </div>
</body></html>`;
}

async function main() {
  console.log(`heuresys-social-kit: rendering ${TARGETS.length} images via headless chromium...`);
  await fs.mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  try {
    for (const t of TARGETS) {
      const page = await browser.newPage({
        viewport: { width: t.width, height: t.height },
        deviceScaleFactor: 1,
      });
      await page.setContent(html(t.width, t.height), { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      const buf = await page.screenshot({ type: "png", fullPage: false });
      const out = path.join(OUT_DIR, `${t.name}.png`);
      await fs.writeFile(out, buf);
      console.log(`  ✓ ${t.width}x${t.height} → ${out}`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`heuresys-social-kit: done (${TARGETS.length} files).`);
}

main().catch((err) => {
  console.error("heuresys-social-kit: failed", err);
  process.exitCode = 1;
});
