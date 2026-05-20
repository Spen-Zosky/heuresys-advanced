"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Palette dropdown listbox — canonical implementation.
 * Spec: docs/06_header_specification.md § "Interactive specification — palette switcher".
 *
 * 4 ratified presets. Active palette HSL values written to `--palette-1..4`
 * on `<html>` via inline style. Selection persisted in localStorage.
 */

export type PaletteIdx = 0 | 1 | 2 | 3;

export type PalettePreset = {
  readonly name: string;
  readonly vars: readonly [string, string, string, string]; // HSL "H S% L%" for palette-1..4
};

export const PALETTES: readonly PalettePreset[] = [
  { name: "Default · balanced", vars: ["222 80% 50%", "188 75% 45%", "262 65% 60%", "38 90% 55%"] },
  { name: "Cool ocean",         vars: ["178 75% 42%", "195 85% 48%", "215 85% 55%", "245 78% 60%"] },
  { name: "Warm sunset",        vars: ["0 80% 55%",   "22 92% 55%",  "38 90% 55%",  "52 92% 60%"] },
  { name: "Brand mono",         vars: ["221 83% 35%", "221 75% 48%", "221 65% 60%", "221 55% 72%"] },
] as const;

const STORAGE_KEY = "heuresys-palette";

export function applyPalette(idx: PaletteIdx) {
  const p = PALETTES[idx];
  if (!p) return;
  const html = document.documentElement;
  p.vars.forEach((value, i) => html.style.setProperty(`--palette-${i + 1}`, value));
}

function readSavedIdx(): PaletteIdx {
  if (typeof window === "undefined") return 0;
  const raw = parseInt(window.localStorage.getItem(STORAGE_KEY) || "0", 10);
  if (!Number.isFinite(raw) || raw < 0 || raw >= PALETTES.length) return 0;
  return raw as PaletteIdx;
}

export function PaletteDropdown() {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState<PaletteIdx>(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = readSavedIdx();
    setIdx(saved);
    applyPalette(saved);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function selectPalette(next: PaletteIdx) {
    setIdx(next);
    applyPalette(next);
    window.localStorage.setItem(STORAGE_KEY, String(next));
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative" data-palette-menu-root>
      <button
        id="js-palette-trigger"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="js-palette-menu"
        aria-label="Cambia palette accent (apri menu)"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="inline-flex h-9 items-center gap-1.5 rounded-control border border-border px-2 transition hover:bg-accent hover:border-foreground/30"
      >
        <span className="flex gap-0.5">
          {([1, 2, 3, 4] as const).map((n) => (
            <span key={n} className={`h-4 w-4 rounded-sm bg-palette-${n}`} />
          ))}
        </span>
        <svg data-palette-chevron className="h-3.5 w-3.5 text-muted-foreground transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <div
        id="js-palette-menu"
        role="listbox"
        aria-label="Palette disponibili"
        hidden={!open}
        className="absolute right-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-card border border-border bg-card shadow-card"
      >
        <div className="border-b border-border bg-muted/30 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Accent palette
        </div>
        <ul className="py-1">
          {PALETTES.map((p, i) => {
            const selected = i === idx;
            return (
              <li key={p.name}>
                <button
                  role="option"
                  type="button"
                  aria-selected={selected}
                  onClick={() => selectPalette(i as PaletteIdx)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-accent"
                >
                  <span className="flex gap-0.5 shrink-0">
                    {p.vars.map((v, k) => (
                      <span key={k} className="h-4 w-4 rounded-sm" style={{ background: `hsl(${v})` }} />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1 text-xs font-medium text-foreground">{p.name}</span>
                  <svg className={`h-3.5 w-3.5 shrink-0 text-primary ${selected ? "" : "hidden"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
