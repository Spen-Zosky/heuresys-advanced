#!/usr/bin/env node
/**
 * scripts/generate-favicons.mjs
 *
 * Generates the Heuresys favicon set (7 PNG sizes) from the canonical
 * HeuresysMark SVG using headless Chromium via Playwright (already a dev
 * dep of apps/web). No additional npm install required.
 *
 * Output: D:/ux-design-shared/ui/src/assets/brand/logo/heuresys-mark-{16,32,48,64,180,192,512}.png
 *
 * Usage:
 *   node scripts/generate-favicons.mjs
 *
 * The script loads Exo 2 weight 700 from Google Fonts in the headless page,
 * waits for `document.fonts.ready`, then screenshots a transparent-background
 * element at each target size. The "y" is rendered in `--accent` purple
 * (#a855f7) per the canonical HeuresysMark.
 *
 * Output PNGs are committable to ux-design-shared. For `favicon.ico` (multi-
 * resolution ICO container), use an additional pass with an ICO tool — not
 * needed for modern browsers which accept PNG via <link rel="icon" type="image/png">.
 */

import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const SIZES = [16, 32, 48, 64, 180, 192, 512];
const OUT_DIR = "D:/ux-design-shared/ui/src/assets/brand/logo";

const BRAND_PURPLE = "#a855f7";

function html(size) {
  return `<!doctype html>
<html><head><meta charset="utf-8" /><style>
  @import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@700&display=swap');
  html, body { margin:0; padding:0; background:transparent; }
  body { width:${size}px; height:${size}px; display:flex; align-items:center; justify-content:center; }
  svg { display:block; }
  svg text {
    font-family: 'Exo 2', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-weight: 700;
    font-size: 32px;
    fill: ${BRAND_PURPLE};
  }
</style></head>
<body>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}">
    <text x="16" y="26" text-anchor="middle">y</text>
  </svg>
</body></html>`;
}

async function main() {
  console.log(`heuresys-favicons: rendering ${SIZES.length} sizes via headless chromium...`);
  await fs.mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  try {
    for (const size of SIZES) {
      const page = await browser.newPage({ viewport: { width: size, height: size } });
      await page.setContent(html(size), { waitUntil: "networkidle" });
      // Belt-and-braces: ensure the webfont is loaded before screenshot.
      await page.evaluate(() => document.fonts.ready);
      const buf = await page.screenshot({ type: "png", omitBackground: true, fullPage: false });
      const out = path.join(OUT_DIR, `heuresys-mark-${size}.png`);
      await fs.writeFile(out, buf);
      console.log(`  ✓ ${String(size).padStart(3)}px → ${out}`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`heuresys-favicons: done (${SIZES.length} files).`);
}

main().catch((err) => {
  console.error("heuresys-favicons: failed", err);
  process.exitCode = 1;
});
